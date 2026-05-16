# claude-shell — Iteration Plan

Hooks-driven desktop client around the interactive `claude` CLI. `claude` runs in a real PTY (xterm.js + portable-pty/ConPTY), all rich UX comes from **Claude Code hooks** firing on tool events, plus passive file reads from `~/.claude/projects/`.

## Billing model invariant (NON-NEGOTIABLE)

claude-shell **must operate exclusively within the Claude subscription pool**. It must **never** touch the Agent SDK credit pool or the API billing pool.

**As of 2026-05-16, Anthropic has not publicly documented the technical signals used to distinguish pools.** The architecture below is the safest reverse-engineered bet (interactive PTY = subscription; piped/`-p`/stream-json = SDK). This assumption is verified after the 2026-06-15 cutover, not before. See "Open questions tied to the 2026-06-15 cutover" below.

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
git grep -nIE '(\-p\b|--print|--output-format|--input-format|stream-json|claude-agent-sdk|anthropic-ai/claude-agent-sdk|api\.anthropic\.com|ANTHROPIC_API_KEY)' -- ':!PLAN.md' ':!CLAUDE.md' ':!README.md' ':!package-lock.json' ':!src-tauri/Cargo.lock'
```

(`-I` skips binary assets so icon files don't false-positive; lock files excluded because they contain hash strings that occasionally pattern-match.)

The command must return zero matches. Any hit blocks the merge.

## Open questions tied to the 2026-06-15 cutover

These are **undocumented by Anthropic** as of 2026-05-16. Each one, if it lands the wrong way, changes our plan. We verify all of them in the first week after 2026-06-15 by spending small known amounts of credit and watching the meter.

| Question | If subscription-pool (good) | If Agent-SDK-pool (bad) |
|---|---|---|
| Are hooks installed by claude-shell billed differently? | iter 2–3 ship as written | Side panel features (iter 3, 6) become opt-in with prominent "may consume SDK credit" warning. Default = off. |
| Is the `Task` tool (subagents) from an interactive session SDK-billed? | No action needed | Add detection in iter 3: when Task fires, surface a per-call cost warning. Recommend system prompt that discourages Task use. |
| Are MCP tools in interactive sessions SDK-billed? | No action needed | Same UI treatment as Task — flag each MCP invocation. |
| Does parent-process inspection by `claude` flag custom terminals? | iter 1 works as planned | Re-evaluate entire architecture; possibly fall back to "rich side panel via passive .jsonl tailing only, no hooks". |

**Mitigation: gate iter 2 on the cutover.** Iteration 1 (raw PTY terminal) is fully viable as a v0.1 MVP on its own. Do not start iteration 2 until at least one full week of real billing data post-2026-06-15 is in hand and the above questions are answered for our specific stack.

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

## Iteration 1.1 — Frameless chat window & tray

Billing-neutral interlude before the 2026-06-15 gate. Goal: single chat window — no system title bar, custom buttons in the top-right (new / resume / settings / minimize), settings dialog with theme picker and `--dangerously-skip-permissions` toggle, system tray with close-to-tray.

**Window chrome:**

- [ ] `tauri.conf.json`: `decorations: false`, `transparent: false`, `minWidth: 800` / `minHeight: 600`.
- [ ] Custom top strip (~36px) with `data-tauri-drag-region` outside the button cluster.
- [ ] Top-right buttons, left → right: **New session** (lucide `Plus`), **Resume** (lucide `History`), **Settings** (lucide `Settings`), **Minimize** (lucide `Minus`). All icon-only with native `title` tooltips.
- [ ] Minimize → `window.hide()` (to tray), not OS-minimize.
- [ ] Intercept close-requested (Alt+F4, OS close gesture) → hide to tray. Quit only via tray menu.
- [ ] No window rounding anywhere (`--radius-*` tokens forced to 0, scrollbar thumb square).
- [ ] Padding `px-4 pb-4` around the terminal area so content doesn't touch window edges.

**System tray:**

- [ ] Tauri 2 built-in tray (`tauri::tray::TrayIconBuilder`). Icon = app icon (pixel-art coral robot).
- [ ] Left-click → show + focus.
- [ ] Right-click → menu: `Show`, `Quit`.

**Theme system:**

- [ ] OKLCH semantic CSS variables in `src/styles.css`: `--color-bg`, `--color-bg-elevated`, `--color-fg`, `--color-fg-muted`, `--color-border`, `--color-accent`, `--color-overlay`. Both light and dark resolve the same names.
- [ ] `[data-theme="dark" | "light"]` on `<html>`. `ThemeProvider` (`src/theme/ThemeProvider.tsx`) reads `localStorage["claude-shell:theme"]` ∈ {`system`, `light`, `dark`}; system fallback via `prefers-color-scheme`.
- [ ] Inline pre-paint script in `index.html` sets `data-theme` before React renders (no FOUC).
- [ ] Xterm theme extracted to `src/design/terminal-theme.ts` with `dark` and `light` variants. Terminal reacts to theme changes via `term.options.theme = …` — no PTY respawn.
- [ ] Xterm scrollbar invisible by default, fades in on hover over the viewport.

**Settings dialog:**

- [ ] Centered shadcn `Dialog`. Opens via Settings button and `Ctrl+,`.
- [ ] **Theme** section: segmented control `System` / `Light` / `Dark`. Live-applies.
- [ ] **Claude** section: `Switch` for "Skip permission prompts" (passes `--dangerously-skip-permissions`). Default ON. Note: "Takes effect on the next session" — toggling does **not** auto-restart claude (avoids surprising mid-conversation kills).
- [ ] All settings persisted via `localStorage`; tauri-plugin-store migration in iter 4.

**New / Resume buttons:**

- [ ] Plus button → kill current PTY, spawn fresh claude with current `--dangerously-skip-permissions` setting. Hotkey: `Ctrl+Shift+N`.
- [ ] History button → kill current PTY, spawn claude with `--resume` (claude shows its own TUI session picker). Hotkey: `Ctrl+Shift+R`.
- [ ] Snapshot of args is taken at restart-button-click time, not on every settings change.

**Resize debounce (TUI banner mitigation):**

- [ ] Visual `fit.fit()` on every ResizeObserver tick; `pty_resize` (real SIGWINCH equivalent) debounced 180ms and skipped if cols/rows unchanged. Reduces claude TUI banner duplication during continuous window dragging (root cause is upstream Ink not using alt-screen).

**Minimal shadcn scaffold:**

- [ ] Deps: `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-radio-group`, `@radix-ui/react-switch`, `@radix-ui/react-slot`.
- [ ] `src/lib/utils.ts` with `cn()`.
- [ ] Copy-paste only: `Button`, `Dialog`, `Switch`, `Segmented` (RadioGroup-based).

**App icon:**

- [ ] Custom pixel-art icon (coral robot on transparent background). Source PNG upscaled 640→1024 with nearest-neighbor, then `tauri icon` generates full size set.

**Checkpoint:**

- [ ] Frameless window opens; only chat + top strip + 4 buttons visible.
- [ ] Drag region works (clicking empty top strip drags the window).
- [ ] Minimize → tray; left-click tray restores; right-click tray → Quit exits.
- [ ] Alt+F4 / OS close hides to tray.
- [ ] Settings open via button and `Ctrl+,`; theme + skip-permissions persist across restart.
- [ ] Theme switch applies to UI chrome + xterm without PTY respawn.
- [ ] New / Resume buttons restart claude with correct flags; hotkeys work.
- [ ] All iter-1 terminal behaviors still pass (spawn, text/image paste, resize, scrollback, Ctrl+C, links).
- [ ] Window/taskbar/tray show the custom robot icon.
- [ ] Billing-invariant grep returns clean.

**Known upstream issues (not our bug):**

- `claude agents` view freezes after opening a session and returning ([claude-code#59688](https://github.com/anthropics/claude-code/issues/59688)). Reproduces in plain Windows Terminal. Workaround: use our `+` button to kill and respawn. Tabs in **iter 1.2** are the structural fix for managing parallel sessions independent of this upstream bug.

---

## Iteration 1.2 — Tabs (bottom bar)

Multi-session support inside our window, independent of `claude agents`. Each tab owns its own PTY. Tab bar lives at the bottom of the window (slim row).

**State & lifecycle:**

- [ ] App state: `tabs: Array<{ id, args, label, createdAt }>` + `activeTabId`. Initial state: one tab with current default args.
- [ ] Each tab renders a `<Terminal>` mounted but only one is visible (`display: none` for inactive). Don't unmount — preserve scrollback and PTY state.
- [ ] On tab close: kill that tab's PTY, remove from list. If closing active tab, activate the previous one (or right neighbor).
- [ ] If last tab is closed: render an empty state with "New session" CTA (no auto-spawn).

**Tab bar:**

- [ ] Slim row (~30px) at the bottom of the window, below the terminal padding.
- [ ] Each tab pill: short label, optional close `×` on hover. Active tab visually distinct (bg-elevated + accent underline or border).
- [ ] Click pill → switch active. Middle-click pill → close.
- [ ] Overflow: horizontal scroll if too many tabs (no fancy reorder/drag in 1.2).

**Wiring with existing buttons & hotkeys:**

- [ ] `+` (New) button → opens **new tab** with current `--dangerously-skip-permissions` setting (no `--resume`). `Ctrl+Shift+N`.
- [ ] `History` (Resume) button → opens **new tab** with `--resume`. `Ctrl+Shift+R`.
- [ ] Hotkeys: `Ctrl+W` close active tab, `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle, `Ctrl+1` … `Ctrl+9` jump to nth.
- [ ] Setting toggle "Skip permission prompts" still affects only **new** tabs created after the change; live tabs keep their startup args.

