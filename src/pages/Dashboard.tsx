import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';
import { WatchlistTable } from '@/components/tables/WatchlistTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { SymbolSearchInput } from '@/components/ui/SymbolSearchInput';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { fetchChartBundle, fetchQuote, fetchQuotes } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import { formatNumber, formatPercent, changeColor } from '@/lib/format';
import { cn } from '@/lib/cn';
import { symbolsKey } from '@/lib/queryKeys';
import { useToast } from '@/lib/toast';
import type { Quote, Resolution, SearchResult } from '@/types/stock';

const StockChart = lazy(() =>
  import('@/components/charts/StockChart').then((m) => ({ default: m.StockChart })),
);

const MAJOR_ASSETS = [
  { symbol: '^GSPC', label: 'S&P 500', category: 'US' },
  { symbol: '^IXIC', label: 'Nasdaq', category: 'US' },
  { symbol: '^DJI', label: '道瓊工業', category: 'US' },
  { symbol: '^TWII', label: '加權指數', category: 'TW' },
  { symbol: 'TSM', label: '台積電 ADR', category: 'US' },
  { symbol: '^SOX', label: '費城半導體', category: 'US' },
  { symbol: 'BTC-USD', label: '比特幣', category: 'CRYPTO' },
];

const RESOLUTIONS: Resolution[] = ['1D', '1W', '1M'];
const CHART_REFETCH_MS = 5 * 60_000;
const QUOTE_REFETCH_MS = 60_000;

