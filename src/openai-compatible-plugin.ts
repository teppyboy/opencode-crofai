import type { Plugin } from '@opencode-ai/plugin';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { log, initLogger } from './logger.js';

const AbortController = globalThis.AbortController;
const setTimeout = globalThis.setTimeout;
const clearTimeout = globalThis.clearTimeout;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_PROVIDER_NPM = '@ai-sdk/openai-compatible';
const DEFAULT_MODEL_ENDPOINT = '/models';
const DEFAULT_CONTEXT_LIMIT = 202752;
const DEFAULT_OUTPUT_LIMIT = 202752;
const VARIANT_SUFFIX_PATTERN = /-(lightning|precision|flash|turbo|extended|plus|pro|max|ultra)$/i;

export interface OpenAICompatibleModel {
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

interface OpenAICompatiblePluginConfig {
  providerID: string;
  providerName: string;
  baseURL: string;
  authLabel: string;
  authPlaceholder: string;
  authPromptMessage: string;
  cacheFileName?: string;
  providerNpm?: string;
  modelEndpointPath?: string;
  fetchTimeoutMs?: number;
  defaultFamily?: string;
  defaultContextLimit?: number;
  defaultOutputLimit?: number;
  buildDisplayName?: (model: OpenAICompatibleModel) => string;
  getVariants?: (
    model: OpenAICompatibleModel
  ) => Record<string, Record<string, string>> | undefined;
}

interface ModelCachePayload {
  fetchedAt: string;
  models: OpenAICompatibleModel[];
}

function getOpenCodeCacheDirectory(): string {
  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  if (xdgCacheHome) {
    return join(xdgCacheHome, 'opencode');
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, 'opencode');
  }

  return join(homedir(), '.cache', 'opencode');
}

export function buildVariantDisplayName(model: OpenAICompatibleModel): string {
  const variantMatch = model.id.match(VARIANT_SUFFIX_PATTERN);
  const variantLabel = variantMatch ? variantMatch[1].toLowerCase() : '';
  const nameAlreadyHasVariant =
    variantLabel !== '' && new RegExp(`(?:\\s|\\()${variantLabel}\\)?$`, 'i').test(model.name);

  if (!variantMatch || nameAlreadyHasVariant) {
    return model.name;
  }

  return `${model.name} ${variantMatch[1].charAt(0).toUpperCase() + variantMatch[1].slice(1)}`;
}

export function createReasoningVariants(
  model: OpenAICompatibleModel
): Record<string, Record<string, string>> | undefined {
  const supportsReasoning = Boolean(model.custom_reasoning || model.reasoning_effort);
  if (!supportsReasoning) {
    return undefined;
  }

  return {
    low: { reasoning_effort: 'low' },
    medium: { reasoning_effort: 'medium' },
    high: { reasoning_effort: 'high' },
  };
}

