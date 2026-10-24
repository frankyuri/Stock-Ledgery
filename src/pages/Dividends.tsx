import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Coins,
  TrendingUp,
  Calendar,
  DollarSign,
  PieChart,
  ArrowRight,
  Sparkles,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { usePortfolioBundles } from '@/lib/hooks/usePortfolioBundles';
import { calculatePortfolioDividends } from '@/lib/dividendForecast';
import { analyzeSecondGenNHI, type SecondGenNHIReport } from '@/lib/taxAnalytics';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { DividendEvent, Quote } from '@/types/stock';

export function Dividends() {
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // 抓取各持股的完整行情與配息資訊
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);

  const { bundles: chartBundles, isLoading, isRefetching, refetch } = usePortfolioBundles(symbols);

  // 計算股息統計與預測
  const overview = useMemo(() => {
    if (!chartBundles || holdings.length === 0) {
      return null;
    }

    const quotesMap = new Map<string, Quote>();
    const dividendsMap = new Map<string, DividendEvent[]>();

    for (const [sym, bundle] of Object.entries(chartBundles)) {
      if (bundle.quote) quotesMap.set(sym, bundle.quote);
      if (bundle.dividends) dividendsMap.set(sym, bundle.dividends);
    }

    return calculatePortfolioDividends(
      holdings,
      transactions,
      quotesMap,
      dividendsMap,
    );
  }, [holdings, transactions, chartBundles]);

  // 試算二代健保補充保費觸發門檻 (單筆 NT$20,000)
  const nhiReport: SecondGenNHIReport | null = useMemo(() => {
    if (!overview || overview.items.length === 0) return null;
    return analyzeSecondGenNHI(overview.items);
  }, [overview]);

  // 最大月現金流，用作長條圖比例尺
  const maxMonthlyIncome = useMemo(() => {
    if (!overview) return 1;
    const max = Math.max(
      ...overview.monthlyForecast.map((m) => m.projectedIncome),
      1,
    );
    return max;
  }, [overview]);

  // 當前選取月份的持股入帳清單
  const activeMonthData = useMemo(() => {
    if (!overview) return null;
    if (selectedMonth == null) {
      // 預設選取當前或下一個有配息的月份
      const currentMonth = new Date().getMonth() + 1;
      const found = overview.monthlyForecast.find(
        (m) => m.month >= currentMonth && m.projectedIncome > 0,
      );
      return found || overview.monthlyForecast[0];
    }
    return overview.monthlyForecast.find((m) => m.month === selectedMonth) || null;
  }, [overview, selectedMonth]);

  // 所有歷史領息紀錄扁平化清單
  const historicalLogs = useMemo(() => {
    if (!overview) return [];
    const logs: {
      symbol: string;
      date: string;
      amount: number;
      shares: number;
      income: number;
    }[] = [];

    for (const item of overview.items) {
      for (const row of item.stats.rows) {
        logs.push({
          symbol: item.symbol,
          date: row.date,
          amount: row.amount,
          shares: row.shares,
          income: row.income,
        });
      }
    }

    // 由新到舊
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }, [overview]);

  if (holdings.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            股息與被動現金流中心
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            追蹤未來 12 個月現金流預測、持股成本殖利率 (YoC) 與歷史配息入帳對帳
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Coins className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-zinc-100">
            尚無任何投資組合持股
          </h3>
          <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            您可以在「交易紀錄」或「持股明細」建立第一筆買入股票，系統將自動為您解析除息日程並試算被動收入！
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-hover"
            >
              前往建立交易
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => useStockStore.getState().loadDemoData()}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/5 px-4 py-2 text-xs font-semibold text-brand hover:bg-brand/10 dark:bg-brand/10"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              體驗示範帳本 (Demo)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* 頁面標題列 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            股息與被動現金流中心
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            未來 12 個月預估現金流 · 成本殖利率 (Yield on Cost) · 配息日程分析
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Sparkles className={cn('h-3.5 w-3.5 text-brand', isRefetching && 'animate-spin')} />
          {isRefetching ? '同步最新配息...' : '重新整理'}
        </button>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              預估年化股息總額
            </span>
            <Coins className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              ${overview ? formatNumber(overview.totalAnnualIncome) : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            依近一年配息頻率推估
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              平均每月被動收入
            </span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              +${overview ? formatNumber(overview.avgMonthlyIncome) : '—'}
            </span>
            <span className="text-xs text-slate-400">/ 月</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            平均現金流入
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              整體現價殖利率
            </span>
            <TrendingUp className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {overview ? `${overview.weightedCurrentYield}%` : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            以當前持股市值計算
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              成本殖利率 (YoC)
            </span>
            <PieChart className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {overview ? `${overview.weightedYieldOnCost}%` : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            以原始購入成本計 (Yield on Cost)
          </p>
        </div>

        <div className="card col-span-2 p-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              歷史累計已領股息
            </span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              ${overview ? formatNumber(overview.totalHistoricalDividends) : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            自第一筆交易起累計
          </p>
        </div>
      </div>

      {/* 二代健保補充保費 (單筆 NT$20,000) 門檻預警條 */}
      {nhiReport && (nhiReport.triggeredCount > 0 || nhiReport.nearLimitCount > 0) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">二代健保補充保費門檻提示</h3>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    單筆給付滿 NT$20,000 扣 2.11%
                  </span>
                </div>
                <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  目前持股中有{' '}
                  <span className="font-bold underline">{nhiReport.triggeredCount} 檔</span> 標的預計觸發 2.11% 補充保費（全年預計扣除 NT${formatNumber(nhiReport.totalAnnualTax)}）
                  {nhiReport.nearLimitCount > 0 && `，另有 ${nhiReport.nearLimitCount} 檔在安全邊界 (NT$16,000~19,999)`}。
                </p>
              </div>
            </div>
            <Link
              to="/tax"
              className="inline-flex items-center gap-1 self-start sm:self-center shrink-0 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition"
            >
              <span>前往稅務中心看調節試算</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* 未來 12 個月現金流預測長條圖 */}
      <section className="card p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              未來 12 個月現金流預測日曆
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              點選月份可展開查看該月份之預估入帳持股明細
            </p>
          </div>
          {activeMonthData && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              <Calendar className="h-3.5 w-3.5" />
              <span>{activeMonthData.monthLabel} 預估現金流：${formatNumber(activeMonthData.projectedIncome)}</span>
            </div>
          )}
        </div>

        {/* 12 個月長條圖 (支援手持裝置水平滑動) */}
        <div className="overflow-x-auto pb-3 pt-1 px-1">
          <div className="mt-5 grid grid-cols-12 gap-1.5 sm:gap-2.5 min-w-[620px] px-2 py-1">
            {overview?.monthlyForecast.map((item) => {
              const isSelected = activeMonthData?.month === item.month;
              const heightPercent = maxMonthlyIncome > 0
                ? Math.max(12, Math.round((item.projectedIncome / maxMonthlyIncome) * 100))
                : 12;

              return (
                <button
                  type="button"
                  key={item.month}
                  onClick={() => setSelectedMonth(item.month)}
                  className={cn(
                    'group flex flex-col items-center rounded-xl p-1.5 sm:p-2 transition text-center touch-action-manipulation min-w-0',
                    isSelected
                      ? 'bg-slate-100 dark:bg-zinc-800 ring-2 ring-brand'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60',
                  )}
                >
                  {/* 金額標籤 */}
                  <span className="mb-2 text-[10px] font-semibold text-slate-600 dark:text-zinc-300 font-mono truncate max-w-full">
                    {item.projectedIncome > 0 ? `$${formatNumber(item.projectedIncome, 0)}` : '—'}
                  </span>

                  {/* 長條柱體容器 */}
                  <div className="relative flex h-36 w-full max-w-[2.5rem] items-end justify-center rounded-lg bg-slate-100 dark:bg-zinc-800/80 p-1">
                    <div
                      style={{ height: `${item.projectedIncome > 0 ? heightPercent : 4}%` }}
                      className={cn(
                        'w-full rounded-md transition-all duration-300',
                        item.projectedIncome > 0
                          ? isSelected
                            ? 'bg-brand'
                            : 'bg-brand/70 group-hover:bg-brand'
                          : 'bg-slate-300 dark:bg-zinc-700',
                      )}
                    />
                  </div>

                  {/* 月份標籤 */}
                  <span className={cn(
                    'mt-2 text-xs font-medium truncate max-w-full',
                    isSelected ? 'font-bold text-brand' : 'text-slate-600 dark:text-zinc-400',
                  )}>
                    {item.monthLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 選取月份細項展開卡片 */}
        {activeMonthData && (
          <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-zinc-800">
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                📅 {activeMonthData.monthLabel} 預計除息 / 發放之持股明細（共 {activeMonthData.holdings.length} 檔）
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                本月小計：+${formatNumber(activeMonthData.projectedIncome)}
              </span>
            </div>

            {activeMonthData.holdings.length > 0 ? (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {activeMonthData.holdings.map((h) => (
                  <div
                    key={h.symbol}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div>
                      <Link
                        to={`/stock/${h.symbol}`}
                        className="text-xs font-bold text-brand hover:underline"
                      >
                        {h.symbol}
                      </Link>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {formatNumber(h.shares)} 股 · 估配 ${h.amountPerShare}/股
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      +${formatNumber(h.estimatedIncome)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-center text-xs text-slate-400 dark:text-zinc-500 py-2">
                本月無預計配息之標的
              </p>
            )}
          </div>
        )}
      </section>

      {/* 持股殖利率矩陣表格 */}
      <section className="card overflow-hidden">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            各持股殖利率與年化現金流矩陣
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            依預估年化股息排序 · 對比現價殖利率與持有成本殖利率 (YoC)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                <th className="px-5 py-3">標的代號</th>
                <th className="px-4 py-3 text-right">持有股數</th>
                <th className="px-4 py-3 text-right">平均成本</th>
                <th className="px-4 py-3 text-right">當前現價</th>
                <th className="px-4 py-3 text-right">TTM 配息/股</th>
                <th className="px-4 py-3 text-right">現價殖利率</th>
                <th className="px-4 py-3 text-right">成本殖利率 (YoC)</th>
                <th className="px-4 py-3 text-center">配息頻率</th>
                <th className="px-5 py-3 text-right">預估年領股息</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {overview?.items.map((item) => (
                <tr
                  key={item.symbol}
                  className="transition hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/stock/${item.symbol}`}
                        className="font-bold text-slate-900 hover:text-brand dark:text-zinc-100"
                      >
                        {item.symbol}
                      </Link>
                      {(() => {
                        const nhiItem = nhiReport?.items.find((n) => n.symbol === item.symbol);
                        if (nhiItem?.isTriggered) {
                          return (
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              title={`單筆預估 NT$${formatNumber(nhiItem.dividendPerPayout)}，觸發 2.11% 健保補充保費（扣 NT$${formatNumber(nhiItem.nhiTaxPerPayout)}/次）`}
                            >
                              健保扣繳
                            </span>
                          );
                        }
                        if (nhiItem?.isNearLimit) {
                          return (
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              title={`單筆預估 NT$${formatNumber(nhiItem.dividendPerPayout)}，接近 NT$20,000 扣繳門檻`}
                            >
                              接近門檻
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[140px]">
                      {item.name}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-slate-700 dark:text-zinc-300">
                    {formatNumber(item.shares)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 dark:text-zinc-400">
                    ${formatNumber(item.avgCost)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-slate-900 dark:text-zinc-100">
                    ${formatNumber(item.currentPrice)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-amber-600 dark:text-amber-400">
                    ${formatNumber(item.trailing12mPerShare)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-800 dark:text-zinc-200">
                    {item.currentYield > 0 ? `${item.currentYield}%` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-purple-600 dark:text-purple-400">
                    {item.yieldOnCost > 0 ? `${item.yieldOnCost}%` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {item.payoutFrequency === 'MONTHLY' && '月配息'}
                      {item.payoutFrequency === 'QUARTERLY' && '季配息'}
                      {item.payoutFrequency === 'SEMI_ANNUAL' && '半年配'}
                      {item.payoutFrequency === 'ANNUAL' && '年配息'}
                      {item.payoutFrequency === 'UNKNOWN' && '依公告'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    +${formatNumber(item.estimatedAnnualIncome)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 歷史領息紀錄明細 */}
      <section className="card p-5">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              歷史除息領息對帳清單
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              依個人歷史持股與除息日自動回測領取金額（共 {historicalLogs.length} 筆）
            </p>
          </div>
        </div>

        {historicalLogs.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-semibold text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
                  <th className="py-2.5">除息日期</th>
                  <th className="py-2.5">標的代號</th>
                  <th className="py-2.5 text-right">當時持有股數</th>
                  <th className="py-2.5 text-right">每股除息金額</th>
                  <th className="py-2.5 text-right">實領股息收入</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {historicalLogs.slice(0, 15).map((log, idx) => (
                  <tr key={`${log.symbol}-${log.date}-${idx}`}>
                    <td className="py-3 font-medium text-slate-600 dark:text-zinc-400">
                      {log.date}
                    </td>
                    <td className="py-3 font-bold text-brand">
                      {log.symbol}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-700 dark:text-zinc-300">
                      {formatNumber(log.shares)} 股
                    </td>
                    <td className="py-3 text-right text-slate-600 dark:text-zinc-400">
                      ${formatNumber(log.amount)}
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      +${formatNumber(log.income)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-slate-400 dark:text-zinc-500 py-6">
            尚無符合除息日之歷史領息紀錄
          </p>
        )}
      </section>
    </div>
  );
}
