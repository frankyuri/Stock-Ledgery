import { useQuery } from '@tanstack/react-query';
import { StockChart } from '@/components/charts/StockChart';
import { WatchlistTable } from '@/components/tables/WatchlistTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchCandles, fetchQuote, fetchQuotes } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { formatNumber, formatPercent, changeColor } from '@/lib/format';
import { cn } from '@/lib/cn';
import { symbolsKey } from '@/lib/queryKeys';
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

  const indexSymbols = INDEX_SYMBOLS.map((x) => x.symbol);
  const indices = useQuery({
    queryKey: ['quotes-lite', symbolsKey(indexSymbols)],
    queryFn: () => fetchQuotes(indexSymbols),
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
    // 與 quote 對齊：盤中最新一根 K 線會跟著動，不更新會跟報價不一致
    refetchInterval: 5 * 60_000,
  });

  const watch = useQuery({
    queryKey: ['quotes-lite', symbolsKey(watchlist)],
    queryFn: () => fetchQuotes(watchlist),
    enabled: watchlist.length > 0,
    refetchInterval: 60_000,
  });

  const indexMap = new Map(
    (indices.data?.quotes ?? []).map((q) => [q.symbol, q]),
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-6">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">大盤總覽</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">{selected} · 日 K 線</h2>
            <p className="section-hint">滾輪縮放 · 拖曳平移 · MA20；點自選切換</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {watchlist.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                className={`btn text-sm ${selected === s ? 'btn-primary' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {quote.data && (
          <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="font-mono text-[32px] font-semibold tracking-tight text-ink num">
              {formatNumber(quote.data.price)}
            </span>
            <span
              className={cn(
                'font-mono text-[15px] font-medium num',
                changeColor(quote.data.change),
              )}
            >
              {quote.data.change > 0 ? '+' : ''}
              {formatNumber(quote.data.change)} (
              {formatPercent(quote.data.changePercent)})
            </span>
            <span className="text-sm text-ink-mute">
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
            <h2 className="section-title">自選清單</h2>
            <p className="section-hint">每 60 秒自動更新（經 Yahoo Finance）</p>
          </div>
        </div>
        {watch.isLoading ? (
          <div className="p-6">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <WatchlistTable
            data={watch.data?.quotes ?? []}
            onRemove={remove}
            stale={(watch.data?.failed.length ?? 0) > 0}
          />
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
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <p className="label-caps">{label}</p>
        <span className="font-mono text-xs text-ink-faint">{symbol}</span>
      </div>
      <p className="mt-3 font-mono text-[28px] font-semibold leading-none tracking-tight text-ink num">
        {quote ? formatNumber(quote.price) : '—'}
      </p>
      {quote && (
        <p className={cn('mt-3 text-[15px] font-medium num', changeColor(quote.change))}>
          {quote.change > 0 ? '+' : ''}
          {quote.change.toFixed(2)}{' '}
          <span className="text-sm opacity-80">
            ({formatPercent(quote.changePercent)})
          </span>
        </p>
      )}
      {quote?.dayHigh != null && quote?.dayLow != null && (
        <p className="mt-2 text-xs text-ink-mute">
          區間 {formatNumber(quote.dayLow)} – {formatNumber(quote.dayHigh)}
        </p>
      )}
    </div>
  );
}
