# claude-shell — agent instructions

Short, durable invariants for this repo. Read [PLAN.md](./PLAN.md) for the current iteration and roadmap.

## What this is

Desktop GUI client built around the **interactive** `claude` CLI. Architecture: PTY-hosted `claude` (xterm.js + portable-pty/ConPTY) on one side, and a side panel driven by **Claude Code hooks** on the other. Solo project, manual checkpoint after each iteration. See [README.md](./README.md) for stack rationale.

## Billing model invariant (NON-NEGOTIABLE)

claude-shell must operate **exclusively within the Claude subscription pool**. It must **never** touch the Agent SDK credit pool or the API billing pool. This is the load-bearing architectural constraint; every design decision is downstream of it.

**Allowed:**

- Spawn `claude` interactively in a real PTY. No flags that change input/output format.
- Use Claude Code hooks (`PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, `Notification`, `SubagentStop`).
- `claude --resume <id>` and `claude --continue` in PTY mode.
- Passive reads of `~/.claude/projects/<encoded-cwd>/*.jsonl` for session history.
- Idempotent reads/writes of `~/.claude/settings.json` to install/remove our hooks.

**Forbidden (each of these moves usage into the Agent SDK pool):**

- `claude -p` or `--print` flag.
- `--output-format stream-json` or `--input-format stream-json`.
- Spawning `claude` with piped stdin/stdout instead of a PTY — the binary detects `isatty()` and switches to wrapper mode.
- Importing `claude-agent-sdk` (Python) or `@anthropic-ai/claude-agent-sdk` (TS/JS).
- Direct HTTP calls to `api.anthropic.com`.
- Setting `ANTHROPIC_API_KEY` for the child `claude` process — auth is the `claude` binary's responsibility, not ours.

Before merging an iteration, run the verification grep from PLAN.md. Zero matches required.

## Stack invariants

- **Tauri 2**, not Electron. Don't import Electron patterns (no `BrowserWindow`, no `ipcRenderer`, no Node APIs in the renderer).
  - Frontend ↔ Rust: `invoke('command_name', args)` for request/response, `emit` / `listen` for streaming events.
  - All Rust commands live behind `#[tauri::command]` and are registered in `tauri::generate_handler!`.
- **No cross-compilation.** Each platform binary is built on its native OS. Local dev = current OS only. Release builds happen in GitHub Actions (iteration 7).
- **React 19 + Vite + TS strict.** No legacy class components. SPA inside a WebView.
- **Tailwind 4** via the Vite plugin (not PostCSS config). shadcn/ui components are copy-pasted into `src/components/ui/`, not imported from a package.
- **PTY layer:** `portable-pty` crate in Rust (uses ConPTY on Windows, forkpty elsewhere). Frontend uses `xterm` + addons (`fit`, `web-links`, `search`).
- **Hooks transport:** in-process HTTP server on `127.0.0.1:<random port>`, per-launch shared secret. A tiny `hook-bridge` binary reads stdin from `claude` hooks and POSTs to the server.
- **Sessions data:** read from `~/.claude/projects/*/*.jsonl`. Don't build our own conversation database.

## Process

- **Worktree per iteration.** Each iteration from PLAN.md gets its own git worktree (`../claude-shell-iter-N`) and branch (`iter-N-<slug>`). Merge to `master` only after the iteration's checkpoint passes manually AND the billing-invariant grep is clean.
- **Manual checkpoint is non-negotiable.** Don't start iteration N+1 until every checkbox under iteration N's "Checkpoint" section is verified by hand. Automated tests don't replace this — most checkpoints are UX validations.
- **No premature abstraction.** Plugin system is iteration 8+ *because* there's no second plugin yet to validate the interface against. Don't generalize during iterations 1–7.
- **No comments in code.** Use clear names. Allowed only for `TODO:` / `FIXME:` with reason, or a hidden invariant that would surprise a reader.

## Things to push back on

- Suggestions to use `--output-format stream-json`, `-p`, the Agent SDK, or to call the Anthropic API directly — these violate the billing invariant. Hard no, regardless of how convenient they look for a given feature.
- Suggestions to add Electron, Node integration, or a bundled Chromium — the whole point of Tauri is the system WebView.
- Suggestions to add a test framework with broad coverage targets — manual checkpoints are the spec until iteration 7.
- Suggestions to ship a plugin architecture before iteration 8 lands.
- Suggestions to build our own SQLite session store when `~/.claude/projects/*/*.jsonl` is the source of truth.
- Suggestions to add telemetry, analytics, or auto-error-reporting — personal-scale app, not needed.
- Suggestions to handle `claude` auth ourselves — the binary handles it.

## Git

- No Claude attribution in commits or PRs (no `Co-Authored-By: Claude`, no "Generated with..." footer).
- Commit messages: short imperative subject, optional body for the *why*. No emoji.
