# opencode-content-filter

OpenCode TUI plugin that makes provider content-filter finishes visible instead of leaving an apparently silent empty assistant turn.

## Install

```bash
opencode plugin opencode-content-filter -g
```

This installs the package globally and updates your `tui.json` automatically.

Or manually:

```bash
npm install -g opencode-content-filter
```

Then add to your `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-content-filter"]
}
```

## Usage

The plugin watches assistant messages in the active TUI session. When a provider returns `finish: "content-filter"` without visible text, it shows an error toast naming the model that was blocked.

You can also run:

```text
/content-filter
```

This shows the most recent content-filtered response in the current session.

## Limitations

This is a TUI visibility plugin. The current OpenCode plugin API does not expose a server-side hook for mutating the persisted assistant `message.error` after a model stream finishes. For CLI, SDK, and persistent transcript behavior, OpenCode core should still surface `content-filter` finish reasons as errors.

## License

MIT
