import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StockChart } from '@/components/charts/StockChart';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchCandles, fetchQuote } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { changeColor, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Quote, Resolution } from '@/types/stock';

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
    refetchInterval: 60_000,
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
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{symbol}</h1>
            {quote.data && (
              <span className="text-sm text-ink-mute">{quote.data.name}</span>
            )}
            {quote.data?.exchangeName && (
              <span className="chip">{quote.data.exchangeName}</span>
            )}
          </div>
          {quote.data ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-[32px] font-semibold leading-none tracking-tight text-ink num">
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
              <span className="text-xs text-ink-mute">{quote.data.currency}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-mute">載入中…</p>
          )}
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

      <QuoteStrip quote={quote.data} />

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">走勢圖</h2>
            <p className="mt-0.5 text-xs text-ink-mute">
              滾輪縮放 · 拖曳平移 · MA 可多選 · hover 看 OHLC · 52W 以虛線標示
            </p>
          </div>
        </div>
        <div className="card-body">
          {chart.isLoading ? (
            <Skeleton className="h-[420px] w-full" />
          ) : chart.data ? (
            <StockChart
              data={chart.data}
              fiftyTwoWeekHigh={quote.data?.fiftyTwoWeekHigh}
              fiftyTwoWeekLow={quote.data?.fiftyTwoWeekLow}
            />
          ) : (
            <p className="py-16 text-center text-ink-mute">暫無資料</p>
          )}
        </div>
      </section>
    </div>
  );
}

function QuoteStrip({ quote }: { quote?: Quote }) {
  const items: Array<{ label: string; value: string; hint?: string }> = [
    { label: '前收', value: fmt(quote?.previousClose) },
    { label: '開盤', value: fmt(quote?.open) },
    { label: '日高', value: fmt(quote?.dayHigh) },
    { label: '日低', value: fmt(quote?.dayLow) },
    { label: '52W 高', value: fmt(quote?.fiftyTwoWeekHigh) },
    { label: '52W 低', value: fmt(quote?.fiftyTwoWeekLow) },
    { label: '成交量', value: formatCompact(quote?.volume) },
    { label: '均量 (20)', value: formatCompact(quote?.avgVolume) },
    {
      label: '市值',
      value: quote?.marketCap
        ? `${formatNumber(quote.marketCap / 1e9, 2)} B`
        : '—',
      hint: quote?.currency,
    },
  ];
  return (
    <div className="card">
      <div className="grid grid-cols-3 divide-x divide-y divide-black/5 sm:grid-cols-5 lg:grid-cols-9">
        {items.map((it) => (
          <div key={it.label} className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
              {it.label}
            </p>
            <p className="mt-1 font-mono text-[15px] font-medium text-ink num">
              {it.value}
            </p>
            {it.hint && <p className="text-[10px] text-ink-faint">{it.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(v: number | undefined): string {
  return v != null ? formatNumber(v) : '—';
}

function formatCompact(v: number | undefined): string {
  if (v == null) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toString();
}
