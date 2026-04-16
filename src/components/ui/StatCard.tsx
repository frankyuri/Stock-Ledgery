import { changeColor, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  changePercent?: number;
  hint?: string;
}

export function StatCard({ label, value, change, changePercent, hint }: StatCardProps) {
  const showChange = typeof change === 'number' && typeof changePercent === 'number';
  return (
    <div className="card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
        {label}
      </p>
      <p className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-tight text-ink num">
        {value}
      </p>
      {showChange && (
        <p className={cn('mt-2 text-sm font-medium num', changeColor(change!))}>
          {change! > 0 ? '+' : ''}
          {change!.toFixed(2)}{' '}
          <span className="text-xs opacity-80">({formatPercent(changePercent!)})</span>
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}
