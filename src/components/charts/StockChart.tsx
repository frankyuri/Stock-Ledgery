import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Logical,
  type LogicalRange,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import {
  CandlestickChart,
  LineChart as LineChartIcon,
  Maximize2,
  Minimize2,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Candle, Quote, Resolution } from '@/types/stock';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';

export interface ChartMarker {
  time: string;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  text?: string;
}

export interface StockChartProps {
  data: Candle[];
  symbol?: string;
  name?: string;
  quote?: Quote | null;
  height?: number;
  /** 目前 K 線 resolution，影響 range 按鈕的「1M / 3M…」對應幾根 */
  resolution?: Resolution;
  onResolutionChange?: (r: Resolution) => void;
  /** 52 週高，會以虛線標示於 Y 軸上 */
  fiftyTwoWeekHigh?: number;
  /** 52 週低，會以虛線標示於 Y 軸上 */
  fiftyTwoWeekLow?: number;
  /** 交易點 / 股息 / 拆股事件標記 */
  markers?: ChartMarker[];
  /** 自選清單（全螢幕快速切換用） */
  watchlist?: string[];
  /** 切換標的 callback（全螢幕快速切換用） */
  onSelectSymbol?: (sym: string) => void;
}

/** 不同 resolution 下「N 個月」對應幾根 K 棒 */
const BARS_PER_MONTH: Record<Resolution, number> = {
  '1D': 22,
  '1W': 4,
  '1M': 1,
};

const MA_OPTIONS = [
  { key: 'ma5', period: 5, color: '#0a84ff', label: 'MA5' },
  { key: 'ma20', period: 20, color: '#f59e0b', label: 'MA20' },
  { key: 'ma60', period: 60, color: '#af52de', label: 'MA60' },
] as const;

type MaKey = (typeof MA_OPTIONS)[number]['key'];

interface HoverInfo {
  candle: Candle;
  ma: Partial<Record<MaKey, number>>;
  bbUpper?: number;
  bbLower?: number;
  rsi?: number;
}

const TIME_RANGES = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '3Y', months: 36 },
  { label: 'ALL', months: 'all' as const },
] as const;

