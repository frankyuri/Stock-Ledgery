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

    const isChunkError =
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Failed to fetch dynamically imported') ||
      error.message?.includes('Loading chunk');

    if (isChunkError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="card w-full max-w-md p-8 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand mb-4">
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            </div>
            <p className="text-xs font-bold text-brand uppercase tracking-wider">系統版本更新</p>
            <h2 className="mt-2 text-xl font-bold text-ink dark:text-zinc-100">偵測到最新版本發布</h2>
            <p className="mt-2 text-sm text-ink-mute dark:text-zinc-400 leading-relaxed">
              Stocktify 已發布最新版本功能，只需重新載入頁面即可獲取最新的元件與數據！
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-primary px-6 py-2.5 text-sm font-semibold shadow-md"
              >
                立即更新載入 (重新整理)
              </button>
            </div>
          </div>
        </div>
      );
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
