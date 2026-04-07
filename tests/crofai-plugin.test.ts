import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CrofAI Plugin', () => {
  let mockGetAuth: ReturnType<typeof vi.fn>;
  let mockFs: ReturnType<typeof vi.fn>;
  let mockClient: any;

  beforeEach(() => {
    mockGetAuth = vi.fn().mockResolvedValue({
      type: 'api' as const,
      key: 'test-api-key',
    });

    mockFs = {
      readJson: vi.fn(),
      writeJson: vi.fn(),
    };

    mockClient = {
      app: {
        log: vi.fn(),
      },
      fs: mockFs,
    };

    vi.clearAllMocks();
  });

  it('should register models with correct display names', async () => {
    // Mock model data from CrofAI (realistic response structure)
    const mockModels = [
      {
        id: 'kimi-k2.5',
        name: 'MoonshotAI: Kimi K2.5',
        family: 'Moonshot AI',
        custom_reasoning: false,
        reasoning_effort: true,
        context_length: 262144,
        max_completion_tokens: 262144,
        pricing: {
          prompt: '0.00000035',
          completion: '0.00000180',
        },
      },
      {
        id: 'kimi-k2.5-lightning',
        name: 'MoonshotAI: Kimi K2.5',
        family: 'Moonshot AI',
        custom_reasoning: true,
        reasoning_effort: true,
        context_length: 131072,
        max_completion_tokens: 32768,
        pricing: {
          prompt: '0.0000025',
          completion: '0.000004',
        },
      },
      {
        id: 'glm-5',
        name: 'Z.ai: GLM 5',
        family: 'Zhipu AI',
        custom_reasoning: false,
        reasoning_effort: false,
        context_length: 202752,
        max_completion_tokens: 202752,
        pricing: {
          prompt: '0.00000048',
          completion: '0.00000190',
        },
      },
    ];

    // Mock fetch response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    // Mock fs for config operations
    mockFs.readJson.mockResolvedValue({});
    mockFs.writeJson.mockResolvedValue(undefined);

    // Import and run the plugin
    const { CrofAIPlugin } = await import('../src/index.ts');
    const plugin = await CrofAIPlugin({
      project: { name: 'test-project' },
      client: mockClient,
      $: {} as any,
      directory: '/test/project',
      worktree: '/test/worktree',
    });

    // Call the loader to trigger model fetching and populate models
    const provider = {} as any;
    await plugin.auth.loader(mockGetAuth, provider);

    // Check that models were added to the provider
    expect(provider.models).toBeDefined();
    expect(provider.models['kimi-k2.5-lightning']).toBeDefined();
    expect(provider.models['kimi-k2.5']).toBeDefined();
    expect(provider.models['glm-5']).toBeDefined();

    // Check Lightning model has "Lightning" suffix
    expect(provider.models['kimi-k2.5-lightning'].name).toBe('MoonshotAI: Kimi K2.5 Lightning');
    expect(provider.models['kimi-k2.5'].name).toBe('MoonshotAI: Kimi K2.5');
    expect(provider.models['glm-5'].name).toBe('Z.ai: GLM 5');

    // Verify reasoning flag is set correctly
    expect(provider.models['kimi-k2.5-lightning'].reasoning).toBe(true);
    expect(provider.models['kimi-k2.5'].reasoning).toBe(true);
    expect(provider.models['glm-5'].reasoning).toBe(false);

    // Verify context length and max tokens are set correctly
    expect(provider.models['kimi-k2.5'].limit.context).toBe(262144);
    expect(provider.models['kimi-k2.5'].limit.output).toBe(262144);

    // Verify cost calculations (pricing is per 1M tokens)
    expect(provider.models['kimi-k2.5'].cost.input).toBe(0.35);
    expect(provider.models['kimi-k2.5'].cost.output).toBeCloseTo(1.8, 10);
  });

  it('should toggle reasoning level via command', async () => {
    mockFs.readJson.mockResolvedValue({
      crofai: {
        reasoning: 'none',
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'kimi-k2.5',
            name: 'MoonshotAI: Kimi K2.5',
            custom_reasoning: false,
            context_length: 262144,
            max_completion_tokens: 262144,
          },
        ],
      }),
    });

    const { CrofAIPlugin } = await import('../src/index.ts');
    const plugin = await CrofAIPlugin({
      project: { name: 'test-project' },
      client: mockClient,
      $: {} as any,
      directory: '/test/project',
      worktree: '/test/worktree',
    });

    // Execute the toggle command
    await plugin.command.crofaiToggleThinking.execute({}, mockClient);

    // Verify config was updated
    expect(mockFs.writeJson).toHaveBeenCalledWith('/test/project/opencode.json', {
      crofai: {
        reasoning: 'low',
      },
    });

    // Verify log was called
    expect(mockClient.app.log).toHaveBeenCalledWith({
      level: 'info',
      body: {
        message: 'CrofAI reasoning level set to "low"',
      },
    });
  });

  it('should cycle reasoning level with Ctrl+T hook', async () => {
    mockFs.readJson.mockResolvedValue({
      crofai: {
        reasoning: 'medium',
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'kimi-k2.5',
            name: 'MoonshotAI: Kimi K2.5',
            custom_reasoning: false,
            context_length: 262144,
            max_completion_tokens: 262144,
          },
        ],
      }),
    });

    const { CrofAIPlugin } = await import('../src/index.ts');
    const plugin = await CrofAIPlugin({
      project: { name: 'test-project' },
      client: mockClient,
      $: {} as any,
      directory: '/test/project',
      worktree: '/test/worktree',
    });

    // Simulate Ctrl+T keybinding (reasoning.toggle command)
    await plugin['tui.command.execute']({ command: 'reasoning.toggle' }, {});

    // Verify config was updated to next level
    expect(mockFs.writeJson).toHaveBeenCalledWith('/test/project/opencode.json', {
      crofai: {
        reasoning: 'high',
      },
    });
  });

  it('should append reasoning note to system prompt when enabled', async () => {
    mockFs.readJson.mockResolvedValue({
      crofai: {
        reasoning: 'medium',
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'kimi-k2.5',
            name: 'MoonshotAI: Kimi K2.5',
            custom_reasoning: false,
            context_length: 262144,
            max_completion_tokens: 262144,
          },
        ],
      }),
    });

    const { CrofAIPlugin } = await import('../src/index.ts');
    const plugin = await CrofAIPlugin({
      project: { name: 'test-project' },
      client: mockClient,
      $: {} as any,
      directory: '/test/project',
      worktree: '/test/worktree',
    });

    // Execute the transform hook
    const input = {
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    };

    const output = {
      system: 'You are a helpful assistant.',
    };

    await plugin['experimental.chat.system.transform'](input, output);

    // Verify reasoning note was appended
    expect(output.system).toContain('[NOTE] Use reasoning level "medium" for this request.');
  });

  it('should handle fetch errors gracefully', async () => {
    mockGetAuth.mockResolvedValue({
      type: 'api' as const,
      key: 'test-api-key',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const { CrofAIPlugin } = await import('../src/index.ts');

    // Create plugin instance
    const plugin = await CrofAIPlugin({
      project: { name: 'test-project' },
      client: mockClient,
      $: {} as any,
      directory: '/test/project',
      worktree: '/test/worktree',
    });

    // Call the loader to trigger the error
    await expect(plugin.auth.loader(mockGetAuth, {} as any)).rejects.toThrow(
      'Failed to fetch CrofAI models: 401 Unauthorized'
    );
  });

  it('should handle API key from environment variable', async () => {
    mockGetAuth.mockResolvedValue({
      type: 'api' as const,
      key: 'env-api-key',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'kimi-k2.5',
            name: 'MoonshotAI: Kimi K2.5',
            custom_reasoning: false,
            context_length: 262144,
            max_completion_tokens: 262144,
          },
        ],
      }),
    });

    const { CrofAIPlugin } = await import('../src/index.ts');
    const plugin = await CrofAIPlugin({
      project: { name: 'test-project' },
      client: mockClient,
      $: {} as any,
      directory: '/test/project',
      worktree: '/test/worktree',
    });

    const provider = {} as any;
    await plugin.auth.loader(mockGetAuth, provider);

    expect(provider.models).toBeDefined();
  });

  it('should cycle through all four reasoning levels', async () => {
    const levels = ['none', 'low', 'medium', 'high'] as const;

    mockFs.readJson.mockResolvedValue({
      crofai: {
        reasoning: 'none',
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'kimi-k2.5',
            name: 'MoonshotAI: Kimi K2.5',
            custom_reasoning: false,
            context_length: 262144,
            max_completion_tokens: 262144,
          },
        ],
      }),
    });

    const { CrofAIPlugin } = await import('../src/index.ts');
    const plugin = await CrofAIPlugin({
      project: { name: 'test-project' },
      client: mockClient,
      $: {} as any,
      directory: '/test/project',
      worktree: '/test/worktree',
    });

    // Test each level
    for (let i = 0; i < levels.length; i++) {
      await plugin['tui.command.execute']({ command: 'reasoning.toggle' }, {});

      const expectedLevel = levels[(i + 1) % levels.length];
      expect(mockFs.writeJson).toHaveBeenCalledWith('/test/project/opencode.json', {
        crofai: {
          reasoning: expectedLevel,
        },
      });
    }
  });
});
