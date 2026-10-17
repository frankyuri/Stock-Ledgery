export interface TargetAllocationItem {
  symbol: string;
  name?: string;
  targetWeight: number; // 百分比，例如 30 代表 30%
}

export interface RebalancePreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  allocations: TargetAllocationItem[];
}

export const REBALANCE_PRESETS: RebalancePreset[] = [
  {
    id: 'growth-80-20',
    name: '積極成長 80/20 (Growth)',
    description: '80% 核心股票指數搭配 20% 總體債券，適合追求長期資本增長之投資人',
    tags: ['長線增長', '經典配置'],
    allocations: [
      { symbol: 'VTI', name: '整體美股市場 ETF', targetWeight: 50 },
      { symbol: 'QQQ', name: '那斯達克100 ETF', targetWeight: 30 },
      { symbol: 'BND', name: '總體債券市場 ETF', targetWeight: 20 },
    ],
  },
  {
    id: 'balanced-60-40',
    name: '穩健平衡 60/40 (Balanced)',
    description: '全球最經典的股債配置，兼顧成長動能與回撤防禦性',
    tags: ['巴菲特推薦', '股債平衡'],
    allocations: [
      { symbol: 'VTI', name: '整體美股市場 ETF', targetWeight: 40 },
      { symbol: 'VT', name: '全世界股票 ETF', targetWeight: 20 },
      { symbol: 'BND', name: '總體債券市場 ETF', targetWeight: 30 },
      { symbol: 'CASH', name: '現金/活存準備金', targetWeight: 10 },
    ],
  },
  {
    id: 'all-weather',
    name: '全天候策略 (All Weather)',
    description: '橋水基金雷·達利歐（Ray Dalio）經典避險模型，穿越通膨與景氣循環',
    tags: ['抗通膨', '低波動'],
    allocations: [
      { symbol: 'VTI', name: '美股全市場', targetWeight: 30 },
      { symbol: 'TLT', name: '20年期以上美國公債', targetWeight: 40 },
      { symbol: 'IEF', name: '7-10年期美國公債', targetWeight: 15 },
      { symbol: 'GLD', name: 'SPDR 黃金信託', targetWeight: 7.5 },
      { symbol: 'DBC', name: '大宗商品指數基金', targetWeight: 7.5 },
    ],
  },
  {
    id: 'tw-us-core',
    name: '台美核心衛星 (TW/US Core)',
    description: '立足台灣龍頭市值，放眼全球科技與美股核心大盤',
    tags: ['台灣投資人首選', '台美雙擎'],
    allocations: [
      { symbol: '0050.TW', name: '元大台灣50', targetWeight: 30 },
      { symbol: 'VTI', name: '整體美股市場 ETF', targetWeight: 40 },
      { symbol: 'QQQ', name: '那斯達克100 ETF', targetWeight: 20 },
      { symbol: '00687B.TW', name: '國泰20年美債', targetWeight: 10 },
    ],
  },
  {
    id: 'dividend-income',
    name: '高股息現金流 (Dividend Focus)',
    description: '每月/每季穩定被動現金流流入，降低本金波動衝擊',
    tags: ['高股息', '被動現金流'],
    allocations: [
      { symbol: '00878.TW', name: '國泰永續高股息', targetWeight: 30 },
      { symbol: '0056.TW', name: '元大高股息', targetWeight: 20 },
      { symbol: 'SCHD', name: '嘉信美國紅利股 ETF', targetWeight: 30 },
      { symbol: '00679B.TW', name: '元大美債20年', targetWeight: 20 },
    ],
  },
];

export interface RebalanceSettings {
  /** 模式: CASH_IN_ONLY (新資金加碼最優化) 或 FULL_REBALANCE (全盤買賣) */
  mode: 'CASH_IN_ONLY' | 'FULL_REBALANCE';
  /** 目標配置標的列表 */
  allocations: TargetAllocationItem[];
  /** 容忍偏離閾值 (%)，預設 2.0% */
  driftThreshold: number;
  /** 預設擬加碼之新資金金額 (TWD) */
  newCashAmount: number;
  /** 最小交易單位: 1 股 (零股) 或 1000 股 (台股整張) */
  shareLotSize: 'FRACTIONAL_OR_ODD' | 'ROUND_LOT';
}

export const DEFAULT_REBALANCE_SETTINGS: RebalanceSettings = {
  mode: 'CASH_IN_ONLY',
  allocations: REBALANCE_PRESETS[3].allocations, // 預設台美核心衛星
  driftThreshold: 2.0,
  newCashAmount: 50_000,
  shareLotSize: 'FRACTIONAL_OR_ODD',
};

