import { Terminal } from "./components/Terminal";

export function App() {
  return (
    <main className="flex h-full overflow-hidden bg-zinc-950 text-zinc-100">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-9 shrink-0 items-center border-b border-zinc-800 px-3 text-xs font-medium tracking-wide text-zinc-400 uppercase">
          terminal · claude
        </header>
        <Terminal command="claude" className="min-h-0 flex-1 overflow-hidden" />
      </section>
      <aside className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-900/60">
        <header className="flex h-9 shrink-0 items-center border-b border-zinc-800 px-3 text-xs font-medium tracking-wide text-zinc-400 uppercase">
          side panel
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-500">
          Hook-driven side panel arrives in iteration 3.
        </div>
      </aside>
    </main>
  );
}
