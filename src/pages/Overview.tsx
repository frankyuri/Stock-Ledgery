import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AllocationPie, type PieSlice } from '@/components/charts/AllocationPie';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchPortfolio } from '@/services/stocks';
import { useStockStore } from '@/store/useStockStore';
import {
  changeColor,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import { cn } from '@/lib/cn';
import type { PortfolioHolding } from '@/types/stock';

export function Overview() {
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);

  const { data, isLoading } = useQuery({
    queryKey: ['portfolio', holdings],
    queryFn: () => fetchPortfolio(holdings),
    enabled: holdings.length > 0,
    refetchInterval: 60_000,
  });

  const groups = useMemo(() => groupByCurrency(data ?? []), [data]);
  const primary = groups[0];

  const netFlow = useMemo(() => {
    let v = 0;
    for (const t of transactions) {
      const amt = t.shares * t.price;
      v += t.type === 'BUY' ? -(amt + t.fee) : amt - t.fee;
    }
    return v;
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">資產總覽</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">
          一眼看懂總資產、今日變動、配置與每支持股的損益。
        </p>
      </div>

      {holdings.length === 0 ? (
        <EmptyState />
      ) : isLoading || !data ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <>
          <SummaryCards primary={primary} groups={groups} netFlow={netFlow} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AllocationCard primary={primary} />
            <TopHoldingsCard primary={primary} />
          </div>

          {groups.length > 1 && <MultiCurrencyCard groups={groups} />}

          <DetailTable data={data} />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card card-body py-16 text-center">
      <p className="text-[15px] text-ink-mute">
        目前沒有任何持股。前往交易紀錄新增一筆買入，就會在這裡看到即時總覽。
      </p>
      <div className="mt-5">
        <Link to="/transactions" className="btn btn-primary">
          新增第一筆交易
        </Link>
      </div>
    </div>
  );
}

function SummaryCards({
  primary,
  groups,
  netFlow,
}: {
  primary?: GroupEntry;
  groups: GroupEntry[];
  netFlow: number;
}) {
  if (!primary) return null;
  const { currency, marketValue, gainLoss, dayChange, cost } = primary;
  const gainPct = cost ? (gainLoss / cost) * 100 : 0;
  const dayPct = marketValue ? (dayChange / marketValue) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="card p-6">
        <div className="flex items-baseline justify-between">
          <p className="label-caps">總市值</p>
          {groups.length > 1 && (
            <span className="text-xs text-ink-faint">
              主要幣別 · 共 {groups.length} 種
            </span>
          )}
        </div>
        <p className="mt-3 font-mono text-[30px] font-semibold text-ink num">
          {formatCurrency(marketValue, currency)}
        </p>
        <p className="mt-1.5 text-xs text-ink-mute">
          成本 {formatCurrency(cost, currency)} · 淨現金流{' '}
          <span className={cn('font-mono num', netFlow >= 0 ? 'text-up' : 'text-down')}>
            {netFlow >= 0 ? '+' : ''}
            {formatNumber(netFlow)}
          </span>
        </p>
      </div>

      <div className="card p-6">
        <p className="label-caps">今日變動</p>
        <p
          className={cn(
            'mt-3 font-mono text-[30px] font-semibold num',
            changeColor(dayChange),
          )}
        >
          {dayChange >= 0 ? '+' : ''}
          {formatNumber(dayChange)}
        </p>
        <p className={cn('mt-1.5 font-mono text-xs num', changeColor(dayChange))}>
          {formatPercent(dayPct)}
        </p>
      </div>

      <div className="card p-6">
        <p className="label-caps">未實現損益</p>
        <p
          className={cn(
            'mt-3 font-mono text-[30px] font-semibold num',
            changeColor(gainLoss),
          )}
        >
          {gainLoss >= 0 ? '+' : ''}
          {formatNumber(gainLoss)}
        </p>
        <p className={cn('mt-1.5 font-mono text-xs num', changeColor(gainLoss))}>
          {formatPercent(gainPct)}
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
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="section-title">資產配置</h2>
          <p className="section-hint">依市值佔比 · {primary.currency}</p>
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
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="section-title">Top 持股</h2>
          <p className="section-hint">依市值排序 · 前 {sorted.length} 檔</p>
        </div>
      </div>
      <div className="card-body">
        <ul className="space-y-3">
          {sorted.map((h) => {
            const pct = (h.marketValue / primary.marketValue) * 100;
            const barPct = (h.marketValue / max) * 100;
            return (
              <li key={h.symbol}>
                <Link to={`/stock/${h.symbol}`} className="block">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ink">{h.symbol}</p>
                      <p className="truncate text-xs text-ink-mute">{h.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[15px] text-ink num">
                        {formatNumber(h.marketValue)}
                      </p>
                      <p
                        className={cn(
                          'font-mono text-xs num',
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
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-mute num">
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
    <div className="card card-body">
      <p className="label-caps">分幣別小計</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div
            key={g.currency}
            className="rounded-xl border border-black/5 bg-white/60 p-4 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-ink">{g.currency}</span>
              <span className="text-xs text-ink-mute">{g.items.length} 檔</span>
            </div>
            <p className="mt-1.5 font-mono text-xl text-ink num">
              {formatCurrency(g.marketValue, g.currency)}
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-sm num',
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
          <h2 className="section-title">持股損益明細</h2>
          <p className="section-hint">依市值排序；點代號可進個股頁面</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-black/5 text-sm">
          <thead>
            <tr className="bg-black/[0.02] text-xs uppercase tracking-[0.12em] text-ink-mute">
              <th className="px-5 py-3 text-left font-semibold">代號</th>
              <th className="px-5 py-3 text-right font-semibold">股數</th>
              <th className="px-5 py-3 text-right font-semibold">成本</th>
              <th className="px-5 py-3 text-right font-semibold">現價</th>
              <th className="px-5 py-3 text-right font-semibold">今日</th>
              <th className="px-5 py-3 text-right font-semibold">市值</th>
              <th className="px-5 py-3 text-right font-semibold">未實現損益</th>
              <th className="px-5 py-3 text-right font-semibold">報酬率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {sorted.map((h) => (
              <tr key={h.symbol} className="text-ink-soft transition hover:bg-black/[0.02]">
                <td className="whitespace-nowrap px-5 py-3">
                  <Link to={`/stock/${h.symbol}`} className="block">
                    <p className="font-semibold text-ink">{h.symbol}</p>
                    <p className="text-xs text-ink-mute">{h.name}</p>
                  </Link>
                </td>
                <td className="px-5 py-3 text-right font-mono num">
                  {formatNumber(h.shares, 4)}
                </td>
                <td className="px-5 py-3 text-right font-mono num">
                  {formatNumber(h.avgCost)}
                </td>
                <td className="px-5 py-3 text-right font-mono num">
                  {formatNumber(h.price)}
                </td>
                <td
                  className={cn(
                    'px-5 py-3 text-right font-mono num',
                    changeColor(h.change),
                  )}
                >
                  {h.change >= 0 ? '+' : ''}
                  {formatNumber(h.change)}{' '}
                  <span className="text-xs opacity-80">
                    ({formatPercent(h.changePercent)})
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono num">
                  {formatNumber(h.marketValue)} {h.currency}
                </td>
                <td
                  className={cn(
                    'px-5 py-3 text-right font-mono font-semibold num',
                    changeColor(h.gainLoss),
                  )}
                >
                  {h.gainLoss >= 0 ? '+' : ''}
                  {formatNumber(h.gainLoss)}
                </td>
                <td
                  className={cn(
                    'px-5 py-3 text-right font-mono num',
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
