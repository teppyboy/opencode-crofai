import type { Plugin } from '@opencode-ai/plugin';

export const CrofAIPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    auth: {
      provider: 'crofai',
      async loader(getAuth, provider) {
        const auth = await getAuth();
        const apiKey = auth.type === 'api' ? auth.key : '';

        // Fetch CrofAI models with timeout handling
        const fetchModels = async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch('https://crof.ai/v1/models', {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(
                `Failed to fetch CrofAI models: ${response.status} ${response.statusText}`
              );
            }

            const data = (await response.json()) as CrofAIModel[];

            // Validate response structure
            if (!data?.data || !Array.isArray(data.data)) {
              throw new Error("Invalid response format: missing 'data' array");
            }

            return data.data;
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('CrofAI API request timed out');
            }
            throw new Error(
              `Error fetching CrofAI models: ${
                error instanceof Error ? error.toString() : String(error)
              }`
            );
          }
        };

        const models = await fetchModels();

        // Ensure provider.models exists
        if (!provider.models) {
          provider.models = {};
        }

        // Register models with display name fix for Lightning variants
        for (const model of models) {
          // Add "Lightning" suffix if the model ID contains "-lightning"
          const displayName = model.id.includes('-lightning')
            ? `${model.name} Lightning`
            : model.name;

          // Register the model in the provider's model catalog
          provider.models[model.id] = {
            id: model.id,
            name: displayName,
            family: model.family ?? 'unknown',
            reasoning: Boolean(model.custom_reasoning || model.reasoning_effort),
            modalities: model.modalities ?? { input: ['text'], output: ['text'] },
            limit: model.limit ?? {
              context: model.context_length || 128000,
              output: model.max_completion_tokens || 4096,
            },
            cost: model.pricing
              ? {
                  input: parseFloat(model.pricing.prompt) * 1000000,
                  output: parseFloat(model.pricing.completion) * 1000000,
                }
              : { input: 0, output: 0 },
            open_weights: model.open_weights ?? false,
          };
        }

        // Return request wrapper that injects the API key
        return {
          apiKey,
          async fetch(input, init) {
            const headers = new Headers(init?.headers ?? {});
            headers.set('Authorization', `Bearer ${apiKey}`);
            return fetch(input, { ...init, headers });
          },
        };
      },
    },

    command: {
      crofaiToggleThinking: {
        description: 'Toggle CrofAI reasoning mode on/off',
        args: {},
        async execute(_, ctx) {
          const cfgPath = `${directory}/opencode.json`;
          const cfg = await client.fs.readJson(cfgPath);
          const currentThinking = cfg?.crofai?.reasoning ?? 'none';

          // Cycle through levels: none → low → medium → high → none
          const levels = ['none', 'low', 'medium', 'high'] as const;
          const currentIndex = levels.indexOf(currentThinking as any);
          const nextIndex = (currentIndex + 1) % levels.length;
          const nextLevel = levels[nextIndex];

          cfg.crofai = { ...(cfg?.crofai ?? {}), reasoning: nextLevel };

          await client.fs.writeJson(cfgPath, cfg);

          client.app.log({
            level: 'info',
            body: {
              message: `CrofAI reasoning level set to "${nextLevel}"`,
            },
          });

          return `✅ Reasoning level ${nextLevel}`;
        },
      },
    },

    'experimental.chat.system.transform': async (input, output) => {
      const cfgPath = `${directory}/opencode.json`;
      const cfg = await client.fs.readJson(cfgPath);

      if (cfg?.crofai?.reasoning && cfg.crofai.reasoning !== 'none') {
        // Append a directive to use the model's reasoning capabilities
        output.system = `${output.system}

[NOTE] Use reasoning level "${cfg.crofai.reasoning}" for this request.`;
      }
    },

    // Listen for the built-in reasoning.toggle command (triggered by Ctrl+T)
    'tui.command.execute': async (input, output) => {
      if (input.command === 'reasoning.toggle') {
        const cfgPath = `${directory}/opencode.json`;
        const cfg = await client.fs.readJson(cfgPath);
        const currentThinking = cfg?.crofai?.reasoning ?? 'none';

        // Cycle through levels: none → low → medium → high → none
        const levels = ['none', 'low', 'medium', 'high'] as const;
        const currentIndex = levels.indexOf(currentThinking as any);
        const nextIndex = (currentIndex + 1) % levels.length;
        const nextLevel = levels[nextIndex];

        cfg.crofai = { ...(cfg?.crofai ?? {}), reasoning: nextLevel };

        await client.fs.writeJson(cfgPath, cfg);

        await client.app.log({
          level: 'info',
          body: {
            message: `CrofAI reasoning level set to "${nextLevel}"`,
          },
        });
      }
    },
  };
};

interface CrofAIModel {
  id: string;
  name: string;
  family?: string;
  custom_reasoning?: boolean;
  reasoning_effort?: boolean;
  modalities?: {
    input: string[];
    output: string[];
  };
  context_length?: number;
  max_completion_tokens?: number;
  pricing?: {
    prompt: string;
    completion: string;
    cache_prompt?: string;
  };
  open_weights?: boolean;
}
