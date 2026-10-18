import type { HoldingDividendAnalysis } from './dividendForecast';

// 台灣與美國稅務相關基準常數
export const NHI_SECOND_GEN_THRESHOLD = 20_000; // 單筆扣繳門檻 NT$ 20,000
export const NHI_SECOND_GEN_RATE = 0.0211; // 2.11%
export const NHI_MAX_PER_PAYOUT = 10_000_000; // 單筆扣繳上限 NT$ 10,000,000

export const TW_DIVIDEND_TAX_CREDIT_RATE = 0.085; // 8.5% 可抵減稅額
export const TW_DIVIDEND_TAX_CREDIT_CAP = 80_000; // 每一申報戶上限 NT$ 80,000
export const TW_DIVIDEND_SEPARATE_RATE = 0.28; // 28% 分開計稅

export const US_WITHHOLDING_TAX_RATE = 0.3; // 美股 30% 股息預扣稅
export const UCITS_WITHHOLDING_TAX_RATE = 0.15; // 愛爾蘭 UCITS ETF 15% 預扣稅

export const OVERSEAS_INCOME_DECLARATION_THRESHOLD = 1_000_000; // 申報門檻 NT$ 100 萬
export const OVERSEAS_INCOME_AMT_EXEMPTION = 7_500_000; // 2024起最低稅負制免稅額 NT$ 750 萬
export const AMT_TAX_RATE = 0.2; // 20% 基本稅額

export interface SecondGenNHIItem {
  symbol: string;
  name: string;
  shares: number;
  frequency: string;
  payoutCount: number;
  dividendPerPayout: number; // 預估單次給付股利
  annualDividend: number;
  isTriggered: boolean; // 是否超過 20,000
  isNearLimit: boolean; // 是否在 16,000 ~ 19,999 警示區
  nhiTaxPerPayout: number; // 單次扣繳 2.11%
  annualTotalNhiTax: number; // 全年預計被扣總額
  maxSharesUnderLimit: number; // 剛好在 19,999 以下的安全股數
  excessShares: number; // 建議調節股數
  potentialSavings: number; // 建議調節後可省下之補充保費
}

export interface SecondGenNHIReport {
  items: SecondGenNHIItem[];
  totalAnnualTax: number;
  triggeredCount: number;
  nearLimitCount: number;
  totalTaiwanAnnualDividend: number;
}

export interface TaiwanDividendTaxBracketOption {
  rate: number;
  label: string;
}

export const TAIWAN_TAX_BRACKETS: TaiwanDividendTaxBracketOption[] = [
  { rate: 0.05, label: '5% (所得淨額 0 ~ 59 萬)' },
  { rate: 0.12, label: '12% (所得淨額 59 ~ 133 萬)' },
  { rate: 0.2, label: '20% (所得淨額 133 ~ 266 萬)' },
  { rate: 0.3, label: '30% (所得淨額 266 ~ 498 萬)' },
  { rate: 0.4, label: '40% (所得淨額 498 萬以上)' },
];

export interface TaiwanDividendTaxStrategyReport {
  annualDividend: number;
  marginalRate: number;
  // 方案甲：合併計稅
  consolidated: {
    grossTax: number;
    taxCredit: number; // 8.5% (上限 8 萬)
    netTax: number; // 若小於 0 則代表實質退稅！
    effectiveRate: number; // 實質稅率 %
  };
  // 方案乙：分開計稅 (28%)
  separated: {
    grossTax: number;
    netTax: number;
    effectiveRate: number;
  };
  recommendedStrategy: 'CONSOLIDATED' | 'SEPARATED';
  taxDifference: number; // 選擇最佳方案可省下或多退的金額
  recommendationExplanation: string;
}

export interface USWithholdingTaxReport {
  grossDividendUSD: number;
  grossDividendTWD: number;
  usTaxWithheldUSD: number;
  usTaxWithheldTWD: number;
  netDividendReceivedUSD: number;
  netDividendReceivedTWD: number;
  // UCITS 對比
  ucitsTaxWithheldUSD: number;
  ucitsAnnualSavingsUSD: number;
  ucitsAnnualSavingsTWD: number;
  tenYearCompoundSavingsTWD: number; // 10年複利差異 (假設 7% 年化)
  twentyYearCompoundSavingsTWD: number; // 20年複利差異
}