export function Dashboard() {
  const selected = useStockStore((s) => s.selectedSymbol);
  const watchlist = useStockStore((s) => s.watchlist);
  const setSelected = useStockStore((s) => s.setSelectedSymbol);
  const addToWatchlist = useStockStore((s) => s.addToWatchlist);
  const remove = useStockStore((s) => s.removeFromWatchlist);
  const qc = useQueryClient();
  const toast = useToast();

  const [resolution, setResolution] = useState<Resolution>('1D');
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [addTickerInput, setAddTickerInput] = useState('');
  const [showAddTicker, setShowAddTicker] = useState(false);

  const assetSymbols = MAJOR_ASSETS.map((x) => x.symbol);
  const indices = useQuery({
    queryKey: ['quotes-lite', symbolsKey(assetSymbols)],
    queryFn: () => fetchQuotes(assetSymbols),
    refetchInterval: QUOTE_REFETCH_MS,
  });

  const bundle = useQuery({
    queryKey: ['chart-bundle', selected, resolution],
    queryFn: () => fetchChartBundle(selected, resolution),
    refetchInterval: CHART_REFETCH_MS,
  });

  const quote = useQuery({
    queryKey: ['quote', selected],
    queryFn: () => fetchQuote(selected),
    refetchInterval: QUOTE_REFETCH_MS,
    placeholderData: () =>
      qc.getQueryData<Awaited<ReturnType<typeof fetchChartBundle>>>([
        'chart-bundle',
        selected,
        resolution,
      ])?.quote,
  });

  const watch = useQuery({
    queryKey: ['quotes-lite', symbolsKey(watchlist)],
    queryFn: () => fetchQuotes(watchlist),
    enabled: watchlist.length > 0,
    refetchInterval: QUOTE_REFETCH_MS,
  });

  const indexMap = new Map((indices.data?.quotes ?? []).map((q) => [q.symbol, q]));
  const displayQuote = quote.data ?? bundle.data?.quote;

  function handleAddTicker(result: SearchResult) {
    if (watchlist.includes(result.symbol)) {
      toast.info(`${result.symbol} 已在自選清單中`);
    } else {
      addToWatchlist(result.symbol);
      toast.success(`已加入自選：${result.symbol}`);
    }
    setAddTickerInput('');
    setShowAddTicker(false);
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Status */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2">
              大盤總覽
              <span className="flex items-center gap-1 text-xs font-normal text-ink-mute dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                每 60 秒自動更新
              </span>
            </h1>
            <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
              全球主要指數行情、個股 K 線走勢、自選清單即時追蹤
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ['quotes-lite'] });
                qc.invalidateQueries({ queryKey: ['quote'] });
                qc.invalidateQueries({ queryKey: ['chart-bundle'] });
                toast.success('已刷新即時行情');
              }}
              className="btn text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>刷新行情</span>
            </button>
            <button
              type="button"
              onClick={() => setTradeModalOpen(true)}
              className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>記帳</span>
            </button>
          </div>
        </div>

        {/* Global Market Index Cards Grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {MAJOR_ASSETS.map((ix) => {
            const q = indexMap.get(ix.symbol);
            const isSelected = selected === ix.symbol;
            return (
              <IndexCard
                key={ix.symbol}
                label={ix.label}
                symbol={ix.symbol}
                quote={q}
                isSelected={isSelected}
                onClick={() => setSelected(ix.symbol)}
              />
            );
          })}
        </div>
      </section>

      {/* Main Interactive Stock Chart Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2">
                {selected}
                <Link
                  to={`/stock/${encodeURIComponent(selected)}`}
                  className="rounded-lg p-1 text-ink-mute transition hover:bg-black/5 hover:text-brand dark:hover:bg-white/10"
                  title="前往個股深入研究"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </h2>
              {displayQuote?.name && (
                <span className="text-sm text-ink-mute dark:text-zinc-400 truncate max-w-xs">
                  {displayQuote.name}
                </span>
              )}
              {displayQuote?.exchangeName && (
                <span className="chip text-[11px]">{displayQuote.exchangeName}</span>
              )}
            </div>

            {displayQuote && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="font-mono text-3xl font-bold tracking-tight text-ink dark:text-zinc-100 num">
                  {formatNumber(displayQuote.price)}
                </span>
                <span
                  className={cn(
                    'font-mono text-sm font-semibold flex items-center gap-1 num',
                    changeColor(displayQuote.change),
                  )}
                >
                  {displayQuote.change > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : displayQuote.change < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : null}
                  {displayQuote.change > 0 ? '+' : ''}
                  {formatNumber(displayQuote.change)} ({formatPercent(displayQuote.changePercent)})
                </span>
                <span className="text-xs text-ink-mute dark:text-zinc-400">
                  前收 {formatNumber(displayQuote.previousClose)} · 開盤{' '}
                  {formatNumber(displayQuote.open ?? 0)} · 高{' '}
                  {formatNumber(displayQuote.dayHigh ?? 0)} · 低{' '}
                  {formatNumber(displayQuote.dayLow ?? 0)} · {displayQuote.currency}
                </span>
              </div>
            )}
          </div>

          {/* Quick Watchlist switch chips & Resolution picker */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResolution(r)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium transition',
                    resolution === r
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                  )}
                >
                  {r === '1D' ? '日K' : r === '1W' ? '週K' : '月K'}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex flex-wrap gap-1.5 pl-2 border-l border-black/10 dark:border-white/10">
              {watchlist.slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                    selected === s
                      ? 'bg-brand text-white shadow-xs'
                      : 'border border-black/10 bg-white/70 text-ink-soft hover:bg-white dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Card */}
        <div className="card">
          <div className="card-body">
            {bundle.isLoading ? (
              <Skeleton className="h-[480px] w-full rounded-xl" />
            ) : bundle.data?.candles ? (
              <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
                <StockChart
                  symbol={selected}
                  data={bundle.data.candles}
                  resolution={resolution}
                  fiftyTwoWeekHigh={displayQuote?.fiftyTwoWeekHigh}
                  fiftyTwoWeekLow={displayQuote?.fiftyTwoWeekLow}
                />
              </Suspense>
            ) : (
              <p className="py-16 text-center text-ink-mute">無法載入圖表資料</p>
            )}
          </div>
        </div>
      </section>

      {/* Watchlist Section */}
      <section className="card overflow-hidden">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              自選監控清單
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand dark:bg-brand/20">
                {watchlist.length} 檔
              </span>
            </h2>
            <p className="section-hint">即時價格動態與 24H 振幅區間（點選任一列即可在上方切換圖表）</p>
          </div>

          <div className="flex items-center gap-2">
            {showAddTicker ? (
              <div className="flex items-center gap-1.5 w-64">
                <SymbolSearchInput
                  value={addTickerInput}
                  onChange={setAddTickerInput}
                  onSelect={handleAddTicker}
                  placeholder="輸入代號加入自選…"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowAddTicker(false)}
                  className="btn text-xs py-2 px-2.5 shrink-0"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddTicker(true)}
                className="btn text-xs py-1.5 px-3 flex items-center gap-1.5 font-medium"
              >
                <Plus className="h-3.5 w-3.5 text-brand" />
                <span>加入自選標的</span>
              </button>
            )}
          </div>
        </div>

        {watch.isLoading ? (
          <div className="p-6">
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        ) : (
          <WatchlistTable
            data={watch.data?.quotes ?? []}
            onRemove={remove}
            onSelectSymbol={(sym) => setSelected(sym)}
            selectedSymbol={selected}
            stale={(watch.data?.failed.length ?? 0) > 0}
          />
        )}
      </section>

      {/* Universal Quick Trade Modal */}
      <QuickTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        initialSymbol={selected}
      />
    </div>
  );
}

function IndexCard({
  label,
  symbol,
  quote,
  isSelected,
  onClick,
}: {
  label: string;
  symbol: string;
  quote?: Quote;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const isUp = (quote?.change ?? 0) > 0;
  const isDown = (quote?.change ?? 0) < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border p-4 text-left transition shadow-xs active:scale-[0.98] min-w-0',
        isSelected
          ? 'border-brand bg-brand/[0.04] ring-2 ring-brand/30 dark:bg-brand/10'
          : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-ink dark:text-zinc-100 truncate">{label}</span>
          <span className="font-mono text-[10px] text-ink-faint dark:text-zinc-500 shrink-0">{symbol}</span>
        </div>
        <p
          className="mt-2 font-mono text-lg sm:text-xl font-bold leading-tight truncate tracking-tight text-ink dark:text-zinc-100 num"
          title={quote ? formatNumber(quote.price) : undefined}
        >
          {quote ? formatNumber(quote.price) : '—'}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {quote ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-mono text-xs font-semibold num',
              changeColor(quote.change),
            )}
          >
            {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
            {isUp ? '+' : ''}
            {formatPercent(quote.changePercent)}
          </span>
        ) : (
          <span className="text-[11px] text-ink-mute">載入中…</span>
        )}

        <ArrowUpRight
          className={cn(
            'h-3.5 w-3.5 text-ink-faint transition group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
            isSelected && 'text-brand',
          )}
        />
      </div>
    </button>
  );
}
