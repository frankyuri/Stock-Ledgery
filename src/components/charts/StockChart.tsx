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
} from 'lucide-react';
import type { Candle } from '@/types/stock';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';

export interface ChartMarker {
  time: string;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  text?: string;
}

interface StockChartProps {
  data: Candle[];
  height?: number;
  /** 目前 K 線 resolution，影響 range 按鈕的「1M / 3M…」對應幾根 */
  resolution?: '1D' | '1W' | '1M';
  /** 52 週高，會以虛線標示於 Y 軸上 */
  fiftyTwoWeekHigh?: number;
  /** 52 週低，會以虛線標示於 Y 軸上 */
  fiftyTwoWeekLow?: number;
  /** 交易點 / 股息 / 拆股事件標記 */
  markers?: ChartMarker[];
}

/** 不同 resolution 下「N 個月」對應幾根 K 棒 */
const BARS_PER_MONTH: Record<NonNullable<StockChartProps['resolution']>, number> = {
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

export function StockChart({
  data,
  height = 420,
  resolution = '1D',
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  markers,
}: StockChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const barsPerMonth = BARS_PER_MONTH[resolution];
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

  // Initialize Chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height: isFullscreen ? 560 : height,
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
      rightPriceScale: { borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' },
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

      const bb = bbMap.get(src.time);
      const rsiVal = rsiMap.get(src.time);

      setHover({
        candle: src,
        ma: maVals,
        bbUpper: bb?.upper,
        bbLower: bb?.lower,
        rsi: rsiVal,
      });
    });

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
    };
  }, [height, isFullscreen]);

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
    if (!candleRef.current || !areaRef.current || !volumeRef.current) return;

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

    if (fiftyTwoWeekHigh) {
      priceLinesRef.current.push(
        activeSeries.createPriceLine({
          price: fiftyTwoWeekHigh,
          color: 'rgba(48, 209, 88, 0.6)',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: '52W 高',
        }),
      );
    }
    if (fiftyTwoWeekLow) {
      priceLinesRef.current.push(
        activeSeries.createPriceLine({
          price: fiftyTwoWeekLow,
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
    data,
    chartType,
    enabledMA,
    enabledBB,
    maData,
    bbUpperData,
    bbLowerData,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
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
    <div className={cn('relative transition-all', isFullscreen && 'fixed inset-4 z-50 rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden')}>
      {/* Chart Top Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70">
            <button
              type="button"
              onClick={() => setChartType('candle')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition',
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
                'flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition',
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

          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

          {/* Technical Indicator Chips */}
          {MA_OPTIONS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setEnabledMA((s) => ({ ...s, [m.key]: !s[m.key] }))}
              className={cn(
                'chip cursor-pointer text-xs font-semibold transition',
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
              'chip cursor-pointer text-xs font-semibold transition',
              enabledBB
                ? 'bg-sky-500 text-white border-sky-500'
                : 'text-sky-600 hover:bg-black/[0.04] dark:text-sky-400 dark:hover:bg-white/5',
            )}
            title="布林通道 (20, 2σ)"
          >
            BB (20,2)
          </button>
        </div>

        {/* Time Range Selector & Fullscreen Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70 text-xs dark:border-white/10 dark:bg-zinc-800/70">
            {(
              [
                { label: '1M', months: 1 },
                { label: '3M', months: 3 },
                { label: '6M', months: 6 },
                { label: '1Y', months: 12 },
                { label: '3Y', months: 36 },
                { label: 'ALL', months: 'all' as const },
              ] as const
            ).map((x) => {
              const bars = x.months === 'all' ? 'all' : x.months * barsPerMonth;
              return (
                <button
                  key={x.label}
                  type="button"
                  onClick={() => setRangeBars(bars)}
                  className="px-3 py-1.5 font-medium text-ink-soft transition hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  {x.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-ink-soft shadow-xs transition hover:bg-white dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title={isFullscreen ? '還原檢視' : '全螢幕檢視'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        ref={containerRef}
        className="w-full transition-all"
        style={{ height: isFullscreen ? 560 : height }}
      />

      {/* Hover Info Tooltip */}
      {hover && (
        <div className="pointer-events-none absolute left-3 top-14 rounded-xl border border-black/10 bg-white/95 px-4 py-3 text-[13px] text-ink-soft shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/95 dark:text-zinc-300">
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
              開盤 <span className="ml-1 font-semibold text-ink dark:text-zinc-100">{hover.candle.open.toFixed(2)}</span>
            </span>
            <span>
              最高 <span className="ml-1 font-semibold text-up">{hover.candle.high.toFixed(2)}</span>
            </span>
            <span>
              收盤{' '}
              <span
                className={cn(
                  'ml-1 font-semibold',
                  hover.candle.close >= hover.candle.open ? 'text-up' : 'text-down',
                )}
              >
                {hover.candle.close.toFixed(2)}
              </span>
            </span>
            <span>
              最低 <span className="ml-1 font-semibold text-down">{hover.candle.low.toFixed(2)}</span>
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
                  {m.label} {hover.ma[m.key]!.toFixed(2)}
                </span>
              ) : null,
            )}
            {enabledBB && hover.bbUpper != null && hover.bbLower != null && (
              <span className="col-span-2 text-sky-500 dark:text-sky-400 font-semibold">
                BB軌: {hover.bbLower.toFixed(2)} ~ {hover.bbUpper.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}
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