export interface OverseasIncomeAMTReport {
  realizedOverseasGainTWD: number;
  usAnnualDividendTWD: number;
  totalOverseasIncomeTWD: number;
  status: 'EXEMPT' | 'REPORT_ONLY_ZERO_TAX' | 'TAXABLE_AMT';
  statusLabel: string;
  declarationRequired: boolean; // 是否需要申報 (達 100 萬)
  amtTaxableAmount: number; // 超過 750 萬的所得部分
  amtTaxDue: number; // 應納基本稅額 (20%)
  safetyBufferTWD: number; // 離 750 萬門檻還差多少
  safetyPercentage: number; // 0% ~ 100%+
}

export interface PortfolioTaxOptimizationOverview {
  nhiReport: SecondGenNHIReport;
  twTaxReport: TaiwanDividendTaxStrategyReport;
  usTaxReport: USWithholdingTaxReport;
  amtReport: OverseasIncomeAMTReport;
}

/**
 * 判斷是否為台股標的
 */
export function isTaiwanStock(symbol: string): boolean {
  const norm = symbol.trim().toUpperCase();
  return (
    norm.endsWith('.TW') ||
    norm.endsWith('.TWO') ||
    /^\d{4,6}$/.test(norm)
  );
}

/**
 * 試算台股二代健保補充保費 (2.11%)
 */
export function analyzeSecondGenNHI(
  holdings: HoldingDividendAnalysis[],
): SecondGenNHIReport {
  const twHoldings = holdings.filter((h) => isTaiwanStock(h.symbol));

  const items: SecondGenNHIItem[] = [];
  let totalAnnualTax = 0;
  let triggeredCount = 0;
  let nearLimitCount = 0;
  let totalTaiwanAnnualDividend = 0;

  for (const h of twHoldings) {
    if (h.shares <= 0 || h.estimatedAnnualIncome <= 0) continue;

    totalTaiwanAnnualDividend += h.estimatedAnnualIncome;

    let payoutCount = 1;
    let freqLabel = '年配';
    if (h.payoutFrequency === 'MONTHLY') {
      payoutCount = 12;
      freqLabel = '月配';
    } else if (h.payoutFrequency === 'QUARTERLY') {
      payoutCount = 4;
      freqLabel = '季配';
    } else if (h.payoutFrequency === 'SEMI_ANNUAL') {
      payoutCount = 2;
      freqLabel = '半年配';
    }

    const dividendPerPayout = h.estimatedAnnualIncome / payoutCount;
    const isTriggered = dividendPerPayout >= NHI_SECOND_GEN_THRESHOLD;
    const isNearLimit =
      !isTriggered && dividendPerPayout >= NHI_SECOND_GEN_THRESHOLD * 0.8;

    let nhiTaxPerPayout = 0;
    let annualTotalNhiTax = 0;
    let maxSharesUnderLimit = h.shares;
    let excessShares = 0;
    let potentialSavings = 0;

    if (isTriggered) {
      triggeredCount++;
      const taxableAmount = Math.min(dividendPerPayout, NHI_MAX_PER_PAYOUT);
      nhiTaxPerPayout = Math.round(taxableAmount * NHI_SECOND_GEN_RATE);
      annualTotalNhiTax = nhiTaxPerPayout * payoutCount;
      totalAnnualTax += annualTotalNhiTax;

      // 剛好在 19,999 元以下的股數
      const dividendPerSharePerPayout = dividendPerPayout / h.shares;
      if (dividendPerSharePerPayout > 0) {
        maxSharesUnderLimit = Math.floor(
          (NHI_SECOND_GEN_THRESHOLD - 1) / dividendPerSharePerPayout,
        );
        excessShares = Math.max(0, h.shares - maxSharesUnderLimit);
        potentialSavings = annualTotalNhiTax;
      }
    } else if (isNearLimit) {
      nearLimitCount++;
    }

    items.push({
      symbol: h.symbol,
      name: h.name || h.symbol,
      shares: h.shares,
      frequency: freqLabel,
      payoutCount,
      dividendPerPayout: Math.round(dividendPerPayout),
      annualDividend: Math.round(h.estimatedAnnualIncome),
      isTriggered,
      isNearLimit,
      nhiTaxPerPayout,
      annualTotalNhiTax,
      maxSharesUnderLimit,
      excessShares,
      potentialSavings,
    });
  }

  // 排序：先排踩雷的（依被扣稅金額大到小），再排即將踩雷的
  items.sort((a, b) => b.annualTotalNhiTax - a.annualTotalNhiTax || b.dividendPerPayout - a.dividendPerPayout);

  return {
    items,
    totalAnnualTax,
    triggeredCount,
    nearLimitCount,
    totalTaiwanAnnualDividend,
  };
}

