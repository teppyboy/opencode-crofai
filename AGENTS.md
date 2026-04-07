# AGENTS.md

## Build & Test Commands

- **Build**: `bun run build` or `bun build ./src/index.ts --outdir dist --target bun`
- **Test**: `bun test` or `bun test`
- **Single Test**: `bun test tests/crofai-plugin.test.ts` (use file glob pattern)
- **Watch Mode**: `bun test --watch`
- **Lint**: `bun run lint` (eslint)
- **Fix Lint**: `bun run lint:fix` (eslint --fix)
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
- **Purpose**: OpenCode plugin for CrofAI integration

## CrofAI Integration Plugin

### Overview

A plugin that connects OpenCode to CrofAI's OpenAI‑compatible API. It automatically discovers available models, distinguishes Lightning variants, and respects the UI‑controlled reasoning level (Ctrl + T).

### Installation

Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@teppyboy/opencode-crofai"]
}
```

OpenCode will fetch the package from npm at startup and install it with Bun.

### Configuration

The plugin stores its settings under the `crofai` key:

```json
{
  "crofai": {
    "reasoning": "medium" // one of "none", "low", "medium", "high"
  }
}
```

The reasoning level is changed by the built‑in **Ctrl + T** shortcut; the plugin updates the above field automatically.

### Model Naming Fix

Models whose IDs contain `-lightning` are displayed as `<DisplayName> Lightning` (e.g., `kimi-k2.5-lightning` → "Kimi K2.5 Lightning") so they are not confused with the non‑Lightning counterpart.

### Hooks Implemented

- `auth.loader` – injects the CrofAI API key and registers models
- `experimental.chat.system.transform` – adds a note about the current reasoning level
- `tui.command.execute` – listens for the `reasoning.toggle` UI command (Ctrl + T) and cycles the level

### Development

Run `bun test` for the test suite located in `tests/`. Build with `bun run build`.

### References

- OpenCode plugin docs: https://opencode.ai/docs/plugins/
- CrofAI API docs: https://crof.ai/docs (model list, reasoning support)
