import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

interface Props {
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught error:", error, info);
    this.setState({ info });
  }

  reset = (): void => {
    this.setState({ error: null, info: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col gap-3 overflow-auto bg-bg p-6 font-mono text-xs text-fg">
          <div className="text-sm font-semibold text-red-400">
            Renderer crashed
          </div>
          <pre className="whitespace-pre-wrap text-red-300">
            {this.state.error.message}
          </pre>
          {this.state.error.stack && (
            <pre className="whitespace-pre-wrap text-fg-muted">
              {this.state.error.stack}
            </pre>
          )}
          {this.state.info?.componentStack && (
            <pre className="whitespace-pre-wrap text-fg-muted">
              Component stack:{this.state.info.componentStack}
            </pre>
          )}
          <button
            type="button"
            onClick={this.reset}
            className="self-start rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-fg hover:bg-border"
          >
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