**Tab labels:**

- [ ] Default: `Session 1`, `Session 2`, … (per-app counter, not persisted across app restarts).
- [ ] Stretch: capture first user prompt from PTY stream and use as label (truncated). If too much complexity, skip — leave for a later iteration.

**Xterm visibility quirks:**

- [ ] When a tab becomes active again after being hidden, call `fit.fit()` + `term.refresh(0, term.rows - 1)` to force redraw (renderer may have skipped frames while hidden).
- [ ] Resize observer keeps running for hidden tabs too — but real `pty_resize` only fires for active tab (inactive PTYs keep their last size; reactivation triggers a fit + resize).

**Checkpoint:**

- [ ] Open 3 tabs, each runs independent claude. Switching preserves scrollback and prompt state.
- [ ] Closing middle tab keeps the others alive; closing all tabs shows empty state.
- [ ] `+` opens a fresh new tab. `History` opens a tab in `--resume` picker.
- [ ] `Ctrl+Tab` cycles; `Ctrl+W` closes; `Ctrl+1..9` jumps.
- [ ] Resize redistributes correctly when switching tabs (no leftover-cells artifact).
- [ ] Billing-invariant grep returns clean.

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
- [ ] Global keybindings: Ctrl+K clear screen (sends `clear` to PTY or xterm `term.clear()`). Settings (Ctrl+,), new tab (Ctrl+Shift+N), resume (Ctrl+Shift+R), tab nav (Ctrl+1..9 / Ctrl+Tab / Ctrl+W) already shipped in 1.1/1.2.
- [ ] Settings panel: migrate `localStorage` settings to `tauri-plugin-store`. Add font family / size / cursor style / hook-install toggle / notification on-off to the existing dialog (theme picker and skip-permissions already there from 1.1).
- [ ] App icon already in 1.1; revisit for monochrome tray variant if the colored icon reads poorly in light system trays.

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

## Iteration 6.5 — Billing observability

(Conditional: only build if any of iter 2–6 features ended up partially in the Agent SDK pool after the 2026-06-15 cutover. Otherwise skip.)

- [ ] Read usage data from `~/.claude/projects/*/*.jsonl` (claude writes per-message token counts and tool invocation records there)
- [ ] Aggregate per-session: subscription-pool calls, suspected-SDK-pool calls (Task, MCP, hooks-triggered actions if confirmed billable)
- [ ] Show current-cycle estimate against the user's Agent SDK credit limit
- [ ] Warn in real time when a tool call that's suspected-SDK-pool is about to fire (PreToolUse hook returns an approval prompt)

**Checkpoint:**

- [ ] Numbers visibly match what Anthropic shows in their dashboard (cross-check after a known set of tasks)
- [ ] Warnings fire before, not after, suspected SDK-pool calls

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
