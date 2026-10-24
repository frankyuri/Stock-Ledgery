import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';
import type { PositionDriftInfo } from '@/lib/rebalanceAnalytics';

interface Props {
  drifts: PositionDriftInfo[];
  driftThreshold?: number;
}

export function AllocationComparisonChart({
  drifts,
  driftThreshold = 2.0,
}: Props) {
  // 找出最大權重，作為長條圖寬度比例上限（至少 50%）
  const maxWeight = useMemo(() => {
    let max = 40;
    for (const d of drifts) {
      if (d.actualWeight > max) max = d.actualWeight;
      if (d.targetWeight > max) max = d.targetWeight;
    }
    return Math.min(Math.ceil(max / 10) * 10 + 5, 100);
  }, [drifts]);

  return (
    <div className="space-y-4">
      {/* 圖例說明 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium border-b border-slate-100 dark:border-zinc-800 pb-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-brand" />
            <span className="text-slate-800 dark:text-zinc-200">
              實際配置權重 (Actual)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border border-dashed border-amber-500 bg-amber-500/20" />
            <span className="text-slate-600 dark:text-zinc-400">
              目標配置權重 (Target)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
          <span>容忍偏離門檻：±{driftThreshold}%</span>
        </div>
      </div>

      {/* 各標的對比長條清單 */}
      <div className="space-y-3">
        {drifts.map((d) => {
          const isOver = d.status === 'OVERWEIGHT';
          const isUnder = d.status === 'UNDERWEIGHT';
          const isBalanced = d.status === 'BALANCED';

          const actualWidth = Math.min((d.actualWeight / maxWeight) * 100, 100);
          const targetWidth = Math.min((d.targetWeight / maxWeight) * 100, 100);

          return (
            <div
              key={d.symbol}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:border-slate-300 dark:border-zinc-800/80 dark:bg-zinc-800/30 dark:hover:border-zinc-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <strong className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                    {d.symbol}
                  </strong>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[160px] sm:max-w-[240px]">
                    {d.name}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-sm',
                      isOver &&
                        'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                      isUnder &&
                        'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
                      isBalanced &&
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                    )}
                  >
                    {isOver && '超配 (Overweight)'}
                    {isUnder && '低配 (Underweight)'}
                    {isBalanced && '平衡 (Balanced)'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 dark:text-zinc-400">
                    市值：
                    <strong className="text-slate-800 dark:text-zinc-200">
                      NT$ {formatNumber(d.marketValue)}
                    </strong>
                  </span>
                  <span
                    className={cn(
                      'font-bold',
                      d.drift > 0 && 'text-rose-600 dark:text-rose-400',
                      d.drift < 0 && 'text-blue-600 dark:text-blue-400',
                      d.drift === 0 && 'text-slate-500 dark:text-zinc-400',
                    )}
                  >
                    偏離：{d.drift > 0 ? `+${d.drift}%` : `${d.drift}%`}
                  </span>
                </div>
              </div>

              {/* 雙層水平對比長條圖 */}
              <div className="space-y-1.5">
                {/* 實際權重長條 */}
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-10 text-slate-500 shrink-0">實際</span>
                  <div className="h-3 flex-1 rounded-full bg-slate-200/70 overflow-hidden dark:bg-zinc-700/60 relative">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isOver
                          ? 'bg-rose-500'
                          : isUnder
                            ? 'bg-blue-500'
                            : 'bg-emerald-500',
                      )}
                      style={{ width: `${actualWidth}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-semibold text-slate-800 dark:text-zinc-200 shrink-0">
                    {formatPercent(d.actualWeight)}
                  </span>
                </div>

                {/* 目標權重長條 */}
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-10 text-slate-500 shrink-0">目標</span>
                  <div className="h-3 flex-1 rounded-full bg-slate-200/70 overflow-hidden dark:bg-zinc-700/60 relative">
                    <div
                      className="h-full rounded-full border border-dashed border-amber-500 bg-amber-500/30 transition-all duration-500"
                      style={{ width: `${targetWidth}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                    {formatPercent(d.targetWeight)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
