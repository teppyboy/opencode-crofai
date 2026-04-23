# opencode-crofai

OpenCode plugin for CrofAI's OpenAI-compatible API.

## What it does

- registers CrofAI models from `GET /v1/models`
- caches model metadata in `.memory/crofai-models.json`
- uses cached models immediately on startup
- refreshes the cache in background
- falls back to cached models if the endpoint is unavailable
- normalizes variant names like `Lightning` and `Precision`

## Install

### Via a LLM

```text
Install the opencode-crofai plugin and configure it by following: https://raw.githubusercontent.com/teppyboy/opencode-crofai/main/installation.md
```

### Via OpenCode CLI

```bash
opencode plugin -g @tretrauit/opencode-crofai
```

Then run `/connect` in OpenCode and enter your CrofAI API key.

### `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@tretrauit/opencode-crofai"]
}
```

## Local development

```bash
git clone https://github.com/teppyboy/opencode-crofai
cd opencode-crofai
bun run build
```

Use this in `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./dist/index.js"]
}
```

## Forking

Reusable factory lives in `src/openai-compatible-plugin.ts`.

Create a thin wrapper like:

```ts
import { createOpenAICompatiblePlugin } from './openai-compatible-plugin.js';

export const ExamplePlugin = createOpenAICompatiblePlugin({
  providerID: 'example',
  providerName: 'ExampleAI',
  baseURL: 'https://example.com/v1',
  authLabel: 'API Key',
  authPlaceholder: 'example-...',
  authPromptMessage: 'Enter your ExampleAI API key',
  cacheFileName: 'example-models.json',
});
```

## Development

```bash
bun run build
bun test
bun run lint
bun run format
```

## Release

GitHub Actions can publish to npm automatically from tags.

Repository setup:

- add `NPM_TOKEN` to GitHub Actions secrets
- token must have publish access to `@tretrauit/opencode-crofai`

Release flow:

```bash
# bump package.json version first
git commit -am "chore: bump version to vX.Y.Z"
git tag vX.Y.Z
git push
git push --tags
```

Workflow behavior:

- triggers on tags matching `v*`
- verifies tag matches `package.json` version
- runs tests and build
- runs `npm pack --dry-run`
- publishes to npm

## Links

- OpenCode plugin docs: https://opencode.ai/docs/plugins/
- OpenCode config docs: https://opencode.ai/docs/config/
- CrofAI docs: https://crof.ai/docs

## License

See the [LICENSE](LICENSE) file for details.
