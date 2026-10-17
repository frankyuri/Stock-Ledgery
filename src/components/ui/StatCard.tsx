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
    <div className="card p-4 sm:p-5 overflow-hidden">
      <p className="label-caps truncate">{label}</p>
      <p
        className="mt-2 font-mono text-xl sm:text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-zinc-100 num truncate"
        title={value}
      >
        {value}
      </p>
      {showChange && (
        <p className={cn('mt-2 text-xs font-semibold num flex items-center gap-1 truncate', changeColor(change!))}>
          <span>
            {change! > 0 ? '+' : ''}
            {change!.toFixed(2)}
          </span>
          <span className="opacity-75">({formatPercent(changePercent!)})</span>
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 truncate">{hint}</p>}
    </div>
  );
}