export function StockChart({
  data,
  symbol,
  name,
  quote,
  height = 460,
  resolution = '1D',
  onResolutionChange,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  markers,
  watchlist,
  onSelectSymbol,
}: StockChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const barsPerMonth = BARS_PER_MONTH[resolution];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const areaRef = useRef<ISeriesApi<'Area'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maSeriesRef = useRef<Record<MaKey, ISeriesApi<'Line'> | null>>({
    ma5: null,
    ma20: null,
    ma60: null,
  });
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const priceLinesRef = useRef<IPriceLine[]>([]);
  const dataRef = useRef<Candle[]>(data);
  dataRef.current = data;
  const fittedSeriesKeyRef = useRef<string | null>(null);

  const [chartReady, setChartReady] = useState(false);
  const [chartType, setChartType] = useState<'candle' | 'area'>('candle');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [enabledMA, setEnabledMA] = useState<Record<MaKey, boolean>>({
    ma5: false,
    ma20: true,
    ma60: false,
  });
  const [enabledBB, setEnabledBB] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Compute Moving Averages
  const maData = useMemo(() => {
    const out: Record<MaKey, Array<{ time: UTCTimestamp; value: number }>> = {
      ma5: [],
      ma20: [],
      ma60: [],
    };
    for (const { key, period } of MA_OPTIONS) {
      out[key] = computeMA(data, period);
    }
    return out;
  }, [data]);

  // Compute Bollinger Bands (20, 2σ)
  const { bbUpperData, bbLowerData, bbMap } = useMemo(() => {
    return computeBollingerBands(data, 20, 2);
  }, [data]);

  // Compute RSI-14
  const rsiMap = useMemo(() => {
    return computeRSIMap(data, 14);
  }, [data]);

  const bbMapRef = useRef(bbMap);
  bbMapRef.current = bbMap;
  const rsiMapRef = useRef(rsiMap);
  rsiMapRef.current = rsiMap;

  // Active Candle for OHLC HUD (hovered candle or the most recent candle)
  const latestCandle = data.length > 0 ? data[data.length - 1] : null;
  const activeCandle = hover?.candle ?? latestCandle;

  const activePrevCandle = useMemo(() => {
    if (!activeCandle || data.length < 2) return null;
    const idx = data.findIndex((c) => c.time === activeCandle.time);
    return idx > 0 ? data[idx - 1] : null;
  }, [activeCandle, data]);

  const candleChange = activeCandle
    ? activePrevCandle
      ? activeCandle.close - activePrevCandle.close
      : activeCandle.close - activeCandle.open
    : 0;

  const candleChangePercent = activeCandle
    ? activePrevCandle && activePrevCandle.close > 0
      ? ((activeCandle.close - activePrevCandle.close) / activePrevCandle.close) * 100
      : activeCandle.open > 0
      ? ((activeCandle.close - activeCandle.open) / activeCandle.open) * 100
      : 0
    : 0;

  const latestMa = useMemo(() => {
    const vals: Partial<Record<MaKey, number>> = {};
    for (const { key } of MA_OPTIONS) {
      const s = maData[key];
      if (s && s.length > 0) {
        vals[key] = s[s.length - 1].value;
      }
    }
    return vals;
  }, [maData]);

  const activeMa = hover?.ma ?? latestMa;

  const activeBb = useMemo(() => {
    if (hover) {
      return hover.bbUpper != null && hover.bbLower != null
        ? { upper: hover.bbUpper, lower: hover.bbLower }
        : null;
    }
    if (!activeCandle) return null;
    return bbMap.get(activeCandle.time) ?? null;
  }, [hover, activeCandle, bbMap]);

  const activeRsi = hover?.rsi ?? (activeCandle ? rsiMap.get(activeCandle.time) : undefined);

  // Toggle true Native Fullscreen + CSS Fullscreen
  const toggleFullscreen = async (forceState?: boolean) => {
    const nextState = forceState !== undefined ? forceState : !isFullscreen;
    if (nextState) {
      setIsFullscreen(true);
      try {
        const el = wrapperRef.current || document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch {
        // Fallback: CSS fixed inset-0 handles viewport expansion
      }
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (
          (document as any).webkitFullscreenElement &&
          (document as any).webkitExitFullscreen
        ) {
          await (document as any).webkitExitFullscreen();
        }
      } catch {
        // Fallback
      }
    }
  };

  // Sync state if user exits via browser native key (Esc, F11)
  useEffect(() => {
    const handleFsChange = () => {
      const isNative = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement,
      );
      if (!isNative && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [isFullscreen]);

  // Initialize Chart once on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#a1a1aa' : '#6e6e73',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)',
          labelBackgroundColor: '#0a84ff',
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)',
          labelBackgroundColor: '#0a84ff',
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const candle = chart.addCandlestickSeries({
      upColor: '#30d158',
      downColor: '#ff453a',
      borderUpColor: '#30d158',
      borderDownColor: '#ff453a',
      wickUpColor: '#30d158',
      wickDownColor: '#ff453a',
    });

    const area = chart.addAreaSeries({
      topColor: 'rgba(10, 132, 255, 0.35)',
      bottomColor: 'rgba(10, 132, 255, 0.02)',
      lineColor: '#0a84ff',
      lineWidth: 2,
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: '#475569',
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // MA Lines
    for (const { key, color } of MA_OPTIONS) {
      maSeriesRef.current[key] = chart.addLineSeries({
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }

    // Bollinger Bands Lines
    bbUpperSeriesRef.current = chart.addLineSeries({
      color: '#38bdf8',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbLowerSeriesRef.current = chart.addLineSeries({
      color: '#38bdf8',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candle;
    areaRef.current = area;
    volumeRef.current = volume;

    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (param.logical == null || !param.seriesData?.size) {
        setHover(null);
        return;
      }
      const latest = dataRef.current;
      const idx = Math.round(param.logical as unknown as number);
      const src = idx >= 0 && idx < latest.length ? latest[idx] : undefined;
      if (!src) {
        setHover(null);
        return;
      }

      const maVals: Partial<Record<MaKey, number>> = {};
      for (const { key } of MA_OPTIONS) {
        const series = maSeriesRef.current[key];
        if (!series) continue;
        const v = param.seriesData.get(series) as { value: number } | undefined;
        if (v) maVals[key] = v.value;
      }

      const bb = bbMapRef.current.get(src.time);
      const rsiVal = rsiMapRef.current.get(src.time);

      setHover({
        candle: src,
        ma: maVals,
        bbUpper: bb?.upper,
        bbLower: bb?.lower,
        rsi: rsiVal,
      });
    });

    setChartReady(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      areaRef.current = null;
      volumeRef.current = null;
      maSeriesRef.current = { ma5: null, ma20: null, ma60: null };
      bbUpperSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      priceLinesRef.current = [];
      fittedSeriesKeyRef.current = null;
      setChartReady(false);
    };
  }, []);

  // Dynamic ResizeObserver for responsive chart resizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chartRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: observedHeight } = entry.contentRect;
        if (width > 0 && observedHeight > 0) {
          chartRef.current?.applyOptions({ width, height: observedHeight });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [chartReady]);

  // Update height when changed in normal mode (responsive on mobile)
  useEffect(() => {
    if (!isFullscreen && containerRef.current) {
      const isMobile = window.innerWidth < 640;
      const targetHeight = isMobile ? Math.min(height, 330) : height;
      containerRef.current.style.height = `${targetHeight}px`;
    }
  }, [height, isFullscreen]);

  // Adjust margins and fitContent when toggling fullscreen
  useEffect(() => {
    if (!chartRef.current) return;

    if (isFullscreen) {
      // In fullscreen, give candles massive vertical space (5% top, 12% bottom)
      chartRef.current.applyOptions({
        rightPriceScale: {
          scaleMargins: { top: 0.05, bottom: 0.12 },
        },
      });
      volumeRef.current?.priceScale().applyOptions({
        scaleMargins: { top: 0.88, bottom: 0 },
      });
    } else {
      chartRef.current.applyOptions({
        rightPriceScale: {
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
      });
      volumeRef.current?.priceScale().applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
    }

    const timer = setTimeout(() => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          chartRef.current?.applyOptions({ width: clientWidth, height: clientHeight });
        }
      }
      chartRef.current?.timeScale().fitContent();
    }, 60);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Keyboard shortcuts in Fullscreen (Esc: Exit, F: Fit, 1/2/3: Resolution, ArrowLeft/Right: Watchlist)
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        toggleFullscreen(false);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        chartRef.current?.timeScale().fitContent();
      } else if (e.key === '1' && onResolutionChange) {
        e.preventDefault();
        onResolutionChange('1D');
      } else if (e.key === '2' && onResolutionChange) {
        e.preventDefault();
        onResolutionChange('1W');
      } else if (e.key === '3' && onResolutionChange) {
        e.preventDefault();
        onResolutionChange('1M');
      } else if (
        e.key === 'ArrowLeft' &&
        watchlist &&
        watchlist.length > 1 &&
        onSelectSymbol &&
        symbol
      ) {
        const idx = watchlist.indexOf(symbol);
        if (idx > 0) {
          e.preventDefault();
          onSelectSymbol(watchlist[idx - 1]);
        } else if (idx === 0) {
          e.preventDefault();
          onSelectSymbol(watchlist[watchlist.length - 1]);
        }
      } else if (
        e.key === 'ArrowRight' &&
        watchlist &&
        watchlist.length > 1 &&
        onSelectSymbol &&
        symbol
      ) {
        const idx = watchlist.indexOf(symbol);
        if (idx >= 0 && idx < watchlist.length - 1) {
          e.preventDefault();
          onSelectSymbol(watchlist[idx + 1]);
        } else if (idx === watchlist.length - 1) {
          e.preventDefault();
          onSelectSymbol(watchlist[0]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onResolutionChange, watchlist, symbol, onSelectSymbol]);

  // Lock body scroll in fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

  // React to Theme Changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        textColor: isDark ? '#a1a1aa' : '#6e6e73',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
      },
      rightPriceScale: { borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' },
      timeScale: { borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' },
      crosshair: {
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)',
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)',
        },
      },
    });
  }, [isDark]);

  // Update Data and Indicators
  useEffect(() => {
    if (!chartReady || !candleRef.current || !areaRef.current || !volumeRef.current) return;

    const candleSeries = candleRef.current;
    const areaSeries = areaRef.current;
    const volumeSeries = volumeRef.current;

    const candles = data.map((c) => ({
      time: c.time as unknown as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const areaPoints = data.map((c) => ({
      time: c.time as unknown as UTCTimestamp,
      value: c.close,
    }));

    const volumes = data.map((c) => ({
      time: c.time as unknown as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(48, 209, 88, 0.45)' : 'rgba(255, 69, 58, 0.45)',
    }));

    if (chartType === 'candle') {
      candleSeries.setData(candles);
      areaSeries.setData([]);
    } else {
      areaSeries.setData(areaPoints);
      candleSeries.setData([]);
    }

    volumeSeries.setData(volumes);

    // Update Moving Averages
    for (const { key } of MA_OPTIONS) {
      const series = maSeriesRef.current[key];
      if (!series) continue;
      series.setData(enabledMA[key] ? maData[key] : []);
    }

    // Update Bollinger Bands
    if (bbUpperSeriesRef.current && bbLowerSeriesRef.current) {
      bbUpperSeriesRef.current.setData(enabledBB ? bbUpperData : []);
      bbLowerSeriesRef.current.setData(enabledBB ? bbLowerData : []);
    }

    // 52-week High/Low price reference lines
    const activeSeries = chartType === 'candle' ? candleSeries : areaSeries;
    priceLinesRef.current.forEach((l) => activeSeries.removePriceLine(l));
    priceLinesRef.current = [];

    const high52 = fiftyTwoWeekHigh ?? quote?.fiftyTwoWeekHigh;
    const low52 = fiftyTwoWeekLow ?? quote?.fiftyTwoWeekLow;

    if (high52) {
      priceLinesRef.current.push(
        activeSeries.createPriceLine({
          price: high52,
          color: 'rgba(48, 209, 88, 0.6)',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: '52W 高',
        }),
      );
    }
    if (low52) {
      priceLinesRef.current.push(
        activeSeries.createPriceLine({
          price: low52,
          color: 'rgba(255, 69, 58, 0.6)',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: '52W 低',
        }),
      );
    }

    // Event Markers
    if (markers && markers.length > 0) {
      const seriesMarkers: SeriesMarker<Time>[] = markers
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((m) => ({
          time: m.time as unknown as Time,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        }));
      activeSeries.setMarkers(seriesMarkers);
    } else {
      activeSeries.setMarkers([]);
    }

    if (data.length > 0) {
      const seriesKey = `${data[0].time}|${resolution}|${chartType}`;
      if (fittedSeriesKeyRef.current !== seriesKey) {
        chartRef.current?.timeScale().fitContent();
        fittedSeriesKeyRef.current = seriesKey;
      }
    }
  }, [
    chartReady,
    data,
    chartType,
    enabledMA,
    enabledBB,
    maData,
    bbUpperData,
    bbLowerData,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    quote,
    markers,
    resolution,
  ]);

  function setRangeBars(bars: number | 'all') {
    const chart = chartRef.current;
    if (!chart || data.length === 0) return;
    if (bars === 'all') {
      chart.timeScale().fitContent();
      return;
    }
    const to = (data.length - 1) as unknown as Logical;
    const from = Math.max(0, data.length - 1 - bars) as unknown as Logical;
    const range: LogicalRange = { from, to };
    chart.timeScale().setVisibleLogicalRange(range);
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative transition-all',
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950 text-ink dark:text-zinc-100 select-none overflow-hidden h-screen w-screen'
          : 'w-full',
      )}
    >
      {/* ── FULLSCREEN TOP PRO BAR (Ultra-compact 44px) ── */}
      {isFullscreen ? (
        <header className="h-11 sm:h-12 px-3 sm:px-4 border-b border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
          {/* Left: Stock Identity & Real-time Quote */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="font-mono text-lg sm:text-xl font-black tracking-tight text-ink dark:text-zinc-100">
                {symbol || 'MARKET'}
              </span>
              {(name || quote?.name) && (
                <span className="hidden md:inline-block text-xs font-medium text-ink-mute dark:text-zinc-400 max-w-[120px] lg:max-w-[180px] truncate">
                  {name || quote?.name}
                </span>
              )}
              <span className="chip text-[10px] font-mono shrink-0 py-0.5">
                {quote?.exchangeName || 'TWSE'} · {quote?.currency || 'TWD'}
              </span>
            </div>

            {quote && (
              <div className="flex items-baseline gap-1.5 pl-2 sm:pl-3 border-l border-black/10 dark:border-white/10">
                <span className="font-mono text-base sm:text-lg font-black text-ink dark:text-zinc-100 num">
                  {formatNumber(quote.price)}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-0.5 font-mono text-xs font-bold num px-1.5 py-0.5 rounded-md',
                    quote.change > 0
                      ? 'bg-emerald-500/10 text-up dark:bg-emerald-500/20'
                      : quote.change < 0
                      ? 'bg-rose-500/10 text-down dark:bg-rose-500/20'
                      : 'bg-black/5 text-ink-mute dark:bg-white/10 dark:text-zinc-400',
                  )}
                >
                  {quote.change > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : quote.change < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {quote.change > 0 ? '+' : ''}
                  {formatNumber(quote.change)} ({formatPercent(quote.changePercent)})
                </span>
              </div>
            )}
          </div>

          {/* Right: Quick Switchers, Indicators, Timeframes, Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5">
            {/* Quick Watchlist switch chips */}
            {watchlist && watchlist.length > 0 && onSelectSymbol && (
              <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-black/10 dark:border-white/10 max-w-[240px] xl:max-w-[340px] overflow-x-auto scrollbar-none">
                {watchlist.slice(0, 8).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSelectSymbol(s)}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-mono font-semibold transition shrink-0',
                      symbol === s
                        ? 'bg-brand text-white shadow-xs'
                        : 'border border-black/10 bg-white/70 text-ink-soft hover:bg-white dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Resolution Picker (1D / 1W / 1M) */}
            {onResolutionChange && (
              <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70">
                {(['1D', '1W', '1M'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onResolutionChange(r)}
                    className={cn(
                      'rounded-md px-2 py-0.5 font-medium transition',
                      resolution === r
                        ? 'bg-brand text-white shadow-xs font-semibold'
                        : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                    )}
                    title={`切換至 ${r === '1D' ? '日K (按鍵 1)' : r === '1W' ? '週K (按鍵 2)' : '月K (按鍵 3)'}`}
                  >
                    {r === '1D' ? '日K' : r === '1W' ? '週K' : '月K'}
                  </button>
                ))}
              </div>
            )}

            {/* Chart Type Toggle */}
            <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70">
              <button
                type="button"
                onClick={() => setChartType('candle')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition',
                  chartType === 'candle'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                )}
                title="K 線圖 (Candlestick)"
              >
                <CandlestickChart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">K 線</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition',
                  chartType === 'area'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                )}
                title="折線走勢圖 (Area)"
              >
                <LineChartIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">走勢</span>
              </button>
            </div>

            {/* Indicators */}
            <div className="hidden sm:flex items-center gap-1">
              {MA_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setEnabledMA((s) => ({ ...s, [m.key]: !s[m.key] }))}
                  className={cn(
                    'chip cursor-pointer text-xs font-semibold py-0.5 transition',
                    enabledMA[m.key] ? 'text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/5',
                  )}
                  style={
                    enabledMA[m.key]
                      ? { backgroundColor: m.color, borderColor: m.color }
                      : { color: m.color }
                  }
                >
                  {m.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEnabledBB((v) => !v)}
                className={cn(
                  'chip cursor-pointer text-xs font-semibold py-0.5 transition',
                  enabledBB
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'text-sky-600 hover:bg-black/[0.04] dark:text-sky-400 dark:hover:bg-white/5',
                )}
                title="布林通道 (20, 2σ)"
              >
                BB
              </button>
            </div>

            {/* Time Range Selector */}
            <div className="hidden md:inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70 text-xs dark:border-white/10 dark:bg-zinc-800/70">
              {TIME_RANGES.map((x) => {
                const bars = x.months === 'all' ? 'all' : x.months * barsPerMonth;
                return (
                  <button
                    key={x.label}
                    type="button"
                    onClick={() => setRangeBars(bars)}
                    className="px-2 py-1 font-medium text-ink-soft transition hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/5"
                  >
                    {x.label}
                  </button>
                );
              })}
            </div>

            {/* Fit Content Action */}
            <button
              type="button"
              onClick={() => chartRef.current?.timeScale().fitContent()}
              className="flex items-center gap-1 rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs font-medium text-ink-soft shadow-xs transition hover:bg-white dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="最適縮放 (快捷鍵 F)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">最適化</span>
              <kbd className="hidden xl:inline rounded bg-black/5 px-1 py-0.5 text-[10px] text-ink-mute dark:bg-white/10 dark:text-zinc-400">
                F
              </kbd>
            </button>

            {/* Exit Fullscreen Action */}
            <button
              type="button"
              onClick={() => toggleFullscreen(false)}
              className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2.5 py-1 text-xs font-bold transition shadow-xs"
              title="退出全螢幕 (快捷鍵 Esc)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
              <kbd className="rounded bg-rose-600/10 dark:bg-rose-400/20 px-1 py-0.5 text-[10px]">
                Esc
              </kbd>
            </button>
          </div>
        </header>
      ) : (
        /* ── STANDARD MODE TOOLBAR ── */
        <div className="mb-2 sm:mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex overflow-x-auto no-scrollbar items-center gap-1.5 sm:gap-2 min-w-0 max-w-full pb-0.5">
            {/* Chart Type Toggle */}
            <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70 shrink-0">
              <button
                type="button"
                onClick={() => setChartType('candle')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 font-medium transition touch-action-manipulation',
                  chartType === 'candle'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                )}
                title="K 線圖 (Candlestick)"
              >
                <CandlestickChart className="h-3.5 w-3.5" />
                <span>K 線</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 font-medium transition touch-action-manipulation',
                  chartType === 'area'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                )}
                title="折線走勢圖 (Area)"
              >
                <LineChartIcon className="h-3.5 w-3.5" />
                <span>走勢</span>
              </button>
            </div>

            <div className="h-4 w-px bg-black/10 dark:bg-white/10 shrink-0" />

            {/* Technical Indicator Chips */}
            {MA_OPTIONS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setEnabledMA((s) => ({ ...s, [m.key]: !s[m.key] }))}
                className={cn(
                  'chip cursor-pointer text-xs font-semibold transition shrink-0 touch-action-manipulation',
                  enabledMA[m.key] ? 'text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/5',
                )}
                style={
                  enabledMA[m.key]
                    ? { backgroundColor: m.color, borderColor: m.color }
                    : { color: m.color }
                }
              >
                {m.label}
              </button>
            ))}

            {/* Bollinger Bands Toggle */}
            <button
              type="button"
              onClick={() => setEnabledBB((v) => !v)}
              className={cn(
                'chip cursor-pointer text-xs font-semibold transition shrink-0 touch-action-manipulation',
                enabledBB
                  ? 'bg-sky-500 text-white border-sky-500'
                  : 'text-sky-600 hover:bg-black/[0.04] dark:text-sky-400 dark:hover:bg-white/5',
              )}
              title="布林通道 (20, 2σ)"
            >
              BB
            </button>
          </div>

          {/* Time Range Selector & Fullscreen Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70 text-xs dark:border-white/10 dark:bg-zinc-800/70">
              {TIME_RANGES.map((x) => {
                const bars = x.months === 'all' ? 'all' : x.months * barsPerMonth;
                return (
                  <button
                    key={x.label}
                    type="button"
                    onClick={() => setRangeBars(bars)}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 font-medium text-ink-soft transition hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/5 touch-action-manipulation"
                  >
                    {x.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => toggleFullscreen(true)}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-ink-soft shadow-xs transition hover:bg-white hover:text-brand dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-brand touch-action-manipulation"
              title="全螢幕檢視 (TradingView 模式)"
              aria-label="全螢幕檢視"
            >
              <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── CHART CANVAS AREA ── */}
      <div
        className={cn(
          'relative w-full',
          isFullscreen ? 'flex-1 min-h-0 h-full overflow-hidden' : '',
        )}
      >
        <div
          ref={containerRef}
          className="w-full h-full transition-all"
          style={{ height: isFullscreen ? '100%' : `${height}px` }}
        />

        {/* ── TRADINGVIEW-STYLE INLINE FLOATING LEGEND (Zero vertical space wasted) ── */}
        {isFullscreen && (
          <>
            <div className="pointer-events-none absolute left-3 top-2.5 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink/80 dark:text-zinc-300 select-none backdrop-blur-xs px-2 py-1 rounded-md bg-white/40 dark:bg-zinc-900/40">
              <span className="font-semibold text-ink dark:text-zinc-100 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {activeCandle ? activeCandle.time : '—'}
              </span>

              {activeCandle && (
                <>
                  <span>
                    開 <span className="font-semibold text-ink dark:text-zinc-100">{formatNumber(activeCandle.open)}</span>
                  </span>
                  <span>
                    高 <span className="font-semibold text-up">{formatNumber(activeCandle.high)}</span>
                  </span>
                  <span>
                    低 <span className="font-semibold text-down">{formatNumber(activeCandle.low)}</span>
                  </span>
                  <span>
                    收{' '}
                    <span className={cn('font-semibold', candleChange >= 0 ? 'text-up' : 'text-down')}>
                      {formatNumber(activeCandle.close)}
                    </span>
                  </span>
                  <span className={cn('font-semibold', candleChange >= 0 ? 'text-up' : 'text-down')}>
                    {candleChange >= 0 ? '+' : ''}
                    {formatNumber(candleChange)} ({candleChangePercent >= 0 ? '+' : ''}
                    {candleChangePercent.toFixed(2)}%)
                  </span>
                  <span className="text-ink-mute dark:text-zinc-400">
                    量 <span className="font-semibold text-ink dark:text-zinc-200">{formatVolume(activeCandle.volume)}</span>
                  </span>
                </>
              )}

              {/* Indicator values */}
              {MA_OPTIONS.map((m) =>
                enabledMA[m.key] && activeMa[m.key] != null ? (
                  <span key={m.key} style={{ color: m.color }} className="font-semibold">
                    {m.label} {formatNumber(activeMa[m.key]!)}
                  </span>
                ) : null,
              )}

              {enabledBB && activeBb && (
                <span className="text-sky-500 dark:text-sky-400 font-semibold">
                  BB {formatNumber(activeBb.lower)}~{formatNumber(activeBb.upper)}
                </span>
              )}

              {activeRsi != null && (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                    activeRsi >= 70
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : activeRsi <= 30
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-black/5 text-ink-mute dark:bg-white/10 dark:text-zinc-400',
                  )}
                >
                  RSI(14) {activeRsi.toFixed(1)}
                </span>
              )}
            </div>

            {/* Top-Right keyboard helper pill */}
            <div className="pointer-events-none absolute right-3 top-2.5 z-10 hidden xl:flex items-center gap-2.5 text-[11px] text-ink-mute dark:text-zinc-400 font-sans select-none backdrop-blur-xs px-2 py-1 rounded-md bg-white/40 dark:bg-zinc-900/40">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 font-mono text-[10px]">Esc</kbd> 退出
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 font-mono text-[10px]">F</kbd> 最適縮放
              </span>
              {onResolutionChange && (
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 font-mono text-[10px]">1/2/3</kbd> 週期
                </span>
              )}
              {watchlist && watchlist.length > 1 && onSelectSymbol && (
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 font-mono text-[10px]">←/→</kbd> 切換標的
                </span>
              )}
            </div>
          </>
        )}

        {/* Hover Info Tooltip (Rendered only in Standard Mode) */}
        {!isFullscreen && hover && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl border border-black/10 bg-white/95 px-4 py-3 text-[13px] text-ink-soft shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/95 dark:text-zinc-300">
            <div className="mb-1.5 font-mono text-sm font-semibold text-ink dark:text-zinc-100 flex items-center justify-between gap-4">
              <span>{hover.candle.time}</span>
              {hover.rsi != null && (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-semibold',
                    hover.rsi >= 70
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : hover.rsi <= 30
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-black/5 text-ink-mute dark:bg-white/10 dark:text-zinc-400',
                  )}
                >
                  RSI(14): {hover.rsi.toFixed(1)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs">
              <span>
                開盤 <span className="ml-1 font-semibold text-ink dark:text-zinc-100">{formatNumber(hover.candle.open)}</span>
              </span>
              <span>
                最高 <span className="ml-1 font-semibold text-up">{formatNumber(hover.candle.high)}</span>
              </span>
              <span>
                收盤{' '}
                <span
                  className={cn(
                    'ml-1 font-semibold',
                    hover.candle.close >= hover.candle.open ? 'text-up' : 'text-down',
                  )}
                >
                  {formatNumber(hover.candle.close)}
                </span>
              </span>
              <span>
                最低 <span className="ml-1 font-semibold text-down">{formatNumber(hover.candle.low)}</span>
              </span>
              <span className="col-span-2">
                成交量{' '}
                <span className="ml-1 font-semibold text-ink dark:text-zinc-100">
                  {formatVolume(hover.candle.volume)}
                </span>
              </span>
              {MA_OPTIONS.map((m) =>
                enabledMA[m.key] && hover.ma[m.key] != null ? (
                  <span key={m.key} style={{ color: m.color }} className="font-semibold">
                    {m.label} {formatNumber(hover.ma[m.key]!)}
                  </span>
                ) : null,
              )}
              {enabledBB && hover.bbUpper != null && hover.bbLower != null && (
                <span className="col-span-2 text-sky-500 dark:text-sky-400 font-semibold">
                  BB軌: {formatNumber(hover.bbLower)} ~ {formatNumber(hover.bbUpper)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function computeMA(
  data: Candle[],
  period: number,
): Array<{ time: UTCTimestamp; value: number }> {
  const out: Array<{ time: UTCTimestamp; value: number }> = [];
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) {
      out.push({ time: data[i].time as unknown as UTCTimestamp, value: sum / period });
    }
  }
  return out;
}

function computeBollingerBands(
  data: Candle[],
  period = 20,
  stdDevMultiplier = 2,
) {
  const upperData: Array<{ time: UTCTimestamp; value: number }> = [];
  const lowerData: Array<{ time: UTCTimestamp; value: number }> = [];
  const bbMap = new Map<string, { upper: number; lower: number }>();

  if (data.length < period) {
    return { bbUpperData: upperData, bbLowerData: lowerData, bbMap };
  }

  for (let i = period - 1; i < data.length; i += 1) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, c) => acc + c.close, 0) / period;
    const variance =
      slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = Math.round((mean + stdDevMultiplier * stdDev) * 100) / 100;
    const lower = Math.round((mean - stdDevMultiplier * stdDev) * 100) / 100;
    const time = data[i].time;

    upperData.push({ time: time as unknown as UTCTimestamp, value: upper });
    lowerData.push({ time: time as unknown as UTCTimestamp, value: lower });
    bbMap.set(time, { upper, lower });
  }

  return { bbUpperData: upperData, bbLowerData: lowerData, bbMap };
}

function computeRSIMap(data: Candle[], period = 14): Map<string, number> {
  const map = new Map<string, number>();
  if (data.length <= period) return map;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  map.set(data[period].time, Math.round(rsi * 10) / 10);

  for (let i = period + 1; i < data.length; i += 1) {
    const diff = data[i].close - data[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    map.set(data[i].time, Math.round(rsi * 10) / 10);
  }

  return map;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toString();
}
