# Install @tretrauit/opencode-crofai

These instructions are designed for AI coding agents.

## Prerequisites

Before installing, verify you have OpenCode installed.

### Check OpenCode version

```bash
opencode --version
```

You should see a version number (e.g., `1.2.28`).

## Installation

### Step 1: Add to OpenCode configuration

Edit the OpenCode configuration file at `~/.config/opencode/opencode.json`.

Add `@tretrauit/opencode-crofai` to the `plugin` array:

```json
{
  "plugin": ["@tretrauit/opencode-crofai"]
}
```

Or run this command to do it automatically:

```bash
node -e "
const fs = require('fs'), p = require('path').join(require('os').homedir(), '.config/opencode/opencode.json');
const c = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf8')) : {};
c.plugin = [...new Set([...(Array.isArray(c.plugin) ? c.plugin : []), '@tretrauit/opencode-crofai'])];
fs.mkdirSync(require('path').dirname(p), {recursive:true});
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Added @tretrauit/opencode-crofai to', p);
"
```

No manual `npm install` is needed — OpenCode [automatically installs npm plugins using Bun at startup](https://opencode.ai/docs/plugins/#how-plugins-are-installed).

### Step 2: Verification

Verify the plugin was added:

```bash
cat ~/.config/opencode/opencode.json
```

You should see `@tretrauit/opencode-crofai` in the `plugin` array.

## Done

The plugin is now installed and configured.

## Troubleshooting

If you encounter issues, see the [main README troubleshooting section](README.md#troubleshooting).
