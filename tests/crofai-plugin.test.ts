import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

// Mock the logger before importing the plugin
vi.mock('../src/logger.ts', () => ({
  log: vi.fn(),
  initLogger: vi.fn().mockResolvedValue(undefined),
}));

describe('CrofAI Plugin', () => {
  let mockGetAuth: ReturnType<typeof vi.fn>;
  let mockClient: any;

  const createPluginInput = () => {
    const testDir = mkdtempSync(join(tmpdir(), 'opencode-crofai-test-'));
    const cacheHome = join(testDir, 'cache-home');
    const cachePath = join(cacheHome, 'opencode', '.cache', 'crofai-models.json');
    const previousXdgCacheHome = process.env.XDG_CACHE_HOME;

    process.env.XDG_CACHE_HOME = cacheHome;

    return {
      input: {
        project: { name: 'test-project' },
        client: mockClient,
        $: {} as any,
        directory: testDir,
        worktree: testDir,
      },
      testDir,
      cachePath,
      cleanup: () => {
        if (previousXdgCacheHome === undefined) {
          delete process.env.XDG_CACHE_HOME;
        } else {
          process.env.XDG_CACHE_HOME = previousXdgCacheHome;
        }

        rmSync(testDir, { recursive: true, force: true });
      },
    };
  };

  beforeEach(() => {
    mockGetAuth = vi.fn().mockResolvedValue({
      type: 'api' as const,
      key: 'test-api-key',
    });

    mockClient = {
      app: {
        log: vi.fn(),
      },
    };

    vi.clearAllMocks();
  });

  it('should register models with correct display names', async () => {
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
      {
        id: 'glm-5.1',
        name: 'Z.ai: GLM-5.1',
        family: 'Zhipu AI',
        custom_reasoning: true,
        reasoning_effort: true,
        context_length: 202752,
        max_completion_tokens: 202752,
        pricing: {
          prompt: '0.00000048',
          completion: '0.00000190',
        },
      },
      {
        id: 'glm-5.1-precision',
        name: 'Z.ai: GLM-5.1',
        family: 'Zhipu AI',
        custom_reasoning: true,
        reasoning_effort: true,
        context_length: 202752,
        max_completion_tokens: 202752,
        pricing: {
          prompt: '0.00000096',
          completion: '0.00000380',
        },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const provider = {} as any;
      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      const models = await plugin.provider.models(provider, ctx);

      // Correct display names
      expect(models['kimi-k2.5-lightning'].name).toBe('MoonshotAI: Kimi K2.5 Lightning');
      expect(models['kimi-k2.5'].name).toBe('MoonshotAI: Kimi K2.5');
      expect(models['glm-5'].name).toBe('Z.ai: GLM 5');
      expect(models['glm-5.1'].name).toBe('Z.ai: GLM-5.1');
      expect(models['glm-5.1-precision'].name).toBe('Z.ai: GLM-5.1 Precision');

      // Capabilities
      expect(models['kimi-k2.5-lightning'].capabilities.reasoning).toBe(true);
      expect(models['kimi-k2.5'].capabilities.reasoning).toBe(true);
      expect(models['glm-5'].capabilities.reasoning).toBe(false);

      // API config
      expect(models['kimi-k2.5'].api.id).toBe('kimi-k2.5');
      expect(models['kimi-k2.5'].api.url).toBe('https://crof.ai/v1');
      expect(models['kimi-k2.5'].api.npm).toBe('@ai-sdk/openai-compatible');
      expect(models['kimi-k2.5'].providerID).toBe('crofai');

      // Limits
      expect(models['kimi-k2.5'].limit.context).toBe(262144);
      expect(models['kimi-k2.5'].limit.output).toBe(262144);

      // Cost
      expect(models['kimi-k2.5'].cost.input).toBe(0.35);
      expect(models['kimi-k2.5'].cost.output).toBeCloseTo(1.8, 10);
    } finally {
      cleanup();
    }
  });

  it('should not duplicate variant suffix already present in model name', async () => {
    const mockModels = [
      {
        id: 'glm-4.7',
        name: 'Z.AI: GLM 4.7',
        custom_reasoning: false,
        reasoning_effort: false,
        context_length: 202752,
        max_completion_tokens: 202752,
      },
      {
        id: 'glm-4.7-flash',
        name: 'Z.AI: GLM 4.7 Flash',
        custom_reasoning: false,
        reasoning_effort: false,
        context_length: 131072,
        max_completion_tokens: 65536,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      const models = await plugin.provider.models({} as any, ctx);

      // Variant suffix not duplicated when already in name
      expect(models['glm-4.7-flash'].name).toBe('Z.AI: GLM 4.7 Flash');
      expect(models['glm-4.7'].name).toBe('Z.AI: GLM 4.7');
    } finally {
      cleanup();
    }
  });

  it('should not duplicate parenthesized variant suffixes already present in model name', async () => {
    const mockModels = [
      {
        id: 'kimi-k2.5-lightning',
        name: 'MoonshotAI: Kimi K2.5 (Lightning)',
        custom_reasoning: true,
        reasoning_effort: true,
        context_length: 131072,
        max_completion_tokens: 32768,
      },
      {
        id: 'glm-5.1-precision',
        name: 'Z.ai: GLM 5.1 (Precision)',
        custom_reasoning: true,
        reasoning_effort: true,
        context_length: 202752,
        max_completion_tokens: 202752,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      const models = await plugin.provider.models({} as any, ctx);

      expect(models['kimi-k2.5-lightning'].name).toBe('MoonshotAI: Kimi K2.5 (Lightning)');
      expect(models['glm-5.1-precision'].name).toBe('Z.ai: GLM 5.1 (Precision)');
    } finally {
      cleanup();
    }
  });

  it('should expose reasoning variants for models that support reasoning', async () => {
    const mockModels = [
      {
        id: 'kimi-k2.5',
        name: 'MoonshotAI: Kimi K2.5',
        custom_reasoning: false,
        reasoning_effort: true,
        context_length: 262144,
        max_completion_tokens: 262144,
      },
      {
        id: 'kimi-k2.5-lightning',
        name: 'MoonshotAI: Kimi K2.5',
        custom_reasoning: true,
        reasoning_effort: true,
        context_length: 131072,
        max_completion_tokens: 32768,
      },
      {
        id: 'glm-5',
        name: 'Z.ai: GLM 5',
        custom_reasoning: false,
        reasoning_effort: false,
        context_length: 202752,
        max_completion_tokens: 202752,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      const models = await plugin.provider.models({} as any, ctx);

      // Reasoning-capable models have low/medium/high variants
      expect(models['kimi-k2.5'].variants).toBeDefined();
      expect(models['kimi-k2.5'].variants.low).toEqual({ reasoning_effort: 'low' });
      expect(models['kimi-k2.5'].variants.medium).toEqual({ reasoning_effort: 'medium' });
      expect(models['kimi-k2.5'].variants.high).toEqual({ reasoning_effort: 'high' });

      expect(models['kimi-k2.5-lightning'].variants).toBeDefined();
      expect(models['kimi-k2.5-lightning'].variants.low).toEqual({ reasoning_effort: 'low' });

      // Non-reasoning model has no variants
      expect(models['glm-5'].variants).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('should handle fetch errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      await expect(plugin.provider.models({} as any, ctx)).rejects.toThrow(
        'Failed to fetch CrofAI models: 401 Unauthorized'
      );
    } finally {
      cleanup();
    }
  });

  it('should use cached models immediately and refresh them in the background', async () => {
    const { input, cachePath, cleanup } = createPluginInput();

    mkdirSync(dirname(cachePath), { recursive: true });

    writeFileSync(
      cachePath,
      JSON.stringify(
        {
          fetchedAt: new Date().toISOString(),
          models: [
            {
              id: 'cached-model',
              name: 'Cached Model',
              context_length: 1024,
              max_completion_tokens: 512,
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'updated-model',
            name: 'Updated Model',
            context_length: 2048,
            max_completion_tokens: 1024,
          },
        ],
      }),
    });

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      const models = await plugin.provider.models({} as any, ctx);

      expect(models['cached-model'].name).toBe('Cached Model');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      for (let attempt = 0; attempt < 10; attempt++) {
        const cachedPayload = JSON.parse(readFileSync(cachePath, 'utf8')) as {
          models: Array<{ id: string }>;
        };

        if (cachedPayload.models[0].id === 'updated-model') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const cachedPayload = JSON.parse(readFileSync(cachePath, 'utf8')) as {
        models: Array<{ id: string }>;
      };

      expect(cachedPayload.models[0].id).toBe('updated-model');
    } finally {
      cleanup();
    }
  });

  it('should write fetched models to cache', async () => {
    const mockModels = [
      {
        id: 'kimi-k2.5',
        name: 'MoonshotAI: Kimi K2.5',
        context_length: 262144,
        max_completion_tokens: 262144,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    const { input, cachePath, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      await plugin.provider.models({} as any, ctx);

      expect(existsSync(cachePath)).toBe(true);

      const cachedPayload = JSON.parse(readFileSync(cachePath, 'utf8')) as {
        fetchedAt: string;
        models: Array<{ id: string }>;
      };

      expect(cachedPayload.fetchedAt).toBeTruthy();
      expect(cachedPayload.models[0].id).toBe('kimi-k2.5');
    } finally {
      cleanup();
    }
  });

  it('should fall back to stale cached models when fetch fails', async () => {
    const { input, cachePath, cleanup } = createPluginInput();

    mkdirSync(dirname(cachePath), { recursive: true });

    writeFileSync(
      cachePath,
      JSON.stringify(
        {
          fetchedAt: '2000-01-01T00:00:00.000Z',
          models: [
            {
              id: 'stale-model',
              name: 'Stale Model',
              context_length: 2048,
              max_completion_tokens: 1024,
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'test-api-key' } };
      const models = await plugin.provider.models({} as any, ctx);

      expect(models['stale-model'].name).toBe('Stale Model');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('should return models when auth key is provided via context', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
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

    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const ctx = { auth: { type: 'api' as const, key: 'env-api-key' } };
      const models = await plugin.provider.models({} as any, ctx);

      expect(models).toBeDefined();
      expect(models['kimi-k2.5']).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it('should inject crofai provider into config', async () => {
    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const cfg: any = {};
      await plugin.config?.(cfg);

      expect(cfg.provider?.crofai).toBeDefined();
      expect(cfg.provider.crofai.options?.baseURL).toBe('https://crof.ai/v1');
      expect(cfg.provider.crofai.npm).toBe('@ai-sdk/openai-compatible');
    } finally {
      cleanup();
    }
  });

  it('should provide API key auth method in auth hook', async () => {
    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      expect(plugin.auth).toBeDefined();
      expect(plugin.auth?.provider).toBe('crofai');
      expect(plugin.auth?.methods).toHaveLength(1);
      expect(plugin.auth?.methods[0].type).toBe('api');
    } finally {
      cleanup();
    }
  });

  it('should inject Authorization header in auth loader', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const { input, cleanup } = createPluginInput();

    try {
      const { CrofAIPlugin } = await import('../src/index.ts');
      const plugin = await CrofAIPlugin(input);

      const result = await plugin.auth!.loader!(mockGetAuth, {} as any);

      expect(result.apiKey).toBe('test-api-key');

      // Make a request through the fetch wrapper
      await result.fetch('https://example.com', {});
      const calledHeaders = new Headers((globalThis.fetch as any).mock.calls[0][1].headers);
      expect(calledHeaders.get('Authorization')).toBe('Bearer test-api-key');
    } finally {
      cleanup();
    }
  });
});
