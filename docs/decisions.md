# Locked design decisions

Design choices locked during the iteration they were decided in. Each entry is
referenced by later iterations and should not be reopened without a
corresponding [PLAN.md](../PLAN.md) edit.

---

## Iteration 0

### `claude` binary discovery

**Strategy:** PATH lookup at app startup. Optional override via the user-facing
settings panel (`settings.claudePath`), persisted by the Tauri store plugin.
**No environment variable.**

**Why:**

- Most users have `claude` on PATH after running the official installer; PATH
  lookup is zero-config in the common case.
- A `CLAUDE_PATH`-style env var would invite breakage: users could accidentally
  point us at a stale binary without realising, and it adds a second source of
  truth alongside the settings store.
- A settings-panel override keeps the escape hatch local to claude-shell and
  visible in the UI.

**Status:** Implementation deferred to iteration 7 (empty-state handling for
"no `claude` on PATH").

### Hook transport

**Strategy:** In-process HTTP server (axum) bound to `127.0.0.1:<random port>`
(OS-assigned via port `0`). Per-launch shared secret required in every POST
body. A tiny `hook-bridge` binary, bundled alongside the main app, reads the
JSON payload from `claude` hooks on stdin and POSTs it to our server with
`?port=<port>&secret=<secret>` (passed in by the hook config command line).

**Why HTTP over Unix sockets / named pipes / stdout pipe:**

- HTTP is the simplest cross-platform transport that doesn't require platform
  `#[cfg]`s in the bridge binary.
- Loopback-only + per-launch secret defends against other local processes on a
  shared machine.
- A separate `hook-bridge` binary is required because the hook command must be
  a single executable invocation — we can't make `claude` HTTP-POST directly,
  and we don't want to depend on `curl` being on PATH.

**Status:** Implementation deferred to iteration 2 (and iteration 2 itself is
gated on the 2026-06-15 cutover per [PLAN.md](../PLAN.md)).

### Hook installation into `~/.claude/settings.json`

**Strategy:** Idempotent merge. Each managed entry is tagged with a sentinel
key `"_managedByClaudeShell": true`. On first run, claude-shell:

1. Reads the existing `settings.json` (or treats an absent file as `{}`).
2. For each hook event we need (`PreToolUse`, `PostToolUse`, `Stop`,
   `UserPromptSubmit`, `Notification`, `SubagentStop`), adds our entry
   alongside any existing user entries — never overwrites.
3. Writes the file back with stable key ordering.

On uninstall or user-initiated opt-out, claude-shell removes only entries
carrying the sentinel and rewrites the file. User-authored hooks are
untouched.

**Why this shape:**

- Users may already have personal hooks; clobbering them is unacceptable.
- The sentinel lets us identify our entries even after manual edits (as long
  as the key survives).
- Idempotent merge means repeated launches don't accumulate duplicates.

**Status:** Implementation deferred to iteration 2.
