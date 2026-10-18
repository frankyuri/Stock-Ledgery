import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Flame,
  TrendingUp,
  Coins,
  Clock,
  Target,
  Sparkles,
  ShieldCheck,
  Zap,
  Coffee,
  CheckCircle2,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { fetchChartBundle } from '@/services/stocks';
import { calculatePortfolioDividends } from '@/lib/dividendForecast';
import {
  simulateFire,
  DEFAULT_FIRE_SETTINGS,
  type FireSettings,
  type FireType,
} from '@/lib/fireAnalytics';
import { FireProjectionChart } from '@/components/charts/FireProjectionChart';
import { MonteCarloPanel } from '@/components/fire/MonteCarloPanel';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import type { ChartBundle } from '@/services/yahoo';
import type { DividendEvent, Quote } from '@/types/stock';

export function FireTracker() {
  const toast = useToast();
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
  const assets = useStockStore((s) => s.assets);
  const fireSettings = useStockStore((s) => s.fireSettings);
  const setFireSettings = useStockStore((s) => s.setFireSettings);

  // 本地調整暫存狀態 (即時連動)
  const [params, setParams] = useState<FireSettings>(fireSettings);
  const [chartMode, setChartMode] = useState<'PROJECTION' | 'MONTE_CARLO'>('PROJECTION');

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);

  // 抓取持股即時報價與股息資料
  const { data: chartBundles } = useQuery({
    queryKey: ['fire-dividend-bundles', symbols.sort().join(',')],
    queryFn: async () => {
      if (symbols.length === 0) return {};
      const results = await Promise.allSettled(
        symbols.map((sym) => fetchChartBundle(sym, '1D')),
      );

      const map: Record<string, ChartBundle> = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          map[symbols[i]] = res.value;
        }
      });
      return map;
    },
    enabled: symbols.length > 0,
    staleTime: 60_000,
  });

  // 計算現有持股市值
  const portfolioMarketValue = useMemo(() => {
    if (!chartBundles || holdings.length === 0) return 0;
    let total = 0;
    for (const h of holdings) {
      const q = chartBundles[h.symbol]?.quote;
      const price = q?.price ?? h.avgCost;
      total += h.shares * price;
    }
    return total;
  }, [holdings, chartBundles]);

  // 計算最新淨值快照中的非證券資產 (現金 + 其他)
  const cashAndOtherAssets = useMemo(() => {
    if (assets.length === 0) return 0;
    // 取最新日期的快照記錄
    const sorted = [...assets].sort((a, b) => b.date.localeCompare(a.date));
    const latestDate = sorted[0]?.date;
    const latestRows = sorted.filter((a) => a.date === latestDate);
    // 粗略以 TWD 累計現金與其他
    return latestRows.reduce((sum, r) => sum + (r.cash + r.other), 0);
  }, [assets]);

  // 總資產淨值
  const currentNetWorth = useMemo(() => {
    return Math.round(portfolioMarketValue + cashAndOtherAssets);
  }, [portfolioMarketValue, cashAndOtherAssets]);

  // 預估年化股息現金流
  const currentAnnualDividends = useMemo(() => {
    if (!chartBundles || holdings.length === 0) return 0;

    const quotesMap = new Map<string, Quote>();
    const dividendsMap = new Map<string, DividendEvent[]>();

    for (const [sym, bundle] of Object.entries(chartBundles)) {
      if (bundle.quote) quotesMap.set(sym, bundle.quote);
      if (bundle.dividends) dividendsMap.set(sym, bundle.dividends);
    }

    const dividendOverview = calculatePortfolioDividends(
      holdings,
      transactions,
      quotesMap,
      dividendsMap,
    );
    return Math.round(dividendOverview.totalAnnualIncome);
  }, [holdings, transactions, chartBundles]);

  // 執行 FIRE 模擬運算
  const sim = useMemo(() => {
    return simulateFire(params, currentNetWorth, currentAnnualDividends);
  }, [params, currentNetWorth, currentAnnualDividends]);

  // 更新參數並持久化
  const updateParam = <K extends keyof FireSettings>(
    key: K,
    val: FireSettings[K],
  ) => {
    const updated = { ...params, [key]: val };
    setParams(updated);
    setFireSettings(updated);
  };

  const handleReset = () => {
    setParams(DEFAULT_FIRE_SETTINGS);
    setFireSettings(DEFAULT_FIRE_SETTINGS);
    toast.success('已恢復預設 FIRE 參數設定');
  };

  const SWR_PRESETS = [3.0, 3.5, 4.0, 4.5, 5.0];

  const FIRE_TYPES_INFO: {
    type: FireType;
    label: string;
    sub: string;
    icon: typeof Flame;
    color: string;
    target: number;
  }[] = [
    {
      type: 'STANDARD',
      label: '標準自由 (Standard FIRE)',
      sub: '100% 覆蓋生活全額開銷',
      icon: Flame,
      color: 'text-amber-500 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20',
      target: sim.targets.standardTarget,
    },
    {
      type: 'LEAN',
      label: '極簡自由 (Lean FIRE)',
      sub: '覆蓋 75% 基本維生開銷',
      icon: Target,
      color: 'text-blue-500 border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20',
      target: sim.targets.leanTarget,
    },
    {
      type: 'FAT',
      label: '富裕自由 (Fat FIRE)',
      sub: '135% 寬裕生活與享樂預算',
      icon: Sparkles,
      color: 'text-purple-500 border-purple-500/40 bg-purple-50/50 dark:bg-purple-950/20',
      target: sim.targets.fatTarget,
    },
    {
      type: 'BARISTA',
      label: '兼職自由 (Barista FIRE)',
      sub: '50% 投資提領 + 50% 輕度兼職',
      icon: Coffee,
      color: 'text-emerald-500 border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20',
      target: sim.targets.baristaTarget,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 標題與引導列 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
              <Flame className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100">
              FIRE 財務自由倒數與被動收入覆蓋
            </h1>
          </div>
          <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
            以 4% 安全提領法則結合投資組合真實股息現金流，動態試算達標年限與各生活支出覆蓋階段。
          </p>
        </div>

        {/* 快捷 FIRE 模式選擇 Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          {(['STANDARD', 'LEAN', 'FAT', 'BARISTA'] as FireType[]).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => updateParam('targetFireType', ft)}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-all',
                params.targetFireType === ft
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
              )}
            >
              {ft === 'STANDARD' && '標準 FIRE'}
              {ft === 'LEAN' && '極簡 Lean'}
              {ft === 'FAT' && '富足 Fat'}
              {ft === 'BARISTA' && '咖啡師 Barista'}
            </button>
          ))}
        </div>
      </div>

      {/* 頂部 4 大 KPI 統計指標卡 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 1: FIRE 達成率 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>FIRE 目標達成率</span>
            <span className="font-semibold text-amber-500">
              {params.targetFireType}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {sim.progressPercent}%
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              (差額 NT$ {formatNumber(sim.remainingGap)})
            </span>
          </div>
          {/* 進度條 */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(sim.progressPercent, 100)}%` }}
            />
          </div>
          <div className="mt-2.5 flex justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>目前 NT$ {formatNumber(sim.currentNetWorth)}</span>
            <span>目標 NT$ {formatNumber(sim.targets.activeTarget)}</span>
          </div>
        </div>

        {/* 卡片 2: 被動股息覆蓋率 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>股息生活開銷覆蓋率</span>
            <Coins className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {sim.dividendCoveragePercent}%
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              月均 NT$ {formatNumber(sim.currentMonthlyDividends)}
            </span>
          </div>
          {/* 進度條 */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(sim.dividendCoveragePercent, 100)}%` }}
            />
          </div>
          <div className="mt-2.5 flex justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>年股息 NT$ {formatNumber(sim.currentAnnualDividends)}</span>
            <span>年開銷 NT$ {formatNumber(params.monthlyExpense * 12)}</span>
          </div>
        </div>

        {/* 卡片 3: 退休倒數計時 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>財務自由預估倒數</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {sim.formattedCountdown}
            </span>
          </div>
          <div className="mt-3.5 space-y-1 text-xs text-slate-500 dark:text-zinc-400">
            <div className="flex justify-between">
              <span>預計達成時間：</span>
              <strong className="text-slate-800 dark:text-zinc-200">
                {sim.estimatedTargetDate?.formatted || '持續累積中'}
              </strong>
            </div>
            {sim.estimatedAgeAtRetirement && (
              <div className="flex justify-between">
                <span>預估達成年齡：</span>
                <strong className="text-slate-800 dark:text-zinc-200">
                  {sim.estimatedAgeAtRetirement} 歲
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* 卡片 4: 4% 安全提領額 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>現狀可安全提領額 ({params.swr}%)</span>
            <ShieldCheck className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              NT$ {formatNumber(sim.currentMonthlySafeWithdrawal)}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">/ 月</span>
          </div>
          <div className="mt-3.5 space-y-1 text-xs text-slate-500 dark:text-zinc-400">
            <div className="flex justify-between">
              <span>每年可提領：</span>
              <strong className="text-slate-800 dark:text-zinc-200">
                NT$ {formatNumber(sim.currentAnnualSafeWithdrawal)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>資產提領覆蓋率：</span>
              <strong className="text-slate-800 dark:text-zinc-200">
                {formatPercent(
                  params.monthlyExpense > 0
                    ? (sim.currentMonthlySafeWithdrawal / params.monthlyExpense) * 100
                    : 0,
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 主版面：左側圖表與里程碑，右側參數控制與生活型態 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左側欄位 (7 欄寬) */}
        <div className="space-y-6 lg:col-span-7">
          {/* 30 年財富增長與達標交叉點圖表 / 蒙地卡羅情境壓力測試 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  {chartMode === 'PROJECTION'
                    ? '30 年複利財富累積與 FIRE 門檻交叉線'
                    : '蒙地卡羅情境壓力測試與動態提領模擬'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {chartMode === 'PROJECTION'
                    ? params.useInflationAdjusted
                      ? '已啟用實質抗通膨調整 (淨年化實質報酬率推算)'
                      : '名目報酬率模擬 (未扣除通膨)'
                    : '2,000 次隨機過程模擬、破產率精算與報酬順序風險 (SRR) 診斷'}
                </p>
              </div>

              {/* Mode switch pills */}
              <div className="inline-flex rounded-xl border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setChartMode('PROJECTION')}
                  className={cn(
                    'rounded-lg px-3 py-1 font-semibold transition',
                    chartMode === 'PROJECTION'
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                  )}
                >
                  📈 定額複利路徑
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('MONTE_CARLO')}
                  className={cn(
                    'rounded-lg px-3 py-1 font-semibold transition flex items-center gap-1.5',
                    chartMode === 'MONTE_CARLO'
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  🎲 蒙地卡羅壓力測試
                </button>
              </div>
            </div>

            {chartMode === 'PROJECTION' ? (
              <FireProjectionChart data={sim.projections} height={320} />
            ) : (
              <MonteCarloPanel
                currentNetWorth={sim.currentNetWorth}
                annualExpense={sim.targets.activeTarget * (params.swr / 100)}
                annualInvestment={params.monthlyInvestment * 12}
                expectedAnnualReturn={params.expectedAnnualReturn}
                inflationRate={params.inflationRate}
              />
            )}
          </div>

          {/* 被動股息生活支出覆蓋階梯 (Milestone Ladder) */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  被動股息生活開銷覆蓋里程碑 (Crossover Ladder)
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  衡量目前的股息現金流已逐步解鎖哪一個生活維度。
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                已解鎖 {sim.milestones.filter((m) => m.isUnlocked).length} /{' '}
                {sim.milestones.length} 階
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sim.milestones.map((m) => (
                <div
                  key={m.key}
                  className={cn(
                    'relative rounded-xl border p-3.5 transition-all',
                    m.isUnlocked
                      ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                      : 'border-slate-200/80 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-800/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {m.isUnlocked ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-slate-300 dark:border-zinc-600 shrink-0" />
                        )}
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                          {m.title}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                        {m.description}
                      </p>
                    </div>

                    <span
                      className={cn(
                        'shrink-0 text-xs font-bold px-2 py-0.5 rounded-md',
                        m.isUnlocked
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-200/60 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300',
                      )}
                    >
                      {m.progressPercent}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                    <span>月需：NT$ {formatNumber(m.targetMonthlyAmount)}</span>
                    <span>
                      {m.isUnlocked ? (
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          已完全達成
                        </strong>
                      ) : (
                        `還差 NT$ ${formatNumber(m.remainingAnnual)}/年`
                      )}
                    </span>
                  </div>

                  {/* 迷你進度條 */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-zinc-700/60">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        m.isUnlocked ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                      style={{ width: `${Math.min(m.progressPercent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 智慧加速建議與財務診斷 (Insights) */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-amber-500" />
              FIRE 財務自由智慧加速策略
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* 建議 1: 加碼定期定額 */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  🚀 開源加速
                </span>
                <p className="mt-1 text-xs text-slate-700 dark:text-zinc-300">
                  若每月額外多投入 <strong>NT$ 5,000</strong>，可提早約{' '}
                  <strong className="text-blue-600 dark:text-blue-400 text-sm">
                    {sim.accelerators.boostInvestmentAdvanceYears} 年
                  </strong>{' '}
                  達成目標！
                </p>
              </div>

              {/* 建議 2: 精省生活開支 */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  ✂️ 節流加速
                </span>
                <p className="mt-1 text-xs text-slate-700 dark:text-zinc-300">
                  若生活開支減少 <strong>10%</strong>，本金目標立減{' '}
                  <strong>
                    NT$ {formatNumber(sim.accelerators.cutExpenseTargetReduced)}
                  </strong>
                  ，可提早約{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 text-sm">
                    {sim.accelerators.cutExpenseAdvanceYears} 年
                  </strong>
                  ！
                </p>
              </div>

              {/* 建議 3: Coast FIRE 檢驗 */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 dark:border-purple-900/40 dark:bg-purple-950/20">
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  ☕ Coast FIRE 檢驗
                </span>
                <p className="mt-1 text-xs text-slate-700 dark:text-zinc-300">
                  {sim.accelerators.coastFirePossible ? (
                    <>
                      恭喜！即使目前完全停止新投入，依複利推算至 60 歲
                      <strong className="text-purple-600 dark:text-purple-400">
                        可自動達成
                      </strong>{' '}
                      目標本金！
                    </>
                  ) : (
                    <>
                      目前資產規模尚無法純靠複利自轉達標，建議持續維持每月定期定額投入。
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 右側欄位：生活型態與即時調控面板 (5 欄寬) */}
        <div className="space-y-6 lg:col-span-5">
          {/* 四大 FIRE 模式對比與切換 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-3 flex items-center justify-between">
              <span>FIRE 生活型態對比</span>
              <span className="text-xs font-normal text-slate-400">
                點選卡片切換目標
              </span>
            </h2>

            <div className="space-y-2.5">
              {FIRE_TYPES_INFO.map((item) => {
                const isSelected = params.targetFireType === item.type;
                const IconComponent = item.icon;
                const progress =
                  item.target > 0
                    ? Math.min(
                        Math.round((sim.currentNetWorth / item.target) * 1000) / 10,
                        100,
                      )
                    : 100;

                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => updateParam('targetFireType', item.type)}
                    className={cn(
                      'w-full text-left rounded-xl border p-3 transition-all cursor-pointer',
                      isSelected
                        ? item.color
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-bold">{item.label}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                        {progress}%
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                      <span>{item.sub}</span>
                      <strong className="text-slate-900 dark:text-zinc-100">
                        NT$ {formatNumber(item.target)}
                      </strong>
                    </div>

                    {/* Progress line */}
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-current transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 互動式參數調控面板 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-brand" />
                動態模擬參數調控
              </h2>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1"
                title="恢復預設參數"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重設
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 每月生活開銷 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    目標每月生活開銷
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">NT$</span>
                    <input
                      type="number"
                      step={5000}
                      min={10000}
                      max={500000}
                      value={params.monthlyExpense}
                      onChange={(e) =>
                        updateParam('monthlyExpense', Number(e.target.value) || 10000)
                      }
                      className="w-24 rounded-md border border-slate-300 px-2 py-0.5 text-right font-bold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={200000}
                  step={5000}
                  value={params.monthlyExpense}
                  onChange={(e) => updateParam('monthlyExpense', Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                  <span>NT$ 1萬</span>
                  <span>
                    年支出 NT$ {formatNumber(params.monthlyExpense * 12)}
                  </span>
                  <span>NT$ 20萬</span>
                </div>
              </div>

              {/* 每月定期定額投入 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    每月定期定額投入
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">NT$</span>
                    <input
                      type="number"
                      step={2000}
                      min={0}
                      max={300000}
                      value={params.monthlyInvestment}
                      onChange={(e) =>
                        updateParam('monthlyInvestment', Number(e.target.value) || 0)
                      }
                      className="w-24 rounded-md border border-slate-300 px-2 py-0.5 text-right font-bold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150000}
                  step={2000}
                  value={params.monthlyInvestment}
                  onChange={(e) =>
                    updateParam('monthlyInvestment', Number(e.target.value))
                  }
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                  <span>NT$ 0</span>
                  <span>年投入 NT$ {formatNumber(params.monthlyInvestment * 12)}</span>
                  <span>NT$ 15萬</span>
                </div>
              </div>

              {/* 預期年化報酬率 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    預期年化報酬率 (%)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      max={20}
                      value={params.expectedAnnualReturn}
                      onChange={(e) =>
                        updateParam('expectedAnnualReturn', Number(e.target.value) || 1)
                      }
                      className="w-16 rounded-md border border-slate-300 px-2 py-0.5 text-right font-bold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={3}
                  max={15}
                  step={0.5}
                  value={params.expectedAnnualReturn}
                  onChange={(e) =>
                    updateParam('expectedAnnualReturn', Number(e.target.value))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                  <span>3.0% (保守債券)</span>
                  <span>7.0% (標普500長期)</span>
                  <span>15.0% (成長)</span>
                </div>
              </div>

              {/* 安全提領率 SWR */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    安全提領率 (SWR)
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {params.swr}% (本金倍數 {(100 / params.swr).toFixed(1)}x)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {SWR_PRESETS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => updateParam('swr', rate)}
                      className={cn(
                        'flex-1 rounded-md py-1 text-center font-semibold transition-all border',
                        params.swr === rate
                          ? 'border-amber-500 bg-amber-500 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
                      )}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* 年齡設定 */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="block mb-1 text-slate-600 dark:text-zinc-400">
                    目前年齡
                  </span>
                  <input
                    type="number"
                    min={18}
                    max={80}
                    value={params.currentAge ?? 30}
                    onChange={(e) =>
                      updateParam('currentAge', Number(e.target.value) || 30)
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <span className="block mb-1 text-slate-600 dark:text-zinc-400">
                    目標退休年齡
                  </span>
                  <input
                    type="number"
                    min={25}
                    max={90}
                    value={params.targetRetirementAge ?? 45}
                    onChange={(e) =>
                      updateParam(
                        'targetRetirementAge',
                        Number(e.target.value) || 45,
                      )
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* 通膨開關 */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-3">
                <span className="text-slate-700 dark:text-zinc-300 font-medium">
                  抗通膨實質調整 (預設 2.0%)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={params.useInflationAdjusted}
                    onChange={(e) =>
                      updateParam('useInflationAdjusted', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-brand"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
