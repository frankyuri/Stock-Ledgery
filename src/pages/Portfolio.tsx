import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  TrendingUp,
  PlusCircle,
  ArrowRight,
  Wallet,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { PortfolioTable } from '@/components/tables/PortfolioTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { portfolioQueryOptions } from '@/lib/queries/portfolio';
import { useStockStore } from '@/store/useStockStore';
import { formatCurrency, formatPercent, changeColor } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { fetchPortfolio } from '@/services/stocks';

export function Portfolio() {
  const holdings = useStockStore((s) => s.holdings);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);

  const { data, isLoading, isError, error, isStale } = useQuery({
    ...portfolioQueryOptions(holdings),
    select: (result: Awaited<ReturnType<typeof fetchPortfolio>>) => result.holdings,
  });

  const portfolioList = data ?? [];

  // Summary Metrics
  const summary = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalDayChange = 0;

    for (const h of portfolioList) {
      totalValue += h.marketValue;
      totalCost += h.shares * h.avgCost;
      totalDayChange += (h.price * (h.changePercent / 100)) * h.shares;
    }

    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
    const prevValue = totalValue - totalDayChange;
    const totalDayChangePercent = prevValue > 0 ? (totalDayChange / prevValue) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent,
      totalDayChange,
      totalDayChangePercent,
      currency: portfolioList[0]?.currency ?? 'USD',
    };
  }, [portfolioList]);

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
            <Briefcase className="h-7 w-7 text-brand" />
            持股明細
          </h1>
          <p className="mt-1 text-[15px] text-ink-mute dark:text-zinc-400">
            目前持有的所有標的與即時部位市值（由
            <Link to="/transactions" className="mx-1 font-semibold text-brand hover:underline inline-flex items-center gap-0.5">
              交易紀錄
              <ArrowRight className="h-3 w-3" />
            </Link>
            加權計算平均成本）。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTradeModalOpen(true)}
            className="btn btn-primary text-xs font-semibold py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>新增買進 / 賣出</span>
          </button>
        </div>
      </div>

      {isError && (
        <div className="card card-body text-sm text-down border-rose-300/40 bg-rose-50/60 dark:bg-rose-950/20">
          讀取持股最新報價失敗：{(error as Error)?.message ?? '網路連線異常'}
        </div>
      )}

      {/* Top Summary Cards */}
      {holdings.length > 0 && !isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5">
            <span className="label-caps flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-brand" />
              持股總市值
            </span>
            <p className="mt-2.5 font-mono text-2xl font-bold text-ink dark:text-zinc-100 num">
              {formatCurrency(summary.totalValue, summary.currency)}
            </p>
            <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
              持股總成本：{formatCurrency(summary.totalCost, summary.currency)}
            </p>
          </div>

          <div className="card p-5">
            <span className="label-caps flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-brand" />
              未實現總損益
            </span>
            <p
              className={cn(
                'mt-2.5 font-mono text-2xl font-bold num',
                changeColor(summary.totalGainLoss),
              )}
            >
              {summary.totalGainLoss > 0 ? '+' : ''}
              {formatCurrency(summary.totalGainLoss, summary.currency)}
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-xs font-semibold num',
                changeColor(summary.totalGainLoss),
              )}
            >
              報酬率 {formatPercent(summary.totalGainLossPercent)}
            </p>
          </div>

          <div className="card p-5">
            <span className="label-caps flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-brand" />
              今日市值變動
            </span>
            <p
              className={cn(
                'mt-2.5 font-mono text-2xl font-bold num',
                changeColor(summary.totalDayChange),
              )}
            >
              {summary.totalDayChange > 0 ? '+' : ''}
              {formatCurrency(summary.totalDayChange, summary.currency)}
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-xs font-semibold num',
                changeColor(summary.totalDayChange),
              )}
            >
              今日波動 {formatPercent(summary.totalDayChangePercent)}
            </p>
          </div>

          <div className="card p-5">
            <span className="label-caps flex items-center gap-1.5">
              <PieChart className="h-3.5 w-3.5 text-brand" />
              持股部位數量
            </span>
            <p className="mt-2.5 font-mono text-2xl font-bold text-ink dark:text-zinc-100 num">
              {holdings.length}{' '}
              <span className="text-sm font-normal text-ink-mute dark:text-zinc-400">檔標的</span>
            </p>
            <Link
              to="/overview"
              className="mt-1 text-xs font-medium text-brand hover:underline inline-flex items-center gap-1"
            >
              查看資產配置圓餅圖 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Table or Empty State */}
      {holdings.length === 0 ? (
        <div className="card card-body py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand dark:bg-brand/20">
            <Briefcase className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-ink dark:text-zinc-100">
            目前尚無任何持股
          </h3>
          <p className="mt-1.5 text-sm text-ink-mute dark:text-zinc-400 max-w-md mx-auto">
            前往新增一筆買入交易，系統會自動為你即時計算平均持股成本與市值損益。
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setTradeModalOpen(true)}
              className="btn btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
            >
              <PlusCircle className="h-4 w-4" />
              <span>立即記帳買進</span>
            </button>
            <Link to="/transactions" className="btn text-sm py-2 px-4">
              前往交易紀錄頁
            </Link>
          </div>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : (
        <PortfolioTable data={portfolioList} stale={isStale && !isLoading} />
      )}

      {/* Quick Trade Modal */}
      <QuickTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
      />
    </div>
  );
}
