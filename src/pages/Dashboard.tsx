import { useQuery } from '@tanstack/react-query';
import { StockChart } from '@/components/charts/StockChart';
import { WatchlistTable } from '@/components/tables/WatchlistTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchCandles, fetchQuote, fetchQuotes } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { formatNumber, formatPercent, changeColor } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Quote } from '@/types/stock';

const INDEX_SYMBOLS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'Nasdaq' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: '^TWII', label: '加權指數' },
];

export function Dashboard() {
  const selected = useStockStore((s) => s.selectedSymbol);
  const watchlist = useStockStore((s) => s.watchlist);
  const setSelected = useStockStore((s) => s.setSelectedSymbol);
  const remove = useStockStore((s) => s.removeFromWatchlist);

  const indices = useQuery({
    queryKey: ['indices', INDEX_SYMBOLS.map((x) => x.symbol)],
    queryFn: () => fetchQuotes(INDEX_SYMBOLS.map((x) => x.symbol)),
    refetchInterval: 60_000,
  });

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

  const indexMap = new Map((indices.data ?? []).map((q) => [q.symbol, q]));

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">大盤總覽</h1>
          <p className="mt-1 text-sm text-ink-mute">
            主要指數即時行情、個股 K 線、自選清單（每 60 秒更新）
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INDEX_SYMBOLS.map((ix) => {
            const q = indexMap.get(ix.symbol);
            return (
              <IndexCard key={ix.symbol} label={ix.label} symbol={ix.symbol} quote={q} />
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              {selected} · 日 K 線
            </h2>
            <p className="mt-0.5 text-xs text-ink-mute">
              滾輪縮放 · 拖曳平移 · MA20；點自選切換
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

        {quote.data && (
          <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="font-mono text-[28px] font-semibold tracking-tight text-ink num">
              {formatNumber(quote.data.price)}
            </span>
            <span
              className={cn(
                'font-mono text-sm font-medium num',
                changeColor(quote.data.change),
              )}
            >
              {quote.data.change > 0 ? '+' : ''}
              {formatNumber(quote.data.change)} (
              {formatPercent(quote.data.changePercent)})
            </span>
            <span className="text-xs text-ink-mute">
              前收 {formatNumber(quote.data.previousClose)} · 開盤{' '}
              {formatNumber(quote.data.open ?? 0)} · 高{' '}
              {formatNumber(quote.data.dayHigh ?? 0)} · 低{' '}
              {formatNumber(quote.data.dayLow ?? 0)} · {quote.data.currency}
            </span>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            {chart.isLoading ? (
              <Skeleton className="h-[420px] w-full" />
            ) : chart.data ? (
              <StockChart data={chart.data} />
            ) : (
              <p className="py-16 text-center text-ink-mute">無法載入圖表資料</p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">自選清單</h2>
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

function IndexCard({
  label,
  symbol,
  quote,
}: {
  label: string;
  symbol: string;
  quote?: Quote;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
          {label}
        </p>
        <span className="text-[10px] font-mono text-ink-faint">{symbol}</span>
      </div>
      <p className="mt-2 font-mono text-[24px] font-semibold leading-none tracking-tight text-ink num">
        {quote ? formatNumber(quote.price) : '—'}
      </p>
      {quote && (
        <p
          className={cn(
            'mt-2 text-sm font-medium num',
            changeColor(quote.change),
          )}
        >
          {quote.change > 0 ? '+' : ''}
          {quote.change.toFixed(2)}{' '}
          <span className="text-xs opacity-80">
            ({formatPercent(quote.changePercent)})
          </span>
        </p>
      )}
      {quote?.dayHigh != null && quote?.dayLow != null && (
        <p className="mt-1.5 text-[11px] text-ink-mute">
          區間 {formatNumber(quote.dayLow)} – {formatNumber(quote.dayHigh)}
        </p>
      )}
    </div>
  );
}
