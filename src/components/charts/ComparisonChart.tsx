import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTheme } from '@/lib/theme';
import type { ReturnPoint } from '@/lib/riskAnalytics';

interface Props {
  data: ReturnPoint[];
  benchmarkLabel?: string;
  height?: number;
}

export function ComparisonChart({
  data,
  benchmarkLabel = 'S&P 500',
  height = 320,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const portSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const benchSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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

    const portSeries = chart.addLineSeries({
      color: '#0a84ff',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
      },
    });

    const benchSeries = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceFormat: {
        type: 'custom',
        formatter: (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
      },
    });

    chartRef.current = chart;
    portSeriesRef.current = portSeries;
    benchSeriesRef.current = benchSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      portSeriesRef.current = null;
      benchSeriesRef.current = null;
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
    if (!portSeriesRef.current || !benchSeriesRef.current || data.length === 0)
      return;

    const portData = data.map((d) => ({
      time: d.time as unknown as UTCTimestamp,
      value: d.portfolio,
    }));

    const benchData = data.map((d) => ({
      time: d.time as unknown as UTCTimestamp,
      value: d.benchmark,
    }));

    portSeriesRef.current.setData(portData);
    benchSeriesRef.current.setData(benchData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center justify-end gap-4 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#0a84ff]" />
          <span className="text-slate-800 dark:text-zinc-200">個人投資組合</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-b-2 border-dashed border-[#a855f7]" />
          <span className="text-slate-600 dark:text-zinc-400">{benchmarkLabel}</span>
        </div>
      </div>
      <div ref={containerRef} style={{ height }} className="w-full" />
    </div>
  );
}
