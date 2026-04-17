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
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '@/types/stock';
import { cn } from '@/lib/cn';

interface StockChartProps {
  data: Candle[];
  height?: number;
  /** 52 週高，會以虛線標示於 Y 軸上 */
  fiftyTwoWeekHigh?: number;
  /** 52 週低，會以虛線標示於 Y 軸上 */
  fiftyTwoWeekLow?: number;
}

const MA_OPTIONS = [
  { key: 'ma5', period: 5, color: '#0a84ff', label: 'MA5' },
  { key: 'ma20', period: 20, color: '#f59e0b', label: 'MA20' },
  { key: 'ma60', period: 60, color: '#af52de', label: 'MA60' },
] as const;

type MaKey = (typeof MA_OPTIONS)[number]['key'];

interface HoverInfo {
  candle: Candle;
  ma: Partial<Record<MaKey, number>>;
}

export function StockChart({
  data,
  height = 420,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maSeriesRef = useRef<Record<MaKey, ISeriesApi<'Line'> | null>>({
    ma5: null,
    ma20: null,
    ma60: null,
  });
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [enabledMA, setEnabledMA] = useState<Record<MaKey, boolean>>({
    ma5: false,
    ma20: true,
    ma60: false,
  });
  const [hover, setHover] = useState<HoverInfo | null>(null);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6e6e73',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.04)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(0, 0, 0, 0.08)' },
      timeScale: {
        borderColor: 'rgba(0, 0, 0, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0, 0, 0, 0.18)',
          labelBackgroundColor: '#0a84ff',
        },
        horzLine: {
          color: 'rgba(0, 0, 0, 0.18)',
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

    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: '#475569',
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    for (const { key, color } of MA_OPTIONS) {
      maSeriesRef.current[key] = chart.addLineSeries({
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;

    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.seriesData?.size) {
        setHover(null);
        return;
      }
      const c = param.seriesData.get(candle) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!c) {
        setHover(null);
        return;
      }
      const idx = data.findIndex((d) => d.time === (param.time as unknown as string));
      const src = idx >= 0 ? data[idx] : undefined;
      const maVals: Partial<Record<MaKey, number>> = {};
      for (const { key } of MA_OPTIONS) {
        const series = maSeriesRef.current[key];
        if (!series) continue;
        const v = param.seriesData.get(series) as { value: number } | undefined;
        if (v) maVals[key] = v.value;
      }
      setHover({
        candle: {
          time: (param.time as unknown as string) ?? src?.time ?? '',
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: src?.volume ?? 0,
        },
        ma: maVals,
      });
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      maSeriesRef.current = { ma5: null, ma20: null, ma60: null };
      priceLinesRef.current = [];
    };
  }, [height, data]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;

    const candles = data.map((c) => ({
      time: c.time as unknown as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumes = data.map((c) => ({
      time: c.time as unknown as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(48, 209, 88, 0.45)' : 'rgba(255, 69, 58, 0.45)',
    }));

    candleRef.current.setData(candles);
    volumeRef.current.setData(volumes);

    for (const { key } of MA_OPTIONS) {
      const series = maSeriesRef.current[key];
      if (!series) continue;
      series.setData(enabledMA[key] ? maData[key] : []);
    }

    // 52 週高低參考線
    const candle = candleRef.current;
    priceLinesRef.current.forEach((l) => candle.removePriceLine(l));
    priceLinesRef.current = [];
    if (fiftyTwoWeekHigh) {
      priceLinesRef.current.push(
        candle.createPriceLine({
          price: fiftyTwoWeekHigh,
          color: 'rgba(48, 209, 88, 0.6)',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: '52W High',
        }),
      );
    }
    if (fiftyTwoWeekLow) {
      priceLinesRef.current.push(
        candle.createPriceLine({
          price: fiftyTwoWeekLow,
          color: 'rgba(255, 69, 58, 0.6)',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: '52W Low',
        }),
      );
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, enabledMA, maData, fiftyTwoWeekHigh, fiftyTwoWeekLow]);

  function setRange(days: number | 'all') {
    const chart = chartRef.current;
    if (!chart || data.length === 0) return;
    if (days === 'all') {
      chart.timeScale().fitContent();
      return;
    }
    const to = (data.length - 1) as unknown as Logical;
    const from = Math.max(0, data.length - 1 - days) as unknown as Logical;
    const range: LogicalRange = { from, to };
    chart.timeScale().setVisibleLogicalRange(range);
  }

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {MA_OPTIONS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() =>
                setEnabledMA((s) => ({ ...s, [m.key]: !s[m.key] }))
              }
              className={cn(
                'chip cursor-pointer transition',
                enabledMA[m.key]
                  ? 'border-transparent text-white'
                  : 'hover:bg-black/[0.04]',
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
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70 text-[11px]">
          {(
            [
              { label: '1M', d: 22 },
              { label: '3M', d: 66 },
              { label: '6M', d: 132 },
              { label: '1Y', d: 252 },
              { label: 'ALL', d: 'all' as const },
            ] as const
          ).map((x) => (
            <button
              key={x.label}
              type="button"
              onClick={() => setRange(x.d)}
              className="px-2.5 py-1 font-medium text-ink-soft transition hover:bg-black/[0.04]"
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="h-[420px] w-full" style={{ height }} />

      {hover && (
        <div className="pointer-events-none absolute left-3 top-12 rounded-lg border border-black/5 bg-white/80 px-3 py-2 text-[11px] text-ink-soft shadow-pop backdrop-blur-xl">
          <div className="mb-1 font-mono text-ink">{hover.candle.time}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
            <span>
              開{' '}
              <span className="text-ink">{hover.candle.open.toFixed(2)}</span>
            </span>
            <span>
              高{' '}
              <span className="text-up">{hover.candle.high.toFixed(2)}</span>
            </span>
            <span>
              收{' '}
              <span
                className={cn(
                  hover.candle.close >= hover.candle.open ? 'text-up' : 'text-down',
                )}
              >
                {hover.candle.close.toFixed(2)}
              </span>
            </span>
            <span>
              低{' '}
              <span className="text-down">{hover.candle.low.toFixed(2)}</span>
            </span>
            <span className="col-span-2">
              量 <span className="text-ink">{formatVolume(hover.candle.volume)}</span>
            </span>
            {MA_OPTIONS.map((m) =>
              enabledMA[m.key] && hover.ma[m.key] != null ? (
                <span key={m.key} style={{ color: m.color }}>
                  {m.label} {hover.ma[m.key]!.toFixed(2)}
                </span>
              ) : null,
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

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toString();
}
