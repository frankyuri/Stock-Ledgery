import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StockChart } from '@/components/charts/StockChart';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { fetchCandles, fetchQuote } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { formatNumber } from '@/lib/format';
import type { Resolution } from '@/types/stock';

const RESOLUTIONS: Resolution[] = ['1D', '1W', '1M'];

export function StockDetail() {
  const { symbol = 'AAPL' } = useParams();
  const resolution = useStockStore((s) => s.resolution);
  const setResolution = useStockStore((s) => s.setResolution);
  const addToWatchlist = useStockStore((s) => s.addToWatchlist);
  const watchlist = useStockStore((s) => s.watchlist);
  const setSelected = useStockStore((s) => s.setSelectedSymbol);

  useEffect(() => {
    setSelected(symbol);
  }, [symbol, setSelected]);

  const quote = useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
  });

  const chart = useQuery({
    queryKey: ['chart', symbol, resolution],
    queryFn: () => fetchCandles(symbol, resolution),
  });

  const inWatchlist = watchlist.includes(symbol);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {symbol}
            {quote.data && (
              <span className="ml-3 text-sm font-normal text-ink-mute">
                {quote.data.name}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-ink-mute">個股即時報價與歷史走勢</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70 backdrop-blur">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResolution(r)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  resolution === r
                    ? 'bg-brand text-white'
                    : 'text-ink-soft hover:bg-black/[0.04]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={inWatchlist}
            onClick={() => addToWatchlist(symbol)}
            className={`btn ${inWatchlist ? 'opacity-60' : 'btn-primary'}`}
          >
            {inWatchlist ? '已在自選' : '加入自選'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="現價"
          value={quote.data ? formatNumber(quote.data.price) : '—'}
          change={quote.data?.change}
          changePercent={quote.data?.changePercent}
        />
        <StatCard
          label="前日收盤"
          value={quote.data ? formatNumber(quote.data.previousClose) : '—'}
        />
        <StatCard label="幣別" value={quote.data?.currency ?? '—'} />
        <StatCard
          label="週期"
          value={resolution}
          hint="1D = 日線；1W = 週線；1M = 月線"
        />
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            走勢圖
          </h2>
          <span className="text-xs text-ink-mute">滾輪縮放 · 拖曳平移 · MA20</span>
        </div>
        <div className="card-body">
          {chart.isLoading ? (
            <Skeleton className="h-[420px] w-full" />
          ) : chart.data ? (
            <StockChart data={chart.data} />
          ) : (
            <p className="py-16 text-center text-ink-mute">暫無資料</p>
          )}
        </div>
      </section>
    </div>
  );
}
