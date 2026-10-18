import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import {
  Sparkles,
  TrendingUp,
  Sliders,
} from 'lucide-react';
import {
  runMonteCarloSimulation,
  type WithdrawalStrategy,
  type MonteCarloSimulationResult,
} from '@/lib/monteCarlo';
import { useTheme } from '@/lib/theme';
import { useCurrency } from '@/lib/hooks/useCurrency';
import { cn } from '@/lib/cn';

interface MonteCarloPanelProps {
  currentNetWorth: number;
  annualExpense: number;
  annualInvestment: number;
  expectedAnnualReturn: number;
  inflationRate: number;
}

export function MonteCarloPanel({
  currentNetWorth,
  annualExpense,
  annualInvestment,
  expectedAnnualReturn,
  inflationRate,
}: MonteCarloPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { baseCurrency, convertToBase, formatMoney } = useCurrency();

  const [strategy, setStrategy] = useState<WithdrawalStrategy>('FIXED_INFLATION_ADJUSTED');
  const [volatility, setVolatility] = useState<number>(0.16); // 16% 年化波動度
  const [simCount, setSimCount] = useState<number>(2000);
  const [years, setYears] = useState<number>(30);
  const [retirementOffset, setRetirementOffset] = useState<number>(0); // 0 代表立即退休提領

  // 執行蒙地卡羅運算
  const result: MonteCarloSimulationResult = useMemo(() => {
    return runMonteCarloSimulation({
      initialNetWorth: currentNetWorth,
      annualExpense,
      annualInvestment,
      expectedReturn: expectedAnnualReturn / 100,
      volatility,
      inflationRate: inflationRate / 100,
      years,
      numSimulations: simCount,
      withdrawalStrategy: strategy,
      retirementYearOffset: retirementOffset,
      seed: 42, // 保證同一參數下圖表渲染不閃爍
    });
  }, [
    currentNetWorth,
    annualExpense,
    annualInvestment,
    expectedAnnualReturn,
    volatility,
    inflationRate,
    years,
    simCount,
    strategy,
    retirementOffset,
  ]);

  // Lightweight Charts 容器
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || result.fanChart.length === 0) return;

    const chart = createChart(el, {
      height: 320,
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
      },
    });
    chartRef.current = chart;

    const currentYear = new Date().getFullYear();

    const formatCurrencyShort = (val: number) => {
      const converted = convertToBase(val, 'TWD');
      if (baseCurrency === 'USD') {
        if (converted >= 1_000_000) return `$${(converted / 1_000_000).toFixed(1)}M`;
        if (converted >= 1_000) return `$${(converted / 1_000).toFixed(0)}k`;
        return `$${converted.toFixed(0)}`;
      }
      if (converted >= 100_000_000) return `${(converted / 100_000_000).toFixed(1)}億`;
      if (converted >= 10_000) return `${(converted / 10_000).toFixed(0)}萬`;
      return `${converted}`;
    };

    const makeData = (selector: (p: (typeof result.fanChart)[0]) => number) => {
      return result.fanChart.map((p) => {
        const time = (Math.floor(
          new Date(currentYear + p.year, 0, 1).getTime() / 1000,
        ) as unknown) as UTCTimestamp;
        return { time, value: selector(p) };
      });
    };

    // P90 (大牛市 - 藍色)
    const sP90 = chart.addLineSeries({
      color: '#38bdf8',
      lineWidth: 2,
      title: '90th 牛市',
      priceFormat: { type: 'custom', formatter: formatCurrencyShort },
    });
    sP90.setData(makeData((p) => p.p90));

    // P75 (樂觀 - 綠色)
    const sP75 = chart.addLineSeries({
      color: '#34d399',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: '75th 樂觀',
      priceFormat: { type: 'custom', formatter: formatCurrencyShort },
    });
    sP75.setData(makeData((p) => p.p75));

    // P50 (中位數 - 翡翠綠粗線)
    const sP50 = chart.addLineSeries({
      color: '#10b981',
      lineWidth: 3,
      title: '50th 中位數',
      priceFormat: { type: 'custom', formatter: formatCurrencyShort },
    });
    sP50.setData(makeData((p) => p.p50));

    // P25 (保守 - 琥珀黃)
    const sP25 = chart.addLineSeries({
      color: '#fbbf24',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: '25th 保守',
      priceFormat: { type: 'custom', formatter: formatCurrencyShort },
    });
    sP25.setData(makeData((p) => p.p25));

    // P10 (悲觀/熊市 - 玫瑰紅虛線)
    const sP10 = chart.addLineSeries({
      color: '#f43f5e',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: '10th 悲觀',
      priceFormat: { type: 'custom', formatter: formatCurrencyShort },
    });
    sP10.setData(makeData((p) => p.p10));

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [result, isDark, baseCurrency, convertToBase]);

  return (
    <div className="space-y-6">
      {/* Simulation Result Header Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Success Rate */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              30 年提領成功率
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                result.successRate >= 90
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : result.successRate >= 75
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-rose-500/10 text-rose-500',
              )}
            >
              {result.srrRiskLevel === 'LOW'
                ? '低風險'
                : result.srrRiskLevel === 'MODERATE'
                ? '中度風險'
                : '高風險警戒'}
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-bold text-slate-900 dark:text-zinc-100 num">
            {result.successRate.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            基於 {result.totalRuns.toLocaleString()} 次市場隨機情境測算
          </p>
        </div>

        {/* Median Final Wealth */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            期末資產中位數 (50th)
          </span>
          <p className="mt-3 font-mono text-2xl font-bold text-emerald-500 num">
            {formatMoney(result.medianEndingNetWorth, 'TWD')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            第 {years} 年資產中位數 (穩健行情)
          </p>
        </div>

        {/* 10th Percentile (Stress scenario) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            熊市壓力情境 (10th)
          </span>
          <p
            className={cn(
              'mt-3 font-mono text-2xl font-bold num',
              result.worstEndingNetWorth > 0 ? 'text-slate-900 dark:text-zinc-100' : 'text-rose-500',
            )}
          >
            {formatMoney(result.worstEndingNetWorth, 'TWD')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            連續熊市與停滯性通膨等極端市況
          </p>
        </div>

        {/* 90th Percentile (Bull market) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            牛市爆發情境 (90th)
          </span>
          <p className="mt-3 font-mono text-2xl font-bold text-sky-500 num">
            {formatMoney(result.bestEndingNetWorth, 'TWD')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            大牛市與高複利倍增情境
          </p>
        </div>
      </div>

      {/* Strategy Selector & Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              提領策略與壓力測試參數
            </h3>
          </div>

          {/* SWR Strategy Buttons */}
          <div className="inline-flex rounded-lg border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/5 text-xs">
            {[
              { id: 'FIXED_INFLATION_ADJUSTED', label: '固定通膨調整 (Trinity Rule)' },
              { id: 'GUYTON_KLINGER', label: '護欄法則 (動態調節)' },
              { id: 'PERCENTAGE_OF_PORTFOLIO', label: '固定比例提領 (永遠不破產)' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id as WithdrawalStrategy)}
                className={cn(
                  'rounded-md px-3 py-1 font-medium transition',
                  strategy === s.id
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="flex justify-between font-semibold text-slate-700 dark:text-zinc-300">
              <span>年化波動度 (標準差 σ)</span>
              <span className="font-mono font-bold text-brand">{(volatility * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.08"
              max="0.30"
              step="0.01"
              value={volatility}
              onChange={(e) => setVolatility(Number(e.target.value))}
              className="mt-2 w-full accent-brand"
            />
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">大盤約 15~18%，科技成長約 22~28%</span>
          </div>

          <div>
            <div className="flex justify-between font-semibold text-slate-700 dark:text-zinc-300">
              <span>模擬路徑次數</span>
              <span className="font-mono font-bold text-brand">{simCount} 次</span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              step="500"
              value={simCount}
              onChange={(e) => setSimCount(Number(e.target.value))}
              className="mt-2 w-full accent-brand"
            />
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">次數愈高，極端風險評估愈精準</span>
          </div>

          <div>
            <div className="flex justify-between font-semibold text-slate-700 dark:text-zinc-300">
              <span>模擬總年期</span>
              <span className="font-mono font-bold text-brand">{years} 年</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              step="5"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-2 w-full accent-brand"
            />
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">退休後持續提領之規劃年期</span>
          </div>

          <div>
            <div className="flex justify-between font-semibold text-slate-700 dark:text-zinc-300">
              <span>提領開始年份 (緩衝期)</span>
              <span className="font-mono font-bold text-brand">
                {retirementOffset === 0 ? '立即開始提領' : `${retirementOffset} 年後開始提領`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={retirementOffset}
              onChange={(e) => setRetirementOffset(Number(e.target.value))}
              className="mt-2 w-full accent-brand"
            />
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              前 N 年維持每月 {formatMoney(annualInvestment / 12, 'TWD')} 投入
            </span>
          </div>
        </div>
      </div>

      {/* Fan Chart View */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              蒙地卡羅扇形分佈圖 (Fan Chart - 30 年路徑)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              展示在 2,000 次隨機市場震盪下，投資組合資本的 90th、75th、50th、25th 與 10th 百分位走勢。
            </p>
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              90th 牛市
            </span>
            <span className="flex items-center gap-1.5 font-medium text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              50th 中位數
            </span>
            <span className="flex items-center gap-1.5 font-medium text-rose-500">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              10th 悲觀
            </span>
          </div>
        </div>

        {/* Lightweight Charts Render Container */}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Sequence of Returns Risk & Stress Diagnostic Banner */}
      <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-brand">
            量化風控診斷：報酬順序風險 (Sequence of Returns Risk) 評估
          </div>
          <p className="mt-1 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
            {result.recommendationNote}
          </p>
          {strategy === 'GUYTON_KLINGER' && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              ✓ 目前已啟用「蓋頓-克林格護欄法則」：在熊市資產大幅縮水時自動將開銷凍結或調降 10%，有效將破產風險壓低至最低限度。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
