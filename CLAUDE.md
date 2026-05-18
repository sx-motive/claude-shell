# claude-shell — agent instructions

Short, durable invariants for this repo.

## What this is

Desktop GUI client built around the **interactive** `claude` CLI. Architecture: PTY-hosted `claude` (xterm.js + portable-pty/ConPTY) on one side, and a side panel driven by **Claude Code hooks** on the other. Solo project. See [README.md](./README.md) for stack rationale.

## Anthropic billing-model cutover (2026-06-15)

Anthropic is changing how subscription vs. Agent-SDK-credit usage is metered. As of today (date stamp in `currentDate`), the technical signals that distinguish the two pools are **undocumented**. The architecture below is a reverse-engineered safe bet, not a guarantee.

After 2026-06-15, empirically verify with small known-cost runs which of the following are actually subscription-pool vs. SDK-credit-pool:

- Hooks installed by claude-shell.
- The `Task` tool (subagents) invoked from an interactive session.
- MCP tools invoked from an interactive session.
- Whether `claude`'s parent-process inspection flags custom terminals like ours.

If any of these turn out to be SDK-billed, gate them behind explicit opt-in with a visible cost warning. Until verified, treat hooks/Task/MCP as "probably subscription, but unconfirmed".

## Billing model invariant (NON-NEGOTIABLE)

claude-shell must operate **exclusively within the Claude subscription pool**. It must **never** touch the Agent SDK credit pool or the API billing pool. This is the load-bearing architectural constraint; every design decision is downstream of it.

**Allowed:**

- Spawn `claude` interactively in a real PTY. No flags that change input/output format.
- Use Claude Code hooks (`PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, `Notification`, `SubagentStop`).
- `claude --resume <id>` and `claude --continue` in PTY mode.
- Passive reads of `~/.claude/projects/<encoded-cwd>/*.jsonl` for session history.
- Idempotent reads/writes of `~/.claude/settings.json` to install/remove our hooks.

**Forbidden (each of these moves usage into the Agent SDK pool, confirmed by official docs):**

- `claude -p` or `--print` flag.
- `--output-format stream-json` or `--input-format stream-json`.
- Spawning `claude` with piped stdin/stdout instead of a PTY — the binary detects `isatty()` and switches to wrapper mode.
- Importing `claude-agent-sdk` (Python) or `@anthropic-ai/claude-agent-sdk` (TS/JS).
- Direct HTTP calls to `api.anthropic.com`.
- Setting `ANTHROPIC_API_KEY` for the child `claude` process — auth is the `claude` binary's responsibility, not ours.

Before merging any branch to master, run this grep — zero matches required:

```bash
git grep -nIE '(\-p\b|--print|--output-format|--input-format|stream-json|claude-agent-sdk|anthropic-ai/claude-agent-sdk|api\.anthropic\.com|ANTHROPIC_API_KEY)' -- ':!CLAUDE.md' ':!README.md' ':!package-lock.json' ':!src-tauri/Cargo.lock'
```

## Stack invariants

- **Tauri 2**, not Electron. Don't import Electron patterns (no `BrowserWindow`, no `ipcRenderer`, no Node APIs in the renderer).
  - Frontend ↔ Rust: `invoke('command_name', args)` for request/response, `emit` / `listen` for streaming events.
  - All Rust commands live behind `#[tauri::command]` and are registered in `tauri::generate_handler!`.
- **No cross-compilation.** Each platform binary is built on its native OS. Local dev = current OS only. Release builds happen in GitHub Actions.
- **React 19 + Vite + TS strict.** No legacy class components. SPA inside a WebView.
- **Tailwind 4** via the Vite plugin (not PostCSS config). shadcn/ui components are copy-pasted into `src/components/ui/`, not imported from a package.
- **PTY layer:** `portable-pty` crate in Rust (uses ConPTY on Windows, forkpty elsewhere). Frontend uses `xterm` + addons (`fit`, `web-links`, `search`).
- **Hooks transport:** in-process HTTP server on `127.0.0.1:<random port>`, per-launch shared secret. A tiny `hook-bridge` binary reads stdin from `claude` hooks and POSTs to the server.
- **Sessions data:** read from `~/.claude/projects/*/*.jsonl`. Don't build our own conversation database.

## Process

- **Feature branches.** Work happens on `iter-N-<slug>` or similar branches in the main working directory. Merge to `master` only after manual UX validation AND the billing-invariant grep is clean. Delete the branch after merge.
- **Manual checkpoint over automated tests.** Most validations are UX-level. Type checks and tests confirm code correctness, not feature correctness.
- **No premature abstraction.** Don't build a plugin system, generalized config, or extension points until there's a second concrete use case to validate against.
- **No comments in code.** Use clear names. Allowed only for `TODO:` / `FIXME:` with reason, or a hidden invariant that would surprise a reader.

## Things to push back on

- Suggestions to use `--output-format stream-json`, `-p`, the Agent SDK, or to call the Anthropic API directly — these violate the billing invariant. Hard no, regardless of how convenient they look for a given feature.
- Suggestions to add Electron, Node integration, or a bundled Chromium — the whole point of Tauri is the system WebView.
- Suggestions to add a test framework with broad coverage targets — manual checkpoints are the spec.
- Suggestions to ship a plugin architecture before a second plugin candidate actually exists.
- Suggestions to build our own SQLite session store when `~/.claude/projects/*/*.jsonl` is the source of truth.
- Suggestions to add telemetry, analytics, or auto-error-reporting — personal-scale app, not needed.
- Suggestions to handle `claude` auth ourselves — the binary handles it.

## Git

- No Claude attribution in commits or PRs (no `Co-Authored-By: Claude`, no "Generated with..." footer).
- Commit messages: short imperative subject, optional body for the *why*. No emoji.
