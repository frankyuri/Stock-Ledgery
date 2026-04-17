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
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">{symbol}</h1>
            {quote.data && (
              <span className="text-[15px] text-ink-mute">{quote.data.name}</span>
            )}
            {quote.data?.exchangeName && (
              <span className="chip">{quote.data.exchangeName}</span>
            )}
          </div>
          {quote.data ? (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
              <span className="font-mono text-[36px] font-semibold leading-none tracking-tight text-ink num">
                {formatNumber(quote.data.price)}
              </span>
              <span
                className={cn(
                  'font-mono text-base font-medium num',
                  changeColor(quote.data.change),
                )}
              >
                {quote.data.change > 0 ? '+' : ''}
                {formatNumber(quote.data.change)} (
                {formatPercent(quote.data.changePercent)})
              </span>
              <span className="text-sm text-ink-mute">{quote.data.currency}</span>
            </div>
          ) : (
            <p className="mt-3 text-[15px] text-ink-mute">載入中…</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70 backdrop-blur">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResolution(r)}
                className={`px-3.5 py-2 text-sm font-medium transition ${
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
            <h2 className="section-title">走勢圖</h2>
            <p className="section-hint">
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
  const dayRangePct = rangePct(
    quote?.price,
    quote?.dayLow,
    quote?.dayHigh,
  );
  const yearRangePct = rangePct(
    quote?.price,
    quote?.fiftyTwoWeekLow,
    quote?.fiftyTwoWeekHigh,
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <InfoCard title="今日區間" hint="前收 → 開盤 → 即時價格位置">
        <Row label="前收" value={fmt(quote?.previousClose)} />
        <Row label="開盤" value={fmt(quote?.open)} />
        <RangeRow
          label="日高 / 日低"
          high={quote?.dayHigh}
          low={quote?.dayLow}
          marker={dayRangePct}
        />
      </InfoCard>

      <InfoCard title="52 週區間" hint="最近一年走勢位置">
        <RangeRow
          label="52W 高 / 低"
          high={quote?.fiftyTwoWeekHigh}
          low={quote?.fiftyTwoWeekLow}
          marker={yearRangePct}
        />
        <Row
          label="距 52W 高"
          value={
            quote?.fiftyTwoWeekHigh && quote.price
              ? formatPercent(
                  ((quote.price - quote.fiftyTwoWeekHigh) / quote.fiftyTwoWeekHigh) * 100,
                )
              : '—'
          }
        />
        <Row
          label="距 52W 低"
          value={
            quote?.fiftyTwoWeekLow && quote.price
              ? formatPercent(
                  ((quote.price - quote.fiftyTwoWeekLow) / quote.fiftyTwoWeekLow) * 100,
                )
              : '—'
          }
        />
      </InfoCard>

      <InfoCard title="成交量與估值">
        <Row label="成交量" value={formatCompact(quote?.volume)} />
        <Row label="20 日均量" value={formatCompact(quote?.avgVolume)} />
        <Row
          label="市值"
          value={
            quote?.marketCap
              ? `${formatNumber(quote.marketCap / 1e9, 2)} B ${quote.currency ?? ''}`
              : '—'
          }
        />
      </InfoCard>
    </div>
  );
}

function InfoCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">
          {title}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-ink-mute">{label}</span>
      <span className="font-mono text-[15px] font-medium text-ink num">{value}</span>
    </div>
  );
}

function RangeRow({
  label,
  high,
  low,
  marker,
}: {
  label: string;
  high?: number;
  low?: number;
  marker: number | null;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-mute">{label}</span>
        <span className="font-mono text-[15px] font-medium text-ink num">
          {fmt(high)}
          <span className="mx-1.5 text-ink-faint">·</span>
          {fmt(low)}
        </span>
      </div>
      {marker != null && (
        <div className="relative mt-2 h-1.5 rounded-full bg-black/[0.06]">
          <div
            className="absolute -top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-brand shadow"
            style={{ left: `${marker}%` }}
          />
        </div>
      )}
    </div>
  );
}

function rangePct(
  price?: number,
  low?: number,
  high?: number,
): number | null {
  if (price == null || low == null || high == null || high <= low) return null;
  const p = ((price - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, p));
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
