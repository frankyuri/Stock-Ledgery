import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';
type ThemeSource = 'system' | 'manual';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  /** 'system' = 跟隨系統；'manual' = 使用者明確選過 */
  source: ThemeSource;
  /** 把選擇權交回給系統 */
  followSystem: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'stock-ledgery-theme';

function systemPrefers(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readInitial(): { theme: Theme; source: ThemeSource } {
  if (typeof window === 'undefined') return { theme: 'light', source: 'system' };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return { theme: stored, source: 'manual' };
    }
  } catch {
    /* ignore */
  }
  return { theme: systemPrefers(), source: 'system' };
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readInitial().theme);
  const [source, setSource] = useState<ThemeSource>(() => readInitial().source);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  // 只有 manual 才落地到 storage；system 模式刻意不寫，
  // 否則下次開站讀到 storage 會被當成 manual，永遠跟不上系統
  useEffect(() => {
    try {
      if (source === 'manual') {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [theme, source]);

  // 在 system 模式時跟著 OS 偏好變
  useEffect(() => {
    if (source !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setThemeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [source]);

  const setTheme = useCallback((t: Theme) => {
    setSource('manual');
    setThemeState(t);
  }, []);
  const toggle = useCallback(() => {
    setSource('manual');
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);
  const followSystem = useCallback(() => {
    setSource('system');
    setThemeState(systemPrefers());
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggle, source, followSystem }),
    [theme, setTheme, toggle, source, followSystem],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light',
      setTheme: () => {},
      toggle: () => {},
      source: 'system',
      followSystem: () => {},
    };
  }
  return ctx;
}
