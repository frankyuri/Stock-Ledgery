import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
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
  LineChart,
  PlusCircle,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import type { Quote } from '@/types/stock';
import { changeColor, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';

interface Props {
  data: Quote[];
  onRemove?: (symbol: string) => void;
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string;
  stale?: boolean;
}

export function WatchlistTable({
  data,
  onRemove,
  onSelectSymbol,
  selectedSymbol,
  stale,
}: Props) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'changePercent', desc: true },
  ]);
  const [tradeTarget, setTradeTarget] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<Quote>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: '代號 / 標的名稱',
        cell: (ctx) => {
          const isSelected = selectedSymbol === ctx.row.original.symbol;
          return (
            <div className="flex items-center gap-2.5">
              {isSelected && (
                <span className="h-2 w-2 rounded-full bg-brand animate-pulse shrink-0" />
              )}
              <div className="flex flex-col">
                <span className={cn("font-bold text-ink dark:text-zinc-100", isSelected && "text-brand")}>
                  {ctx.row.original.symbol}
                </span>
                <span className="text-xs text-ink-mute dark:text-zinc-400 truncate max-w-[220px]">
                  {ctx.row.original.name}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'price',
        header: '即時價格',
        cell: (ctx) => (
          <div className="flex flex-col">
            <span className="font-mono font-semibold text-ink dark:text-zinc-100 num">
              {formatNumber(ctx.getValue<number>())}
            </span>
            <span className="text-[11px] text-ink-mute dark:text-zinc-500">
              {ctx.row.original.currency}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'change',
        header: '今日漲跌',
        cell: (ctx) => {
          const v = ctx.getValue<number>();
          return (
            <span className={cn('font-mono font-medium num', changeColor(v))}>
              {v > 0 ? '+' : ''}
              {formatNumber(v)}
            </span>
          );
        },
      },
      {
        accessorKey: 'changePercent',
        header: '今日幅度',
        cell: (ctx) => {
          const v = ctx.getValue<number>();
          const isUp = v > 0;
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-xs font-semibold num',
                isUp
                  ? 'bg-emerald-500/10 text-up dark:bg-emerald-500/20'
                  : v < 0
                  ? 'bg-rose-500/10 text-down dark:bg-rose-500/20'
                  : 'bg-black/5 text-ink-mute dark:bg-white/10 dark:text-zinc-400',
              )}
            >
              {isUp ? <TrendingUp className="h-3 w-3" /> : v < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              {formatPercent(v)}
            </span>
          );
        },
      },
      {
        id: 'range',
        header: '24H 價格區間',
        cell: (ctx) => {
          const { dayLow, dayHigh, price } = ctx.row.original;
          if (dayLow == null || dayHigh == null || dayHigh === dayLow) {
            return <span className="text-xs text-ink-mute">—</span>;
          }
          const pct = Math.max(0, Math.min(100, ((price - dayLow) / (dayHigh - dayLow)) * 100));
          return (
            <div className="flex flex-col gap-1 w-28 sm:w-36">
              <div className="flex justify-between text-[10px] text-ink-mute font-mono">
                <span>{formatNumber(dayLow)}</span>
                <span>{formatNumber(dayHigh)}</span>
              </div>
              <div className="relative h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-brand to-brand-dark rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
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
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {onSelectSymbol && (
                <button
                  type="button"
                  onClick={() => onSelectSymbol(sym)}
                  className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/5 hover:text-brand dark:hover:bg-white/10"
                  title="在上方圖表檢視"
                >
                  <LineChart className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setTradeTarget(sym)}
                className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/5 hover:text-up dark:hover:bg-white/10"
                title="快速買賣記帳"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate(`/stock/${encodeURIComponent(sym)}`)}
                className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/5 hover:text-ink dark:hover:bg-white/10"
                title="深入個股研究"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(sym)}
                  className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/5 hover:text-down dark:hover:bg-white/10"
                  title="自選股中移除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [onRemove, onSelectSymbol, selectedSymbol, navigate],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="overflow-x-auto">
        {stale && (
          <div className="border-b border-amber-300/40 bg-amber-50/60 px-5 py-2.5 text-xs text-amber-700 dark:border-amber-400/20 dark:bg-amber-950/20 dark:text-amber-300">
            ⚠ 部分自選股報價載入稍有延遲，正自動背景重試中
          </div>
        )}
        <table className="min-w-full divide-y divide-black/5 dark:divide-white/10 text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="bg-black/[0.02] dark:bg-white/[0.02]">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortable = header.column.getCanSort() && header.id !== 'actions' && header.id !== 'range';
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
            {table.getRowModel().rows.map((row) => {
              const isSelected = selectedSymbol === row.original.symbol;
              return (
                <tr
                  key={row.id}
                  onClick={() => {
                    if (onSelectSymbol) onSelectSymbol(row.original.symbol);
                    else navigate(`/stock/${encodeURIComponent(row.original.symbol)}`);
                  }}
                  className={cn(
                    'cursor-pointer transition hover:bg-black/[0.03] dark:hover:bg-white/5',
                    isSelected && 'bg-brand/[0.04] dark:bg-brand/10',
                  )}
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
              );
            })}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center text-sm text-ink-mute dark:text-zinc-500"
                >
                  目前自選清單為空。使用上方搜尋框或點選「+ 自選」快速加入。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Trade Modal */}
      {tradeTarget && (
        <QuickTradeModal
          isOpen={!!tradeTarget}
          onClose={() => setTradeTarget(null)}
          initialSymbol={tradeTarget}
        />
      )}
    </>
  );
}
