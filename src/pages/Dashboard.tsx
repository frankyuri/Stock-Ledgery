import { useQuery } from '@tanstack/react-query';
import { StockChart } from '@/components/charts/StockChart';
import { WatchlistTable } from '@/components/tables/WatchlistTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { fetchCandles, fetchQuote, fetchQuotes } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { formatNumber } from '@/lib/format';

export function Dashboard() {
  const selected = useStockStore((s) => s.selectedSymbol);
  const watchlist = useStockStore((s) => s.watchlist);
  const setSelected = useStockStore((s) => s.setSelectedSymbol);
  const remove = useStockStore((s) => s.removeFromWatchlist);

  const quote = useQuery({
    queryKey: ['quote', selected],
    queryFn: () => fetchQuote(selected),
    refetchInterval: 60_000,
  });

  const chart = useQuery({
    queryKey: ['chart', selected, '1D'],
    queryFn: () => fetchCandles(selected, '1D'),
  });

  const watch = useQuery({
    queryKey: ['quotes', watchlist],
    queryFn: () => fetchQuotes(watchlist),
    enabled: watchlist.length > 0,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              大盤總覽
            </h1>
            <p className="mt-1 text-sm text-ink-mute">
              即時報價、個股 K 線、自選清單
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {watchlist.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                className={`btn text-xs ${selected === s ? 'btn-primary' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="現價"
            value={quote.data ? formatNumber(quote.data.price) : '—'}
            change={quote.data?.change}
            changePercent={quote.data?.changePercent}
            hint={quote.data?.name}
          />
          <StatCard
            label="前日收盤"
            value={quote.data ? formatNumber(quote.data.previousClose) : '—'}
          />
          <StatCard
            label="幣別"
            value={quote.data?.currency ?? '—'}
            hint="依市場自動判斷"
          />
          <StatCard
            label="市值 (估)"
            value={
              quote.data?.marketCap
                ? `${formatNumber(quote.data.marketCap / 1e9, 2)} B ${quote.data.currency}`
                : '—'
            }
          />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              {selected} · 日 K 線
            </h2>
            <p className="mt-0.5 text-xs text-ink-mute">
              滾輪縮放、按住拖曳平移；MA20 顯示於黃色線
            </p>
          </div>
        </div>
        <div className="card-body">
          {chart.isLoading ? (
            <Skeleton className="h-[420px] w-full" />
          ) : chart.data ? (
            <StockChart data={chart.data} />
          ) : (
            <p className="py-16 text-center text-ink-mute">無法載入圖表資料</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              自選清單
            </h2>
            <p className="mt-0.5 text-xs text-ink-mute">
              每 60 秒自動更新（經 Yahoo Finance）
            </p>
          </div>
        </div>
        {watch.isLoading ? (
          <div className="p-6">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <WatchlistTable data={watch.data ?? []} onRemove={remove} />
        )}
      </section>
    </div>
  );
}
