// Re-export the plugin for use by npm consumers
export { CrofAIPlugin } from './crofai-plugin.js';
export { CrofAIPlugin as default } from './crofai-plugin.js';
export {
  buildVariantDisplayName,
  createOpenAICompatiblePlugin,
  createReasoningVariants,
} from './openai-compatible-plugin.js';
export type { OpenAICompatibleModel } from './openai-compatible-plugin.js';
