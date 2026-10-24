import React from 'react';
import { cn } from '@/lib/cn';
import type { PortfolioHealthScore } from '@/lib/correlationAnalytics';
import {
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  HeartPulse,
  TrendingUp,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';

interface Props {
  health: PortfolioHealthScore;
}

export const HealthDiagnosticsCard: React.FC<Props> = ({ health }) => {
  const { overallScore, grade, gradeTitle, pillars, strengths, warnings, recommendations } = health;

  // 取得評級代表色
  const getGradeStyle = () => {
    switch (grade) {
      case 'S':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          badge: 'bg-emerald-500 text-white',
          ring: 'stroke-emerald-500',
        };
      case 'A':
        return {
          bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
          badge: 'bg-sky-500 text-white',
          ring: 'stroke-sky-500',
        };
      case 'B':
        return {
          bg: 'bg-brand/10 text-brand border-brand/20',
          badge: 'bg-brand text-white',
          ring: 'stroke-brand',
        };
      case 'C':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          badge: 'bg-amber-500 text-white',
          ring: 'stroke-amber-500',
        };
      default:
        return {
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          badge: 'bg-rose-500 text-white',
          ring: 'stroke-rose-500',
        };
    }
  };

  const style = getGradeStyle();
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="card p-5 space-y-6">
      {/* 頂部標題 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
              <HeartPulse className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              投資組合體質健康健檢 (Portfolio Health Score)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            綜合持股分散度、波動回撤防禦、夏普報酬效率與壓力情境抗震力之全方位診斷
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border',
              style.bg,
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            評級 {grade} · {gradeTitle}
          </span>
        </div>
      </div>

      {/* 總分圓形儀表板 + 四大維度條形圖 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-center">
        {/* 左側圓環總分 */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50/60 dark:bg-zinc-800/30 border border-slate-200/60 dark:border-zinc-800">
          <div className="relative flex items-center justify-center w-32 h-32 shrink-0">
            <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r={radius}
                className="stroke-slate-200 dark:stroke-zinc-700"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                className={cn('transition-all duration-1000 ease-out', style.ring)}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-3xl font-black text-slate-900 dark:text-zinc-100 leading-none">
                {Math.max(0, Math.min(100, overallScore))}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 mt-1">/ 100 滿分</span>
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            綜合投組健康度評分
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {overallScore >= 80 ? '優於 85% 一般散戶配置' : overallScore >= 65 ? '屬中等常態分佈' : '建議針對弱項部位優化'}
          </p>
        </div>

        {/* 右側四大支柱柱狀進度條 */}
        <div className="md:col-span-2 space-y-3.5 min-w-0">
          {/* 1. 分散度 */}
          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300 truncate min-w-0">
                <Layers className="h-3.5 w-3.5 text-brand shrink-0" />
                <span className="truncate">標的分散度</span>
                <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-zinc-500">(持股與權重均衡)</span>
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 shrink-0">
                {Math.max(0, Math.min(100, pillars.diversification))} 分
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
              <div
                style={{ width: `${Math.max(0, Math.min(100, pillars.diversification))}%` }}
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  pillars.diversification >= 75 ? 'bg-emerald-500' : pillars.diversification >= 50 ? 'bg-brand' : 'bg-rose-500',
                )}
              />
            </div>
          </div>

          {/* 2. 波動與回撤防禦 */}
          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300 truncate min-w-0">
                <Shield className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                <span className="truncate">波動與回撤防禦</span>
                <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-zinc-500">(MDD & 波動控制)</span>
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 shrink-0">
                {Math.max(0, Math.min(100, pillars.riskControl))} 分
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
              <div
                style={{ width: `${Math.max(0, Math.min(100, pillars.riskControl))}%` }}
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  pillars.riskControl >= 75 ? 'bg-emerald-500' : pillars.riskControl >= 50 ? 'bg-cyan-500' : 'bg-rose-500',
                )}
              />
            </div>
          </div>

          {/* 3. 報酬效率 */}
          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300 truncate min-w-0">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">報酬效率</span>
                <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-zinc-500">(夏普 Sharpe & 貝他)</span>
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 shrink-0">
                {Math.max(0, Math.min(100, pillars.efficiency))} 分
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
              <div
                style={{ width: `${Math.max(0, Math.min(100, pillars.efficiency))}%` }}
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  pillars.efficiency >= 75 ? 'bg-emerald-500' : pillars.efficiency >= 50 ? 'bg-emerald-400' : 'bg-rose-500',
                )}
              />
            </div>
          </div>

          {/* 4. 壓力情境韌性 */}
          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300 truncate min-w-0">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                <span className="truncate">黑天鵝壓力韌性</span>
                <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-zinc-500">(危機抗跌評級)</span>
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 shrink-0">
                {Math.max(0, Math.min(100, pillars.resilience))} 分
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
              <div
                style={{ width: `${Math.max(0, Math.min(100, pillars.resilience))}%` }}
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  pillars.resilience >= 75 ? 'bg-emerald-500' : pillars.resilience >= 50 ? 'bg-purple-500' : 'bg-rose-500',
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 診斷亮點、警示與改善建議 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 pt-2">
        {/* 體質優勢 (Strengths) */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/20 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>核心配置優勢</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
            {strengths.map((s, idx) => (
              <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 潛在警示 (Warnings) */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-950/40 dark:bg-amber-950/20 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>潛在盲點警示</span>
          </div>
          {warnings.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
              {warnings.map((w, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                  <span className="text-amber-600 font-bold">!</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              未偵測到明顯結構性隱患，持股集中度與波動控制皆符合標準規範。
            </p>
          )}
        </div>

        {/* 優化行動建議 (Recommendations) */}
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 dark:border-sky-950/40 dark:bg-sky-950/20 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
            <Lightbulb className="h-4 w-4 text-sky-600" />
            <span>投組優化行動指引</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
            {recommendations.map((r, idx) => (
              <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-sky-600 font-bold">💡</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
