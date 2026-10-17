import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTheme } from '@/lib/theme';
import type { ReturnPoint } from '@/lib/riskAnalytics';

interface Props {
  data: ReturnPoint[];
  height?: number;
}

export function UnderwaterChart({ data, height = 180 }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#a1a1aa' : '#6e6e73',
      },
      grid: {
        vertLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        },
        horzLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        timeVisible: false,
        secondsVisible: false,
      },
    });

    const series = chart.addAreaSeries({
      lineColor: '#f43f5e',
      topColor: 'rgba(244, 63, 94, 0.02)',
      bottomColor: 'rgba(244, 63, 94, 0.35)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (val: number) => `${val.toFixed(2)}%`,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        textColor: isDark ? '#a1a1aa' : '#6e6e73',
      },
      grid: {
        vertLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        },
        horzLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      },
    });
  }, [isDark]);

  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    seriesRef.current.setData(
      data.map((d) => ({
        time: d.time as unknown as UTCTimestamp,
        value: d.drawdown,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
