import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ShieldAlert,
  TrendingUp,
  Percent,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Compass,
  Zap,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { fetchChartBundle } from '@/services/stocks';
import { calculateRiskMetrics } from '@/lib/riskAnalytics';
import { ComparisonChart } from '@/components/charts/ComparisonChart';
import { UnderwaterChart } from '@/components/charts/UnderwaterChart';
import { cn } from '@/lib/cn';
import type { Candle } from '@/types/stock';
import type { ChartBundle } from '@/services/yahoo';

const BENCHMARK_OPTIONS = [
  { symbol: '^GSPC', label: '標普 500 指數 (S&P 500)' },
  { symbol: '0050.TW', label: '元大台灣 50 (0050)' },
  { symbol: '^IXIC', label: '那斯達克綜合指數 (Nasdaq)' },
  { symbol: '^TWII', label: '台灣加權股價指數 (TAIEX)' },
];

export function Analytics() {
  const holdings = useStockStore((s) => s.holdings);
  const [selectedBenchmark, setSelectedBenchmark] = useState('^GSPC');
  const [timeRange, setTimeRange] = useState<'3M' | '6M' | '1Y' | 'ALL'>('1Y');

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const allSymbolsToFetch = useMemo(
    () => Array.from(new Set([...symbols, selectedBenchmark])),
    [symbols, selectedBenchmark],
  );

  const { data: bundles, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['risk-analytics-bundles', allSymbolsToFetch.sort().join(',')],
    queryFn: async () => {
      if (allSymbolsToFetch.length === 0) return {};
      const results = await Promise.allSettled(
        allSymbolsToFetch.map((sym) => fetchChartBundle(sym, '1D')),
      );

      const map: Record<string, ChartBundle> = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          map[allSymbolsToFetch[i]] = res.value;
        }
      });
      return map;
    },
    enabled: allSymbolsToFetch.length > 0,
    staleTime: 60_000,
  });

  // 計算權重與量化指標
  const { metrics, holdingWeights, benchmarkLabel } = useMemo(() => {
    const defaultLabel =
      BENCHMARK_OPTIONS.find((b) => b.symbol === selectedBenchmark)?.label ||
      selectedBenchmark;

    if (!bundles || holdings.length === 0) {
      return {
        metrics: null,
        holdingWeights: [],
        benchmarkLabel: defaultLabel,
      };
    }

    // 計算各標的最新市值與權重
    let totalValue = 0;
    const valueMap = new Map<string, number>();

    for (const h of holdings) {
      const q = bundles[h.symbol]?.quote;
      const price = q?.price ?? h.avgCost;
      const val = h.shares * price;
      valueMap.set(h.symbol, val);
      totalValue += val;
    }

    const weights = new Map<string, number>();
    const holdingWeightsArr: {
      symbol: string;
      name: string;
      weight: number;
      marketValue: number;
    }[] = [];

    for (const h of holdings) {
      const val = valueMap.get(h.symbol) || 0;
      const w = totalValue > 0 ? val / totalValue : 0;
      weights.set(h.symbol, w);
      holdingWeightsArr.push({
        symbol: h.symbol,
        name: bundles[h.symbol]?.quote?.name ?? h.symbol,
        weight: Math.round(w * 1000) / 10,
        marketValue: val,
      });
    }

    holdingWeightsArr.sort((a, b) => b.weight - a.weight);

    // 準備 Candle Map
    const candleMap = new Map<string, Candle[]>();
    for (const sym of symbols) {
      if (bundles[sym]?.candles) {
        candleMap.set(sym, bundles[sym].candles);
      }
    }

    const benchCandles = bundles[selectedBenchmark]?.candles || [];

    // 依據時間區間過濾
    const now = new Date();
    const cutoff = new Date();
    if (timeRange === '3M') cutoff.setMonth(now.getMonth() - 3);
    else if (timeRange === '6M') cutoff.setMonth(now.getMonth() - 6);
    else if (timeRange === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
    else cutoff.setFullYear(2000);

    const cutoffISO = cutoff.toISOString().slice(0, 10);

    const filteredCandleMap = new Map<string, Candle[]>();
    for (const [sym, cList] of candleMap.entries()) {
      filteredCandleMap.set(
        sym,
        cList.filter((c: Candle) => c.time >= cutoffISO),
      );
    }
    const filteredBenchCandles = benchCandles.filter(
      (c: Candle) => c.time >= cutoffISO,
    );

    const res = calculateRiskMetrics(
      weights,
      filteredCandleMap,
      filteredBenchCandles,
    );

    return {
      metrics: res,
      holdingWeights: holdingWeightsArr,
      benchmarkLabel: defaultLabel,
    };
  }, [bundles, holdings, symbols, selectedBenchmark, timeRange]);

  if (holdings.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            績效與量化風險分析
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            夏普值 (Sharpe Ratio) · 最大回撤 (MDD) · 基準大盤走勢對比
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Activity className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-zinc-100">
            尚無任何投資組合持股
          </h3>
          <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            建立持股後，系統將自動提取過去一年的歷史價格序列，計算夏普值、波動度、最大回撤並與大盤進行對標！
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-hover"
            >
              前往建立交易
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 計算超額報酬 Alpha (投組報酬 - 基準報酬)
  const lastPoint = metrics?.timeSeries[metrics.timeSeries.length - 1];
  const alpha = lastPoint ? lastPoint.portfolio - lastPoint.benchmark : 0;

  // 集中度警示：最大單一持股是否超過 25%
  const highestWeightHolding = holdingWeights[0];
  const isConcentrated = highestWeightHolding && highestWeightHolding.weight > 25;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* 標題與控制工具列 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            績效與量化風險分析
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            夏普值 (Sharpe Ratio) · 最大回撤 (MDD) · 年化波動度 · 基準大盤對比
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 大盤基準切換 */}
          <select
            value={selectedBenchmark}
            onChange={(e) => setSelectedBenchmark(e.target.value)}
            className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-brand focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {BENCHMARK_OPTIONS.map((opt) => (
              <option key={opt.symbol} value={opt.symbol}>
                對比：{opt.label}
              </option>
            ))}
          </select>

          {/* 期間切換 */}
          <div className="inline-flex rounded-xl border border-slate-200/90 bg-white p-0.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            {(['3M', '6M', '1Y', 'ALL'] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setTimeRange(r)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                  timeRange === r
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Sparkles className={cn('h-3.5 w-3.5 text-brand', isRefetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* 集中度風險提示 (若有持股 > 25%) */}
      {isConcentrated && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <span className="font-bold">投資組合集中度提示：</span>
            單一持股 <span className="font-bold">{highestWeightHolding.symbol}</span> 佔比達到{' '}
            <span className="font-bold underline">{highestWeightHolding.weight}%</span>
            ，高於一般建議的 20~25% 風險分散水位。建議留意個股極端波動風險。
          </p>
        </div>
      )}

      {/* 量化核心指標卡片 (6 欄) */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* 夏普值 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              夏普值 (Sharpe)
            </span>
            <Activity className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {metrics ? metrics.sharpeRatio : '—'}
            </span>
            {metrics && (
              <span className={cn(
                'text-[10px] font-bold rounded-sm px-1 py-0.2',
                metrics.sharpeRatio >= 1.5 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                metrics.sharpeRatio >= 1.0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
              )}>
                {metrics.sharpeRatio >= 1.5 ? '優異' : metrics.sharpeRatio >= 1.0 ? '良好' : '普通'}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            風險調整後超額報酬
          </p>
        </div>

        {/* 最大回撤 MDD */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              最大回撤 (MDD)
            </span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {metrics ? `${metrics.maxDrawdown}%` : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            歷史波段峰值最大跌幅
          </p>
        </div>

        {/* 年化波動度 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              年化波動度
            </span>
            <Percent className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {metrics ? `${metrics.annualizedVolatility}%` : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            日收益標準差年化 (252天)
          </p>
        </div>

        {/* 累積超額報酬 (Alpha) */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              超額報酬 (Alpha)
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={cn(
              'text-xl font-bold tracking-tight',
              alpha >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            )}>
              {alpha >= 0 ? '+' : ''}{Math.round(alpha * 100) / 100}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500 truncate">
            相對 {selectedBenchmark}
          </p>
        </div>

        {/* 貝他值 Beta */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              貝他係數 (Beta)
            </span>
            <Compass className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {metrics ? metrics.beta : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            大盤敏感度 ({metrics && metrics.beta > 1 ? '高於大盤' : '低於大盤'})
          </p>
        </div>

        {/* 索提諾比率 Sortino */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              索提諾比率
            </span>
            <Zap className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {metrics ? metrics.sortinoRatio : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            僅懲罰下行虧損風險
          </p>
        </div>
      </div>

      {/* 投組 vs 大盤對比走勢圖 */}
      <section className="card p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              投資組合 vs 大盤基準累積報酬率走勢
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              以 0.00% 為基準起點，每日按持股加權重算累積百分比成長曲線
            </p>
          </div>
        </div>

        <div className="mt-4">
          {metrics && metrics.timeSeries.length > 0 ? (
            <ComparisonChart
              data={metrics.timeSeries}
              benchmarkLabel={benchmarkLabel}
              height={340}
            />
          ) : (
            <div className="flex h-72 items-center justify-center text-xs text-slate-400">
              正在彙整歷史序列資料...
            </div>
          )}
        </div>
      </section>

      {/* 水底回撤深度圖 (Drawdown Underwater Chart) */}
      <section className="card p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            歷史波段回撤水底圖 (Drawdown Underwater)
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            視覺化展示歷次波段回調深度與修復時間，觀察極端市況下承受的資產回撤
          </p>
        </div>

        <div className="mt-4">
          {metrics && metrics.timeSeries.length > 0 ? (
            <UnderwaterChart data={metrics.timeSeries} height={180} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-slate-400">
              正在繪製回撤圖...
            </div>
          )}
        </div>
      </section>

      {/* 持股權重與風險配置分佈 */}
      <section className="card p-5">
        <div className="border-b border-slate-200/80 pb-3 dark:border-zinc-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            持股權重與風險曝險佔比
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            目前持股佔比總覽（共 {holdingWeights.length} 檔標的）
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {holdingWeights.map((h) => (
            <div
              key={h.symbol}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
            >
              <div className="flex items-center justify-between">
                <Link
                  to={`/stock/${h.symbol}`}
                  className="font-bold text-slate-900 hover:text-brand dark:text-zinc-100"
                >
                  {h.symbol}
                </Link>
                <span className={cn(
                  'text-xs font-bold',
                  h.weight > 25 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-zinc-300'
                )}>
                  {h.weight}%
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                {h.name}
              </p>
              {/* 進度條 */}
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                <div
                  style={{ width: `${Math.min(h.weight, 100)}%` }}
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    h.weight > 25 ? 'bg-amber-500' : 'bg-brand'
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
