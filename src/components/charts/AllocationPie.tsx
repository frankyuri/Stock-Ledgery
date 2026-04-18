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
  '#0A84FF',
  '#30D158',
  '#FF9F0A',
  '#BF5AF2',
  '#64D2FF',
  '#FF375F',
  '#5E5CE6',
  '#FFD60A',
  '#34C759',
  '#FF9500',
];

export function AllocationPie({
  data,
  size = 220,
  thickness = 34,
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
      <div className="flex h-48 items-center justify-center text-sm text-ink-mute">
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
    <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:gap-7">
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
                opacity={hover && hover !== p.key ? 0.4 : 1}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(null)}
                className="transition-opacity"
                style={{ cursor: 'pointer' }}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            {hovered ? hovered.label : '總計'}
          </p>
          <p className="mt-1 font-mono text-[22px] font-semibold text-ink num">
            {formatNumber(hovered ? hovered.value : total)}
          </p>
          <p className="mt-0.5 text-xs text-ink-mute">
            {hovered
              ? `${(hovered.frac * 100).toFixed(1)}%`
              : currency ?? ''}
          </p>
        </div>
      </div>

      <ul className="w-full flex-1 space-y-1.5 text-sm">
        {paths.map((p) => (
          <li
            key={p.key}
            onMouseEnter={() => setHover(p.key)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-1.5 transition',
              hover === p.key && 'bg-black/[0.04]',
            )}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{p.label}</span>
            <span className="font-mono num text-ink">{formatNumber(p.value)}</span>
            <span className="w-14 text-right text-xs text-ink-mute num">
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
