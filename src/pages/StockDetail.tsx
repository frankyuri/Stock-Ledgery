import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StockChart } from '@/components/charts/StockChart';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchCandles, fetchQuote } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { changeColor, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Holding, Quote, Resolution, Transaction } from '@/types/stock';

const RESOLUTIONS: Resolution[] = ['1D', '1W', '1M'];

export function StockDetail() {
  const { symbol = 'AAPL' } = useParams();
  const resolution = useStockStore((s) => s.resolution);
  const setResolution = useStockStore((s) => s.setResolution);
  const addToWatchlist = useStockStore((s) => s.addToWatchlist);
  const watchlist = useStockStore((s) => s.watchlist);
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
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
  const holding = useMemo(
    () => holdings.find((h) => h.symbol === symbol),
    [holdings, symbol],
  );
  const symbolTxns = useMemo(
    () =>
      transactions
        .filter((t) => t.symbol === symbol)
        .sort((a, b) => b.tradedAt.localeCompare(a.tradedAt))
        .slice(0, 8),
    [transactions, symbol],
  );

  return (
    <div className="space-y-5">
      <TickerHeader
        symbol={symbol}
        quote={quote.data}
        resolution={resolution}
        setResolution={setResolution}
        inWatchlist={inWatchlist}
        onAddWatchlist={() => addToWatchlist(symbol)}
      />

      <TickerStatsBar quote={quote.data} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
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
                <Skeleton className="h-[440px] w-full" />
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

          <TradesCard symbol={symbol} txns={symbolTxns} currency={quote.data?.currency} />
        </div>

        <aside className="space-y-5">
          <HoldingCard
            symbol={symbol}
            holding={holding}
            quote={quote.data}
          />
          <RangeCard quote={quote.data} />
        </aside>
      </div>
    </div>
  );
}