export interface HoldingPosition {
  symbol: string;
  name?: string;
  shares: number;
  currentPrice: number;
  marketValue: number;
  currency: string;
}

export interface PositionDriftInfo {
  symbol: string;
  name: string;
  currentShares: number;
  currentPrice: number;
  marketValue: number;
  actualWeight: number; // %
  targetWeight: number; // %
  drift: number; // actualWeight - targetWeight (%)
  status: 'OVERWEIGHT' | 'BALANCED' | 'UNDERWEIGHT';
  targetValue: number; // 理想目標金額
  valueDiff: number; // targetValue - marketValue (正數表示需買入，負數表示需賣出)
}

export interface CashInRebalanceResult {
  totalCurrentValue: number;
  newCashInput: number;
  totalPostValue: number;
  cashRemaining: number;
  recommendations: {
    symbol: string;
    name: string;
    currentShares: number;
    currentPrice: number;
    currentMarketValue: number;
    actualWeight: number; // %
    targetWeight: number; // %
    driftBefore: number; // %
    recommendedShares: number;
    cost: number;
    postShares: number;
    postMarketValue: number;
    postWeight: number; // %
    driftAfter: number; // %
  }[];
}

export interface FullRebalanceAction {
  symbol: string;
  name: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  currentShares: number;
  targetShares: number;
  deltaShares: number; // 正數代表買進，負數代表賣出
  currentPrice: number;
  estimatedAmount: number; // 交易金額
  estimatedFee: number;
  estimatedTax: number;
  netCashFlow: number; // 賣出時為正現金流，買進時為負現金流
}

export interface FullRebalanceResult {
  totalCurrentValue: number;
  actions: FullRebalanceAction[];
  totalBuyAmount: number;
  totalSellAmount: number;
  totalFeesAndTaxes: number;
  netRequiredCash: number; // 若買 > 賣，需補入的現金
}

/**
 * 檢查與標準化目標配置清單（確保權重總和為 100%）
 */
export function validateAndNormalizeAllocations(
  allocations: TargetAllocationItem[],
): { isValid: boolean; totalWeight: number; normalized: TargetAllocationItem[] } {
  if (allocations.length === 0) {
    return { isValid: false, totalWeight: 0, normalized: [] };
  }

  const sum = allocations.reduce((acc, a) => acc + (a.targetWeight || 0), 0);
  const roundedSum = Math.round(sum * 10) / 10;
  const isValid = roundedSum === 100;

  return {
    isValid,
    totalWeight: roundedSum,
    normalized: allocations,
  };
}

/**
 * 計算各標的的持股偏離度 (Drift Analysis)
 */
export function calculatePortfolioDrift(
  holdings: HoldingPosition[],
  targetAllocations: TargetAllocationItem[],
  driftThreshold: number = 2.0,
): {
  totalMarketValue: number;
  drifts: PositionDriftInfo[];
  maxAbsDrift: number;
  isPortfolioBalanced: boolean;
} {
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

  // 建立標的聯合映射表 (包含持有中標的與目標中但尚未持有的標的)
  const allSymbols = Array.from(
    new Set([
      ...holdings.map((h) => h.symbol),
      ...targetAllocations.map((t) => t.symbol),
    ]),
  );

  const holdingsMap = new Map(holdings.map((h) => [h.symbol, h]));
  const targetsMap = new Map(targetAllocations.map((t) => [t.symbol, t]));

  const drifts: PositionDriftInfo[] = [];

  for (const sym of allSymbols) {
    const h = holdingsMap.get(sym);
    const t = targetsMap.get(sym);

    const currentShares = h?.shares ?? 0;
    const currentPrice = h?.currentPrice ?? 0;
    const marketValue = h?.marketValue ?? 0;
    const name = h?.name ?? t?.name ?? sym;

    const actualWeight =
      totalMarketValue > 0
        ? Math.round((marketValue / totalMarketValue) * 1000) / 10
        : 0;
    const targetWeight = t?.targetWeight ?? 0;
    const drift = Math.round((actualWeight - targetWeight) * 10) / 10;

    let status: 'OVERWEIGHT' | 'BALANCED' | 'UNDERWEIGHT' = 'BALANCED';
    if (drift > driftThreshold) status = 'OVERWEIGHT';
    else if (drift < -driftThreshold) status = 'UNDERWEIGHT';

    const targetValue = Math.round((totalMarketValue * targetWeight) / 100);
    const valueDiff = targetValue - marketValue;

    drifts.push({
      symbol: sym,
      name,
      currentShares,
      currentPrice,
      marketValue,
      actualWeight,
      targetWeight,
      drift,
      status,
      targetValue,
      valueDiff,
    });
  }

  // 依偏離幅度排序（低配嚴重的排在前面，方便優先加碼）
  drifts.sort((a, b) => a.drift - b.drift);

  const maxAbsDrift = drifts.reduce(
    (max, d) => Math.max(max, Math.abs(d.drift)),
    0,
  );
  const isPortfolioBalanced = maxAbsDrift <= driftThreshold;

  return {
    totalMarketValue,
    drifts,
    maxAbsDrift,
    isPortfolioBalanced,
  };
}

