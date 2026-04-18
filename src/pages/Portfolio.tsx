import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PortfolioTable } from '@/components/tables/PortfolioTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchPortfolio } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

interface OrphanHolding {
  symbol: string;
  shares: number;
  avgCost: number;
}

function findOrphans(
  holdings: ReturnType<typeof useStockStore.getState>['holdings'],
  transactions: ReturnType<typeof useStockStore.getState>['transactions'],
): OrphanHolding[] {
  const net = new Map<string, number>();
  for (const t of transactions) {
    const prev = net.get(t.symbol) ?? 0;
    net.set(t.symbol, t.type === 'BUY' ? prev + t.shares : prev - t.shares);
  }
  const out: OrphanHolding[] = [];
  for (const h of holdings) {
    const covered = net.get(h.symbol) ?? 0;
    const missing = h.shares - covered;
    if (missing > 1e-6) {
      out.push({ symbol: h.symbol, shares: missing, avgCost: h.avgCost });
    }
  }
  return out;
}

export function Portfolio() {
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
  const addRawTransaction = useStockStore((s) => s.addRawTransaction);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['portfolio', holdings],
    queryFn: () => fetchPortfolio(holdings),
    enabled: holdings.length > 0,
    refetchInterval: 60_000,
  });

  const orphans = useMemo(
    () => findOrphans(holdings, transactions),
    [holdings, transactions],
  );

  function migrateOrphans() {
    const today = todayISO();
    for (const o of orphans) {
      addRawTransaction({
        type: 'BUY',
        symbol: o.symbol,
        shares: o.shares,
        price: o.avgCost,
        fee: 0,
        tradedAt: today,
        note: '初始部位匯入',
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">持股明細</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">
          目前持有的所有部位。新增 / 修改 / 減倉都請到{' '}
          <Link to="/transactions" className="font-medium text-brand hover:underline">
            交易紀錄
          </Link>{' '}
          新增買進 / 賣出，持股會自動同步。
        </p>
      </div>

      {orphans.length > 0 && (
        <div className="card border-brand/25 bg-brand-soft/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-ink">
                發現 {orphans.length} 筆持股沒有對應的交易紀錄
              </p>
              <p className="mt-1 text-sm text-ink-mute">
                一鍵補建為初始買入，交易紀錄與持股即可對齊
                <span className="text-ink-faint">
                  （{orphans.map((o) => o.symbol).join('、')}）
                </span>
              </p>
            </div>
            <button type="button" onClick={migrateOrphans} className="btn btn-primary">
              補建初始部位
            </button>
          </div>
        </div>
      )}

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
        <PortfolioTable data={data ?? []} />
      )}
    </div>
  );
}