function TickerHeader({
  symbol,
  quote,
  resolution,
  setResolution,
  inWatchlist,
  onAddWatchlist,
}: {
  symbol: string;
  quote?: Quote;
  resolution: Resolution;
  setResolution: (r: Resolution) => void;
  inWatchlist: boolean;
  onAddWatchlist: () => void;
}) {
  return (
    <div className="card px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">{symbol}</h1>
            {quote && <span className="text-[15px] text-ink-mute">{quote.name}</span>}
            {quote?.exchangeName && <span className="chip">{quote.exchangeName}</span>}
          </div>
          {quote ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="font-mono text-[36px] font-semibold leading-none tracking-tight text-ink num">
                {formatNumber(quote.price)}
              </span>
              <span
                className={cn(
                  'font-mono text-base font-medium num',
                  changeColor(quote.change),
                )}
              >
                {quote.change > 0 ? '+' : ''}
                {formatNumber(quote.change)} ({formatPercent(quote.changePercent)})
              </span>
              <span className="text-sm text-ink-mute">{quote.currency}</span>
            </div>
          ) : (
            <p className="mt-2 text-[15px] text-ink-mute">載入中…</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={onAddWatchlist}
            className={`btn ${inWatchlist ? 'opacity-60' : ''}`}
          >
            {inWatchlist ? '已在自選' : '加入自選'}
          </button>
          <Link to="/transactions" className="btn btn-primary">
            新增交易
          </Link>
        </div>
      </div>
    </div>
  );
}

function TickerStatsBar({ quote }: { quote?: Quote }) {
  const items: Array<{ label: string; value: string; tone?: 'up' | 'down' }> = [
    { label: '24H 高', value: fmt(quote?.dayHigh), tone: 'up' },
    { label: '24H 低', value: fmt(quote?.dayLow), tone: 'down' },
    { label: '開盤', value: fmt(quote?.open) },
    { label: '前收', value: fmt(quote?.previousClose) },
    { label: '24H 量', value: formatCompact(quote?.volume) },
    { label: '20D 均量', value: formatCompact(quote?.avgVolume) },
    { label: '52W 高', value: fmt(quote?.fiftyTwoWeekHigh) },
    { label: '52W 低', value: fmt(quote?.fiftyTwoWeekLow) },
    {
      label: '市值',
      value: quote?.marketCap
        ? `${formatNumber(quote.marketCap / 1e9, 2)}B`
        : '—',
    },
  ];

  return (
    <div className="card px-5 py-3.5">
      <div className="flex flex-wrap gap-x-7 gap-y-3">
        {items.map((it) => (
          <div key={it.label} className="min-w-[84px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              {it.label}
            </p>
            <p
              className={cn(
                'mt-0.5 font-mono text-[15px] font-semibold text-ink num',
                it.tone === 'up' && 'text-up',
                it.tone === 'down' && 'text-down',
              )}
            >
              {it.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldingCard({
  symbol,
  holding,
  quote,
}: {
  symbol: string;
  holding?: Holding;
  quote?: Quote;
}) {
  if (!holding || !quote) {
    return (
      <div className="card p-5">
        <p className="label-caps">我的持倉</p>
        <p className="mt-3 text-sm text-ink-mute">
          尚未持有 {symbol}。前往交易紀錄新增一筆買入，就會在這裡看到即時損益。
        </p>
        <Link to="/transactions" className="btn btn-primary mt-4 w-full">
          新增交易
        </Link>
      </div>
    );
  }

  const marketValue = holding.shares * quote.price;
  const cost = holding.shares * holding.avgCost;
  const gainLoss = marketValue - cost;
  const gainLossPercent = cost ? (gainLoss / cost) * 100 : 0;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="label-caps">我的持倉</p>
        <span className="text-xs text-ink-faint">{quote.currency}</span>
      </div>

      <div className="mt-3 space-y-2.5">
        <Row label="持股數" value={formatNumber(holding.shares, 4)} />
        <Row label="平均成本" value={formatNumber(holding.avgCost)} />
        <Row label="市值" value={formatNumber(marketValue)} />
      </div>

      <div className="mt-4 rounded-xl border border-black/5 bg-black/[0.02] p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-mute">未實現損益</span>
          <span
            className={cn(
              'font-mono text-[15px] font-semibold num',
              changeColor(gainLoss),
            )}
          >
            {gainLoss > 0 ? '+' : ''}
            {formatNumber(gainLoss)}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-xs text-ink-faint">報酬率</span>
          <span
            className={cn('font-mono text-xs font-medium num', changeColor(gainLoss))}
          >
            {formatPercent(gainLossPercent)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RangeCard({ quote }: { quote?: Quote }) {
  const dayPct = rangePct(quote?.price, quote?.dayLow, quote?.dayHigh);
  const yearPct = rangePct(
    quote?.price,
    quote?.fiftyTwoWeekLow,
    quote?.fiftyTwoWeekHigh,
  );

  return (
    <div className="card p-5">
      <p className="label-caps">區間位置</p>
      <div className="mt-4 space-y-5">
        <RangeRow
          label="今日區間"
          low={quote?.dayLow}
          high={quote?.dayHigh}
          marker={dayPct}
        />
        <RangeRow
          label="52 週區間"
          low={quote?.fiftyTwoWeekLow}
          high={quote?.fiftyTwoWeekHigh}
          marker={yearPct}
        />
      </div>
    </div>
  );
}

function TradesCard({
  symbol,
  txns,
  currency,
}: {
  symbol: string;
  txns: Transaction[];
  currency?: string;
}) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="section-title">此股交易明細</h2>
          <p className="section-hint">最近 8 筆 · 依成交時間排序</p>
        </div>
        <Link to="/transactions" className="btn">
          查看全部
        </Link>
      </div>
      <div className="card-body p-0">
        {txns.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-mute">
            尚無 {symbol} 的交易紀錄
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left text-xs font-medium uppercase tracking-[0.1em] text-ink-faint">
                  <th className="px-6 py-3">日期</th>
                  <th className="px-6 py-3">方向</th>
                  <th className="px-6 py-3 text-right">股數</th>
                  <th className="px-6 py-3 text-right">價格</th>
                  <th className="px-6 py-3 text-right">手續費</th>
                  <th className="px-6 py-3 text-right">小計</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => {
                  const subtotal = t.shares * t.price + t.fee;
                  return (
                    <tr key={t.id} className="border-b border-black/[0.04] last:border-0">
                      <td className="px-6 py-3 text-ink-soft">{t.tradedAt.slice(0, 10)}</td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'chip',
                            t.type === 'BUY'
                              ? 'border-up/30 bg-up/10 text-up'
                              : 'border-down/30 bg-down/10 text-down',
                          )}
                        >
                          {t.type === 'BUY' ? '買入' : '賣出'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono num">
                        {formatNumber(t.shares, 4)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono num">
                        {formatNumber(t.price)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-ink-mute num">
                        {formatNumber(t.fee)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono num">
                        {formatNumber(subtotal)} {currency ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
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
  low,
  high,
  marker,
}: {
  label: string;
  low?: number;
  high?: number;
  marker: number | null;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-mute">{label}</span>
        <span className="font-mono text-[13px] text-ink-soft num">
          {fmt(low)}
          <span className="mx-1.5 text-ink-faint">—</span>
          {fmt(high)}
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

function rangePct(price?: number, low?: number, high?: number): number | null {
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
