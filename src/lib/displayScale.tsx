import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DisplayScale = '100%' | '115%' | '130%' | '150%';

export interface DisplayScaleOption {
  value: DisplayScale;
  label: string;
  desc: string;
  desktopPx: number;
  mobilePx: number;
}

export const DISPLAY_SCALES: DisplayScaleOption[] = [
  { value: '100%', label: '100%', desc: '緊湊 (14px)', desktopPx: 14, mobilePx: 13 },
  { value: '115%', label: '115%', desc: '標準 (16px)', desktopPx: 16, mobilePx: 14 },
  { value: '130%', label: '130%', desc: '舒適 (18px)', desktopPx: 18, mobilePx: 15 },
  { value: '150%', label: '150%', desc: '放大 (21px - 和諧)', desktopPx: 21, mobilePx: 16 },
];

interface DisplayScaleContextValue {
  scale: DisplayScale;
  setScale: (s: DisplayScale) => void;
  scaleOptions: DisplayScaleOption[];
}

const DisplayScaleContext = createContext<DisplayScaleContextValue | null>(null);
const STORAGE_KEY = 'stock-ledgery-display-scale';

function getInitialScale(): DisplayScale {
  if (typeof window === 'undefined') return '150%';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && DISPLAY_SCALES.some((s) => s.value === stored)) {
      return stored as DisplayScale;
    }
  } catch {
    /* ignore */
  }
  return '150%'; // Default to 150% as requested by the user
}

export function DisplayScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<DisplayScale>(getInitialScale);

  const applyScale = useCallback((currentScale: DisplayScale) => {
    const config = DISPLAY_SCALES.find((s) => s.value === currentScale) || DISPLAY_SCALES[3];
    const isMobile = window.innerWidth < 1024;
    const px = isMobile ? config.mobilePx : config.desktopPx;
    document.documentElement.style.setProperty('--font-size-base', `${px}px`);
  }, []);

  useEffect(() => {
    applyScale(scale);
    try {
      window.localStorage.setItem(STORAGE_KEY, scale);
    } catch {
      /* ignore */
    }

    const handleResize = () => {
      applyScale(scale);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scale, applyScale]);

  const setScale = useCallback((s: DisplayScale) => {
    setScaleState(s);
  }, []);

  const value = useMemo(
    () => ({ scale, setScale, scaleOptions: DISPLAY_SCALES }),
    [scale, setScale],
  );

  return (
    <DisplayScaleContext.Provider value={value}>
      {children}
    </DisplayScaleContext.Provider>
  );
}

export function useDisplayScale(): DisplayScaleContextValue {
  const ctx = useContext(DisplayScaleContext);
  if (!ctx) {
    return {
      scale: '150%',
      setScale: () => {},
      scaleOptions: DISPLAY_SCALES,
    };
  }
  return ctx;
}
