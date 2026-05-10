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
import type { Quote } from '@/types/stock';
import { changeColor, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Props {
  data: Quote[];
  onRemove?: (symbol: string) => void;
  /** 部分報價失敗時顯示警示 */
  stale?: boolean;
}

export function WatchlistTable({ data, onRemove, stale }: Props) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'changePercent', desc: true },
  ]);
  const columns = useMemo<ColumnDef<Quote>[]>(
    () => [
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
        accessorKey: 'price',
        header: '現價',
        cell: (ctx) => (
          <span className="font-mono num">{formatNumber(ctx.getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'change',
        header: '漲跌',
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
        header: '漲跌幅',
        cell: (ctx) => {
          const v = ctx.getValue<number>();
          return (
            <span className={cn('font-mono font-medium num', changeColor(v))}>
              {formatPercent(v)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: (ctx) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(ctx.row.original.symbol);
            }}
            className="rounded-md px-2 py-1 text-xs text-ink-mute transition hover:bg-black/5 hover:text-down"
          >
            移除
          </button>
        ),
      },
    ],
    [onRemove],
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
    <div className="overflow-x-auto">
      {stale && (
        <div className="border-b border-amber-300/40 bg-amber-50/60 px-5 py-2 text-xs text-amber-700">
          ⚠ 部分自選股報價載入失敗，列表可能不完整
        </div>
      )}
      <table className="min-w-full divide-y divide-black/5 text-[15px]">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="bg-black/[0.02]">
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
                      'select-none px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-mute transition',
                      sortable && 'cursor-pointer hover:text-ink',
                    )}
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
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-sm text-ink-mute"
              >
                尚未加入任何股票
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
