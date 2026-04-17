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
    <div className="card p-6">
      <p className="label-caps">{label}</p>
      <p className="mt-3 font-mono text-[30px] font-semibold leading-none tracking-tight text-ink num">
        {value}
      </p>
      {showChange && (
        <p className={cn('mt-3 text-[15px] font-medium num', changeColor(change!))}>
          {change! > 0 ? '+' : ''}
          {change!.toFixed(2)}{' '}
          <span className="text-sm opacity-80">({formatPercent(changePercent!)})</span>
        </p>
      )}
      {hint && <p className="mt-2 text-sm text-ink-mute">{hint}</p>}
    </div>
  );
}