/**
 * 模式 A：新資金加碼最優化演算法 (Cash-In Only Rebalancing)
 * 專為長期指數/存股投資人設計：只買不賣，將新資金依偏離度加碼至最欠缺部位，最有效縮小追蹤誤差
 */
export function calculateCashInRebalance(
  holdings: HoldingPosition[],
  targetAllocations: TargetAllocationItem[],
  newCash: number,
  lotSize: 'FRACTIONAL_OR_ODD' | 'ROUND_LOT' = 'FRACTIONAL_OR_ODD',
): CashInRebalanceResult {
  const currentTotal = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const postTotalExpected = currentTotal + newCash;

  const holdingsMap = new Map(holdings.map((h) => [h.symbol, h]));
  const targetSymbols = targetAllocations.filter((t) => t.targetWeight > 0);

  // 1. 初步計算各目標標的在加碼後所需的理論市值與資金缺口
  const items = targetSymbols.map((t) => {
    const h = holdingsMap.get(t.symbol);
    const currentShares = h?.shares ?? 0;
    const currentPrice = h?.currentPrice ?? 1; // 避免除以零
    const currentMarketValue = h?.marketValue ?? 0;
    const actualWeight =
      currentTotal > 0
        ? Math.round((currentMarketValue / currentTotal) * 1000) / 10
        : 0;
    const targetWeight = t.targetWeight;
    const driftBefore = Math.round((actualWeight - targetWeight) * 10) / 10;

    // 加碼後的理想總資產下，該標的應達到的金額
    const idealPostValue = (postTotalExpected * targetWeight) / 100;
    const shortfall = Math.max(0, idealPostValue - currentMarketValue);

    return {
      symbol: t.symbol,
      name: t.name ?? h?.name ?? t.symbol,
      currentShares,
      currentPrice,
      currentMarketValue,
      actualWeight,
      targetWeight,
      driftBefore,
      shortfall,
      recommendedShares: 0,
      cost: 0,
    };
  });

  const totalShortfall = items.reduce((s, it) => s + it.shortfall, 0);
  let remainingCash = newCash;

  // 2. 依資金缺口比例分配初步可買股數
  if (totalShortfall > 0 && remainingCash > 0) {
    for (const it of items) {
      if (it.shortfall <= 0 || it.currentPrice <= 0) continue;
      const proportion = it.shortfall / totalShortfall;
      const budget = Math.min(remainingCash, newCash * proportion);
      let shares = Math.floor(budget / it.currentPrice);

      if (lotSize === 'ROUND_LOT' && it.symbol.endsWith('.TW')) {
        shares = Math.floor(shares / 1000) * 1000;
      }

      if (shares > 0) {
        it.recommendedShares = shares;
        it.cost = shares * it.currentPrice;
        remainingCash -= it.cost;
      }
    }
  }

  // 3. 貪婪精確微調：剩餘零散現金，優先補進「加碼後仍最低配」且買得起至少 1 股的標的
  let canBuyMore = true;
  while (canBuyMore && remainingCash > 0) {
    canBuyMore = false;

    // 計算當前暫定加碼後的即時權重
    const currentSimTotal =
      currentTotal + (newCash - remainingCash);
    let worstItem: (typeof items)[0] | null = null;
    let worstDrift = 9999;

    for (const it of items) {
      if (it.currentPrice <= 0) continue;
      const unitStep =
        lotSize === 'ROUND_LOT' && it.symbol.endsWith('.TW') ? 1000 : 1;
      const costStep = it.currentPrice * unitStep;

      if (remainingCash >= costStep) {
        const simVal = it.currentMarketValue + it.cost;
        const simWeight =
          currentSimTotal > 0 ? (simVal / currentSimTotal) * 100 : 0;
        const drift = simWeight - it.targetWeight;

        if (drift < worstDrift) {
          worstDrift = drift;
          worstItem = it;
        }
      }
    }

    if (worstItem) {
      const unitStep =
        lotSize === 'ROUND_LOT' && worstItem.symbol.endsWith('.TW') ? 1000 : 1;
      worstItem.recommendedShares += unitStep;
      worstItem.cost += worstItem.currentPrice * unitStep;
      remainingCash -= worstItem.currentPrice * unitStep;
      canBuyMore = true;
    }
  }

  // 4. 計算加碼完成後的最終狀態
  const finalSpent = newCash - remainingCash;
  const finalTotalValue = currentTotal + finalSpent;

  const recommendations = items.map((it) => {
    const postShares = it.currentShares + it.recommendedShares;
    const postMarketValue = it.currentMarketValue + it.cost;
    const postWeight =
      finalTotalValue > 0
        ? Math.round((postMarketValue / finalTotalValue) * 1000) / 10
        : 0;
    const driftAfter = Math.round((postWeight - it.targetWeight) * 10) / 10;

    return {
      symbol: it.symbol,
      name: it.name,
      currentShares: it.currentShares,
      currentPrice: it.currentPrice,
      currentMarketValue: it.currentMarketValue,
      actualWeight: it.actualWeight,
      targetWeight: it.targetWeight,
      driftBefore: it.driftBefore,
      recommendedShares: it.recommendedShares,
      cost: it.cost,
      postShares,
      postMarketValue,
      postWeight,
      driftAfter,
    };
  });

  // 依建議投入金額由高至低排列
  recommendations.sort((a, b) => b.cost - a.cost);

  return {
    totalCurrentValue: currentTotal,
    newCashInput: newCash,
    totalPostValue: finalTotalValue,
    cashRemaining: Math.round(remainingCash),
    recommendations,
  };
}

