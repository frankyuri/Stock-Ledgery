import { useEffect, useRef, useState } from 'react';
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTheme } from '@/lib/theme';
import { formatNumber } from '@/lib/format';
import type { ProjectionPoint } from '@/lib/fireAnalytics';

interface Props {
  data: ProjectionPoint[];
  height?: number;
}

export function FireProjectionChart({ data, height = 340 }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const wealthSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const contSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const targetSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<ProjectionPoint | null>(null);

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
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: LineStyle.Dotted,
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: LineStyle.Dotted,
        },
      },
    });

    const formatCurrencyShort = (val: number) => {
      if (val >= 100_000_000) return `${(val / 100_000_000).toFixed(1)}億`;
      if (val >= 10_000) return `${(val / 10_000).toFixed(0)}萬`;
      return `${val}`;
    };

    // 1. 預估累積總資產 (Area)
    const wealthSeries = chart.addAreaSeries({
      topColor: 'rgba(16, 185, 129, 0.38)',
      bottomColor: 'rgba(16, 185, 129, 0.02)',
      lineColor: '#10b981',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: formatCurrencyShort,
      },
    });

    // 2. 累計投入本金 (Line)
    const contSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceFormat: {
        type: 'custom',
        formatter: formatCurrencyShort,
      },
    });

    // 3. FIRE 目標門檻基準線 (Line)
    const targetSeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceFormat: {
        type: 'custom',
        formatter: formatCurrencyShort,
      },
    });

    chartRef.current = chart;
    wealthSeriesRef.current = wealthSeries;
    contSeriesRef.current = contSeries;
    targetSeriesRef.current = targetSeries;

    // Crosshair move listener
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !data || data.length === 0) {
        setHoveredPoint(null);
        return;
      }
      const timeStr = typeof param.time === 'string' ? param.time : '';
      const year = parseInt(timeStr.slice(0, 4), 10);
      const found = data.find((d) => d.year === year);
      setHoveredPoint(found || null);
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      wealthSeriesRef.current = null;
      contSeriesRef.current = null;
      targetSeriesRef.current = null;
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
    if (
      !wealthSeriesRef.current ||
      !contSeriesRef.current ||
      !targetSeriesRef.current ||
      data.length === 0
    ) {
      return;
    }

    const wealthPoints = data.map((d) => ({
      time: `${d.year}-01-01` as unknown as UTCTimestamp,
      value: d.netWorth,
    }));

    const contPoints = data.map((d) => ({
      time: `${d.year}-01-01` as unknown as UTCTimestamp,
      value: d.totalContributed,
    }));

    const targetPoints = data.map((d) => ({
      time: `${d.year}-01-01` as unknown as UTCTimestamp,
      value: d.standardTarget,
    }));

    wealthSeriesRef.current.setData(wealthPoints);
    contSeriesRef.current.setData(contPoints);
    targetSeriesRef.current.setData(targetPoints);

    // 標記達標點 (Crossover Marker)
    const firstReached = data.find((d) => d.isStandardReached);
    if (firstReached) {
      const markers: SeriesMarker<UTCTimestamp>[] = [
        {
          time: `${firstReached.year}-01-01` as unknown as UTCTimestamp,
          position: 'aboveBar',
          color: '#f59e0b',
          shape: 'arrowDown',
          text: `🎯 FIRE 達成 (${firstReached.year})`,
        },
      ];
      wealthSeriesRef.current.setMarkers(markers);
    } else {
      wealthSeriesRef.current.setMarkers([]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  const activeDisplay = hoveredPoint || data[data.length - 1] || null;

  return (
    <div className="relative w-full space-y-3">
      {/* Legend & Hover stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium border-b border-slate-100 dark:border-zinc-800 pb-2.5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-xs bg-[#10b981]" />
            <span className="text-slate-800 dark:text-zinc-200">
              預估總資產 (複利累積)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-b-2 border-dashed border-[#3b82f6]" />
            <span className="text-slate-600 dark:text-zinc-400">
              累計自備投入本金
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[#f59e0b]" />
            <span className="text-amber-600 dark:text-amber-400">
              FIRE 目標門檻 (4% SWR)
            </span>
          </div>
        </div>

        {activeDisplay && (
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1 rounded-md text-slate-700 dark:text-zinc-300">
            <span>
              <strong>{activeDisplay.year} 年</strong>
              {activeDisplay.age ? ` (${activeDisplay.age} 歲)` : ''}
            </span>
            <span className="text-slate-300 dark:text-zinc-600">|</span>
            <span>
              總淨值：
              <strong className="text-emerald-600 dark:text-emerald-400">
                NT$ {formatNumber(activeDisplay.netWorth)}
              </strong>
            </span>
            <span className="text-slate-300 dark:text-zinc-600">|</span>
            <span>
              自備本金：NT$ {formatNumber(activeDisplay.totalContributed)}
            </span>
            <span className="text-slate-300 dark:text-zinc-600">|</span>
            <span>
              每年安全提領：NT$ {formatNumber(activeDisplay.annualSafeWithdrawal)}
            </span>
          </div>
        )}
      </div>

      <div ref={containerRef} style={{ height }} className="w-full" />
    </div>
  );
}
