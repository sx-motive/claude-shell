# claude-shell

A fast, minimal desktop client for Claude Code (and other CLI agents later).

## Why

The standard terminal experience around Claude Code on Windows is rough: no clipboard image paste, awkward selection, no system notifications when the assistant finishes, generic look. Existing alternatives (Warp, etc.) feel slow or bloated.

This is a personal-scale GUI client built around the agent, not a general-purpose terminal that happens to host one.

## Stack

- **Tauri 2** (Rust + system WebView) — small bundle, fast startup, low memory
- **React 19 + TypeScript + Vite**
- **Tailwind CSS 4** + **shadcn/ui**
- **SQLite** (`rusqlite`) for session persistence

## Platforms

Windows, macOS, Linux. Each binary is built on its native OS — cross-compilation is not supported by Tauri. CI (GitHub Actions) handles cross-platform release builds.

## Status

Pre-alpha. See [PLAN.md](./PLAN.md) for the iteration roadmap.
