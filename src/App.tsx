import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "./components/Terminal";
import { TitleBar } from "./components/TitleBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { SessionsDialog } from "./components/SessionsDialog";
import { TabBar } from "./components/TabBar";
import { useSkipPermissions } from "./settings/skipPermissions";
import { resolveCommand, useClaudePath } from "./settings/claudePath";
import { readNotifyOnIdle } from "./settings/notifyOnIdle";
import { buildArgs, type SessionMode } from "./lib/sessionArgs";
import { projectLabel, type SessionInfo } from "./lib/sessions";
import { pushToast } from "./lib/toast";
import { cn } from "./lib/utils";

interface Tab {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  label: string;
}

function nextId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2, 10)}`;
}

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [skipPermissions] = useSkipPermissions();
  const [claudePath] = useClaudePath();

  const counterRef = useRef(2);
  const makeTab = useCallback(
    (mode: SessionMode): Tab => {
      const n = counterRef.current++;
      return {
        id: nextId(),
        command: resolveCommand(claudePath),
        args: buildArgs(skipPermissions, mode),
        label: `Tab ${n}`,
      };
    },
    [skipPermissions, claudePath],
  );

  const [tabs, setTabs] = useState<Tab[]>(() => [
    {
      id: nextId(),
      command: resolveCommand(claudePath),
      args: buildArgs(skipPermissions, { kind: "new" }),
      label: "Tab 1",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => tabs[0]?.id ?? null,
  );
  const [unreadTabs, setUnreadTabs] = useState<Set<string>>(() => new Set());

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const onTabReady = useCallback((id: string, label: string) => {
    const tabActive = activeTabIdRef.current === id;
    const mainOnScreen =
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus();

    if (tabActive && mainOnScreen) return;

    if (!tabActive) {
      setUnreadTabs((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    if (!readNotifyOnIdle()) return;
    void pushToast({
      title: "Ready",
      body: `${label} is ready`,
      tabId: id,
    });
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    listen<string>("main://activate-tab", (event) => {
      const id = event.payload;
      if (typeof id !== "string" || !id) return;
      setActiveTabId(id);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (activeTabId == null) return;
    setUnreadTabs((prev) => {
      if (!prev.has(activeTabId)) return prev;
      const next = new Set(prev);
      next.delete(activeTabId);
      return next;
    });
  }, [activeTabId]);

  useEffect(() => {
    if (tabs.length === 0) {
      if (activeTabId !== null) setActiveTabId(null);
      return;
    }
    if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const openTab = useCallback(
    (mode: SessionMode) => {
      const tab = makeTab(mode);
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    },
    [makeTab],
  );

  const openSessionTab = useCallback(
    (session: SessionInfo) => {
      const n = counterRef.current++;
      const labelBase = session.title?.trim() || projectLabel(session.cwd);
      const label =
        labelBase && labelBase !== "—"
          ? labelBase.length > 32
            ? `${labelBase.slice(0, 31)}…`
            : labelBase
          : `Tab ${n}`;
      const tab: Tab = {
        id: nextId(),
        command: resolveCommand(claudePath),
        args: buildArgs(skipPermissions, {
          kind: "resume-id",
          sessionId: session.sessionId,
        }),
        cwd: session.cwd ?? undefined,
        label,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    },
    [claudePath, skipPermissions],
  );

  const renameTab = useCallback((id: string, label: string) => {
    const trimmed = label.trim().slice(0, 60);
    if (!trimmed) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, label: trimmed } : t)),
    );
  }, []);

  const closeTab = useCallback((id: string) => {
    const prev = tabsRef.current;
    const idx = prev.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    setTabs(next);
    setActiveTabId((current) => {
      if (current !== id) return current;
      if (next.length === 0) return null;
      const fallback = next[idx - 1] ?? next[idx] ?? next[0];
      return fallback.id;
    });
    setUnreadTabs((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }, []);

  const cycleTab = useCallback(
    (direction: 1 | -1) => {
      setActiveTabId((current) => {
        if (tabs.length === 0) return null;
        const idx = current ? tabs.findIndex((t) => t.id === current) : -1;
        const nextIdx = (idx + direction + tabs.length) % tabs.length;
        return tabs[nextIdx].id;
      });
    },
    [tabs],
  );

  const onNewSession = useCallback(() => openTab({ kind: "new" }), [openTab]);
  const onResumeSession = useCallback(
    () => openTab({ kind: "resume" }),
    [openTab],
  );
  const onOpenSessions = useCallback(() => setSessionsOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;

      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      };

      if (!e.shiftKey && e.key === ",") {
        consume();
        setSettingsOpen((prev) => !prev);
        return;
      }

      if (settingsOpen || sessionsOpen) return;

      if (e.shiftKey && (e.key === "N" || e.key === "n")) {
        consume();
        onNewSession();
        return;
      }
      if (e.shiftKey && (e.key === "R" || e.key === "r")) {
        consume();
        onResumeSession();
        return;
      }
      if (e.shiftKey && (e.key === "H" || e.key === "h")) {
        consume();
        onOpenSessions();
        return;
      }
      if (!e.shiftKey && (e.key === "w" || e.key === "W")) {
        consume();
        if (activeTabId) closeTab(activeTabId);
        return;
      }
      if (e.key === "Tab") {
        consume();
        cycleTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (!e.shiftKey && e.key >= "1" && e.key <= "9") {
        const n = parseInt(e.key, 10);
        if (n <= tabs.length) {
          consume();
          setActiveTabId(tabs[n - 1].id);
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [
    activeTabId,
    closeTab,
    cycleTab,
    onNewSession,
    onResumeSession,
    onOpenSessions,
    settingsOpen,
    sessionsOpen,
    tabs,
  ]);

  return (
    <main className="flex h-full flex-col overflow-hidden border border-border bg-bg text-fg">
      <TitleBar
        onOpenSessions={onOpenSessions}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {tabs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-fg-muted">
            No sessions. Press{" "}
            <kbd className="mx-1 border border-border bg-bg-elevated px-1.5 py-0.5 text-[11px]">
              Ctrl+Shift+N
            </kbd>{" "}
            or click <span className="mx-1 font-semibold">+</span> to start one.
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "absolute inset-0 px-4",
                tab.id === activeTabId ? "" : "hidden",
              )}
            >
              <Terminal
                command={tab.command}
                args={tab.args}
                cwd={tab.cwd}
                active={tab.id === activeTabId}
                onClaudeReady={() => onTabReady(tab.id, tab.label)}
                className="h-full w-full overflow-hidden"
              />
            </div>
          ))
        )}
      </div>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        unreadIds={unreadTabs}
        onActivate={setActiveTabId}
        onClose={closeTab}
        onRename={renameTab}
        onNewSession={onNewSession}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <SessionsDialog
        open={sessionsOpen}
        onOpenChange={setSessionsOpen}
        onPickSession={(s) => {
          setSessionsOpen(false);
          openSessionTab(s);
        }}
      />
    </main>
  );
}
