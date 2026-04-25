import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PortfolioTable } from '@/components/tables/PortfolioTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchPortfolio } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { holdingsKey } from '@/lib/queryKeys';
import type { PortfolioHolding } from '@/types/stock';

export function Portfolio() {
  const holdings = useStockStore((s) => s.holdings);

  const { data, isLoading, isError, error, isStale } = useQuery<
    Awaited<ReturnType<typeof fetchPortfolio>>,
    Error,
    PortfolioHolding[]
  >({
    queryKey: ['portfolio', holdingsKey(holdings)],
    queryFn: () => fetchPortfolio(holdings),
    select: (result) => result.holdings,
    enabled: holdings.length > 0,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">持股明細</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">
          目前持有的所有部位（由
          <Link to="/transactions" className="mx-1 font-medium text-brand hover:underline">
            交易紀錄
          </Link>
          自動 derive；新增買進 / 賣出後會即時同步）。
        </p>
      </div>

      {isError && (
        <div className="card card-body text-sm text-down">
          讀取持股報價失敗：{(error as Error)?.message ?? '未知錯誤'}
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="card card-body py-14 text-center">
          <p className="text-[15px] text-ink-mute">
            目前沒有持股。前往交易紀錄新增一筆買入試試看。
          </p>
          <div className="mt-5">
            <Link to="/transactions" className="btn btn-primary">
              前往交易紀錄
            </Link>
          </div>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <PortfolioTable data={data ?? []} stale={isStale && !isLoading} />
      )}
    </div>
  );
}
