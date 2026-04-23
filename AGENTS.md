# AGENTS.md

## Build & Test Commands

- **Build**: `bun run build` or `bun build ./src/index.ts --outdir dist --target bun`
- **Test**: `bun test` or `bun test`
- **Single Test**: `bun test tests/crofai-plugin.test.ts` (use file glob pattern)
- **Watch Mode**: `bun test --watch`
- **Lint**: `bun run lint` (eslint)
- **Format**: `bun run format` (prettier)

## Code Style Guidelines

### Imports & Module System

- Use ES6 `import`/`export` syntax (module: "ESNext", type: "module")
- Group imports: external libraries first, then internal modules
- Use explicit file extensions (`.ts`) for internal imports

### Formatting (Prettier)

- **Single quotes** (`singleQuote: true`)
- **Line width**: 100 characters
- **Tab width**: 2 spaces
- **Trailing commas**: ES5 (no trailing commas in function parameters)
- **Semicolons**: enabled

### TypeScript & Naming

- **NeverNesters**: avoid deeply nested structures. Always exit early.
- **Strict mode**: enforced (`"strict": true`)
- **Classes**: PascalCase (e.g., `BackgroundTask`, `BackgroundTaskManager`)
- **Methods/properties**: camelCase
- **Status strings**: use union types (e.g., `'pending' | 'running' | 'completed' | 'failed' | 'cancelled'`)
- **Explicit types**: prefer explicit type annotations over inference
- **Return types**: optional (not required but recommended for public methods)

### Error Handling

- Check error type before accessing error properties: `error instanceof Error ? error.toString() : String(error)`
- Log errors with `[ERROR]` prefix for consistency
- Always provide error context when recording output

### Linting Rules

- `@typescript-eslint/no-explicit-any`: warn (avoid `any` type)
- `no-console`: error (minimize console logs)
- `prettier/prettier`: error (formatting violations are errors)

## Testing

- Framework: **vitest** with `describe` & `it` blocks
- Style: Descriptive nested test cases with clear expectations
- Assertion library: `expect()` (vitest)

## Memory

- Store temporary data in `.memory/` directory (gitignored)

## Project Context

- **Type**: ES Module package for Bun modules
- **Target**: Bun runtime, ES2021+
- **Purpose**: OpenCode plugin for CrofAI integration, with reusable OpenAI-compatible provider factory for forks

## CrofAI Integration Plugin

### Overview

A plugin that connects OpenCode to CrofAI's OpenAI-compatible API. It automatically discovers available models, caches them for fast startup, refreshes the cache in background, and distinguishes model variants like Lightning and Precision without duplicate suffixes.

### Installation

Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@tretrauit/opencode-crofai"]
}
```

OpenCode will fetch the package from npm at startup and install it with Bun.

### Configuration

Connect the provider in OpenCode with `/connect` and enter your CrofAI API key.

For local development, point OpenCode at the built plugin:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./dist/index.js"]
}
```

### Current Behavior

- Model list fetched from `GET /v1/models`
- Model cache stored in `.memory/crofai-models.json`
- Cached models used immediately on startup when available
- Cache refreshed in background on startup
- Cached models continue to work if the endpoint is unavailable
- Reasoning-capable models expose `low`, `medium`, and `high` variants

### Model Naming Fix

Models with variant suffixes like `-lightning`, `-precision`, and `-flash` have normalized display names without duplicate suffixes. Example: `kimi-k2.5-lightning` stays `MoonshotAI: Kimi K2.5 (Lightning)` if provider metadata already includes `(Lightning)`.

### Architecture

- `src/crofai-plugin.ts` - CrofAI-specific wrapper config
- `src/openai-compatible-plugin.ts` - reusable OpenAI-compatible provider factory
- `src/logger.ts` - optional debug logger

Factory exports available from `src/index.ts`:

- `createOpenAICompatiblePlugin`
- `buildVariantDisplayName`
- `createReasoningVariants`
- `OpenAICompatibleModel` type

Forking another provider should usually mean creating a thin wrapper similar to `src/crofai-plugin.ts` with a different `providerID`, `providerName`, `baseURL`, auth prompt, and cache file name.

### Development

Run `bun test` for the test suite located in `tests/`. Build with `bun run build`.

### References

- OpenCode plugin docs: https://opencode.ai/docs/plugins/
- CrofAI API docs: https://crof.ai/docs (model list, reasoning support)
