import { useEffect, useMemo, lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  BookmarkPlus,
  BookmarkCheck,
  Share2,
  Pencil,
  Wallet,
  BarChart3,
  Percent,
  Bell,
} from 'lucide-react';
import type { ChartMarker } from '@/components/charts/StockChart';
import { Skeleton } from '@/components/ui/Skeleton';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { fetchChartBundle, fetchQuote } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { changeColor, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import {
  computeDividendStats,
  estimateAnnualIncome,
  type DividendStats,
} from '@/lib/dividends';
import type {
  Candle,
  DividendEvent,
  Holding,
  Quote,
  Resolution,
  SplitEvent,
  Transaction,
  TransactionType,
} from '@/types/stock';

const StockChart = lazy(() =>
  import('@/components/charts/StockChart').then((m) => ({ default: m.StockChart })),
);

const CHART_REFETCH_MS = 5 * 60_000;
const QUOTE_REFETCH_MS = 60_000;
const RESOLUTIONS: Resolution[] = ['1D', '1W', '1M'];

export function StockDetail() {
  const { symbol = 'AAPL' } = useParams();
  const navigate = useNavigate();
  const resolution = useStockStore((s) => s.resolution);
  const setResolution = useStockStore((s) => s.setResolution);
  const addToWatchlist = useStockStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useStockStore((s) => s.removeFromWatchlist);
  const watchlist = useStockStore((s) => s.watchlist);
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
  const setSelected = useStockStore((s) => s.setSelectedSymbol);
  const qc = useQueryClient();
  const toast = useToast();

  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<TransactionType>('BUY');
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);

  useEffect(() => {
    setSelected(symbol);
  }, [symbol, setSelected]);

  const bundle = useQuery({
    queryKey: ['chart-bundle', symbol, resolution],
    queryFn: () => fetchChartBundle(symbol, resolution),
    refetchInterval: CHART_REFETCH_MS,
  });

  const quote = useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
    refetchInterval: QUOTE_REFETCH_MS,
    placeholderData: () =>
      qc.getQueryData<Awaited<ReturnType<typeof fetchChartBundle>>>([
        'chart-bundle',
        symbol,
        resolution,
      ])?.quote,
  });

  const displayQuote = quote.data ?? bundle.data?.quote;
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
        .slice(0, 10),
    [transactions, symbol],
  );

  const dividends = bundle.data?.dividends ?? [];
  const splits = bundle.data?.splits ?? [];

  const dividendStats = useMemo(
    () => computeDividendStats(symbol, transactions, dividends),
    [symbol, transactions, dividends],
  );

  const markers = useMemo<ChartMarker[]>(() => {
    const out: ChartMarker[] = [];
    for (const t of transactions.filter((x) => x.symbol === symbol)) {
      out.push({
        time: t.tradedAt,
        position: t.type === 'BUY' ? 'belowBar' : 'aboveBar',
        color: t.type === 'BUY' ? '#30d158' : '#ff453a',
        shape: t.type === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `${t.type === 'BUY' ? '買' : '賣'} ${formatNumber(t.shares, 2)}`,
      });
    }
    for (const d of dividends) {
      out.push({
        time: d.date,
        position: 'belowBar',
        color: '#0a84ff',
        shape: 'circle',
        text: `配息 ${d.amount}`,
      });
    }
    for (const s of splits) {
      out.push({
        time: s.date,
        position: 'aboveBar',
        color: '#bf5af2',
        shape: 'square',
        text: `拆股 ${s.numerator}:${s.denominator}`,
      });
    }
    return out;
  }, [transactions, symbol, dividends, splits]);

  function handleOpenTrade(type: TransactionType = 'BUY', txnToEdit: Transaction | null = null) {
    setTradeType(type);
    setEditingTxn(txnToEdit);
    setTradeModalOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <TickerHeader
        symbol={symbol}
        quote={displayQuote}
        resolution={resolution}
        setResolution={setResolution}
        inWatchlist={inWatchlist}
        onToggleWatchlist={() => {
          if (inWatchlist) {
            removeFromWatchlist(symbol);
            toast.info(`已從自選清單移除：${symbol}`);
          } else {
            addToWatchlist(symbol);
            toast.success(`已加入自選清單：${symbol}`);
          }
        }}
        onOpenTrade={() => handleOpenTrade('BUY')}
      />

      {/* Stats Bar */}
      <TickerStatsBar quote={displayQuote} />

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {/* Chart Section */}
          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand" />
                  技術線圖與買賣標記
                </h2>
                <p className="section-hint">
                  買進以綠色箭頭、賣出以紅色箭頭、配息以藍點、拆股以紫色方塊標記
                </p>
              </div>
            </div>
            <div className="card-body">
              {bundle.isLoading ? (
                <Skeleton className="h-[480px] w-full rounded-xl" />
              ) : bundle.data ? (
                <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
                  <StockChart
                    symbol={symbol}
                    name={displayQuote?.name}
                    quote={displayQuote}
                    data={bundle.data.candles}
                    resolution={resolution}
                    onResolutionChange={setResolution}
                    fiftyTwoWeekHigh={displayQuote?.fiftyTwoWeekHigh}
                    fiftyTwoWeekLow={displayQuote?.fiftyTwoWeekLow}
                    markers={markers}
                    watchlist={watchlist}
                    onSelectSymbol={(s) => navigate(`/stock/${encodeURIComponent(s)}`)}
                  />
                </Suspense>
              ) : (
                <p className="py-16 text-center text-ink-mute dark:text-zinc-400">暫無歷史線圖資料</p>
              )}
            </div>
          </section>

          {/* Historical Returns Scorecard */}
          {bundle.data?.candles && (
            <PerformanceScorecard candles={bundle.data.candles} />
          )}

          {/* Recent Trades for this symbol */}
          <TradesCard
            symbol={symbol}
            txns={symbolTxns}
            currency={displayQuote?.currency}
            onEditTrade={(t) => handleOpenTrade(t.type, t)}
            onNewTrade={() => handleOpenTrade('BUY')}
          />

          {/* Corporate Events (Dividends & Splits) */}
          {(dividends.length > 0 || splits.length > 0) && (
            <EventsCard
              dividends={dividends}
              splits={splits}
              currency={displayQuote?.currency}
              dividendStats={dividendStats}
            />
          )}
        </div>

        {/* Right Sidebar Panel */}
        <aside className="space-y-5">
          <HoldingCard
            symbol={symbol}
            holding={holding}
            quote={displayQuote}
            stats={dividendStats}
            onBuyMore={() => handleOpenTrade('BUY')}
            onSell={() => handleOpenTrade('SELL')}
          />
          <RangeCard quote={displayQuote} />
        </aside>
      </div>

      {/* Quick Trade Modal */}
      <QuickTradeModal
        isOpen={tradeModalOpen}
        onClose={() => {
          setTradeModalOpen(false);
          setEditingTxn(null);
        }}
        initialSymbol={symbol}
        initialType={tradeType}
        editTransaction={editingTxn}
      />
    </div>
  );
}

