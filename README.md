# Claude Shell

A small, fast desktop client for the `claude` CLI — built for the Claude Code subscription on Windows and macOS.

It wraps the interactive `claude` binary in a real terminal (xterm.js + ConPTY/forkpty), adds tabs, persistent sessions, a system tray, idle-notifications, and an auto-updater. No Anthropic API key, no SDK calls — it talks to whatever `claude` CLI you already have logged in.

![status](https://img.shields.io/badge/status-pre--alpha-orange)

## Install

Grab the latest installer from the [Releases page](https://github.com/sx-motive/claude-shell/releases/latest):

- **Windows** — `Claude.Shell_*_x64-setup.exe`
- **macOS** — `Claude.Shell_*_universal.dmg`

Installers are unsigned (personal-scale project) so first launch will show SmartScreen / Gatekeeper warnings — choose "Run anyway" / right-click → Open.

After install, subsequent versions install themselves on launch via the built-in updater.

## Requirements

- The official `claude` CLI installed and logged in (`claude` should run from your shell). On first launch you can point Claude Shell at a custom path in Settings if needed.

## What you get

- Tabs with per-tab session state
- Recent-sessions picker (reads `~/.claude/projects/*.jsonl`)
- System tray + notifications when Claude finishes while the window is unfocused
- WebGL terminal renderer
- Auto-update from signed GitHub Releases

## Build from source

Requires Node 20+ and Rust stable.

```bash
npm ci
npm run tauri:dev
```

Production builds run on the OS they target — no cross-compilation.

## License

MIT
