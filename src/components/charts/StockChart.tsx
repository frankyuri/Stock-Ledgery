import { useEffect, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '@/types/stock';

interface StockChartProps {
  data: Candle[];
  height?: number;
}

export function StockChart({ data, height = 420 }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRef = useRef<ISeriesApi<'Line'> | null>(null);

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
      rightPriceScale: {
        borderColor: 'rgba(0, 0, 0, 0.08)',
      },
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
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const ma = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    maRef.current = ma;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      maRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !maRef.current) return;

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

    const ma20 = computeMA(data, 20);

    candleRef.current.setData(candles);
    volumeRef.current.setData(volumes);
    maRef.current.setData(ma20);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="h-[420px] w-full" />;
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
