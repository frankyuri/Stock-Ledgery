import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="label-caps text-down">發生未預期錯誤</p>
          <h2 className="mt-3 text-xl font-semibold text-ink dark:text-zinc-100">畫面暫時無法顯示</h2>
          <p className="mt-3 text-sm text-ink-mute dark:text-zinc-400">
            可以點下方按鈕重試；若持續發生請重新整理瀏覽器。
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-black/[0.04] p-3 text-left font-mono text-xs text-ink-soft dark:bg-white/5 dark:text-zinc-300">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={this.reset} className="btn">
              重試
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              重新整理
            </button>
          </div>
        </div>
      </div>
    );
  }
}
