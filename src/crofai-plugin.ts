import { createOpenAICompatiblePlugin } from './openai-compatible-plugin.js';

export const CrofAIPlugin = createOpenAICompatiblePlugin({
  providerID: 'crofai',
  providerName: 'CrofAI',
  baseURL: 'https://crof.ai/v1',
  authLabel: 'API Key',
  authPlaceholder: 'crof-...',
  authPromptMessage: 'Enter your CrofAI API key',
  cacheFileName: 'crofai-models.json',
  defaultContextLimit: 202752,
  defaultOutputLimit: 202752,
});