/**
 * 試算台股綜合所得稅股利申報最佳化 (合併 8.5% 抵減 vs 分開 28% 單一稅率)
 */
export function analyzeTaiwanDividendTaxStrategy(
  annualDividend: number,
  marginalRate: number = 0.12,
): TaiwanDividendTaxStrategyReport {
  if (annualDividend <= 0) {
    return {
      annualDividend: 0,
      marginalRate,
      consolidated: { grossTax: 0, taxCredit: 0, netTax: 0, effectiveRate: 0 },
      separated: { grossTax: 0, netTax: 0, effectiveRate: 0 },
      recommendedStrategy: 'CONSOLIDATED',
      taxDifference: 0,
      recommendationExplanation: '目前尚無台股股息收入。',
    };
  }

  // 1. 合併計稅
  const consolidatedGross = annualDividend * marginalRate;
  const taxCredit = Math.min(
    annualDividend * TW_DIVIDEND_TAX_CREDIT_RATE,
    TW_DIVIDEND_TAX_CREDIT_CAP,
  );
  const consolidatedNet = Math.round(consolidatedGross - taxCredit);
  const consolidatedEffectiveRate = (consolidatedNet / annualDividend) * 100;

  // 2. 分開計稅 (28%)
  const separatedNet = Math.round(annualDividend * TW_DIVIDEND_SEPARATE_RATE);
  const separatedEffectiveRate = TW_DIVIDEND_SEPARATE_RATE * 100;

  const isConsolidatedBetter = consolidatedNet <= separatedNet;
  const taxDifference = Math.abs(separatedNet - consolidatedNet);

  let explanation = '';
  if (isConsolidatedBetter) {
    if (consolidatedNet < 0) {
      explanation = `因您的綜所稅邊際稅率為 ${(marginalRate * 100).toFixed(0)}%，低於股利抵減率 8.5%，合併計稅不僅免繳股利稅，還可產生 NT$ ${Math.abs(consolidatedNet).toLocaleString()} 的退稅款！`;
    } else {
      explanation = `合併計稅享有 8.5% 抵減稅額，實質有效稅率僅 ${consolidatedEffectiveRate.toFixed(1)}%，相較 28% 分開計稅每年可多保留 NT$ ${taxDifference.toLocaleString()} 資金。`;
    }
  } else {
    explanation = `因您的所得淨額級距較高（邊際稅率高於 28%），採分開計稅（單一稅率 28%）較划算，相較合併計稅每年可節省 NT$ ${taxDifference.toLocaleString()} 稅負。`;
  }

  return {
    annualDividend,
    marginalRate,
    consolidated: {
      grossTax: Math.round(consolidatedGross),
      taxCredit: Math.round(taxCredit),
      netTax: consolidatedNet,
      effectiveRate: Math.round(consolidatedEffectiveRate * 10) / 10,
    },
    separated: {
      grossTax: separatedNet,
      netTax: separatedNet,
      effectiveRate: separatedEffectiveRate,
    },
    recommendedStrategy: isConsolidatedBetter ? 'CONSOLIDATED' : 'SEPARATED',
    taxDifference,
    recommendationExplanation: explanation,
  };
}

/**
 * 試算美股 30% 股息預扣稅與 UCITS 潛在省稅複利效益
 */
