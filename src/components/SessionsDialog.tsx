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
          className="rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-fg-muted"
        />

        <div className="-mx-2 max-h-[420px] overflow-y-auto">
          {error && (
            <div className="px-2 py-4 text-xs text-red-400">
              Failed to load sessions: {error}
            </div>
          )}
          {!error && filtered === null && (
            <div className="px-2 py-4 text-xs text-fg-muted">Loading…</div>
          )}
          {!error && filtered && filtered.length === 0 && (
            <div className="px-2 py-4 text-xs text-fg-muted">
              No sessions found.
            </div>
          )}
          {!error && filtered && filtered.length > 0 && (
            <ul className="grid gap-px">
              {filtered.slice(0, 200).map((s) => (
                <li key={s.sessionId}>
                  <button
                    type="button"
                    onClick={() => onPickSession(s)}
                    className="group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-fg">
                        {s.title ?? "(no title)"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-muted">
                        <span className="truncate font-mono">
                          {projectLabel(s.cwd)}
                        </span>
                        <span>•</span>
                        <span>{s.messageCount} msg</span>
                        <span>•</span>
                        <span>{relativeTime(s.lastTimestamp)}</span>
                      </div>
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
