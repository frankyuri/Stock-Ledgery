import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PortfolioTable } from '@/components/tables/PortfolioTable';
import { HoldingForm } from '@/components/portfolio/HoldingForm';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchPortfolio } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { formatCurrency } from '@/lib/format';

export function Portfolio() {
  const holdings = useStockStore((s) => s.holdings);
  const removeHolding = useStockStore((s) => s.removeHolding);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['portfolio', holdings],
    queryFn: () => fetchPortfolio(holdings),
    enabled: holdings.length > 0,
    refetchInterval: 60_000,
  });

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { marketValue: number; cost: number; gainLoss: number; dayChange: number }
    >();
    for (const x of data ?? []) {
      const g = map.get(x.currency) ?? {
        marketValue: 0,
        cost: 0,
        gainLoss: 0,
        dayChange: 0,
      };
      g.marketValue += x.marketValue;
      g.cost += x.shares * x.avgCost;
      g.gainLoss += x.gainLoss;
      g.dayChange += x.change * x.shares;
      map.set(x.currency, g);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].marketValue - a[1].marketValue);
  }, [data]);

  const summary = useMemo(() => {
    if (groups.length === 0) {
      return { currency: 'USD', marketValue: 0, gainLoss: 0, dayChange: 0, cost: 0 };
    }
    const [currency, g] = groups[0];
    return { currency, ...g };
  }, [groups]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">個人持股</h1>
        <p className="mt-1 text-sm text-ink-mute">
          資料只儲存在你的瀏覽器 (localStorage)，報價經 Yahoo Finance 取得
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="總市值"
          value={formatCurrency(summary.marketValue, summary.currency)}
          hint={
            groups.length > 1
              ? `主要幣別 ${summary.currency}（共 ${groups.length} 種幣別）`
              : '依最新 Yahoo 報價估算'
          }
        />
        <StatCard
          label="未實現損益"
          value={formatCurrency(summary.gainLoss, summary.currency)}
          change={summary.gainLoss}
          changePercent={summary.cost ? (summary.gainLoss / summary.cost) * 100 : 0}
        />
        <StatCard
          label="今日變動"
          value={formatCurrency(summary.dayChange, summary.currency)}
          change={summary.dayChange}
          changePercent={
            summary.marketValue ? (summary.dayChange / summary.marketValue) * 100 : 0
          }
        />
      </div>

      {groups.length > 1 && (
        <div className="card card-body">
          <p className="text-xs uppercase tracking-wider text-ink-mute">分幣別小計</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map(([cur, g]) => (
              <div
                key={cur}
                className="rounded-lg border border-black/5 bg-white/60 p-3 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{cur}</span>
                  <span className="text-xs text-ink-mute">市值</span>
                </div>
                <p className="mt-1 font-mono text-lg text-ink">
                  {formatCurrency(g.marketValue, cur)}
                </p>
                <p className="mt-1 text-xs text-ink-mute">
                  損益 {formatCurrency(g.gainLoss, cur)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <HoldingForm />

      {isError && (
        <div className="card card-body text-sm text-down">
          讀取持股報價失敗：{(error as Error)?.message ?? '未知錯誤'}
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="card card-body py-12 text-center text-ink-mute">
          目前沒有持股。用上方表單新增一筆試試看。
        </div>
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <PortfolioTable data={data ?? []} onRemove={removeHolding} />
      )}
    </div>
  );
}
