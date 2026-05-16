import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function App() {
  const [reply, setReply] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callPing() {
    setPending(true);
    setError(null);
    try {
      const result = await invoke<string>("ping", { msg: "hello from react" });
      setReply(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-zinc-100">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
        claude-shell
      </h1>
      <p className="max-w-md text-center text-sm text-zinc-400">
        Iteration 0 skeleton. The button below round-trips a string through a
        Rust <code className="font-mono text-zinc-300">#[tauri::command]</code>.
      </p>
      <button
        type="button"
        onClick={callPing}
        disabled={pending}
        className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Pinging…" : "Ping Rust"}
      </button>
      {reply && (
        <div className="rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 font-mono text-sm text-emerald-200">
          {reply}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 font-mono text-sm text-red-200">
          {error}
        </div>
      )}
    </main>
  );
}
