import type { DividendEvent, Holding, Quote, Transaction } from '@/types/stock';
import { computeDividendStats, type DividendStats } from './dividends';

export interface HoldingDividendAnalysis {
  symbol: string;
  name: string;
  currency: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  cost: number;
  trailing12mPerShare: number;
  estimatedAnnualIncome: number;
  currentYield: number; // %
  yieldOnCost: number; // %
  payoutFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'UNKNOWN';
  payoutMonths: number[]; // 1-12
  stats: DividendStats;
}

export interface MonthlyForecastItem {
  month: number; // 1-12
  monthLabel: string; // e.g. "1月", "2月"
  projectedIncome: number;
  holdings: {
    symbol: string;
    shares: number;
    amountPerShare: number;
    estimatedIncome: number;
  }[];
}

export interface PortfolioDividendOverview {
  totalAnnualIncome: number;
  avgMonthlyIncome: number;
  totalMarketValue: number;
  totalCost: number;
  weightedCurrentYield: number;
  weightedYieldOnCost: number;
  totalHistoricalDividends: number;
  monthlyForecast: MonthlyForecastItem[];
  items: HoldingDividendAnalysis[];
}

const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

/**
 * 依歷史除息日推估配息頻率與配息月份
 */
export function detectPayoutPattern(dividends: DividendEvent[]): {
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'UNKNOWN';
  months: number[];
} {
  if (dividends.length === 0) {
    return { frequency: 'UNKNOWN', months: [] };
  }

  // 抓出過去 24 個月內的除息紀錄，若少於 2 筆則採全部紀錄中的最新幾筆
  const now = new Date();
  const cutoff = new Date();
  cutoff.setMonth(now.getMonth() - 24);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = dividends.filter((d) => d.date >= cutoffStr);
  const targetList = recent.length >= 2 ? recent : dividends.slice(-6);

  const monthSet = new Set<number>();
  for (const d of targetList) {
    const m = parseInt(d.date.slice(5, 7), 10);
    if (!isNaN(m) && m >= 1 && m <= 12) {
      monthSet.add(m);
    }
  }

  const months = Array.from(monthSet).sort((a, b) => a - b);
  const count = months.length;

  if (count >= 10) return { frequency: 'MONTHLY', months };
  if (count >= 3 && count <= 5) return { frequency: 'QUARTERLY', months };
  if (count === 2) return { frequency: 'SEMI_ANNUAL', months };
  if (count === 1) return { frequency: 'ANNUAL', months };
  return { frequency: 'UNKNOWN', months };
}

/**
 * 計算整個投資組合的股息現金流分析
 */
export function calculatePortfolioDividends(
  holdings: Holding[],
  transactions: Transaction[],
  quotesMap: Map<string, Quote>,
  dividendsMap: Map<string, DividendEvent[]>,
): PortfolioDividendOverview {
  let totalAnnualIncome = 0;
  let totalMarketValue = 0;
  let totalCost = 0;
  let totalHistoricalDividends = 0;

  const monthlyBuckets: {
    [key: number]: MonthlyForecastItem;
  } = {};

  for (let m = 1; m <= 12; m++) {
    monthlyBuckets[m] = {
      month: m,
      monthLabel: MONTH_LABELS[m - 1],
      projectedIncome: 0,
      holdings: [],
    };
  }

  const items: HoldingDividendAnalysis[] = [];

  for (const h of holdings) {
    const symbol = h.symbol;
    const q = quotesMap.get(symbol);
    const divs = dividendsMap.get(symbol) ?? [];
    const stats = computeDividendStats(symbol, transactions, divs);

    const price = q?.price ?? h.avgCost;
    const shares = h.shares;
    const avgCost = h.avgCost;
    const marketValue = round(shares * price);
    const cost = round(shares * avgCost);

    const trailing12m = stats.trailing12mPerShare;
    const estimatedAnnual = round(trailing12m * shares);

    const currentYield = price > 0 ? round((trailing12m / price) * 100) : 0;
    const yieldOnCost = avgCost > 0 ? round((trailing12m / avgCost) * 100) : 0;

    totalAnnualIncome += estimatedAnnual;
    totalMarketValue += marketValue;
    totalCost += cost;
    totalHistoricalDividends += stats.totalIncome;

    const pattern = detectPayoutPattern(divs);

    // 分攤至月份預測
    if (estimatedAnnual > 0) {
      let activeMonths = pattern.months;
      if (activeMonths.length === 0) {
        // 若歷史無完整月份資訊，預設採季配息（3, 6, 9, 12月）
        activeMonths = [3, 6, 9, 12];
      }

      const payoutPerEvent = estimatedAnnual / activeMonths.length;
      const amountPerShare = trailing12m / activeMonths.length;

      for (const m of activeMonths) {
        if (monthlyBuckets[m]) {
          monthlyBuckets[m].projectedIncome = round(
            monthlyBuckets[m].projectedIncome + payoutPerEvent,
          );
          monthlyBuckets[m].holdings.push({
            symbol,
            shares,
            amountPerShare: round(amountPerShare, 4),
            estimatedIncome: round(payoutPerEvent),
          });
        }
      }
    }

    items.push({
      symbol,
      name: q?.name ?? symbol,
      currency: q?.currency ?? (symbol.endsWith('.TW') ? 'TWD' : 'USD'),
      shares,
      avgCost,
      currentPrice: price,
      marketValue,
      cost,
      trailing12mPerShare: trailing12m,
      estimatedAnnualIncome: estimatedAnnual,
      currentYield,
      yieldOnCost,
      payoutFrequency: pattern.frequency,
      payoutMonths: pattern.months,
      stats,
    });
  }

  // 排序持股：預估年配息由大到小
  items.sort((a, b) => b.estimatedAnnualIncome - a.estimatedAnnualIncome);

  const monthlyForecast = Object.values(monthlyBuckets);

  const weightedCurrentYield =
    totalMarketValue > 0
      ? round((totalAnnualIncome / totalMarketValue) * 100)
      : 0;

  const weightedYieldOnCost =
    totalCost > 0 ? round((totalAnnualIncome / totalCost) * 100) : 0;

  return {
    totalAnnualIncome: round(totalAnnualIncome),
    avgMonthlyIncome: round(totalAnnualIncome / 12),
    totalMarketValue: round(totalMarketValue),
    totalCost: round(totalCost),
    weightedCurrentYield,
    weightedYieldOnCost,
    totalHistoricalDividends: round(totalHistoricalDividends),
    monthlyForecast,
    items,
  };
}

function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