export function analyzeUSWithholdingTax(
  grossDividendUSD: number,
  usdToTwdRate: number = 32.0,
): USWithholdingTaxReport {
  const grossUSD = Math.max(0, grossDividendUSD);
  const grossTWD = Math.round(grossUSD * usdToTwdRate);

  const usTaxWithheldUSD = grossUSD * US_WITHHOLDING_TAX_RATE;
  const usTaxWithheldTWD = Math.round(usTaxWithheldUSD * usdToTwdRate);

  const netDividendReceivedUSD = grossUSD - usTaxWithheldUSD;
  const netDividendReceivedTWD = Math.round(netDividendReceivedUSD * usdToTwdRate);

  // 愛爾蘭註冊 UCITS ETF (15% 預扣)
  const ucitsTaxWithheldUSD = grossUSD * UCITS_WITHHOLDING_TAX_RATE;
  const ucitsAnnualSavingsUSD = usTaxWithheldUSD - ucitsTaxWithheldUSD;
  const ucitsAnnualSavingsTWD = Math.round(ucitsAnnualSavingsUSD * usdToTwdRate);

  // 10年與20年複利成長差距 (FV of Annuity, 年化 7% 複利再投資)
  // FV = Pmt * (((1 + r)^n - 1) / r)
  const r = 0.07;
  const fv10Multiplier = (Math.pow(1 + r, 10) - 1) / r;
  const fv20Multiplier = (Math.pow(1 + r, 20) - 1) / r;

  const tenYearCompoundSavingsTWD = Math.round(ucitsAnnualSavingsTWD * fv10Multiplier);
  const twentyYearCompoundSavingsTWD = Math.round(ucitsAnnualSavingsTWD * fv20Multiplier);

  return {
    grossDividendUSD: Math.round(grossUSD * 100) / 100,
    grossDividendTWD: grossTWD,
    usTaxWithheldUSD: Math.round(usTaxWithheldUSD * 100) / 100,
    usTaxWithheldTWD,
    netDividendReceivedUSD: Math.round(netDividendReceivedUSD * 100) / 100,
    netDividendReceivedTWD,
    ucitsTaxWithheldUSD: Math.round(ucitsTaxWithheldUSD * 100) / 100,
    ucitsAnnualSavingsUSD: Math.round(ucitsAnnualSavingsUSD * 100) / 100,
    ucitsAnnualSavingsTWD,
    tenYearCompoundSavingsTWD,
    twentyYearCompoundSavingsTWD,
  };
}

/**
 * 試算台灣海外所得最低稅負制 (AMT)
 */
export function analyzeOverseasIncomeAMT(
  realizedOverseasGainTWD: number,
  usAnnualDividendTWD: number,
): OverseasIncomeAMTReport {
  const total = Math.max(0, realizedOverseasGainTWD) + Math.max(0, usAnnualDividendTWD);

  let status: OverseasIncomeAMTReport['status'] = 'EXEMPT';
  let statusLabel = '免計入基本所得額 (全年海外所得未達 100 萬)';
  let declarationRequired = false;
  let amtTaxableAmount = 0;
  let amtTaxDue = 0;

  if (total >= OVERSEAS_INCOME_DECLARATION_THRESHOLD) {
    declarationRequired = true;
    if (total > OVERSEAS_INCOME_AMT_EXEMPTION) {
      status = 'TAXABLE_AMT';
      amtTaxableAmount = total - OVERSEAS_INCOME_AMT_EXEMPTION;
      amtTaxDue = Math.round(amtTaxableAmount * AMT_TAX_RATE);
      statusLabel = '超出 750 萬基本免稅額，超出部分適用 20% 基本稅額';
    } else {
      status = 'REPORT_ONLY_ZERO_TAX';
      statusLabel = '達 100 萬需申報，但未超過 750 萬免稅額，無須繳納基本稅額';
    }
  }

  const safetyBufferTWD = Math.max(0, OVERSEAS_INCOME_AMT_EXEMPTION - total);
  const safetyPercentage = Math.min(100, Math.round((total / OVERSEAS_INCOME_AMT_EXEMPTION) * 100));

  return {
    realizedOverseasGainTWD: Math.round(realizedOverseasGainTWD),
    usAnnualDividendTWD: Math.round(usAnnualDividendTWD),
    totalOverseasIncomeTWD: Math.round(total),
    status,
    statusLabel,
    declarationRequired,
    amtTaxableAmount: Math.round(amtTaxableAmount),
    amtTaxDue,
    safetyBufferTWD: Math.round(safetyBufferTWD),
    safetyPercentage,
  };
}
