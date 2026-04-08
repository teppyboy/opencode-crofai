import type { Plugin } from '@opencode-ai/plugin';
import { log, initLogger } from './logger.js';

// Global API declarations for Bun runtime
const AbortController = globalThis.AbortController;
const setTimeout = globalThis.setTimeout;
const clearTimeout = globalThis.clearTimeout;

export const CrofAIPlugin: Plugin = async (input: any) => {
  // Initialize logger (disabled by default - enable via DEBUG=1 env var)
  await initLogger(input.client);

  log('[CrofAI Plugin] Plugin initializing...');

  return {
    config: async (config: any) => {
      log('[CrofAI Plugin] Config hook called - registering provider');
      config.provider = config.provider || {};
      config.provider.crofai = {
        npm: '@ai-sdk/openai-compatible',
        name: 'CrofAI',
        options: {
          baseURL: 'https://crof.ai/v1',
        },
        models: {},
      };
      log('[CrofAI Plugin] Provider registered in config');
    },

    provider: {
      id: 'crofai',
      async models(_provider: any, ctx: any) {
        log('[CrofAI Plugin] Provider hook - models() called');

        const apiKey = ctx.auth?.key ?? '';
        if (!apiKey) {
          log('[CrofAI Plugin] No auth found, skipping model registration');
        }

        // Fetch CrofAI models
        const fetchModels = async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await globalThis.fetch('https://crof.ai/v1/models', {
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

            const data = (await response.json()) as { data: CrofAIModel[] };

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
        log(`[CrofAI Plugin] Retrieved ${models.length} available CrofAI models`);
        const modelRegistry: Record<string, any> = {};

        for (const model of models) {
          log(`[CrofAI Plugin] Processing model: ${model.id}`);
          const displayName = model.id.includes('-lightning')
            ? `${model.name} Lightning`
            : model.name;

          // Parse modalities into capabilities
          const inputMods = model.modalities?.input ?? ['text'];
          const outputMods = model.modalities?.output ?? ['text'];

          // Models with reasoning support expose low/medium/high variants.
          // OpenCode's Ctrl+T (variant_cycle) cycles through them and merges
          // the variant options into the API request automatically.
          const supportsReasoning = Boolean(model.custom_reasoning || model.reasoning_effort);
          const variants = supportsReasoning
            ? {
                low: { reasoning_effort: 'low' },
                medium: { reasoning_effort: 'medium' },
                high: { reasoning_effort: 'high' },
              }
            : undefined;
          log(
            `[CrofAI Plugin] Model ${model.id}: supportsReasoning=${supportsReasoning}, variants=${JSON.stringify(variants)}`
          );

          modelRegistry[model.id] = {
            id: model.id,
            providerID: 'crofai',
            api: {
              id: model.id,
              url: 'https://crof.ai/v1',
              npm: '@ai-sdk/openai-compatible',
            },
            name: displayName,
            family: model.family ?? 'unknown',
            capabilities: {
              temperature: true,
              reasoning: supportsReasoning,
              attachment: inputMods.includes('image') || inputMods.includes('pdf'),
              // Every model should be able to support tool calls now.
              toolcall: model.supports_tool_calls ?? true,
              input: {
                text: inputMods.includes('text'),
                audio: inputMods.includes('audio'),
                image: inputMods.includes('image'),
                video: inputMods.includes('video'),
                pdf: inputMods.includes('pdf'),
              },
              output: {
                text: outputMods.includes('text'),
                audio: outputMods.includes('audio'),
                image: outputMods.includes('image'),
                video: outputMods.includes('video'),
                pdf: outputMods.includes('pdf'),
              },
              interleaved: false,
            },
            cost: {
              input: model.pricing ? parseFloat(model.pricing.prompt) * 1000000 : 0,
              output: model.pricing ? parseFloat(model.pricing.completion) * 1000000 : 0,
              cache: {
                read: model.pricing?.cache_prompt
                  ? parseFloat(model.pricing.cache_prompt) * 1000000
                  : 0,
                write: 0,
              },
            },
            // 202752 because of Z.ai GLM-5.1 and defined "OpenCode Integration" https://crof.ai/docs
            limit: {
              context: model.context_length || 202752,
              output: model.max_completion_tokens || 202752,
            },
            status: 'active' as const,
            options: {},
            headers: {},
            release_date: new Date().toISOString(),
            ...(variants ? { variants } : {}),
          };
        }

        log(
          `[CrofAI Plugin] Model registry created with ${Object.keys(modelRegistry).length} models`
        );
        return modelRegistry;
      },
    },

    'chat.params': async (input: any, output: any) => {
      log('[CrofAI Plugin] chat.params called');
      log(
        `[CrofAI Plugin] chat.params input: model=${input.model?.id}, providerID=${input.model?.providerID}`
      );
      log(`[CrofAI Plugin] chat.params message variant: ${JSON.stringify(input.message?.variant)}`);
      log(`[CrofAI Plugin] chat.params model variants: ${JSON.stringify(input.model?.variants)}`);
      log(`[CrofAI Plugin] chat.params output.options (before): ${JSON.stringify(output.options)}`);
    },

    auth: {
      provider: 'crofai',
      methods: [
        {
          type: 'api',
          label: 'API Key',
          prompts: [
            {
              type: 'text',
              key: 'key',
              message: 'Enter your CrofAI API key',
              placeholder: 'crof-...',
            },
          ],
        },
      ],
      async loader(getAuth, _provider) {
        log('[CrofAI Plugin] Auth loader called');
        const auth = await getAuth();
        log('[CrofAI Plugin] Auth type:', auth.type);
        const apiKey = auth.type === 'api' ? auth.key : '';

        return {
          apiKey,
          async fetch(input: any, init: any) {
            const headers = new Headers(init?.headers ?? {});
            headers.set('Authorization', `Bearer ${apiKey}`);
            return globalThis.fetch(input, { ...init, headers });
          },
        };
      },
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
  supports_tool_calls?: boolean;
}
