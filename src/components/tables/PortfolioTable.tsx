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
import type { PortfolioHolding } from '@/types/stock';
import {
  changeColor,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShares,
} from '@/lib/format';
import { cn } from '@/lib/cn';

interface Props {
  data: PortfolioHolding[];
  onRemove?: (symbol: string) => void;
}

export function PortfolioTable({ data, onRemove }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'marketValue', desc: true },
  ]);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<PortfolioHolding>[]>(() => {
    const base: ColumnDef<PortfolioHolding>[] = [
      {
        accessorKey: 'symbol',
        header: '代號',
        cell: (ctx) => (
          <div className="flex flex-col">
            <span className="font-semibold text-ink">{ctx.row.original.symbol}</span>
            <span className="text-xs text-ink-mute">{ctx.row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'shares',
        header: '持有股數',
        cell: (ctx) => (
          <span className="font-mono num">{formatShares(ctx.getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'avgCost',
        header: '平均成本',
        cell: (ctx) => (
          <span className="font-mono num">{formatNumber(ctx.getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'price',
        header: '現價',
        cell: (ctx) => (
          <span className="font-mono num">{formatNumber(ctx.getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'changePercent',
        header: '今日',
        cell: (ctx) => {
          const v = ctx.getValue<number>();
          return (
            <span className={cn('font-medium num', changeColor(v))}>
              {formatPercent(v)}
            </span>
          );
        },
      },
      {
        accessorKey: 'marketValue',
        header: '市值',
        cell: (ctx) => (
          <span className="font-mono num">
            {formatCurrency(ctx.getValue<number>(), ctx.row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'gainLoss',
        header: '損益',
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <div
              className={cn('flex flex-col font-medium num', changeColor(row.gainLoss))}
            >
              <span className="font-mono">
                {formatCurrency(row.gainLoss, row.currency)}
              </span>
              <span className="text-xs">{formatPercent(row.gainLossPercent)}</span>
            </div>
          );
        },
      },
    ];
    if (onRemove) {
      base.push({
        id: 'actions',
        header: '',
        cell: (ctx) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(ctx.row.original.symbol);
            }}
            className="rounded-md px-2 py-1 text-xs text-ink-mute transition hover:bg-black/5 hover:text-down"
          >
            移除
          </button>
        ),
      });
    }
    return base;
  }, [onRemove]);

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
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <h3 className="section-title">個人持股</h3>
          <p className="section-hint">點擊列可進入個股研究頁</p>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="搜尋..."
          className="input w-48 py-2"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-black/5 text-[15px]">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="bg-black/[0.02]">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-mute transition hover:text-ink"
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' && '▲'}
                        {sorted === 'desc' && '▼'}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-black/5">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() =>
                  navigate(`/stock/${encodeURIComponent(row.original.symbol)}`)
                }
                className="cursor-pointer transition hover:bg-black/[0.03]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="whitespace-nowrap px-5 py-4 text-ink-soft"
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
                  className="px-5 py-12 text-center text-sm text-ink-mute"
                >
                  沒有符合條件的持股
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
