import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface PieSlice {
  key: string;
  label: string;
  value: number;
}

interface Props {
  data: PieSlice[];
  size?: number;
  thickness?: number;
  currency?: string;
  maxLegend?: number;
}

const PALETTE = [
  '#2563eb', // Royal Blue
  '#16a34a', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#0891b2', // Cyan
  '#e11d48', // Rose
  '#4f46e5', // Indigo
  '#059669', // Teal
  '#ea580c', // Orange
  '#475569', // Slate
];

export function AllocationPie({
  data,
  size = 200,
  thickness = 32,
  currency,
  maxLegend = 8,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const { slices, total } = useMemo(() => {
    const filtered = data.filter((d) => d.value > 0);
    const sorted = [...filtered].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, maxLegend - 1);
    const rest = sorted.slice(maxLegend - 1);
    const final =
      rest.length > 0
        ? [
            ...top,
            {
              key: '__other__',
              label: `其他 ${rest.length} 項`,
              value: rest.reduce((s, x) => s + x.value, 0),
            },
          ]
        : top;
    const t = final.reduce((s, x) => s + x.value, 0);
    return { slices: final, total: t };
  }, [data, maxLegend]);

  if (total <= 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-ink-mute dark:text-zinc-500">
        尚無資料可繪製配置
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR - thickness;

  let cursor = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const frac = s.value / total;
    const start = cursor;
    const end = cursor + frac * Math.PI * 2;
    cursor = end;
    return {
      ...s,
      color: PALETTE[i % PALETTE.length],
      d: arcPath(cx, cy, outerR, innerR, start, end),
      frac,
    };
  });

  const hovered = paths.find((p) => p.key === hover) ?? null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6 min-w-0">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {paths.length === 1 ? (
            <circle
              cx={cx}
              cy={cy}
              r={(outerR + innerR) / 2}
              fill="none"
              stroke={paths[0].color}
              strokeWidth={outerR - innerR}
              onMouseEnter={() => setHover(paths[0].key)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          ) : (
            paths.map((p) => (
              <path
                key={p.key}
                d={p.d}
                fill={p.color}
                opacity={hover && hover !== p.key ? 0.35 : 1}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(null)}
                className="transition-opacity"
                style={{ cursor: 'pointer' }}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
          <p
            className="max-w-[120px] truncate text-[11px] font-semibold uppercase tracking-wider text-ink-mute dark:text-zinc-400"
            title={hovered ? hovered.label : '總計'}
          >
            {hovered ? hovered.label : '總計'}
          </p>
          <p
            className="mt-0.5 max-w-[120px] truncate font-mono text-base sm:text-lg font-bold tracking-tight text-ink dark:text-zinc-100 num"
            title={formatNumber(hovered ? hovered.value : total)}
          >
            {formatNumber(hovered ? hovered.value : total)}
          </p>
          <p className="text-[11px] font-medium text-ink-mute dark:text-zinc-400">
            {hovered
              ? `${(hovered.frac * 100).toFixed(1)}%`
              : currency ?? ''}
          </p>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs sm:text-sm">
        {paths.map((p) => (
          <li
            key={p.key}
            onMouseEnter={() => setHover(p.key)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              'flex items-center gap-2 sm:gap-2.5 rounded-lg px-2 py-1.5 transition min-w-0',
              hover === p.key && 'bg-black/[0.04] dark:bg-white/[0.06]',
            )}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span
              className="min-w-0 flex-1 truncate font-medium text-ink-soft dark:text-zinc-300"
              title={p.label}
            >
              {p.label}
            </span>
            <span className="font-mono text-xs sm:text-sm font-semibold num text-ink dark:text-zinc-100 shrink-0">
              {formatNumber(p.value)}
            </span>
            <span className="w-12 sm:w-14 text-right font-mono text-xs text-ink-mute dark:text-zinc-400 num shrink-0">
              {(p.frac * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function arcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  start: number,
  end: number,
): string {
  const large = end - start > Math.PI ? 1 : 0;
  const x1 = cx + outerR * Math.cos(start);
  const y1 = cy + outerR * Math.sin(start);
  const x2 = cx + outerR * Math.cos(end);
  const y2 = cy + outerR * Math.sin(end);
  const x3 = cx + innerR * Math.cos(end);
  const y3 = cy + innerR * Math.sin(end);
  const x4 = cx + innerR * Math.cos(start);
  const y4 = cy + innerR * Math.sin(start);
  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}
