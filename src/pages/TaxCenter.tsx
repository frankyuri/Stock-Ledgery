import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  ShieldCheck,
  Receipt,
  Scale,
  Sparkles,
  Info,
  Globe2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { fetchChartBundle } from '@/services/stocks';
import { calculatePortfolioDividends } from '@/lib/dividendForecast';
import {
  analyzeSecondGenNHI,
  analyzeTaiwanDividendTaxStrategy,
  analyzeUSWithholdingTax,
  analyzeOverseasIncomeAMT,
  TAIWAN_TAX_BRACKETS,
  isTaiwanStock,
} from '@/lib/taxAnalytics';
import { formatNumber, formatShares } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/hooks/useCurrency';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';
import type { ChartBundle } from '@/services/yahoo';
import type { DividendEvent, Quote } from '@/types/stock';

type TaxTab = 'ALL' | 'NHI' | 'TW_INCOME' | 'US_WITHHOLDING' | 'OVERSEAS_AMT';

export function TaxCenter() {
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
  const { fxRate } = useCurrency();
  const [activeTab, setActiveTab] = useState<TaxTab>('ALL');
  const [selectedMarginalRate, setSelectedMarginalRate] = useState<number>(0.12); // 預設 12% 級距

  // 抓取各持股的完整行情與配息資訊
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);

  const { data: chartBundles } = useQuery({
    queryKey: ['portfolio-tax-bundles', symbols.sort().join(',')],
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

  // 計算整體股息概況
  const dividendOverview = useMemo(() => {
    if (!chartBundles || holdings.length === 0) return null;

    const quotesMap = new Map<string, Quote>();
    const dividendsMap = new Map<string, DividendEvent[]>();

    for (const [sym, bundle] of Object.entries(chartBundles)) {
      if (bundle.quote) quotesMap.set(sym, bundle.quote);
      if (bundle.dividends) dividendsMap.set(sym, bundle.dividends);
    }

    return calculatePortfolioDividends(
      holdings,
      transactions,
      quotesMap,
      dividendsMap,
    );
  }, [holdings, transactions, chartBundles]);

  // 1. 二代健保試算
  const nhiReport = useMemo(() => {
    if (!dividendOverview) return null;
    return analyzeSecondGenNHI(dividendOverview.items);
  }, [dividendOverview]);

  // 2. 綜所稅 8.5% 抵減 vs 28% 分開計稅
  const twTaxReport = useMemo(() => {
    const twDiv = nhiReport ? nhiReport.totalTaiwanAnnualDividend : 0;
    return analyzeTaiwanDividendTaxStrategy(twDiv, selectedMarginalRate);
  }, [nhiReport, selectedMarginalRate]);

  // 3. 美股 30% 預扣稅與 UCITS
  const usTaxReport = useMemo(() => {
    if (!dividendOverview) return null;
    const usItems = dividendOverview.items.filter((h) => !isTaiwanStock(h.symbol));
    const totalUSD = usItems.reduce((acc, h) => acc + h.estimatedAnnualIncome, 0);
    return analyzeUSWithholdingTax(totalUSD, fxRate);
  }, [dividendOverview, fxRate]);

  // 4. 海外所得最低稅負制 (AMT)
  const amtReport = useMemo(() => {
    let realizedOverseasGain = 0;
    for (const t of transactions) {
      if (!isTaiwanStock(t.symbol) && t.type === 'SELL' && t.realizedGainLoss) {
        // 美元交易折合台幣（依全域即時匯率）
        realizedOverseasGain += t.realizedGainLoss * fxRate;
      }
    }
    const usDivTWD = usTaxReport ? usTaxReport.grossDividendTWD : 0;
    return analyzeOverseasIncomeAMT(realizedOverseasGain, usDivTWD);
  }, [transactions, usTaxReport, fxRate]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
              <Receipt className="h-6 w-6 text-brand" />
              台美雙市場稅務與二代健保試算中心
            </h1>
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/30">
              Tax Optimizer
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
            精算台股二代健保補充保費（2.11%）避稅拆單、綜所稅 8.5% 抵減最佳化、美股 30% 預扣稅與全球海外所得 750 萬安全監控。
          </p>
        </div>

        {/* Tab Filters & Currency Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <CurrencyToggle />
          <div className="inline-flex rounded-xl border border-black/10 bg-white/70 p-1 dark:border-white/10 dark:bg-zinc-800/70 text-xs">
            {[
              { id: 'ALL', label: '全景面板' },
              { id: 'NHI', label: '二代健保 (2.11%)' },
              { id: 'TW_INCOME', label: '台股股利報稅' },
              { id: 'US_WITHHOLDING', label: '美股預扣與UCITS' },
              { id: 'OVERSEAS_AMT', label: '海外所得 750萬' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TaxTab)}
                className={cn(
                  'rounded-lg px-3 py-1.5 font-medium transition',
                  activeTab === tab.id
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 4 Key Indicator Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: NHI */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="label-caps flex items-center gap-1.5 text-ink-mute dark:text-zinc-400">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              預估二代健保扣繳
            </span>
            {nhiReport && nhiReport.triggeredCount > 0 ? (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-500">
                {nhiReport.triggeredCount} 檔踩雷
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                安全無扣繳
              </span>
            )}
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-ink dark:text-zinc-100 num">
            NT$ {formatNumber(nhiReport?.totalAnnualTax ?? 0)}
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
            {nhiReport && nhiReport.triggeredCount > 0
              ? '單筆配息達 20,000 元，將自動由股務扣繳 2.11%'
              : '目前各檔台股單次配息均在 20,000 元安全門檻內'}
          </p>
        </div>

        {/* Card 2: TW Income Tax */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="label-caps flex items-center gap-1.5 text-ink-mute dark:text-zinc-400">
              <Scale className="h-4 w-4 text-brand" />
              綜所稅最佳策略
            </span>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
              {twTaxReport.recommendedStrategy === 'CONSOLIDATED' ? '推薦合併計稅' : '推薦分開計稅'}
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-emerald-500 num">
            {twTaxReport.consolidated.netTax < 0 ? '享退稅 ' : '稅負差額 '}
            NT$ {formatNumber(twTaxReport.taxDifference)}
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
            {twTaxReport.consolidated.netTax < 0
              ? '8.5% 抵減稅額大於邊際稅率，具實質退稅效應'
              : '依您設定之綜合所得淨額級距試算最省稅方案'}
          </p>
        </div>

        {/* Card 3: US Withholding Tax */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="label-caps flex items-center gap-1.5 text-ink-mute dark:text-zinc-400">
              <Globe2 className="h-4 w-4 text-sky-500" />
              美股 30% 預扣稅拖累
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-500">
              IRS Withholding
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-ink dark:text-zinc-100 num">
            ${formatNumber(usTaxReport?.usTaxWithheldUSD ?? 0)}
            <span className="text-xs font-normal text-ink-mute dark:text-zinc-400 ml-1.5">
              (≈ NT$ {formatNumber(usTaxReport?.usTaxWithheldTWD ?? 0)})
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
            轉投愛爾蘭 UCITS ETF 每年可保留約 NT$ {formatNumber(usTaxReport?.ucitsAnnualSavingsTWD ?? 0)}
          </p>
        </div>

        {/* Card 4: Overseas Income AMT */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="label-caps flex items-center gap-1.5 text-ink-mute dark:text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              海外所得 750 萬安全額
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                amtReport.status === 'EXEMPT'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : amtReport.status === 'REPORT_ONLY_ZERO_TAX'
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-rose-500/10 text-rose-500',
              )}
            >
              {amtReport.status === 'EXEMPT'
                ? '免申報'
                : amtReport.status === 'REPORT_ONLY_ZERO_TAX'
                ? '申報但免稅'
                : '超出免稅額'}
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-ink dark:text-zinc-100 num">
            NT$ {formatNumber(amtReport.safetyBufferTWD)}
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
            離 2024 最低稅負制 750 萬門檻尚有安全裕度
          </p>
        </div>
      </div>

      {/* Section 1: 二代健保補充保費 (2.11%) 警戒雷達 */}
      {(activeTab === 'ALL' || activeTab === 'NHI') && (
        <section className="card overflow-hidden">
          <div className="card-header flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <h3 className="section-title">台股二代健保補充保費（2.11%）警戒雷達</h3>
              </div>
              <p className="section-hint">
                依健保法規，台股單筆股利總額達 NT$ 20,000 元（含）以上時，由發放公司直接扣繳 2.11% 補充保費。
              </p>
            </div>

            {nhiReport && nhiReport.triggeredCount > 0 && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>偵測到 {nhiReport.triggeredCount} 檔持股觸發扣繳，可參考右側建議進行避稅拆單</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black/5 dark:divide-white/10 text-sm font-sans">
              <thead>
                <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    標的名稱
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    持有股數
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    配息頻率
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    預估單次股息
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    扣繳狀態
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    單次扣繳 (2.11%)
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    全年預計被扣
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                    智慧避稅 / 調節建議
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono">
                {nhiReport && nhiReport.items.length > 0 ? (
                  nhiReport.items.map((item) => (
                    <tr
                      key={item.symbol}
                      className={cn(
                        'transition',
                        item.isTriggered
                          ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.06]'
                          : item.isNearLimit
                          ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]'
                          : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                      )}
                    >
                      <td className="px-5 py-3 text-left font-sans">
                        <div className="font-bold text-ink dark:text-zinc-100">{item.symbol}</div>
                        <div className="text-xs text-ink-mute dark:text-zinc-400">{item.name}</div>
                      </td>
                      <td className="px-5 py-3 text-right text-ink dark:text-zinc-200">
                        {formatShares(item.shares)}
                      </td>
                      <td className="px-5 py-3 text-center font-sans text-xs">
                        <span className="rounded-md bg-black/5 px-2 py-0.5 font-medium dark:bg-white/5 text-ink-soft dark:text-zinc-300">
                          {item.frequency}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-ink dark:text-zinc-100">
                        NT$ {formatNumber(item.dividendPerPayout)}
                      </td>
                      <td className="px-5 py-3 text-center font-sans">
                        {item.isTriggered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-500">
                            <AlertTriangle className="h-3 w-3" />
                            超過 2 萬門檻
                          </span>
                        ) : item.isNearLimit ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                            接近門檻 (80%+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
                            安全 (未達2萬)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-rose-500 font-semibold">
                        {item.nhiTaxPerPayout > 0 ? `-NT$ ${formatNumber(item.nhiTaxPerPayout)}` : '0'}
                      </td>
                      <td className="px-5 py-3 text-right text-rose-500 font-bold">
                        {item.annualTotalNhiTax > 0 ? `-NT$ ${formatNumber(item.annualTotalNhiTax)}` : '0'}
                      </td>
                      <td className="px-5 py-3 text-left font-sans text-xs">
                        {item.isTriggered ? (
                          <div className="space-y-1">
                            <span className="text-brand font-semibold">
                              💡 建議持有上限 {formatShares(item.maxSharesUnderLimit)} 股
                            </span>
                            <div className="text-[11px] text-ink-mute dark:text-zinc-400">
                              除息前調節 {formatShares(item.excessShares)} 股（或撥轉借券信託），可完全避開 2.11%，省下 NT$ {formatNumber(item.potentialSavings)}！
                            </div>
                          </div>
                        ) : item.isNearLimit ? (
                          <span className="text-amber-500">
                            再加碼或配息增加容易突破 2 萬門檻，除息前需留意
                          </span>
                        ) : (
                          <span className="text-emerald-500/80">
                            單次配息離 2 萬門檻尚有充裕空間，無須調節
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-ink-mute">
                      目前未持有台股標的或無預估配息資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 2: 台股綜合所得稅股利申報最佳化 */}
      {(activeTab === 'ALL' || activeTab === 'TW_INCOME') && (
        <section className="card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-brand" />
                <h3 className="section-title">台股綜合所得稅股利申報模式試算與推薦</h3>
              </div>
              <p className="section-hint">
                依所得稅法規定，股利申報可自選「合併計稅（享 8.5% 抵減，上限 8 萬）」或「28% 分開計稅」。
              </p>
            </div>

            {/* Bracket Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-ink-mute dark:text-zinc-400">
                預估個人綜所稅邊際稅率：
              </label>
              <select
                value={selectedMarginalRate}
                onChange={(e) => setSelectedMarginalRate(Number(e.target.value))}
                className="select py-1.5 px-3 text-xs font-semibold"
              >
                {TAIWAN_TAX_BRACKETS.map((b) => (
                  <option key={b.rate} value={b.rate}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Recommendation Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-brand flex items-center gap-2">
                PM 稅務推薦：
                {twTaxReport.recommendedStrategy === 'CONSOLIDATED'
                  ? '強烈建議採【方案甲：合併計稅】'
                  : '強烈建議採【方案乙：分開計稅 28%】'}
              </div>
              <p className="mt-1 text-xs text-ink-soft dark:text-zinc-300 leading-relaxed">
                {twTaxReport.recommendationExplanation}
              </p>
            </div>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Option A: Consolidated */}
            <div
              className={cn(
                'rounded-2xl border p-5 transition relative',
                twTaxReport.recommendedStrategy === 'CONSOLIDATED'
                  ? 'border-brand ring-2 ring-brand/20 bg-brand/[0.02]'
                  : 'border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-900/40',
              )}
            >
              {twTaxReport.recommendedStrategy === 'CONSOLIDATED' && (
                <span className="absolute -top-3 right-4 rounded-full bg-brand px-3 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  最佳省稅方案
                </span>
              )}
              <h4 className="text-base font-bold text-ink dark:text-zinc-100 flex items-center justify-between">
                <span>方案甲：股利合併計稅</span>
                <span className="text-xs font-mono font-normal text-ink-mute">
                  實質稅率：{twTaxReport.consolidated.effectiveRate}%
                </span>
              </h4>
              <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
                併入個人綜合所得總額，享有 8.5% 股利可抵減稅額（上限 8 萬元）
              </p>

              <div className="mt-4 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between text-ink-soft dark:text-zinc-300">
                  <span>台股全年預估股利總額</span>
                  <span>NT$ {formatNumber(twTaxReport.annualDividend)}</span>
                </div>
                <div className="flex justify-between text-ink-soft dark:text-zinc-300">
                  <span>應納股利所得稅 (稅率 {(selectedMarginalRate * 100).toFixed(0)}%)</span>
                  <span>NT$ {formatNumber(twTaxReport.consolidated.grossTax)}</span>
                </div>
                <div className="flex justify-between text-emerald-500 font-semibold">
                  <span>8.5% 股利可抵減稅額 (上限 8 萬)</span>
                  <span>-NT$ {formatNumber(twTaxReport.consolidated.taxCredit)}</span>
                </div>
                <div className="border-t border-black/10 dark:border-white/10 pt-2 flex justify-between font-bold text-sm">
                  <span>最終股利實質應納稅額</span>
                  <span
                    className={
                      twTaxReport.consolidated.netTax < 0 ? 'text-emerald-500' : 'text-ink dark:text-zinc-100'
                    }
                  >
                    {twTaxReport.consolidated.netTax < 0
                      ? `退稅 NT$ ${formatNumber(Math.abs(twTaxReport.consolidated.netTax))}`
                      : `NT$ ${formatNumber(twTaxReport.consolidated.netTax)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Option B: Separated */}
            <div
              className={cn(
                'rounded-2xl border p-5 transition relative',
                twTaxReport.recommendedStrategy === 'SEPARATED'
                  ? 'border-brand ring-2 ring-brand/20 bg-brand/[0.02]'
                  : 'border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-900/40',
              )}
            >
              {twTaxReport.recommendedStrategy === 'SEPARATED' && (
                <span className="absolute -top-3 right-4 rounded-full bg-brand px-3 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  最佳省稅方案
                </span>
              )}
              <h4 className="text-base font-bold text-ink dark:text-zinc-100 flex items-center justify-between">
                <span>方案乙：股利分開計稅 (28%)</span>
                <span className="text-xs font-mono font-normal text-ink-mute">
                  單一固定稅率：28.0%
                </span>
              </h4>
              <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
                股利不併入綜所總額，單獨依 28% 計算，不可抵減 8.5%
              </p>

              <div className="mt-4 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between text-ink-soft dark:text-zinc-300">
                  <span>台股全年預估股利總額</span>
                  <span>NT$ {formatNumber(twTaxReport.annualDividend)}</span>
                </div>
                <div className="flex justify-between text-ink-soft dark:text-zinc-300">
                  <span>固定稅率 28%</span>
                  <span>28%</span>
                </div>
                <div className="flex justify-between text-ink-faint">
                  <span>8.5% 可抵減稅額</span>
                  <span>不適用 (0)</span>
                </div>
                <div className="border-t border-black/10 dark:border-white/10 pt-2 flex justify-between font-bold text-sm">
                  <span>最終股利實質應納稅額</span>
                  <span className="text-ink dark:text-zinc-100">
                    NT$ {formatNumber(twTaxReport.separated.netTax)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section 3 & 4: 美股預扣稅 + 海外所得 AMT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 3: 美股 30% 預扣稅拖累與 UCITS 愛爾蘭 ETF 轉投效益 */}
        {(activeTab === 'ALL' || activeTab === 'US_WITHHOLDING') && (
          <section className="card p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-sky-500" />
                <h3 className="section-title">美股 30% 預扣稅與 UCITS 潛在省稅效益</h3>
              </div>
              <p className="section-hint">
                非美籍人士投資美股股票/ETF 需被預扣 30% 股息稅；愛爾蘭註冊 UCITS ETF 享美愛租稅協定僅 15% 預扣。
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-ink-mute dark:text-zinc-400">美股預估年度總股息</span>
                <span className="font-bold text-ink dark:text-zinc-100">
                  ${formatNumber(usTaxReport?.grossDividendUSD ?? 0)} USD
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono text-rose-500">
                <span>美國國稅局 (IRS) 30% 預扣稅</span>
                <span>-${formatNumber(usTaxReport?.usTaxWithheldUSD ?? 0)} USD</span>
              </div>
              <div className="border-t border-sky-500/20 pt-2 flex justify-between text-xs font-mono font-bold text-emerald-500">
                <span>實際入帳現金 (70%)</span>
                <span>${formatNumber(usTaxReport?.netDividendReceivedUSD ?? 0)} USD</span>
              </div>
            </div>

            {/* UCITS Comparison Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-500 dark:text-sky-400">
                <Lightbulb className="h-4 w-4" />
                UCITS ETF (如 VWRA / VUAA) 複利省稅試算
              </div>
              <p className="text-xs text-ink-mute dark:text-zinc-400 leading-relaxed">
                若將同類指數標的改持愛爾蘭註冊 UCITS ETF，每年可少被扣 15% 股息：
              </p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-black/[0.04] p-2.5 dark:bg-black/30">
                  <div className="text-[11px] text-ink-mute">10 年複利增加資產</div>
                  <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    +NT$ {formatNumber(usTaxReport?.tenYearCompoundSavingsTWD ?? 0)}
                  </div>
                </div>
                <div className="rounded-lg bg-black/[0.04] p-2.5 dark:bg-black/30">
                  <div className="text-[11px] text-ink-mute">20 年複利增加資產</div>
                  <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    +NT$ {formatNumber(usTaxReport?.twentyYearCompoundSavingsTWD ?? 0)}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section 4: 全球海外所得最低稅負制 (750 萬) 進度監控 */}
        {(activeTab === 'ALL' || activeTab === 'OVERSEAS_AMT') && (
          <section className="card p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <h3 className="section-title">全球海外所得最低稅負制 (AMT) 進度監控</h3>
              </div>
              <p className="section-hint">
                全年海外所得達 NT$ 100 萬需申報；2024 年起個人基本免稅額調升至 NT$ 750 萬，超過部分課徵 20% 基本稅額。
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-ink-soft dark:text-zinc-300">
                  本年度海外所得累計進度
                </span>
                <span className="font-mono font-bold text-ink dark:text-zinc-100">
                  NT$ {formatNumber(amtReport.totalOverseasIncomeTWD)} / 750 萬 ({amtReport.safetyPercentage}%)
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500 rounded-full',
                    amtReport.safetyPercentage < 50
                      ? 'bg-emerald-500'
                      : amtReport.safetyPercentage < 80
                      ? 'bg-amber-500'
                      : 'bg-rose-500',
                  )}
                  style={{ width: `${Math.max(4, amtReport.safetyPercentage)}%` }}
                />
              </div>
            </div>

            {/* Threshold Breakdowns */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between text-ink-soft dark:text-zinc-300">
                <span>美股已實現獲利 (折合台幣)</span>
                <span>NT$ {formatNumber(amtReport.realizedOverseasGainTWD)}</span>
              </div>
              <div className="flex justify-between text-ink-soft dark:text-zinc-300">
                <span>美股年度股利收入 (折合台幣)</span>
                <span>NT$ {formatNumber(amtReport.usAnnualDividendTWD)}</span>
              </div>
              <div className="border-t border-black/10 dark:border-white/10 pt-2 flex justify-between font-bold text-sm">
                <span>本年度海外總所得</span>
                <span className="text-ink dark:text-zinc-100">
                  NT$ {formatNumber(amtReport.totalOverseasIncomeTWD)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-ink-soft dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-zinc-100">法定門檻診斷：</span>
                {amtReport.statusLabel}
                {amtReport.amtTaxDue > 0 && (
                  <div className="mt-1 font-bold text-rose-400">
                    預估應納基本稅額：NT$ {formatNumber(amtReport.amtTaxDue)}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
