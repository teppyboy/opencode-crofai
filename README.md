# @teppyboy/opencode-crofai

A plugin for OpenCode that seamlessly integrates with CrofAI's OpenAI‑compatible API, featuring automatic model discovery, Lightning model disambiguation, and a reasoning level toggle controlled by **Ctrl + T**.

## Features

- **Automatic Model Discovery**: Fetches all available models from CrofAI and registers them with OpenCode
- **Lightning Model Naming**: Models with IDs containing `-lightning` (e.g., `kimi-k2.5-lightning`) are displayed as `<DisplayName> Lightning` to distinguish them from the non‑lightning version
- **Reasoning Level Toggle**: Use the built‑in **Ctrl + T** shortcut to cycle through four reasoning levels: `none`, `low`, `medium`, `high`
- **Optimized API Handling**: 30‑second timeout, proper error handling, and cost calculation
- **OpenAI‑Compatible**: Works seamlessly with CrofAI's OpenAI‑compatible API endpoint

## Installation

### Via npm (Recommended)

1. Install the plugin via npm:

```bash
bun install @teppyboy/opencode-crofai
```

2. Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@teppyboy/opencode-crofai"]
}
```

3. Add your CrofAI API key via the `/connect` command in OpenCode.

4. Restart OpenCode (or reload plugins) to activate the plugin.

### Via local development

1. Clone the repository:

```bash
git clone https://github.com/teppyboy/opencode-crofai.git
cd opencode-crofai
```

2. Build the package:

```bash
bun run build
```

3. Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./dist/index.js"]
}
```

## Usage

### Model Selection

After installation, all CrofAI models will appear in the `/models` command. Lightning models will have a distinct name:

```
Available Models:
  ├─ MoonshotAI: Kimi K2.5
  ├─ MoonshotAI: Kimi K2.5 Lightning
  ├─ Z.ai: GLM 5
  ├─ Z.ai: GLM 5 Lightning
  └─ ...
```

### Reasoning Level Toggle

Control the reasoning level using the built‑in **Ctrl + T** shortcut:

```
Press Ctrl+T to cycle through: none → low → medium → high → none
```

The plugin stores the current reasoning level in your project's `opencode.json`:

```json
{
  "crofai": {
    "reasoning": "medium"
  }
}
```

The reasoning level is automatically reflected in the system prompt when enabled.

### Configuration

You can also set the reasoning level directly in your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "crofai": {
    "reasoning": "high"
  }
}
```

## Architecture

The plugin uses OpenCode's plugin system to:

1. **Authenticate**: Uses the OpenCode `/connect` mechanism to store and retrieve API keys
2. **Fetch Models**: Calls CrofAI's `GET /v1/models` endpoint with a 30‑second timeout
3. **Register Models**: Injects model metadata into OpenCode's provider catalog with:
   - Correct display names (including Lightning suffix)
   - Reasoning flags (based on `custom_reasoning` or `reasoning_effort`)
   - Cost calculations (per 1M tokens)
   - Context length and max output tokens
   - Modalities information
4. **Reasoning Toggle**: Listens for the built‑in `reasoning.toggle` UI command (triggered by Ctrl + T) and cycles through the four levels
5. **System Prompt Injection**: Uses the `experimental.chat.system.transform` hook to add reasoning directives when enabled

## Testing

Run the test suite:

```bash
npm test
```

All tests are located in the `tests/` directory and use Vitest.

## Development

### Build

```bash
bun run build
```

### Test

```bash
bun test
```

### Lint

```bash
bun run lint
```

### Format

```bash
bun run format
```

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

## License

See the [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0

- Initial release
- Automatic model discovery from CrofAI
- Lightning model naming fix
- Reasoning level toggle via Ctrl + T
- Four reasoning levels: none, low, medium, high
- Optimized API handling with timeout and error handling
- Cost calculation support
- Full test coverage

## References

- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/)
- [OpenCode Config Documentation](https://opencode.ai/docs/config/)
- [CrofAI API Documentation](https://crof.ai/docs)
