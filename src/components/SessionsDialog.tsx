import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  listSessions,
  projectLabel,
  relativeTime,
  type SessionInfo,
} from "../lib/sessions";

interface SessionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickSession: (session: SessionInfo) => void;
}

export function SessionsDialog({
  open,
  onOpenChange,
  onPickSession,
}: SessionsDialogProps) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSessions(null);
    setError(null);
    listSessions().then(
      (list) => {
        if (cancelled) return;
        setSessions(list);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    if (!sessions) return null;
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const fields = [s.title ?? "", s.cwd ?? "", s.sessionId];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [sessions, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] gap-3">
        <DialogHeader>
          <DialogTitle>Sessions</DialogTitle>
          <DialogDescription>
            Pick a past session to resume. Newest first.
          </DialogDescription>
        </DialogHeader>

        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title, project or id…"
          className="w-full min-w-0 rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-fg outline-none focus:border-fg-muted"
        />

        <div className="max-h-[420px] min-w-0 overflow-x-hidden overflow-y-auto">
          {error && (
            <div className="px-1 py-3 text-xs text-red-400">
              Failed to load sessions: {error}
            </div>
          )}
          {!error && filtered === null && (
            <div className="px-1 py-3 text-xs text-fg-muted">Loading…</div>
          )}
          {!error && filtered && filtered.length === 0 && (
            <div className="px-1 py-3 text-xs text-fg-muted">
              No sessions found.
            </div>
          )}
          {!error && filtered && filtered.length > 0 && (
            <ul className="grid gap-1">
              {filtered.slice(0, 200).map((s) => (
                <li key={s.sessionId} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onPickSession(s)}
                    className="group flex w-full min-w-0 items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-bg"
                  >
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="block truncate text-sm text-fg">
                        {s.title ?? "(no title)"}
                      </span>
                      <span className="flex min-w-0 items-center gap-2 text-[11px] text-fg-muted">
                        <span className="min-w-0 flex-1 truncate font-mono">
                          {projectLabel(s.cwd)}
                        </span>
                        <span className="shrink-0">{s.messageCount} msg</span>
                        <span className="shrink-0">
                          {relativeTime(s.lastTimestamp)}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
