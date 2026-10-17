import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  push: (tone: ToastTone, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, string> = {
  info: 'border-brand/30 bg-white/95 dark:bg-zinc-900/95 text-ink dark:text-zinc-100 shadow-glass',
  success:
    'border-up/40 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 shadow-glass',
  error:
    'border-down/40 bg-rose-50/95 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 shadow-glass',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      setToasts((arr) => [...arr, { id, tone, message }]);
      const handle = window.setTimeout(() => dismiss(id), 4200);
      timers.current.set(id, handle);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((h) => window.clearTimeout(h));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2.5"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm shadow-pop backdrop-blur-2xl transition animate-in fade-in slide-in-from-top-2',
              TONE_STYLE[t.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">
              {t.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {t.tone === 'error' && <AlertCircle className="h-4 w-4 text-rose-500" />}
              {t.tone === 'info' && <Info className="h-4 w-4 text-brand" />}
            </span>
            <span className="flex-1 text-xs font-semibold leading-relaxed">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 text-ink-mute hover:text-ink dark:hover:text-zinc-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: (_, m) => console.warn('[toast: no provider]', m),
      success: (m) => console.warn('[toast: no provider]', m),
      error: (m) => console.warn('[toast: no provider]', m),
      info: (m) => console.warn('[toast: no provider]', m),
    };
  }
  return ctx;
}