function TickerHeader({
  symbol,
  quote,
  resolution,
  setResolution,
  inWatchlist,
  onToggleWatchlist,
  onOpenTrade,
}: {
  symbol: string;
  quote?: Quote;
  resolution: Resolution;
  setResolution: (r: Resolution) => void;
  inWatchlist: boolean;
  onToggleWatchlist: () => void;
  onOpenTrade: () => void;
}) {
  const toast = useToast();

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      toast.success('已複製個股連結至剪貼簿');
    });
  }

  return (
    <div className="card px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink dark:text-zinc-100 truncate">
              {symbol}
            </h1>
            {quote && (
              <span className="text-sm sm:text-base text-ink-mute dark:text-zinc-400 font-medium truncate">
                {quote.name}
              </span>
            )}
            {quote?.exchangeName && (
              <span className="chip font-semibold shrink-0">{quote.exchangeName}</span>
            )}
          </div>

          {quote ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="font-mono text-3xl sm:text-4xl font-bold leading-none tracking-tight text-ink dark:text-zinc-100 num truncate">
                {formatNumber(quote.price)}
              </span>
              <span
                className={cn(
                  'font-mono text-base font-semibold flex items-center gap-1 num',
                  changeColor(quote.change),
                )}
              >
                {quote.change > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : quote.change < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : null}
                {quote.change > 0 ? '+' : ''}
                {formatNumber(quote.change)} ({formatPercent(quote.changePercent)})
              </span>
              <span className="text-xs text-ink-mute dark:text-zinc-400 font-medium">
                {quote.currency}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-mute dark:text-zinc-400">讀取即時報價中…</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Resolution Tabs */}
          <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResolution(r)}
                className={cn(
                  'rounded-md px-3 py-1.5 font-semibold transition',
                  resolution === r
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                )}
              >
                {r === '1D' ? '日K' : r === '1W' ? '週K' : '月K'}
              </button>
            ))}
          </div>

          {/* Watchlist Button */}
          <button
            type="button"
            onClick={onToggleWatchlist}
            className={cn(
              'btn text-xs font-semibold py-2 px-3 flex items-center gap-1.5',
              inWatchlist && 'bg-brand-soft text-brand dark:bg-brand/20',
            )}
          >
            {inWatchlist ? (
              <BookmarkCheck className="h-4 w-4 text-brand" />
            ) : (
              <BookmarkPlus className="h-4 w-4" />
            )}
            <span>{inWatchlist ? '已在自選' : '加入自選'}</span>
          </button>

          {/* Share Link Button */}
          <button
            type="button"
            onClick={copyLink}
            className="btn text-xs py-2 px-2.5"
            title="複製分享連結"
          >
            <Share2 className="h-4 w-4" />
          </button>

          {/* Price Alert Button */}
          <Link
            to="/settings/line"
            className="btn text-xs py-2 px-2.5 flex items-center text-amber-600 hover:text-amber-700 dark:text-amber-400"
            title="設定此檔股票價格警示"
          >
            <Bell className="h-4 w-4" />
          </Link>

          {/* Quick Trade Button */}
          <button
            type="button"
            onClick={onOpenTrade}
            className="btn btn-primary text-xs font-semibold py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>記帳 / 交易</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TickerStatsBar({ quote }: { quote?: Quote }) {
  const items: Array<{ label: string; value: string; tone?: 'up' | 'down' }> = [
    { label: '24H 最高', value: fmt(quote?.dayHigh), tone: 'up' },
    { label: '24H 最低', value: fmt(quote?.dayLow), tone: 'down' },
    { label: '開盤價', value: fmt(quote?.open) },
    { label: '昨日收盤', value: fmt(quote?.previousClose) },
    { label: '24H 成交量', value: formatCompact(quote?.volume) },
    { label: '20日均量', value: formatCompact(quote?.avgVolume) },
    { label: '52週最高', value: fmt(quote?.fiftyTwoWeekHigh) },
    { label: '52週最低', value: fmt(quote?.fiftyTwoWeekLow) },
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
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint dark:text-zinc-500">
              {it.label}
            </p>
            <p
              className={cn(
                'mt-0.5 font-mono text-sm font-bold text-ink num dark:text-zinc-100',
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

function PerformanceScorecard({ candles }: { candles: Candle[] }) {
  const returns = useMemo(() => {
    if (!candles || candles.length < 2) return null;
    const latestClose = candles[candles.length - 1].close;

    function calcReturn(barsAgo: number) {
      if (candles.length <= barsAgo) return null;
      const baseClose = candles[candles.length - 1 - barsAgo].close;
      if (!baseClose) return null;
      return ((latestClose - baseClose) / baseClose) * 100;
    }

    return [
      { label: '近 1 週', val: calcReturn(5) },
      { label: '近 1 月', val: calcReturn(22) },
      { label: '近 3 月', val: calcReturn(66) },
      { label: '近 6 月', val: calcReturn(132) },
      { label: '近 1 年', val: calcReturn(252) },
    ];
  }, [candles]);

  if (!returns) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="label-caps flex items-center gap-1.5">
          <Percent className="h-3.5 w-3.5 text-brand" />
          歷史區間報酬率 (表現回顧)
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {returns.map(({ label, val }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center rounded-xl border border-black/5 bg-black/[0.02] py-2.5 px-3 text-center dark:border-white/5 dark:bg-white/[0.03]"
          >
            <span className="text-[11px] font-bold text-ink-mute dark:text-zinc-400">
              {label}
            </span>
            <span
              className={cn(
                'mt-1 font-mono text-sm font-bold num',
                val != null ? changeColor(val) : 'text-ink-mute',
              )}
            >
              {val != null ? (val > 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`) : '—'}
            </span>
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
  stats,
  onBuyMore,
  onSell,
}: {
  symbol: string;
  holding?: Holding;
  quote?: Quote;
  stats?: DividendStats;
  onBuyMore: () => void;
  onSell: () => void;
}) {
  if (!holding || !quote) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <p className="label-caps">我的持倉部位</p>
          <Wallet className="h-4 w-4 text-ink-faint dark:text-zinc-500" />
        </div>
        <p className="mt-3 text-sm text-ink-mute dark:text-zinc-400">
          目前尚未持有 {symbol}。點選下方按鈕可快速記帳，即時建立成本與損益追蹤。
        </p>
        <button
          type="button"
          onClick={onBuyMore}
          className="btn btn-primary mt-4 w-full text-xs font-semibold py-2"
        >
          買進此股票
        </button>
      </div>
    );
  }

  const marketValue = holding.shares * quote.price;
  const cost = holding.shares * holding.avgCost;
  const gainLoss = marketValue - cost;
  const gainLossPercent = cost ? (gainLoss / cost) * 100 : 0;

  const annualIncome = stats
    ? estimateAnnualIncome(stats.trailing12mPerShare, holding.shares)
    : 0;
  const yieldOnCost = cost && annualIncome ? (annualIncome / cost) * 100 : 0;
  const showDividend = !!stats && stats.totalIncome > 0;
  const showForwardYield = !!stats && stats.trailing12mPerShare > 0;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="label-caps flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-brand" />
          我的持倉部位
        </p>
        <span className="text-xs text-ink-faint dark:text-zinc-400 font-semibold">{quote.currency}</span>
      </div>

      <div className="mt-4 space-y-2.5 text-sm">
        <Row label="持有股數" value={formatNumber(holding.shares, 4)} />
        <Row label="平均持股成本" value={formatNumber(holding.avgCost)} />
        <Row label="目前市值" value={formatNumber(marketValue)} />
      </div>

      {/* Unrealized Gain Loss Box */}
      <div className="mt-4 rounded-xl border border-black/5 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-ink-mute dark:text-zinc-400">未實現損益</span>
          <span
            className={cn(
              'font-mono text-base font-bold num',
              changeColor(gainLoss),
            )}
          >
            {gainLoss > 0 ? '+' : ''}
            {formatNumber(gainLoss)}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-xs text-ink-faint dark:text-zinc-400">報酬率</span>
          <span
            className={cn('font-mono text-xs font-semibold num', changeColor(gainLoss))}
          >
            {formatPercent(gainLossPercent)}
          </span>
        </div>
      </div>

      {/* Dividend Income Box */}
      {(showDividend || showForwardYield) && (
        <div className="mt-3 rounded-xl border border-black/5 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
          {showDividend && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-ink-mute dark:text-zinc-400">
                累計領取股息
                <span className="ml-1 text-[11px] text-ink-faint dark:text-zinc-400">
                  · {stats!.paidEventCount} 次
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-up num">
                +{formatNumber(stats!.totalIncome)}
              </span>
            </div>
          )}
          {showForwardYield && (
            <div className={cn('flex items-baseline justify-between', showDividend && 'mt-1.5')}>
              <span className="text-xs text-ink-faint dark:text-zinc-400">預估年股息 (TTM)</span>
              <span className="font-mono text-xs font-semibold text-ink-soft num dark:text-zinc-300">
                {formatNumber(annualIncome)}
                {yieldOnCost > 0 && (
                  <span className="ml-1 text-ink-faint dark:text-zinc-400">
                    ({yieldOnCost.toFixed(2)}%)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quick Buy/Sell actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onBuyMore}
          className="btn text-xs font-semibold py-2 text-up border-up/30 hover:bg-up/[0.08]"
        >
          買進加碼
        </button>
        <button
          type="button"
          onClick={onSell}
          className="btn text-xs font-semibold py-2 text-down border-down/30 hover:bg-down/[0.08]"
        >
          賣出部位
        </button>
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
      <p className="label-caps mb-4">價格區間位置</p>
      <div className="space-y-5">
        <RangeRow
          label="今日振幅區間"
          low={quote?.dayLow}
          high={quote?.dayHigh}
          current={quote?.price}
          marker={dayPct}
        />
        <RangeRow
          label="52 週高低區間"
          low={quote?.fiftyTwoWeekLow}
          high={quote?.fiftyTwoWeekHigh}
          current={quote?.price}
          marker={yearPct}
        />
      </div>
    </div>
  );
}

function RangeRow({
  label,
  low,
  high,
  current,
  marker,
}: {
  label: string;
  low?: number;
  high?: number;
  current?: number;
  marker: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-mute dark:text-zinc-400">{label}</span>
        {current != null && (
          <span className="font-mono font-semibold text-ink dark:text-zinc-200">
            現價 {formatNumber(current)}
          </span>
        )}
      </div>
      <div className="relative mt-2.5 h-2 w-full rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-brand shadow-sm dark:border-zinc-900"
          style={{ left: `${marker}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ink-faint dark:text-zinc-500">
        <span>{fmt(low)}</span>
        <span>{fmt(high)}</span>
      </div>
    </div>
  );
}

function TradesCard({
  symbol,
  txns,
  currency,
  onEditTrade,
  onNewTrade,
}: {
  symbol: string;
  txns: Transaction[];
  currency?: string;
  onEditTrade: (t: Transaction) => void;
  onNewTrade: () => void;
}) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="section-title">此標的交易歷史</h2>
          <p className="section-hint">最近 10 筆交易（點選筆圖示可直接編輯）</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewTrade}
            className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>記帳</span>
          </button>
          <Link to="/transactions" className="btn text-xs py-1.5 px-3">
            全部紀錄
          </Link>
        </div>
      </div>
      <div className="card-body p-0">
        {txns.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-mute dark:text-zinc-500">
            尚無 {symbol} 的交易紀錄
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-faint dark:border-white/10 dark:text-zinc-500">
                  <th className="px-5 py-3">交易日期</th>
                  <th className="px-5 py-3">類別</th>
                  <th className="px-5 py-3 text-right">股數</th>
                  <th className="px-5 py-3 text-right">成交價</th>
                  <th className="px-5 py-3 text-right">手續費</th>
                  <th className="px-5 py-3 text-right">總金額</th>
                  <th className="px-5 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {txns.map((t) => {
                  const subtotal = t.shares * t.price + (t.type === 'BUY' ? t.fee : -t.fee);
                  return (
                    <tr
                      key={t.id}
                      className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3 font-mono text-ink-soft dark:text-zinc-300">
                        {t.tradedAt}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'chip font-semibold',
                            t.type === 'BUY'
                              ? 'border-up/30 bg-up/10 text-up'
                              : 'border-down/30 bg-down/10 text-down',
                          )}
                        >
                          {t.type === 'BUY' ? '買入' : '賣出'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold num">
                        {formatNumber(t.shares, 4)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono num">
                        {formatNumber(t.price)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-ink-mute dark:text-zinc-400 num">
                        {formatNumber(t.fee)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold num">
                        {formatNumber(subtotal)} {currency ?? ''}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onEditTrade(t)}
                          className="rounded-lg p-1.5 text-ink-mute dark:text-zinc-400 transition hover:bg-black/5 hover:text-brand dark:hover:bg-white/10"
                          title="編輯此筆交易"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
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

function EventsCard({
  dividends,
  splits,
  currency,
  dividendStats,
}: {
  dividends: DividendEvent[];
  splits: SplitEvent[];
  currency?: string;
  dividendStats?: DividendStats;
}) {
  const recentDivs = [...dividends]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  const recentSplits = [...splits]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const incomeByDate = new Map(
    (dividendStats?.rows ?? []).map((r) => [r.date, r]),
  );

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="section-title">公司事件與除權息</h2>
          <p className="section-hint">
            歷史配息 {dividends.length} 次 · 拆股 {splits.length} 次
            {dividendStats && dividendStats.totalIncome > 0 && (
              <span className="ml-1.5 font-bold text-up">
                · 累計領取股息 +{formatNumber(dividendStats.totalIncome)} {currency ?? ''}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-black/5 md:grid-cols-2 md:divide-x md:divide-y-0 dark:divide-white/10">
        <div className="p-5">
          <p className="label-caps mb-3">最近配息歷程</p>
          {recentDivs.length === 0 ? (
            <p className="text-sm text-ink-mute dark:text-zinc-400">無歷史配息紀錄</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {recentDivs.map((d) => {
                const myRow = incomeByDate.get(d.date);
                return (
                  <li
                    key={d.date}
                    className="flex items-baseline justify-between gap-2 font-mono"
                  >
                    <span className="text-xs text-ink-soft num dark:text-zinc-300">
                      {d.date}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-ink num dark:text-zinc-100">
                        {d.amount} {currency ?? ''}
                      </span>
                      {myRow && (
                        <span
                          className="rounded-md bg-up/[0.1] px-1.5 py-0.5 text-[11px] font-bold text-up num"
                          title={`當時持有 ${formatNumber(myRow.shares, 2)} 股`}
                        >
                          +{formatNumber(myRow.income)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-5">
          <p className="label-caps mb-3">股票分割 (拆股)</p>
          {recentSplits.length === 0 ? (
            <p className="text-sm text-ink-mute dark:text-zinc-400">近期無拆股紀錄</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {recentSplits.map((s) => (
                <li
                  key={s.date}
                  className="flex items-baseline justify-between gap-2 font-mono"
                >
                  <span className="text-xs text-ink-soft num dark:text-zinc-300">
                    {s.date}
                  </span>
                  <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                    {s.numerator} : {s.denominator} 拆股
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-ink-mute dark:text-zinc-400">{label}</span>
      <span className="font-mono font-semibold text-ink num dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}

function fmt(n?: number): string {
  return n != null ? formatNumber(n) : '—';
}

function formatCompact(v?: number): string {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return formatNumber(v, 0);
}

function rangePct(val?: number, low?: number, high?: number): number {
  if (val == null || low == null || high == null || high <= low) return 50;
  const clamped = Math.min(Math.max(val, low), high);
  return ((clamped - low) / (high - low)) * 100;
}
