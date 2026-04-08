# opencode-crofai

A plugin for OpenCode that seamlessly integrates with CrofAI's OpenAI‑compatible API.

## Features

- **Automatic Model Discovery**: Fetches all available models from CrofAI and registers them with OpenCode
- **Lightning Model Naming**: Models with IDs containing `-lightning` (e.g., `kimi-k2.5-lightning`) are displayed as `<DisplayName> Lightning` to distinguish them from the non‑lightning version
- **Reasoning Level Toggle**: Use the built‑in **Ctrl + T** shortcut to cycle through four reasoning levels: `none`, `low`, `medium`, `high`
- **Optimized API Handling**: 30‑second timeout, proper error handling, and cost calculation

## Installation

### Via a LLM (recommended)

Paste this into any LLM agent (Claude Code, OpenCode, Cursor, etc.):

```
Install the opencode-crofai plugin and configure it by following: https://raw.githubusercontent.com/teppyboy/opencode-crofai/main/installation.md
```

### Via OpenCode CLI

1. Install the plugin via opencode:

```bash
opencode plugin -g @tretrauit/opencode-crofai
```

2. Add your CrofAI API key via the `/connect` command in OpenCode.

### Via local development

1. Clone the repository:

```bash
git clone https://github.com/teppyboy/opencode-crofai
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

For models where reasoning is supported, you can control the reasoning level using the built‑in **Ctrl + T** shortcut

## Logging

The plugin logs all activity to a file for debugging purposes when OpenCode is launched with the environment variable `OPENCODE_PLUGIN_CROFAI_DEBUG=1`. Logs are stored at:

```
C:\Users\<username>\.local\share\opencode\log\opencode-crofai\plugin-<date>.log
```

**On Windows:**

```
C:\Users\<username>\.local\share\opencode\log\opencode-crofai\plugin-2026-04-07-133736.log
```

**On Linux/macOS:**

```
~/.local/share/opencode/log/opencode-crofai/plugin-2026-04-07-133736.log
```

Each log entry includes a timestamp and detailed information about plugin operations, including:

- Plugin initialization
- Provider registration
- Model fetching and processing
- Configuration updates

Example log entry:

```
[2026-04-07T14:18:03.029Z] [CrofAI Plugin] Plugin initializing...
[2026-04-07T14:18:03.031Z] [CrofAI Plugin] Config hook called - registering provider
[2026-04-07T14:18:03.032Z] [CrofAI Plugin] Retrieved 10 available CrofAI models
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
4. **Reasoning Toggle**: Listens for the built‑in `reasoning.toggle` UI command (triggered by Ctrl + T) and cycles through the four levels
5. **System Prompt Injection**: Uses the `experimental.chat.system.transform` hook to add reasoning directives when enabled

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

## References

- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/)
- [OpenCode Config Documentation](https://opencode.ai/docs/config/)
- [CrofAI API Documentation](https://crof.ai/docs)