/**
 * 模式 B：全盤直接再平衡演算法 (Full Rebalance - 賣出超配 + 買入低配)
 */
export function calculateFullRebalance(
  holdings: HoldingPosition[],
  targetAllocations: TargetAllocationItem[],
  feeDiscount: number = 0.6, // 券商手續費 6 折
): FullRebalanceResult {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

  const allSymbols = Array.from(
    new Set([
      ...holdings.map((h) => h.symbol),
      ...targetAllocations.map((t) => t.symbol),
    ]),
  );

  const holdingsMap = new Map(holdings.map((h) => [h.symbol, h]));
  const targetsMap = new Map(targetAllocations.map((t) => [t.symbol, t]));

  const actions: FullRebalanceAction[] = [];
  let totalBuyAmount = 0;
  let totalSellAmount = 0;
  let totalFeesAndTaxes = 0;

  for (const sym of allSymbols) {
    const h = holdingsMap.get(sym);
    const t = targetsMap.get(sym);

    const currentShares = h?.shares ?? 0;
    const currentPrice = h?.currentPrice ?? 0;
    const name = h?.name ?? t?.name ?? sym;
    const targetWeight = t?.targetWeight ?? 0;

    if (currentPrice <= 0) continue;

    const targetValue = (totalValue * targetWeight) / 100;
    const targetShares = Math.round(targetValue / currentPrice);
    const deltaShares = targetShares - currentShares;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let estimatedAmount = 0;
    let fee = 0;
    let tax = 0;
    let netCashFlow = 0;

    const baseFeeRate = 0.001425 * feeDiscount;
    const taxRate = sym.includes('00') ? 0.001 : 0.003; // 台股 ETF 0.1%，個股 0.3%

    if (deltaShares > 0) {
      action = 'BUY';
      estimatedAmount = deltaShares * currentPrice;
      fee = Math.max(20, Math.round(estimatedAmount * baseFeeRate));
      netCashFlow = -(estimatedAmount + fee);
      totalBuyAmount += estimatedAmount;
      totalFeesAndTaxes += fee;
    } else if (deltaShares < 0) {
      action = 'SELL';
      const sellShares = Math.abs(deltaShares);
      estimatedAmount = sellShares * currentPrice;
      fee = Math.max(20, Math.round(estimatedAmount * baseFeeRate));
      tax = Math.round(estimatedAmount * taxRate);
      netCashFlow = estimatedAmount - fee - tax;
      totalSellAmount += estimatedAmount;
      totalFeesAndTaxes += fee + tax;
    }

    if (action !== 'HOLD') {
      actions.push({
        symbol: sym,
        name,
        action,
        currentShares,
        targetShares,
        deltaShares,
        currentPrice,
        estimatedAmount,
        estimatedFee: fee,
        estimatedTax: tax,
        netCashFlow,
      });
    }
  }

  // 依交易金額由大到小排序
  actions.sort((a, b) => b.estimatedAmount - a.estimatedAmount);

  const netRequiredCash = Math.max(
    0,
    totalBuyAmount + totalFeesAndTaxes - totalSellAmount,
  );

  return {
    totalCurrentValue: totalValue,
    actions,
    totalBuyAmount,
    totalSellAmount,
    totalFeesAndTaxes,
    netRequiredCash,
  };
}
