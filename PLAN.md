# claude-shell — Iteration Plan

Hooks-driven desktop client around the interactive `claude` CLI. `claude` runs in a real PTY (xterm.js + portable-pty/ConPTY), all rich UX comes from **Claude Code hooks** firing on tool events, plus passive file reads from `~/.claude/projects/`.

## Billing model invariant (NON-NEGOTIABLE)

claude-shell **must operate exclusively within the Claude subscription pool**. It must **never** touch the Agent SDK credit pool or the API billing pool.

**Allowed:**

- Spawn `claude` interactively via PTY (no flags that change input/output format).
- Use Claude Code hooks (`PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, `Notification`, `SubagentStop`, etc.) — these execute local commands and don't make API calls themselves.
- Run `claude --resume <session-id>` and `claude --continue` in interactive PTY mode.
- Read `~/.claude/projects/<encoded-cwd>/*.jsonl` files for session history (passive, no API).
- Read/write `~/.claude/settings.json` to install our hooks (passive, no API).

**Forbidden — anything below would shift usage to the Agent SDK pool:**

- `claude -p` / `--print` flag (non-interactive mode).
- `--output-format stream-json` or `--input-format stream-json` in any combination.
- Spawning `claude` with piped stdin/stdout instead of a PTY (the binary detects `isatty()` and flips to wrapper mode).
- Importing or using `claude-agent-sdk` (Python) or `@anthropic-ai/claude-agent-sdk` (TS/JS).
- Direct HTTP calls to `api.anthropic.com` from any part of claude-shell.
- Setting `ANTHROPIC_API_KEY` env var for the child `claude` process (we don't manage auth — the `claude` binary handles login itself via its normal flow).

**Verification before each merge:**

```bash
git grep -nE '(\-p\b|--print|--output-format|--input-format|stream-json|claude-agent-sdk|anthropic-ai/claude-agent-sdk|api\.anthropic\.com|ANTHROPIC_API_KEY)' -- ':!PLAN.md' ':!CLAUDE.md' ':!README.md'
```

The command must return zero matches. Any hit blocks the merge.

## Workflow

- One git worktree per iteration: `git worktree add ../claude-shell-iter-N iter-N-<slug>`.
- Merge to `master` only after every checkbox in the iteration's **Checkpoint** section is verified by hand AND the billing-invariant grep returns clean.
- Don't start iteration N+1 until N is merged. No parallel iterations.
- See [CLAUDE.md](./CLAUDE.md) for stack invariants and process rules the agent should follow.

Plugin abstraction is deferred until iteration 8+, only if a second non-chat plugin candidate appears. Don't generalize earlier.

---

## Iteration 0 — Skeleton

- [ ] Initialize Tauri 2 + React + TS + Vite project
- [ ] Add Tailwind CSS 4 with base dark theme (via Vite plugin, not PostCSS config)
- [ ] Add one test Rust command (`ping`) callable from frontend
- [ ] Decide `claude` binary discovery strategy: PATH lookup, with optional override via settings (no env var). Document but don't implement yet.
- [ ] Decide hook transport: HTTP server on `127.0.0.1:<random port>` with per-session shared secret. Lock the design, don't implement.
- [ ] Decide hook installation strategy: idempotent merge into `~/.claude/settings.json`, marked with a sentinel key (`"_managedByClaudeShell": true`) so we can identify and clean up our entries without touching user-authored hooks. Lock the design.
- [ ] Document the billing invariant in CLAUDE.md (done in this iteration's CLAUDE.md update).

**Checkpoint:**

- [ ] `npm run tauri dev` opens window
- [ ] HMR works (React edit reflects instantly)
- [ ] JS → Rust command roundtrip succeeds
- [ ] Debug `.exe` builds cleanly (size measured later in iteration 7)
- [ ] Billing-invariant grep returns clean

---

## Iteration 1 — Terminal foundation

- [ ] Add `xterm` + `xterm-addon-fit` + `xterm-addon-web-links` + `xterm-addon-search` on the frontend
- [ ] Add `portable-pty` crate in Rust
- [ ] Rust commands: `pty_spawn(command, args, cwd, cols, rows)`, `pty_write(handle, bytes)`, `pty_resize(handle, cols, rows)`, `pty_kill(handle)`
- [ ] Bridge: PTY output bytes → Tauri event `pty:output` → xterm.js `term.write()`
- [ ] Bridge: xterm.js `onData` → Tauri command `pty_write`
- [ ] Window resize → `fit.fit()` → `pty_resize` to keep PTY cols/rows in sync
- [ ] Layout: terminal area on the left/main, empty side panel area on the right (no content yet, just split)
- [ ] Font selection (monospace with good ligatures, e.g. `JetBrains Mono` / `Fira Code`), font size, base color palette

**Checkpoint:**

- [ ] Spawn `claude` directly in xterm.js — full conversation works end-to-end via TUI
- [ ] Resize window → terminal reflows, no broken layout
- [ ] Ctrl+C interrupts, Ctrl+V pastes, arrow keys navigate input history
- [ ] Clipboard image paste into `claude` TUI works (this is a `claude` TUI feature delivered through PTY clipboard semantics, not anything we implement)
- [ ] Long output scrolls smoothly, scrollback works
- [ ] Billing-invariant grep returns clean

---

## Iteration 2 — Hooks infrastructure

- [ ] Rust HTTP server (axum) bound to `127.0.0.1:0` (OS-assigned random port), in-process
- [ ] Generate per-app-launch shared secret, required in hook POST body
- [ ] Define event schema for the in-process channel (discriminated union: `PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, `Notification`, `SubagentStop`)
- [ ] Bundle a tiny `hook-bridge` binary (Rust, compiled alongside main app) that reads stdin (JSON payload from `claude`), POSTs to our HTTP server with secret + port (passed as args by the hook config)
- [ ] On first run: read `~/.claude/settings.json`, merge our hook entries with sentinel `"_managedByClaudeShell": true`. Preserve existing user hooks for the same events by chaining (run user hook → run our bridge, or vice versa, depending on hook type).
- [ ] On app uninstall / explicit user opt-out: remove only sentinel-marked entries, leave user-authored hooks intact
- [ ] Forward received events to frontend via Tauri events
- [ ] Visible indicator in UI when hooks are installed / active

**Checkpoint:**

- [ ] Run a real `claude` task that uses tools — events arrive in claude-shell with correct payloads
- [ ] Install with a pre-existing user hook → user hook still fires; settings.json diff shows only our entries added
- [ ] Uninstall → settings.json returns to pre-install state for our keys, user entries untouched
- [ ] App restart picks up existing hooks (no double-install)
- [ ] Billing-invariant grep returns clean

---

## Iteration 3 — Hook-driven side panel

- [ ] Side panel: vertical stack of cards, one per recent tool call, auto-scroll to newest
- [ ] Card components:
  - [ ] `Read` / `Glob` / `Grep` — file path + collapsible preview (read file contents on `PostToolUse`)
  - [ ] `Edit` / `Write` — diff view (use `shiki` for syntax highlighting, `diff` lib for hunks), before/after from hook payload
  - [ ] `Bash` — command + status badge (running/done/failed), exit code, output preview (correlate by capturing PTY chunk between `PreToolUse` and `PostToolUse` boundaries for that tool invocation)
  - [ ] `TodoWrite` — render the todo list state
  - [ ] `WebFetch` / `WebSearch` — URL + result summary card
  - [ ] `Task` — sub-agent invocation card, expandable to nested events
- [ ] Auto-collapse cards older than the last N (configurable, default 5 expanded)
- [ ] Click card → terminal scrolls to corresponding region (best-effort by timestamp)

**Checkpoint:**

- [ ] Run a real multi-tool task (edit several files, run a build) — side panel shows each step as a structured card
- [ ] Diff view readable with syntax highlight
- [ ] Bash output correlation looks right on at least 3 sequential bash calls
- [ ] Billing-invariant grep returns clean

---

## Iteration 4 — Native polish

- [ ] Window size/position persistence (Tauri store plugin)
- [ ] Single-instance enforcement (`tauri-plugin-single-instance`)
- [ ] System notification on `Stop` hook when window is unfocused (Tauri notification plugin)
- [ ] Global keybindings: Ctrl+1 focus terminal, Ctrl+2 focus side panel, Ctrl+K clear screen (sends `clear` to PTY or xterm `term.clear()`), Ctrl+, open settings
- [ ] Settings panel: theme (dark only for now), font family, font size, hook installation toggle (with explanation that disabling loses rich features), notification on/off
- [ ] App icon + `.ico` / `.icns`

**Checkpoint:**

- [ ] Background app → claude finishes turn → toast appears with title preview
- [ ] Restart app → window position and size restored
- [ ] Settings persist across restarts
- [ ] Toggling hooks off in settings → side panel becomes empty/disabled with clear "rich features disabled" state
- [ ] Billing-invariant grep returns clean

---

## Iteration 5 — Sessions sidebar

- [ ] Read `~/.claude/projects/` directory; each subdir is a project (encoded cwd)
- [ ] Parse `*.jsonl` files: extract session id, first user message preview, last activity timestamp, message count
- [ ] Sidebar (left of terminal): collapsible list of projects → list of sessions per project
- [ ] Click session → respawn current PTY with `claude --resume <session-id>` in that project's cwd
- [ ] "New session" button → spawn fresh `claude` in chosen cwd (native dir picker)
- [ ] Session card actions: pin, rename (renames our own metadata, not claude's), delete (with confirm — deletes the jsonl file)
- [ ] Show currently active session highlighted

**Checkpoint:**

- [ ] Existing claude sessions on disk appear in sidebar with correct previews
- [ ] Resume picks up exactly where the conversation left off
- [ ] Switch project → claude restarts in new cwd, prior session preserved in its file
- [ ] Delete confirms and removes file
- [ ] Billing-invariant grep returns clean

---

## Iteration 6 — Dev server side panel

- [ ] Detect dev-server-launching `Bash` calls via `PreToolUse` hook:
  - Match command patterns: `npm run dev`, `pnpm dev`, `yarn dev`, `bun dev`, `vite`, `next dev`, `npm start`, custom regex configurable in settings
  - Also match commands launched with `run_in_background: true` if `claude` exposes this in the hook payload
- [ ] Open a side-panel slot when matched, status "starting"
- [ ] Parse PTY output stream for URL patterns: `Local:\s+(http://\S+)`, `ready (on|started server on)\s+(http://\S+)`, `Listening on (http://\S+)`, configurable regex list
- [ ] On URL detected: replace slot content with a Tauri webview pointing at it (`<webview>` tag or Tauri's window-in-window)
- [ ] On `PostToolUse` for that Bash call (process ended) or detected server crash → mark slot stopped, keep last-known URL clickable
- [ ] Support multiple concurrent dev servers (tabs within the slot)
- [ ] Manual "Pin a URL" action in side panel for when detection misses

**Checkpoint:**

- [ ] Ask claude to run a real dev server — panel detects, opens, shows live site within ~2s of "ready"
- [ ] Reload site in panel works
- [ ] Stop server in terminal → panel reflects stopped state
- [ ] Start a second dev server while first is running → both visible as tabs
- [ ] Billing-invariant grep returns clean

---

## Iteration 7 — Daily-use polish & release

- [ ] Rust panic handler → log to `%APPDATA%/claude-shell/logs/panic-<ts>.log` (and platform equivalents)
- [ ] Subprocess crash surfacing: claude died unexpectedly → banner in UI with restart button
- [ ] Empty states: no `claude` on PATH (with instructions), no sessions yet, no projects yet
- [ ] Error states: hook port already in use (try next port), settings.json malformed, permissions denied on `~/.claude/`
- [ ] Measure release `.exe` size; document if it exceeds 30 MB
- [ ] GitHub Actions: cross-platform release build matrix (Windows / macOS / Linux), artifact upload, no signing yet
- [ ] README section on Windows SmartScreen / macOS Gatekeeper unsigned-binary warnings and how to bypass

**Checkpoint:**

- [ ] A full week of real daily use with no blocking bugs
- [ ] CI produces working binaries for all three platforms
- [ ] Cold-start launch under 2s on the dev machine
- [ ] Billing-invariant grep returns clean

---

## Iteration 8+ — Plugin architecture (deferred)

Triggered only if a second non-chat plugin candidate has real demand. Not before.

- [ ] Define plugin interface (frontend component + optional Rust backend, optional hook subscriber)
- [ ] Refactor chat (terminal + side panel + sessions) into the default plugin
- [ ] Candidate plugins: standalone terminal (non-claude), file tree, git status panel, project switcher

Auto-updater is deferred indefinitely. Add only when there's a real distribution audience.
