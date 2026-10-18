import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  MinusCircle,
  ExternalLink,
  Search,
  Download,
  Trash2,
} from 'lucide-react';
import type { PortfolioHolding, TransactionType } from '@/types/stock';
import {
  changeColor,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShares,
} from '@/lib/format';
import { cn } from '@/lib/cn';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { useToast } from '@/lib/toast';

interface Props {
  data: PortfolioHolding[];
  onRemove?: (symbol: string) => void;
  stale?: boolean;
}

export function PortfolioTable({ data, onRemove, stale }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'marketValue', desc: true },
  ]);
  const [filter, setFilter] = useState('');
  const [tradeTarget, setTradeTarget] = useState<{ symbol: string; type: TransactionType } | null>(null);

  const navigate = useNavigate();
  const toast = useToast();

  const totalMarketValue = useMemo(() => {
    return data.reduce((acc, h) => acc + h.marketValue, 0);
  }, [data]);

  function exportCSV() {
    if (data.length === 0) return;
    const headers = ['代號', '標的名稱', '持有股數', '平均成本', '目前現價', '今日漲跌幅', '市值', '未實現損益', '報酬率', '幣別'];
    const rows = data.map((h) => [
      h.symbol,
      `"${h.name.replace(/"/g, '""')}"`,
      h.shares,
      h.avgCost,
      h.price,
      `${h.changePercent}%`,
      h.marketValue,
      h.gainLoss,
      `${h.gainLossPercent}%`,
      h.currency,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('已匯出持股明細 CSV');
  }

  const columns = useMemo<ColumnDef<PortfolioHolding>[]>(() => {
    const base: ColumnDef<PortfolioHolding>[] = [
      {
        accessorKey: 'symbol',
        header: '代號 / 標的',
        cell: (ctx) => (
          <div className="flex flex-col">
            <span className="font-bold text-ink dark:text-zinc-100">{ctx.row.original.symbol}</span>
            <span className="text-xs text-ink-mute dark:text-zinc-400 truncate max-w-[200px]">
              {ctx.row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'shares',
        header: '持有股數',
        cell: (ctx) => (
          <span className="font-mono font-medium num text-ink dark:text-zinc-100">
            {formatShares(ctx.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'avgCost',
        header: '平均成本',
        cell: (ctx) => (
          <span className="font-mono num text-ink-soft dark:text-zinc-300">
            {formatNumber(ctx.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'price',
        header: '最新現價',
        cell: (ctx) => (
          <span className="font-mono font-semibold num text-ink dark:text-zinc-100">
            {formatNumber(ctx.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'changePercent',
        header: '今日漲跌',
        cell: (ctx) => {
          const v = ctx.getValue<number>();
          return (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-mono text-xs font-semibold num',
                changeColor(v),
              )}
            >
              {v > 0 ? <TrendingUp className="h-3 w-3" /> : v < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              {formatPercent(v)}
            </span>
          );
        },
      },
      {
        accessorKey: 'marketValue',
        header: '部位市值',
        cell: (ctx) => (
          <span className="font-mono font-bold num text-ink dark:text-zinc-100">
            {formatCurrency(ctx.getValue<number>(), ctx.row.original.currency)}
          </span>
        ),
      },
      {
        id: 'weight',
        header: '部位佔比',
        cell: (ctx) => {
          const val = ctx.row.original.marketValue;
          const weight = totalMarketValue > 0 ? (val / totalMarketValue) * 100 : 0;
          return (
            <div className="flex flex-col gap-1 w-24">
              <span className="font-mono text-xs font-semibold text-ink dark:text-zinc-200">
                {weight.toFixed(1)}%
              </span>
              <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, weight))}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'gainLoss',
        header: '未實現損益',
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <div
              className={cn('flex flex-col font-medium num', changeColor(row.gainLoss))}
            >
              <span className="font-mono font-bold">
                {row.gainLoss > 0 ? '+' : ''}
                {formatCurrency(row.gainLoss, row.currency)}
              </span>
              <span className="text-xs font-semibold">
                {formatPercent(row.gainLossPercent)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '操作',
        cell: (ctx) => {
          const sym = ctx.row.original.symbol;
          return (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setTradeTarget({ symbol: sym, type: 'BUY' })}
                className="rounded-lg p-1.5 text-ink-mute dark:text-zinc-400 transition hover:bg-black/5 hover:text-up dark:hover:bg-white/10"
                title="加碼買進"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setTradeTarget({ symbol: sym, type: 'SELL' })}
                className="rounded-lg p-1.5 text-ink-mute dark:text-zinc-400 transition hover:bg-black/5 hover:text-down dark:hover:bg-white/10"
                title="賣出獲利 / 停損"
              >
                <MinusCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate(`/stock/${encodeURIComponent(sym)}`)}
                className="rounded-lg p-1.5 text-ink-mute dark:text-zinc-400 transition hover:bg-black/5 hover:text-brand dark:hover:bg-white/10"
                title="個股詳細研究"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(sym)}
                  className="rounded-lg p-1.5 text-ink-mute dark:text-zinc-400 transition hover:bg-black/5 hover:text-down dark:hover:bg-white/10"
                  title="從持股中移除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        },
      },
    ];
    return base;
  }, [totalMarketValue, onRemove, navigate]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <div className="card overflow-hidden">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h3 className="section-title">持股資產分佈表</h3>
            <p className="section-hint">
              共 {data.length} 檔持股部位 · 點選任一列即可深入個股 K 線分析
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {stale && (
              <span
                className="chip border-amber-400/40 bg-amber-50/80 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 text-xs"
                title="部分報價來源失敗，正在使用快取"
              >
                ⚠ 報價可能延遲
              </span>
            )}

            {/* Filter Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint dark:text-zinc-500" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="搜尋代號或名稱…"
                className="input py-1.5 pl-8 pr-3 text-xs w-40 sm:w-52"
              />
            </div>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={exportCSV}
              className="btn text-xs py-1.5 px-3 flex items-center gap-1.5"
              title="匯出持股為 CSV 檔案"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">匯出 CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-black/5 dark:divide-white/10 text-sm">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="bg-black/[0.02] dark:bg-white/[0.02]">
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const sortable = header.column.getCanSort() && header.id !== 'actions';
                    return (
                      <th
                        key={header.id}
                        onClick={
                          sortable ? header.column.getToggleSortingHandler() : undefined
                        }
                        className={cn(
                          'select-none px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.12em] text-ink-mute dark:text-zinc-400 transition',
                          sortable && 'cursor-pointer hover:text-ink dark:hover:text-zinc-200',
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortable && (
                            sorted === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-brand" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="h-3 w-3 text-brand" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() =>
                    navigate(`/stock/${encodeURIComponent(row.original.symbol)}`)
                  }
                  className="cursor-pointer transition hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap px-5 py-3.5 text-ink-soft dark:text-zinc-300"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-12 text-center text-sm text-ink-mute dark:text-zinc-500"
                  >
                    沒有符合篩選條件的持股
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Trade Modal */}
      {tradeTarget && (
        <QuickTradeModal
          isOpen={!!tradeTarget}
          onClose={() => setTradeTarget(null)}
          initialSymbol={tradeTarget.symbol}
          initialType={tradeTarget.type}
        />
      )}
    </>
  );
}
