import React, { useState } from 'react';
import { cn } from '@/lib/cn';
import type { CorrelationMatrixResult, CorrelationPair } from '@/lib/correlationAnalytics';
import { AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

interface Props {
  data: CorrelationMatrixResult;
}

export const CorrelationHeatmap: React.FC<Props> = ({ data }) => {
  const { symbols, matrix, highRiskPairs, hedgingPairs, averageCorrelation } = data;
  const [hoveredPair, setHoveredPair] = useState<{
    symA: string;
    symB: string;
    val: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'high_risk' | 'hedging'>('matrix');

  if (symbols.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-400 dark:text-zinc-500">
        無足夠持股數據以計算相關性矩陣
      </div>
    );
  }

  // 取得格子顏色
  const getCellColor = (i: number, j: number, val: number) => {
    if (i === j) {
      return 'bg-slate-100 text-slate-400 dark:bg-zinc-800/80 dark:text-zinc-500 font-mono';
    }
    if (val >= 0.75) {
      return 'bg-rose-500 text-white font-bold hover:bg-rose-600';
    }
    if (val >= 0.45) {
      return 'bg-rose-400/80 text-white font-medium hover:bg-rose-500';
    }
    if (val >= 0.2) {
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 hover:bg-amber-200';
    }
    if (val >= -0.15) {
      return 'bg-slate-100 text-slate-700 dark:bg-zinc-800/50 dark:text-zinc-300 hover:bg-slate-200';
    }
    if (val >= -0.45) {
      return 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950/70 dark:text-cyan-200 hover:bg-cyan-200';
    }
    return 'bg-emerald-600 text-white font-bold hover:bg-emerald-700';
  };

  return (
    <div className="space-y-4">
      {/* 頂部狀態與切換按鈕 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            投組平均相關係數：
          </span>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 font-mono text-xs font-bold',
              averageCorrelation >= 0.65
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                : averageCorrelation <= 0.35
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
            )}
          >
            {averageCorrelation > 0 ? `+${averageCorrelation}` : averageCorrelation}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
            ({averageCorrelation >= 0.65 ? '同質性偏高' : averageCorrelation <= 0.35 ? '分散度優異' : '正常分佈'})
          </span>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200/90 bg-white p-0.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              activeTab === 'matrix'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            相關矩陣 ({symbols.length}×{symbols.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('high_risk')}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              activeTab === 'high_risk'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            高度同步 ({highRiskPairs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hedging')}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              activeTab === 'hedging'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            互補避險 ({hedgingPairs.length})
          </button>
        </div>
      </div>

      {/* 矩陣視圖 */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="min-w-fit">
              <table className="border-collapse text-center text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-semibold text-slate-400 dark:text-zinc-500 text-[11px]">
                      標的
                    </th>
                    {symbols.map((sym) => (
                      <th
                        key={sym}
                        className="p-2 font-bold text-slate-700 dark:text-zinc-300 text-[11px] whitespace-nowrap min-w-[54px]"
                      >
                        {sym.replace('.TW', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {symbols.map((symRow, i) => (
                    <tr key={symRow}>
                      <td className="p-2 text-left font-bold text-slate-800 dark:text-zinc-200 text-[11px] whitespace-nowrap pr-3">
                        {symRow.replace('.TW', '')}
                      </td>
                      {symbols.map((symCol, j) => {
                        const val = matrix[i][j];
                        return (
                          <td
                            key={symCol}
                            onMouseEnter={() =>
                              setHoveredPair({ symA: symRow, symB: symCol, val })
                            }
                            onMouseLeave={() => setHoveredPair(null)}
                            className="p-0.5"
                          >
                            <div
                              className={cn(
                                'flex h-8 w-[54px] cursor-pointer items-center justify-center rounded-md font-mono text-[11px] transition-transform duration-100 hover:scale-105 shadow-xs',
                                getCellColor(i, j, val),
                              )}
                            >
                              {i === j ? '1.00' : val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 懸浮詳細提示卡片 */}
          <div className="min-h-[38px] rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-zinc-800/40 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-800">
            {hoveredPair ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-zinc-100">
                    {hoveredPair.symA} × {hoveredPair.symB}
                  </span>
                  <span>相關係數：</span>
                  <span className="font-mono font-bold text-brand">
                    {hoveredPair.val >= 0 ? `+${hoveredPair.val.toFixed(2)}` : hoveredPair.val.toFixed(2)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {hoveredPair.symA === hoveredPair.symB
                    ? '自我相關基準 (1.00)'
                    : hoveredPair.val >= 0.75
                      ? '⚠️ 高度正相關：同漲同跌無分散效果'
                      : hoveredPair.val >= 0.4
                        ? 'ℹ️ 中度正相關：同屬性產業或關聯族群'
                        : hoveredPair.val <= 0.1
                          ? '🛡️ 負相關或弱相關：優質分散避險'
                          : '弱相關：具備分散風險效果'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>將游標移動至熱力圖各網格即可查看兩檔股票的具體連動說明</span>
              </div>
            )}
          </div>

          {/* 圖例說明 */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-emerald-600" />
              <span>&lt; -0.2 (反向避險)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-slate-200 dark:bg-zinc-800" />
              <span>-0.2 ~ +0.2 (獨立分散)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-amber-200 dark:bg-amber-900" />
              <span>+0.2 ~ +0.45 (溫和相關)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-rose-400" />
              <span>+0.45 ~ +0.75 (中度正相關)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-rose-500" />
              <span>&gt; +0.75 (高度同步連動)</span>
            </div>
          </div>
        </div>
      )}

      {/* 高度同步標的清單 */}
      {activeTab === 'high_risk' && (
        <div className="space-y-2.5">
          {highRiskPairs.length > 0 ? (
            highRiskPairs.map((p) => (
              <PairCard key={`${p.symbolA}-${p.symbolB}`} pair={p} isAlert />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-6 text-center text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              <ShieldCheck className="mx-auto h-5 w-5 text-emerald-600 mb-1" />
              恭喜！投組內無任何相關係數大於 0.75 的極度重疊標的，各資產具備良好獨立性。
            </div>
          )}
        </div>
      )}

      {/* 互補避險標的清單 */}
      {activeTab === 'hedging' && (
        <div className="space-y-2.5">
          {hedgingPairs.length > 0 ? (
            hedgingPairs.map((p) => (
              <PairCard key={`${p.symbolA}-${p.symbolB}`} pair={p} isHedging />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
              目前投組尚無明顯負相關或獨立避險標的（如公債 ETF、反向資產或不同區域市場），建議配置部分抗震標的。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function PairCard({
  pair,
  isAlert = false,
  isHedging = false,
}: {
  pair: CorrelationPair;
  isAlert?: boolean;
  isHedging?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border p-3 text-xs transition',
        isAlert
          ? 'border-rose-200 bg-rose-50/40 dark:border-rose-950/50 dark:bg-rose-950/20'
          : isHedging
            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-950/50 dark:bg-emerald-950/20'
            : 'border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/40',
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isAlert && <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />}
          {isHedging && <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />}
          <span className="font-bold text-slate-900 dark:text-zinc-100">
            {pair.symbolA}
          </span>
          <span className="text-slate-400">與</span>
          <span className="font-bold text-slate-900 dark:text-zinc-100">
            {pair.symbolB}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">{pair.description}</p>
      </div>

      <div className="text-right pl-3">
        <span
          className={cn(
            'font-mono text-sm font-bold',
            pair.correlation >= 0.75
              ? 'text-rose-600 dark:text-rose-400'
              : pair.correlation <= 0.1
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-700 dark:text-zinc-300',
          )}
        >
          {pair.correlation > 0 ? `+${pair.correlation}` : pair.correlation}
        </span>
        <p className="text-[10px] text-slate-400">相關係數</p>
      </div>
    </div>
  );
}
