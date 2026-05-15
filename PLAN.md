# claude-shell — Iteration Plan

Working through these in order. Each iteration leaves a runnable artifact and a checkpoint to validate manually before moving on.

Modular plugin system is intentionally deferred until iteration 7 — chat is built as the app first, plugin interface is extracted only once there's a second plugin (terminal) to validate the abstraction against.

---

## Iteration 0 — Skeleton

- [ ] Initialize Tauri 2 + React + TS + Vite project
- [ ] Add Tailwind CSS 4 with base dark theme
- [ ] Wire up shadcn/ui
- [ ] Add one test Rust command (`ping`) callable from frontend

**Checkpoint:**
- [ ] `npm run tauri dev` opens window
- [ ] HMR works (React edit reflects instantly)
- [ ] JS → Rust command roundtrip succeeds
- [ ] `npm run tauri build` produces a working ~10–15 MB `.exe`

---

## Iteration 1 — Chat UI shell

- [ ] Layout: virtualized message list (`@tanstack/react-virtual`), auto-resizing input
- [ ] Markdown rendering (`react-markdown` + `remark-gfm`)
- [ ] Code syntax highlighting (`shiki`)
- [ ] Mock conversation data (text, code, diffs, lists)
- [ ] Visual polish pass: typography, spacing, custom scrollbars

**Checkpoint:**
- [ ] Long mock chat scrolls smoothly
- [ ] Markdown + code look clean — distinct from Discord/ChatGPT generic
- [ ] Input grows with content, Ctrl+Enter triggers send handler

---

## Iteration 2 — Claude Code integration

- [ ] Verify exact `claude` CLI flags for `--output-format stream-json` / `--input-format stream-json`
- [ ] Rust: spawn `claude` via `tokio::process`, pipe stdin/stdout
- [ ] Parse stream-json events, forward to frontend via Tauri events
- [ ] Frontend subscribes, renders streaming assistant text in real time
- [ ] Stop button (SIGINT to subprocess)
- [ ] CWD passed at session start (hardcoded for now)

**Checkpoint:**
- [ ] Real conversation works end-to-end
- [ ] Streaming visible chunk-by-chunk
- [ ] Stop actually halts generation
- [ ] Tool calls visible (even if styled raw)

---

## Iteration 3 — Tool call rendering

- [ ] `Read` / `Glob` / `Grep` — collapsible card with preview
- [ ] `Edit` / `Write` — diff view with syntax highlighting
- [ ] `Bash` — command + output card, ANSI colors via `ansi-to-html`
- [ ] `TodoWrite` — proper checklist UI
- [ ] `WebFetch` / `WebSearch` — URL-aware card

**Checkpoint:**
- [ ] Run a real editing task — output reads better than raw terminal

---

## Iteration 4 — Native features

- [ ] Clipboard image paste (Ctrl+V in input → attached image preview → sent as attachment)
- [ ] System notification when assistant turn ends AND window is unfocused
- [ ] Keybindings: Ctrl+Enter send, Esc cancel, Ctrl+K new session, Ctrl+L clear
- [ ] Persist window size/position

**Checkpoint:**
- [ ] Win+Shift+S → Ctrl+V into input → image attached and sent
- [ ] Background → end of task → system toast appears

---

## Iteration 5 — Sessions & projects

- [ ] SQLite schema in `%APPDATA%/claude-shell/sessions.db` (`rusqlite`)
- [ ] Collapsible sessions sidebar
- [ ] Create / rename / delete sessions
- [ ] Project directory selector per session (native dialog)
- [ ] Message persistence; sessions survive app restart
- [ ] `claude --resume <session-id>` integration (verify behavior)

**Checkpoint:**
- [ ] Work in a session, close app, reopen — state intact, conversation resumable

---

## Iteration 6 — Daily-use polish

- [ ] Settings panel (theme, font family, font size)
- [ ] Subprocess crash handling (UI surfacing + retry)
- [ ] Empty states (no sessions, empty chat)
- [ ] App icon + `.ico`
- [ ] Tauri auto-updater config (not yet enabled)
- [ ] **GitHub Actions: cross-platform release build (Win / macOS / Linux)**

**Checkpoint:**
- [ ] Full day of real use with no blocking bugs
- [ ] CI produces working binaries for all three platforms

---

## Iteration 7+ — Plugin architecture

Triggered once iteration 6 is stable and there is genuine demand for the terminal panel — not before.

- [ ] Define plugin interface (frontend component + optional Rust backend)
- [ ] Refactor chat into the default plugin
- [ ] **Terminal plugin**: xterm.js + ConPTY/forkpty via `portable-pty` crate
- [ ] Plugin discovery / enable-disable in settings

Future plugin ideas (not committed): file tree, git status, todo viewer, project switcher.