export function createOpenAICompatiblePlugin(config: OpenAICompatiblePluginConfig): Plugin {
  const providerNpm = config.providerNpm ?? DEFAULT_PROVIDER_NPM;
  const cacheFileName = config.cacheFileName ?? `${config.providerID}-models.json`;
  const fetchTimeoutMs = config.fetchTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const modelEndpointPath = config.modelEndpointPath ?? DEFAULT_MODEL_ENDPOINT;
  const defaultFamily = config.defaultFamily ?? 'unknown';
  const defaultContextLimit = config.defaultContextLimit ?? DEFAULT_CONTEXT_LIMIT;
  const defaultOutputLimit = config.defaultOutputLimit ?? DEFAULT_OUTPUT_LIMIT;
  const buildDisplayName = config.buildDisplayName ?? buildVariantDisplayName;
  const getVariants = config.getVariants ?? createReasoningVariants;
  const logPrefix = `[${config.providerName} Plugin]`;

  return async (input: any) => {
    await initLogger(input.client);
    log(`${logPrefix} Plugin initializing...`);

    const cacheFile = join(getOpenCodeCacheDirectory(), '.cache', cacheFileName);
    let modelRefreshPromise: Promise<void> | null = null;

    const readModelCache = (): OpenAICompatibleModel[] | null => {
      if (!existsSync(cacheFile)) {
        return null;
      }

      try {
        const rawCache = readFileSync(cacheFile, 'utf8');
        const parsedCache = JSON.parse(rawCache) as Partial<ModelCachePayload>;

        if (!parsedCache.fetchedAt || !Array.isArray(parsedCache.models)) {
          return null;
        }

        const fetchedAt = Date.parse(parsedCache.fetchedAt);
        if (Number.isNaN(fetchedAt)) {
          return null;
        }

        return parsedCache.models;
      } catch (error) {
        log(
          `${logPrefix} Failed to read model cache: ${
            error instanceof Error ? error.toString() : String(error)
          }`
        );
        return null;
      }
    };

    const writeModelCache = (models: OpenAICompatibleModel[]) => {
      try {
        mkdirSync(dirname(cacheFile), { recursive: true });
        writeFileSync(
          cacheFile,
          JSON.stringify({ fetchedAt: new Date().toISOString(), models }, null, 2),
          'utf8'
        );
      } catch (error) {
        log(
          `${logPrefix} Failed to write model cache: ${
            error instanceof Error ? error.toString() : String(error)
          }`
        );
      }
    };

    const fetchModels = async (apiKey: string): Promise<OpenAICompatibleModel[]> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);

        const response = await globalThis.fetch(`${config.baseURL}${modelEndpointPath}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${config.providerName} models: ${response.status} ${response.statusText}`
          );
        }

        const data = (await response.json()) as { data: OpenAICompatibleModel[] };
        if (!data?.data || !Array.isArray(data.data)) {
          throw new Error("Invalid response format: missing 'data' array");
        }

        return data.data;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`${config.providerName} API request timed out`);
        }

        throw new Error(
          `Error fetching ${config.providerName} models: ${
            error instanceof Error ? error.toString() : String(error)
          }`
        );
      }
    };

    const buildModelRegistry = (models: OpenAICompatibleModel[]) => {
      const modelRegistry: Record<string, any> = {};

      for (const model of models) {
        log(`${logPrefix} Processing model: ${model.id}`);

        const inputMods = model.modalities?.input ?? ['text'];
        const outputMods = model.modalities?.output ?? ['text'];
        const supportsReasoning = Boolean(model.custom_reasoning || model.reasoning_effort);
        const variants = getVariants(model);

        log(
          `${logPrefix} Model ${model.id}: supportsReasoning=${supportsReasoning}, variants=${JSON.stringify(variants)}`
        );

        modelRegistry[model.id] = {
          id: model.id,
          providerID: config.providerID,
          api: {
            id: model.id,
            url: config.baseURL,
            npm: providerNpm,
          },
          name: buildDisplayName(model),
          family: model.family ?? defaultFamily,
          capabilities: {
            temperature: true,
            reasoning: supportsReasoning,
            attachment: inputMods.includes('image') || inputMods.includes('pdf'),
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
          limit: {
            context: model.context_length || defaultContextLimit,
            output: model.max_completion_tokens || defaultOutputLimit,
          },
          status: 'active' as const,
          options: {},
          headers: {},
          release_date: new Date().toISOString(),
          ...(variants ? { variants } : {}),
        };
      }

      return modelRegistry;
    };

    return {
      config: async (outputConfig: any) => {
        log(`${logPrefix} Config hook called - registering provider`);
        outputConfig.provider = outputConfig.provider || {};
        outputConfig.provider[config.providerID] = {
          npm: providerNpm,
          name: config.providerName,
          options: {
            baseURL: config.baseURL,
          },
          models: {},
        };
        log(`${logPrefix} Provider registered in config`);
      },

      provider: {
        id: config.providerID,
        async models(_provider: any, ctx: any) {
          log(`${logPrefix} Provider hook - models() called`);

          const apiKey = ctx.auth?.key ?? '';
          if (!apiKey) {
            log(`${logPrefix} No auth found, skipping model registration`);
          }

          const fetchAndCacheModels = async () => {
            const fetchedModels = await fetchModels(apiKey);
            writeModelCache(fetchedModels);
            return fetchedModels;
          };

          const refreshModelsInBackground = () => {
            if (modelRefreshPromise) {
              return;
            }

            modelRefreshPromise = fetchAndCacheModels()
              .then((fetchedModels) => {
                log(`${logPrefix} Refreshed cached model list (${fetchedModels.length} models)`);
              })
              .catch((error) => {
                log(
                  `${logPrefix} Background model refresh failed: ${
                    error instanceof Error ? error.toString() : String(error)
                  }`
                );
              })
              .finally(() => {
                modelRefreshPromise = null;
              });
          };

          const cachedModels = readModelCache();
          const models = cachedModels
            ? (() => {
                log(`${logPrefix} Using cached model list (${cachedModels.length} models)`);
                refreshModelsInBackground();
                return cachedModels;
              })()
            : await fetchAndCacheModels();

          log(`${logPrefix} Retrieved ${models.length} available ${config.providerName} models`);
          const modelRegistry = buildModelRegistry(models);
          log(
            `${logPrefix} Model registry created with ${Object.keys(modelRegistry).length} models`
          );
          return modelRegistry;
        },
      },

      'chat.params': async (chatInput: any, output: any) => {
        log(`${logPrefix} chat.params called`);
        log(
          `${logPrefix} chat.params input: model=${chatInput.model?.id}, providerID=${chatInput.model?.providerID}`
        );
        log(
          `${logPrefix} chat.params message variant: ${JSON.stringify(chatInput.message?.variant)}`
        );
        log(
          `${logPrefix} chat.params model variants: ${JSON.stringify(chatInput.model?.variants)}`
        );
        log(`${logPrefix} chat.params output.options (before): ${JSON.stringify(output.options)}`);
      },

      auth: {
        provider: config.providerID,
        methods: [
          {
            type: 'api',
            label: config.authLabel,
            prompts: [
              {
                type: 'text',
                key: 'key',
                message: config.authPromptMessage,
                placeholder: config.authPlaceholder,
              },
            ],
          },
        ],
        async loader(getAuth, _provider) {
          log(`${logPrefix} Auth loader called`);
          const auth = await getAuth();
          log(`${logPrefix} Auth type:`, auth.type);
          const apiKey = auth.type === 'api' ? auth.key : '';

          return {
            apiKey,
            async fetch(fetchInput: any, init: any) {
              const headers = new Headers(init?.headers ?? {});
              headers.set('Authorization', `Bearer ${apiKey}`);
              return globalThis.fetch(fetchInput, { ...init, headers });
            },
          };
        },
      },
    };
  };
}
