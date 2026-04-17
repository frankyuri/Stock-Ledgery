import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

export interface LinePoint {
  time: string;
  value: number;
}

interface Props {
  data: LinePoint[];
  height?: number;
}

export function LineAreaChart({ data, height = 280 }: Props) {
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
        textColor: '#6e6e73',
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.04)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(0, 0, 0, 0.08)' },
      timeScale: {
        borderColor: 'rgba(0, 0, 0, 0.08)',
        timeVisible: false,
        secondsVisible: false,
      },
    });

    const series = chart.addAreaSeries({
      lineColor: '#0a84ff',
      topColor: 'rgba(10, 132, 255, 0.35)',
      bottomColor: 'rgba(10, 132, 255, 0.02)',
      lineWidth: 2,
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
    if (!seriesRef.current) return;
    seriesRef.current.setData(
      data.map((d) => ({ time: d.time as unknown as UTCTimestamp, value: d.value })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="h-[280px] w-full" />;
}
