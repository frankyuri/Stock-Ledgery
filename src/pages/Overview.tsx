import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  PlusCircle,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  FileText,
} from 'lucide-react';
import { AllocationPie, type PieSlice } from '@/components/charts/AllocationPie';
import { Skeleton } from '@/components/ui/Skeleton';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { MonthlyReportModal } from '@/components/modals/MonthlyReportModal';
import { portfolioQueryOptions } from '@/lib/queries/portfolio';
import { useStockStore } from '@/store/useStockStore';
import {
  changeColor,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import { useCurrency } from '@/lib/hooks/useCurrency';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';
import { cn } from '@/lib/cn';
import type { PortfolioHolding } from '@/types/stock';

export function Overview() {
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const { baseCurrency } = useCurrency();

  const { data, isLoading } = useQuery(portfolioQueryOptions(holdings));

  const enriched = data?.holdings ?? [];
  const stale = data?.stale ?? false;
  const failedSymbols = data?.failed ?? [];

  const groups = useMemo(() => groupByCurrency(enriched), [enriched]);
  const primary = groups.find((g) => g.currency === baseCurrency) || groups[0];

  const netFlow = useMemo(() => {
    let v = 0;
    for (const t of transactions) {
      const amt = t.shares * t.price;
      v += t.type === 'BUY' ? -(amt + t.fee) : amt - t.fee;
    }
    return v;
  }, [transactions]);

  const realizedTotal = useMemo(
    () => transactions.reduce((s, t) => s + (t.realizedGainLoss ?? 0), 0),
    [transactions],
  );

  // Diversification metrics
  const diversification = useMemo(() => {
    if (enriched.length === 0) return null;
    const sorted = [...enriched].sort((a, b) => b.marketValue - a.marketValue);
    const totalVal = sorted.reduce((sum, h) => sum + h.marketValue, 0);
    const top3Val = sorted.slice(0, 3).reduce((sum, h) => sum + h.marketValue, 0);
    const top3Ratio = totalVal > 0 ? (top3Val / totalVal) * 100 : 0;

    const gainers = enriched.filter((h) => h.gainLoss > 0).length;
    const losers = enriched.filter((h) => h.gainLoss < 0).length;

    return {
      top3Ratio,
      totalHoldings: enriched.length,
      gainers,
      losers,
    };
  }, [enriched]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
            <PieChart className="h-6 w-6 text-brand" />
            資產總覽
          </h1>
          <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
            視覺化分析總資產部位、今日波動、配置權重與集中度。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CurrencyToggle />
          {holdings.length > 0 && (
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="btn text-xs font-semibold py-2 px-3 flex items-center gap-1.5 border-brand/40 bg-brand/10 text-brand hover:bg-brand/20 shadow-xs"
              title="生成並匯出投資月報簡報"
            >
              <FileText className="h-4 w-4" />
              <span>月度簡報</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setTradeModalOpen(true)}
            className="btn btn-primary text-xs font-semibold py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>快速記帳</span>
          </button>
        </div>
      </div>

      {holdings.length === 0 ? (
        <EmptyState onAdd={() => setTradeModalOpen(true)} />
      ) : isLoading || !data ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : (
        <>
          {stale && (
            <div className="card border-amber-300/40 bg-amber-50/60 px-5 py-3 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
              ⚠ 以下標的報價載入稍微延遲，數值以持股成本暫代：
              <span className="ml-1 font-mono">{failedSymbols.join('、')}</span>
            </div>
          )}

          {/* Top Summary Cards */}
          <SummaryCards
            primary={primary}
            groups={groups}
            netFlow={netFlow}
            realizedTotal={realizedTotal}
          />

          {/* Diversification & Health Banner */}
          {diversification && (
            <div className="card px-5 py-4 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-brand-soft/40 to-transparent dark:from-brand/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-xs">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink dark:text-zinc-100">
                    投資組合集中度指標
                  </h4>
                  <p className="text-xs text-ink-mute dark:text-zinc-400">
                    前三大持股佔比：
                    <strong className="font-mono text-ink dark:text-zinc-200">
                      {' '}{diversification.top3Ratio.toFixed(1)}%
                    </strong>
                    {diversification.top3Ratio > 70 ? '（集中度偏高，建議適度分散）' : '（配置相對均衡）'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-up">
                  <span className="h-2 w-2 rounded-full bg-up" />
                  獲利標的：{diversification.gainers} 檔
                </span>
                <span className="flex items-center gap-1.5 text-down">
                  <span className="h-2 w-2 rounded-full bg-down" />
                  虧損標的：{diversification.losers} 檔
                </span>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AllocationCard primary={primary} />
            <TopHoldingsCard primary={primary} />
          </div>

          {groups.length > 1 && <MultiCurrencyCard groups={groups} />}

          <DetailTable data={enriched} />
        </>
      )}

      {/* Quick Trade Modal */}
      <QuickTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
      />

      {/* Monthly Report Export Modal */}
      <MonthlyReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        holdings={enriched}
        transactions={transactions}
        totalMarketValue={primary?.marketValue ?? 0}
        totalCost={primary?.cost ?? 0}
        totalGainLoss={primary?.gainLoss ?? 0}
        dayChange={primary?.dayChange ?? 0}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card card-body py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand dark:bg-brand/20">
        <PieChart className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-ink dark:text-zinc-100">
        目前沒有任何持股部位
      </h3>
      <p className="mt-1.5 text-sm text-ink-mute dark:text-zinc-400 max-w-md mx-auto">
        前往交易紀錄新增一筆買入交易，資產配置圓餅圖與損益分佈便會立即在此呈現。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onAdd}
          className="btn btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
        >
          <PlusCircle className="h-4 w-4" />
          <span>新增第一筆交易</span>
        </button>
        <button
          type="button"
          onClick={() => useStockStore.getState().loadDemoData()}
          className="btn text-sm py-2 px-4 flex items-center gap-1.5 border border-brand/40 text-brand bg-brand/5 hover:bg-brand/10 dark:bg-brand/10"
        >
          <Sparkles className="h-4 w-4" />
          <span>體驗示範帳本 (Demo)</span>
        </button>
        <Link to="/transactions" className="btn text-sm py-2 px-4">
          前往交易紀錄
        </Link>
      </div>
    </div>
  );
}

function SummaryCards({
  primary,
  groups,
  netFlow,
  realizedTotal,
}: {
  primary?: GroupEntry;
  groups: GroupEntry[];
  netFlow: number;
  realizedTotal: number;
}) {
  if (!primary) return null;
  const { currency, marketValue, gainLoss, dayChange, cost } = primary;
  const gainPct = cost ? (gainLoss / cost) * 100 : 0;
  const prevValue = marketValue - dayChange;
  const dayPct = prevValue ? (dayChange / prevValue) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="card p-5 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <p className="label-caps truncate">總部位市值</p>
          {groups.length > 1 && (
            <span className="text-[11px] text-ink-faint dark:text-zinc-400 shrink-0">
              主要幣別 · 共 {groups.length} 種
            </span>
          )}
        </div>
        <p
          className="mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight text-ink dark:text-zinc-100 num"
          title={formatCurrency(marketValue, currency)}
        >
          {formatCurrency(marketValue, currency)}
        </p>
        <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400 truncate">
          總成本 {formatCurrency(cost, currency)} · 淨現金流{' '}
          <span className={cn('font-mono font-semibold num', netFlow >= 0 ? 'text-up' : 'text-down')}>
            {netFlow >= 0 ? '+' : ''}
            {formatNumber(netFlow)}
          </span>
        </p>
      </div>

      <div className="card p-5 min-w-0">
        <p className="label-caps truncate">今日波動</p>
        <p
          className={cn(
            'mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight num',
            changeColor(dayChange),
          )}
          title={`${dayChange >= 0 ? '+' : ''}${formatNumber(dayChange)}`}
        >
          {dayChange >= 0 ? '+' : ''}
          {formatNumber(dayChange)}
        </p>
        <p className={cn('mt-1 font-mono text-xs font-semibold num truncate', changeColor(dayChange))}>
          {formatPercent(dayPct)} 今日變化
        </p>
      </div>

      <div className="card p-5 min-w-0">
        <p className="label-caps truncate">未實現總損益</p>
        <p
          className={cn(
            'mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight num',
            changeColor(gainLoss),
          )}
          title={`${gainLoss >= 0 ? '+' : ''}${formatNumber(gainLoss)}`}
        >
          {gainLoss >= 0 ? '+' : ''}
          {formatNumber(gainLoss)}
        </p>
        <p className={cn('mt-1 font-mono text-xs font-semibold num truncate', changeColor(gainLoss))}>
          報酬率 {formatPercent(gainPct)}
        </p>
      </div>

      <div className="card p-5 min-w-0">
        <p className="label-caps truncate">累計已實現損益</p>
        <p
          className={cn(
            'mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight num',
            changeColor(realizedTotal),
          )}
          title={`${realizedTotal >= 0 ? '+' : ''}${formatNumber(realizedTotal)}`}
        >
          {realizedTotal >= 0 ? '+' : ''}
          {formatNumber(realizedTotal)}
        </p>
        <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400 truncate">
          賣出交易已落袋結算
        </p>
      </div>
    </div>
  );
}

function AllocationCard({ primary }: { primary?: GroupEntry }) {
  if (!primary) return null;
  const slices: PieSlice[] = primary.items.map((h) => ({
    key: h.symbol,
    label: `${h.symbol} ${h.name}`,
    value: h.marketValue,
  }));
  return (
    <section className="card min-w-0">
      <div className="card-header">
        <div>
          <h2 className="section-title">資產配置比例</h2>
          <p className="section-hint">依部位市值權重分佈 · {primary.currency}</p>
        </div>
      </div>
      <div className="card-body">
        <AllocationPie data={slices} currency={primary.currency} />
      </div>
    </section>
  );
}

function TopHoldingsCard({ primary }: { primary?: GroupEntry }) {
  if (!primary) return null;
  const sorted = [...primary.items].sort((a, b) => b.marketValue - a.marketValue).slice(0, 6);
  const max = sorted[0]?.marketValue ?? 1;
  return (
    <section className="card min-w-0">
      <div className="card-header">
        <div>
          <h2 className="section-title">主要持股部位排行</h2>
          <p className="section-hint">市值最高前 {sorted.length} 檔標的</p>
        </div>
      </div>
      <div className="card-body">
        <ul className="space-y-3.5">
          {sorted.map((h) => {
            const pct = (h.marketValue / primary.marketValue) * 100;
            const barPct = (h.marketValue / max) * 100;
            return (
              <li key={h.symbol}>
                <Link to={`/stock/${h.symbol}`} className="block group">
                  <div className="flex items-baseline justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink group-hover:text-brand dark:text-zinc-100 transition truncate">
                        {h.symbol}
                      </p>
                      <p className="truncate text-xs text-ink-mute dark:text-zinc-400" title={h.name}>{h.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-bold text-ink dark:text-zinc-100 num">
                        {formatNumber(h.marketValue)}
                      </p>
                      <p
                        className={cn(
                          'font-mono text-xs font-semibold num',
                          changeColor(h.gainLoss),
                        )}
                      >
                        {h.gainLoss >= 0 ? '+' : ''}
                        {formatNumber(h.gainLoss)}
                        <span className="ml-1">({formatPercent(h.gainLossPercent)})</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all duration-300"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-ink-mute dark:text-zinc-400 num">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function MultiCurrencyCard({ groups }: { groups: GroupEntry[] }) {
  return (
    <div className="card card-body min-w-0">
      <p className="label-caps mb-3">各幣別資產小計</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div
            key={g.currency}
            className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 min-w-0"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-base font-bold text-ink dark:text-zinc-100">{g.currency}</span>
              <span className="text-xs text-ink-mute dark:text-zinc-400 shrink-0">{g.items.length} 檔持股</span>
            </div>
            <p
              className="mt-2 font-mono text-xl font-bold truncate tracking-tight text-ink dark:text-zinc-100 num"
              title={formatCurrency(g.marketValue, g.currency)}
            >
              {formatCurrency(g.marketValue, g.currency)}
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-xs font-semibold num truncate',
                changeColor(g.gainLoss),
              )}
            >
              損益 {g.gainLoss >= 0 ? '+' : ''}
              {formatNumber(g.gainLoss)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailTable({ data }: { data: PortfolioHolding[] }) {
  const sorted = [...data].sort((a, b) => b.marketValue - a.marketValue);
  return (
    <section className="card overflow-hidden">
      <div className="card-header">
        <div>
          <h2 className="section-title">持股盈虧明細</h2>
          <p className="section-hint">依部位市值排序 · 點選代號可進入個股詳細研究</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-black/5 dark:divide-white/10 text-sm">
          <thead>
            <tr className="bg-black/[0.02] dark:bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-ink-mute dark:text-zinc-400 font-bold whitespace-nowrap">
              <th className="px-5 py-3 text-left">代號 / 名稱</th>
              <th className="px-5 py-3 text-right">持有股數</th>
              <th className="px-5 py-3 text-right">平均成本</th>
              <th className="px-5 py-3 text-right">目前現價</th>
              <th className="px-5 py-3 text-right">今日動態</th>
              <th className="px-5 py-3 text-right">部位市值</th>
              <th className="px-5 py-3 text-right">未實現損益</th>
              <th className="px-5 py-3 text-right">報酬率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {sorted.map((h) => (
              <tr key={h.symbol} className="text-ink-soft dark:text-zinc-300 transition hover:bg-black/[0.02] dark:hover:bg-white/5">
                <td className="whitespace-nowrap px-5 py-3.5">
                  <Link to={`/stock/${h.symbol}`} className="block group">
                    <p className="font-bold text-ink dark:text-zinc-100 group-hover:text-brand transition flex items-center gap-1">
                      {h.symbol}
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                    </p>
                    <p className="text-xs text-ink-mute dark:text-zinc-400 truncate max-w-[140px]">{h.name}</p>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono font-medium num text-ink dark:text-zinc-100">
                  {formatNumber(h.shares, 4)}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono num">
                  {formatNumber(h.avgCost)}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono font-semibold num text-ink dark:text-zinc-100">
                  {formatNumber(h.price)}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-5 py-3.5 text-right font-mono font-semibold num',
                    changeColor(h.change),
                  )}
                >
                  {h.change >= 0 ? '+' : ''}
                  {formatNumber(h.change)}{' '}
                  <span className="text-xs opacity-80">
                    ({formatPercent(h.changePercent)})
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono font-bold num text-ink dark:text-zinc-100">
                  {formatNumber(h.marketValue)} {h.currency}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-5 py-3.5 text-right font-mono font-bold num',
                    changeColor(h.gainLoss),
                  )}
                >
                  {h.gainLoss >= 0 ? '+' : ''}
                  {formatNumber(h.gainLoss)}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-5 py-3.5 text-right font-mono font-bold num',
                    changeColor(h.gainLoss),
                  )}
                >
                  {formatPercent(h.gainLossPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface GroupEntry {
  currency: string;
  items: PortfolioHolding[];
  marketValue: number;
  cost: number;
  gainLoss: number;
  dayChange: number;
}

function groupByCurrency(list: PortfolioHolding[]): GroupEntry[] {
  const map = new Map<string, GroupEntry>();
  for (const h of list) {
    const g =
      map.get(h.currency) ??
      ({
        currency: h.currency,
        items: [],
        marketValue: 0,
        cost: 0,
        gainLoss: 0,
        dayChange: 0,
      } as GroupEntry);
    g.items.push(h);
    g.marketValue += h.marketValue;
    g.cost += h.shares * h.avgCost;
    g.gainLoss += h.gainLoss;
    g.dayChange += h.change * h.shares;
    map.set(h.currency, g);
  }
  return Array.from(map.values()).sort((a, b) => b.marketValue - a.marketValue);
}
