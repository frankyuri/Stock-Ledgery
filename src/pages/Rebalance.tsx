import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scale,
  Sliders,
  TrendingUp,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Layers,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { fetchChartBundle } from '@/services/stocks';
import {
  calculatePortfolioDrift,
  calculateCashInRebalance,
  calculateFullRebalance,
  validateAndNormalizeAllocations,
  REBALANCE_PRESETS,
  DEFAULT_REBALANCE_SETTINGS,
  type HoldingPosition,
  type RebalanceSettings,
} from '@/lib/rebalanceAnalytics';
import { AllocationComparisonChart } from '@/components/charts/AllocationComparisonChart';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { formatNumber } from '@/lib/format';
import { useCurrency } from '@/lib/hooks/useCurrency';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import type { ChartBundle } from '@/services/yahoo';
import type { TransactionType } from '@/types/stock';

export function Rebalance() {
  const toast = useToast();
  const { formatMoney } = useCurrency();
  const holdings = useStockStore((s) => s.holdings);
  const rebalanceSettings = useStockStore((s) => s.rebalanceSettings);
  const setRebalanceSettings = useStockStore((s) => s.setRebalanceSettings);

  // 本地調整暫存狀態 (即時連動)
  const [settings, setSettings] = useState<RebalanceSettings>(rebalanceSettings);
  const [newSymbolInput, setNewSymbolInput] = useState('');

  // 快速記帳下單視窗狀態
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState('');
  const [tradeType, setTradeType] = useState<TransactionType>('BUY');

  // 抓取持股與目標標的的即時報價
  const targetSymbols = useMemo(
    () => settings.allocations.map((a) => a.symbol),
    [settings.allocations],
  );

  const allSymbolsToFetch = useMemo(() => {
    const set = new Set([...holdings.map((h) => h.symbol), ...targetSymbols]);
    return Array.from(set).filter((s) => s !== 'CASH');
  }, [holdings, targetSymbols]);

  const { data: chartBundles } = useQuery({
    queryKey: ['rebalance-bundles', allSymbolsToFetch.sort().join(',')],
    queryFn: async () => {
      if (allSymbolsToFetch.length === 0) return {};
      const results = await Promise.allSettled(
        allSymbolsToFetch.map((sym) => fetchChartBundle(sym, '1D')),
      );

      const map: Record<string, ChartBundle> = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          map[allSymbolsToFetch[i]] = res.value;
        }
      });
      return map;
    },
    enabled: allSymbolsToFetch.length > 0,
    staleTime: 60_000,
  });

  // 彙整現有持股部位與報價
  const holdingPositions: HoldingPosition[] = useMemo(() => {
    return holdings.map((h) => {
      const q = chartBundles?.[h.symbol]?.quote;
      const price = q?.price ?? h.avgCost;
      const name = q?.name ?? h.symbol;
      return {
        symbol: h.symbol,
        name,
        shares: h.shares,
        currentPrice: price,
        marketValue: Math.round(h.shares * price),
        currency: q?.currency ?? 'TWD',
      };
    });
  }, [holdings, chartBundles]);

  // 為目標中但尚未持有的標的補上當前市價
  const fullHoldingPositions: HoldingPosition[] = useMemo(() => {
    const list = [...holdingPositions];
    const existingSet = new Set(list.map((p) => p.symbol));

    for (const alloc of settings.allocations) {
      if (!existingSet.has(alloc.symbol)) {
        const q = chartBundles?.[alloc.symbol]?.quote;
        const price = q?.price ?? (alloc.symbol === 'CASH' ? 1 : 100);
        list.push({
          symbol: alloc.symbol,
          name: alloc.name ?? q?.name ?? alloc.symbol,
          shares: 0,
          currentPrice: price,
          marketValue: 0,
          currency: q?.currency ?? 'TWD',
        });
      }
    }
    return list;
  }, [holdingPositions, settings.allocations, chartBundles]);

  // 檢查配置權重加總是否為 100%
  const allocationValidation = useMemo(() => {
    return validateAndNormalizeAllocations(settings.allocations);
  }, [settings.allocations]);

  // 計算偏離度
  const driftResult = useMemo(() => {
    return calculatePortfolioDrift(
      fullHoldingPositions,
      settings.allocations,
      settings.driftThreshold,
    );
  }, [fullHoldingPositions, settings.allocations, settings.driftThreshold]);

  // 計算新資金加碼最優化 (Cash-in Only)
  const cashInResult = useMemo(() => {
    return calculateCashInRebalance(
      fullHoldingPositions,
      settings.allocations,
      settings.newCashAmount,
      settings.shareLotSize,
    );
  }, [fullHoldingPositions, settings.allocations, settings.newCashAmount, settings.shareLotSize]);

  // 計算全盤直接再平衡 (Full Rebalance)
  const fullRebalanceResult = useMemo(() => {
    return calculateFullRebalance(fullHoldingPositions, settings.allocations);
  }, [fullHoldingPositions, settings.allocations]);

  // 更新參數並持久化
  const updateSettings = <K extends keyof RebalanceSettings>(
    key: K,
    val: RebalanceSettings[K],
  ) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    setRebalanceSettings(updated);
  };

  // 更改特定標的目標權重
  const handleWeightChange = (symbol: string, newWeight: number) => {
    const updated = settings.allocations.map((a) =>
      a.symbol === symbol ? { ...a, targetWeight: newWeight } : a,
    );
    updateSettings('allocations', updated);
  };

  // 移除配置標的
  const handleRemoveAllocation = (symbol: string) => {
    if (settings.allocations.length <= 1) {
      toast.warning('至少需保留一檔配置標的');
      return;
    }
    const updated = settings.allocations.filter((a) => a.symbol !== symbol);
    updateSettings('allocations', updated);
  };

  // 新增配置標的
  const handleAddSymbol = () => {
    const norm = newSymbolInput.trim().toUpperCase();
    if (!norm) return;
    if (settings.allocations.some((a) => a.symbol === norm)) {
      toast.warning(`${norm} 已在配置清單中`);
      return;
    }
    const updated = [...settings.allocations, { symbol: norm, targetWeight: 0 }];
    updateSettings('allocations', updated);
    setNewSymbolInput('');
    toast.success(`已將 ${norm} 加入目標配置清單，請設定其目標權重`);
  };

  // 套用經典範本
  const handleApplyPreset = (presetId: string) => {
    const p = REBALANCE_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    updateSettings('allocations', p.allocations);
    toast.success(`已套用「${p.name}」目標配置`);
  };

  // 重設回預設設定
  const handleReset = () => {
    setSettings(DEFAULT_REBALANCE_SETTINGS);
    setRebalanceSettings(DEFAULT_REBALANCE_SETTINGS);
    toast.success('已恢復預設再平衡參數');
  };

  // 開啟快速記帳彈窗
  const openTradeModal = (symbol: string, type: TransactionType) => {
    setTradeSymbol(symbol);
    setTradeType(type);
    setTradeModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 標題與模式切換 Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20">
              <Scale className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100">
              目標資產配置與自動再平衡計算器
            </h1>
          </div>
          <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
            監控投資組合各標的之偏離度（Drift），智慧算出「新資金加碼最佳化」或「全盤買賣再平衡」之建議下單股數。
          </p>
        </div>

        {/* 模式切換 Pill Tabs 與 幣別切換 */}
        <div className="flex flex-wrap items-center gap-2">
          <CurrencyToggle />
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => updateSettings('mode', 'CASH_IN_ONLY')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-all cursor-pointer',
                settings.mode === 'CASH_IN_ONLY'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
              )}
            >
              💰 新資金加碼最佳化 (只買不賣)
            </button>
            <button
              type="button"
              onClick={() => updateSettings('mode', 'FULL_REBALANCE')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-all cursor-pointer',
                settings.mode === 'FULL_REBALANCE'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
              )}
            >
              ⚖️ 全盤直接再平衡 (買賣歸位)
            </button>
          </div>
        </div>
      </div>

      {/* 頂部 4 大 KPI 統計指標卡 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 1: 投組總市值 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>目前投組總市值</span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {formatMoney(driftResult.totalMarketValue, 'TWD')}
            </span>
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>持有檔數：{holdings.length} 檔</span>
            <span>目標配置：{settings.allocations.length} 檔</span>
          </div>
        </div>

        {/* 卡片 2: 最大偏離度 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>最大權重偏離度 (Max Drift)</span>
            <Scale className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                'text-2xl font-bold tracking-tight',
                driftResult.isPortfolioBalanced
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              ±{driftResult.maxAbsDrift}%
            </span>
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <span className="text-slate-500 dark:text-zinc-400">
              偏離容忍門檻：±{settings.driftThreshold}%
            </span>
            <span
              className={cn(
                'font-bold px-1.5 py-0.2 rounded-sm',
                driftResult.isPortfolioBalanced
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
              )}
            >
              {driftResult.isPortfolioBalanced ? '投組均衡' : '建議再平衡'}
            </span>
          </div>
        </div>

        {/* 卡片 3: 新資金投入 vs 剩餘現金 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>
              {settings.mode === 'CASH_IN_ONLY' ? '擬投入新資金' : '全盤買入總額'}
            </span>
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatMoney(
                settings.mode === 'CASH_IN_ONLY'
                  ? settings.newCashAmount
                  : fullRebalanceResult.totalBuyAmount,
                'TWD',
              )}
            </span>
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-zinc-400">
            {settings.mode === 'CASH_IN_ONLY' ? (
              <>
                <span>已分配：{formatMoney(settings.newCashAmount - cashInResult.cashRemaining, 'TWD')}</span>
                <span>剩餘零頭：{formatMoney(cashInResult.cashRemaining, 'TWD')}</span>
              </>
            ) : (
              <>
                <span>賣出變現：{formatMoney(fullRebalanceResult.totalSellAmount, 'TWD')}</span>
                <span>差額補入：{formatMoney(fullRebalanceResult.netRequiredCash, 'TWD')}</span>
              </>
            )}
          </div>
        </div>

        {/* 卡片 4: 預估交易稅費 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>預估摩擦成本 (稅金與手續費)</span>
            <ShieldCheck className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {formatMoney(
                settings.mode === 'CASH_IN_ONLY'
                  ? 0
                  : fullRebalanceResult.totalFeesAndTaxes,
                'TWD',
              )}
            </span>
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-zinc-400">
            {settings.mode === 'CASH_IN_ONLY' ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                🛡️ 只買不賣，免繳證券交易稅！
              </span>
            ) : (
              <span>包含 0.3% 證交稅與券商手續費</span>
            )}
          </div>
        </div>
      </div>

      {/* 主版面：左側圖表與建議算單，右側目標配置編輯與參數微調 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左側欄位 (7 欄寬) */}
        <div className="space-y-6 lg:col-span-7">
          {/* 目標 vs 實際 配置偏離長條圖 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand" />
                  各標的配置權重與偏離度 (Drift)
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  即時對比實際權重與目標權重之差距。
                </p>
              </div>

              {!allocationValidation.isValid && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    目標權重總和為 {allocationValidation.totalWeight}% (需為 100%)
                  </span>
                </div>
              )}
            </div>

            <AllocationComparisonChart
              drifts={driftResult.drifts}
              driftThreshold={settings.driftThreshold}
            />
          </div>

          {/* 智慧再平衡建議算單明細 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  {settings.mode === 'CASH_IN_ONLY'
                    ? '新資金加碼最優化建議算單 (Buy-Only)'
                    : '全盤再平衡下單明細 (Full Rebalance)'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {settings.mode === 'CASH_IN_ONLY'
                    ? '以最優資金分配算法優先補強最欠缺標的，使投組在不賣出的前提下最逼近目標'
                    : '同時執行超配賣出與低配買進，使所有部位 100% 精準歸位'}
                </p>
              </div>
            </div>

            {/* 模式 A：新資金加碼清單 */}
            {settings.mode === 'CASH_IN_ONLY' ? (
              <div className="space-y-3">
                {cashInResult.recommendations.map((rec) => (
                  <div
                    key={rec.symbol}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                          {rec.symbol}
                        </strong>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[120px]">
                          {rec.name}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        目前：{formatNumber(rec.currentShares)} 股 · 市價 NT${' '}
                        {formatNumber(rec.currentPrice)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        建議加碼
                      </div>
                      <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {rec.recommendedShares > 0
                          ? `+${formatNumber(rec.recommendedShares)} 股`
                          : '暫不加碼 (已達標)'}
                      </div>
                      {rec.cost > 0 && (
                        <div className="text-xs text-slate-600 dark:text-zinc-400">
                          約 NT$ {formatNumber(rec.cost)}
                        </div>
                      )}
                    </div>

                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        預期權重變化
                      </div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                        {rec.actualWeight}% →{' '}
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {rec.postWeight}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        目標 {rec.targetWeight}%
                      </div>
                    </div>

                    <div>
                      {rec.recommendedShares > 0 ? (
                        <button
                          type="button"
                          onClick={() => openTradeModal(rec.symbol, 'BUY')}
                          className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs"
                        >
                          <span>快速記帳</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 py-1.5 px-3 inline-block">
                          無須操作
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 模式 B：全盤直接再平衡清單 */
              <div className="space-y-3">
                {fullRebalanceResult.actions.map((act) => (
                  <div
                    key={act.symbol}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-sm',
                            act.action === 'BUY'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                          )}
                        >
                          {act.action === 'BUY' ? '買進 BUY' : '賣出 SELL'}
                        </span>
                        <strong className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                          {act.symbol}
                        </strong>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        目前：{formatNumber(act.currentShares)} 股 → 目標{' '}
                        {formatNumber(act.targetShares)} 股
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        異動股數
                      </div>
                      <div
                        className={cn(
                          'text-base font-bold',
                          act.action === 'BUY'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {act.action === 'BUY' ? '+' : '-'}
                        {formatNumber(Math.abs(act.deltaShares))} 股
                      </div>
                      <div className="text-xs text-slate-600 dark:text-zinc-400">
                        金額 NT$ {formatNumber(act.estimatedAmount)}
                      </div>
                    </div>

                    <div className="text-right hidden sm:block text-xs text-slate-500 dark:text-zinc-400">
                      <div>手續費 NT$ {act.estimatedFee}</div>
                      {act.estimatedTax > 0 && (
                        <div>證交稅 NT$ {act.estimatedTax}</div>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => openTradeModal(act.symbol, act.action as TransactionType)}
                        className={cn(
                          'btn text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs',
                          act.action === 'BUY' ? 'btn-primary' : 'btn-danger',
                        )}
                      >
                        <span>快速下單</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右側欄位：目標配置編輯器與參數面板 (5 欄寬) */}
        <div className="space-y-6 lg:col-span-5">
          {/* 目標配置權重模型編輯器 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-brand" />
                  目標配置權重模型
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  自訂標的目標佔比，加總需為 100%
                </p>
              </div>

              <span
                className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-md',
                  allocationValidation.isValid
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                )}
              >
                合計：{allocationValidation.totalWeight}%
              </span>
            </div>

            {/* 快速套用範本 Pill */}
            <div className="mb-4">
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">
                快速套用經典配置模板：
              </span>
              <div className="flex flex-wrap gap-1.5">
                {REBALANCE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p.id)}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 cursor-pointer transition-all"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 配置標的清單編輯 */}
            <div className="space-y-2.5">
              {settings.allocations.map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                      {item.symbol}
                    </div>
                    {item.name && (
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {item.name}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={100}
                      value={item.targetWeight}
                      onChange={(e) =>
                        handleWeightChange(item.symbol, Number(e.target.value) || 0)
                      }
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-xs font-bold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <span className="text-xs text-slate-500">%</span>

                    <button
                      type="button"
                      onClick={() => handleRemoveAllocation(item.symbol)}
                      className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 cursor-pointer"
                      title="移除此標的"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 新增配置標的輸入 */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="輸入股票代碼 (例: 0050.TW, VT)"
                value={newSymbolInput}
                onChange={(e) => setNewSymbolInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs uppercase dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleAddSymbol}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                新增
              </button>
            </div>
          </div>

          {/* 互動式再平衡參數面板 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-brand" />
                再平衡參數調控
              </h2>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                title="恢復預設參數"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重設
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 擬投入新資金 (模式 A) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    預備投入新資金 (TWD)
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">NT$</span>
                    <input
                      type="number"
                      step={5000}
                      min={0}
                      max={1000000}
                      value={settings.newCashAmount}
                      onChange={(e) =>
                        updateSettings('newCashAmount', Number(e.target.value) || 0)
                      }
                      className="w-28 rounded-md border border-slate-300 px-2 py-0.5 text-right font-bold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={300000}
                  step={5000}
                  value={settings.newCashAmount}
                  onChange={(e) =>
                    updateSettings('newCashAmount', Number(e.target.value))
                  }
                  className="w-full accent-brand cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                  <span>NT$ 1萬</span>
                  <span>NT$ 15萬</span>
                  <span>NT$ 30萬</span>
                </div>
              </div>

              {/* 容忍偏離門檻 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    偏離容忍門檻 (Drift Threshold)
                  </span>
                  <span className="font-bold text-brand">
                    ±{settings.driftThreshold}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1.0, 2.0, 3.0, 5.0].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateSettings('driftThreshold', t)}
                      className={cn(
                        'flex-1 rounded-md py-1 text-center font-semibold transition-all border cursor-pointer',
                        settings.driftThreshold === t
                          ? 'border-brand bg-brand text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
                      )}
                    >
                      ±{t}%
                    </button>
                  ))}
                </div>
              </div>

              {/* 台股交易單位限制 */}
              <div>
                <span className="block mb-1.5 font-semibold text-slate-700 dark:text-zinc-300">
                  交易股數限制
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings('shareLotSize', 'FRACTIONAL_OR_ODD')}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-center font-semibold transition-all cursor-pointer',
                      settings.shareLotSize === 'FRACTIONAL_OR_ODD'
                        ? 'border-brand bg-brand/10 text-brand dark:bg-brand/20'
                        : 'border-slate-200 text-slate-600 dark:border-zinc-800 dark:text-zinc-400',
                    )}
                  >
                    1 股 (盤中零股)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings('shareLotSize', 'ROUND_LOT')}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-center font-semibold transition-all cursor-pointer',
                      settings.shareLotSize === 'ROUND_LOT'
                        ? 'border-brand bg-brand/10 text-brand dark:bg-brand/20'
                        : 'border-slate-200 text-slate-600 dark:border-zinc-800 dark:text-zinc-400',
                    )}
                  >
                    1,000 股 (整張)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 快速記帳下單彈窗 */}
      {tradeModalOpen && (
        <QuickTradeModal
          isOpen={tradeModalOpen}
          onClose={() => setTradeModalOpen(false)}
          initialSymbol={tradeSymbol}
          initialType={tradeType}
        />
      )}
    </div>
  );
}
