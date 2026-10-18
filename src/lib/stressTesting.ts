/**
 * 投資組合情境壓力測試引擎 (Portfolio Stress Testing Engine)
 * 模擬歷史重大黑天鵝事件與極端市場衝擊對投資組合當前部位的潛在回撤與虧損試算
 */

export interface StressScenario {
  id: string;
  name: string;
  period: string;
  description: string;
  marketImpact: {
    usMarket: number; // 美股大盤跌幅 % (e.g. -50.8)
    twMarket: number; // 台股大盤跌幅 % (e.g. -53.2)
    techSector: number; // 科技股衝擊 % (e.g. -60.0)
    defensiveSector: number; // 防禦型/高股息衝擊 % (e.g. -25.0)
    bondCash: number; // 債券/現金避險資產變動 % (e.g. +5.0)
  };
  durationMonths: number;
  recoveryMonths: number;
}

export const HISTORICAL_SCENARIOS: StressScenario[] = [
  {
    id: 'GFC_2008',
    name: '2008 全球金融海嘯 (Subprime Crisis)',
    period: '2007/10 ~ 2009/03',
    description: '雷曼兄弟倒閉引發全球流動性枯竭，標普500大跌50.8%，台股重挫53.2%，全球股市系統性大崩盤。',
    marketImpact: {
      usMarket: -50.8,
      twMarket: -53.2,
      techSector: -52.0,
      defensiveSector: -32.0,
      bondCash: 8.5,
    },
    durationMonths: 17,
    recoveryMonths: 48,
  },
  {
    id: 'COVID_2020',
    name: '2020 疫情全球閃崩 (COVID Crash)',
    period: '2020/02 ~ 2020/03',
    description: '全球供應鏈中斷與封城危機，美股一個月內觸發4次熔斷，但其後因無限QE而快速強力反彈。',
    marketImpact: {
      usMarket: -33.9,
      twMarket: -28.5,
      techSector: -25.0,
      defensiveSector: -30.0,
      bondCash: 3.0,
    },
    durationMonths: 1.5,
    recoveryMonths: 5,
  },
  {
    id: 'RATE_HIKE_2022',
    name: '2022 通膨飆升與鷹派升息 (Rate Hike & Tech Rout)',
    period: '2022/01 ~ 2022/10',
    description: '40年最高通膨迫使聯準會激進升息，成長型科技股與加密資產大幅去槓桿，股債雙殺。',
    marketImpact: {
      usMarket: -25.4,
      twMarket: -32.1,
      techSector: -37.5,
      defensiveSector: -12.0,
      bondCash: -13.0,
    },
    durationMonths: 10,
    recoveryMonths: 14,
  },
  {
    id: 'DOTCOM_2000',
    name: '2000 網路科技泡沫破裂 (Dot-Com Bubble)',
    period: '2000/03 ~ 2002/10',
    description: '科技股估值全面破滅，那斯達克跌幅達78%，台股跌幅67%，傳統價值型與傳產股相對具防禦力。',
    marketImpact: {
      usMarket: -49.1,
      twMarket: -67.4,
      techSector: -78.0,
      defensiveSector: -18.0,
      bondCash: 12.0,
    },
    durationMonths: 31,
    recoveryMonths: 72,
  },
];

export interface HoldingStressItem {
  symbol: string;
  name: string;
  marketValue: number;
  weight: number; // 0 ~ 100
  beta: number;
  estimatedReturnPct: number; // % e.g. -42.5
  estimatedLossAmount: number; // e.g. 150000
}

export interface ScenarioResult {
  scenario: StressScenario;
  portfolioLossPct: number; // 投組整體預估跌幅 %
  portfolioLossAmount: number; // 預估虧損金額
  projectedEndingValue: number; // 衝擊後預估殘存淨值
  resilienceRating: 'A' | 'B' | 'C' | 'D';
  resilienceDesc: string;
  items: HoldingStressItem[];
}

/**
 * 依據標的代號推估資產類別與風險敏感度
 */
export function estimateAssetRiskProfile(symbol: string): {
  isTaiwan: boolean;
  isTechOrGrowth: boolean;
  isDefensiveOrDividend: boolean;
  isBondOrCash: boolean;
  defaultBeta: number;
} {
  const s = symbol.toUpperCase().trim();
  const isTaiwan = s.endsWith('.TW') || s.endsWith('.TWO');

  if (s === 'CASH' || s.startsWith('BND') || s.startsWith('AGG') || s.startsWith('TLT') || s.startsWith('00679B')) {
    return { isTaiwan, isTechOrGrowth: false, isDefensiveOrDividend: false, isBondOrCash: true, defaultBeta: 0.1 };
  }

  // 高股息或防禦型
  const defensiveSymbols = ['0056.TW', '00878.TW', '00713.TW', '00919.TW', 'VIG', 'SCHD', 'KO', 'JNJ', 'PG', 'PEP'];
  if (defensiveSymbols.includes(s)) {
    return { isTaiwan, isTechOrGrowth: false, isDefensiveOrDividend: true, isBondOrCash: false, defaultBeta: 0.75 };
  }

  // 科技成長股
  const techSymbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'QQQ', 'SOXX', 'SMH', '2330.TW', '2454.TW', '0052.TW'];
  if (techSymbols.includes(s) || /2330|2454|3034|2379/i.test(s)) {
    return { isTaiwan, isTechOrGrowth: true, isDefensiveOrDividend: false, isBondOrCash: false, defaultBeta: 1.25 };
  }

  return { isTaiwan, isTechOrGrowth: false, isDefensiveOrDividend: false, isBondOrCash: false, defaultBeta: 1.0 };
}

/**
 * 執行特定壓力測試劇本計算
 */
export function evaluateStressScenario(
  scenario: StressScenario,
  holdings: Array<{ symbol: string; name?: string; marketValue: number; beta?: number }>,
): ScenarioResult {
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

  if (totalMarketValue <= 0 || holdings.length === 0) {
    return {
      scenario,
      portfolioLossPct: 0,
      portfolioLossAmount: 0,
      projectedEndingValue: 0,
      resilienceRating: 'A',
      resilienceDesc: '未建立持股或市值為零',
      items: [],
    };
  }

  let totalLoss = 0;
  const items: HoldingStressItem[] = [];

  for (const h of holdings) {
    const profile = estimateAssetRiskProfile(h.symbol);
    const beta = h.beta && h.beta > 0 ? h.beta : profile.defaultBeta;
    const weight = (h.marketValue / totalMarketValue) * 100;

    let baseDrop = profile.isTaiwan
      ? scenario.marketImpact.twMarket
      : scenario.marketImpact.usMarket;

    if (profile.isBondOrCash) {
      baseDrop = scenario.marketImpact.bondCash;
    } else if (profile.isTechOrGrowth) {
      baseDrop = Math.min(baseDrop, scenario.marketImpact.techSector);
    } else if (profile.isDefensiveOrDividend) {
      baseDrop = Math.max(baseDrop, scenario.marketImpact.defensiveSector);
    }

    // 依個股 Beta 放大或縮小跌幅
    let estimatedReturnPct = profile.isBondOrCash ? baseDrop : baseDrop * Math.max(0.4, Math.min(2.0, beta));
    // 跌幅下限防禦 -95%
    estimatedReturnPct = Math.max(-95, Math.min(50, estimatedReturnPct));

    const estimatedLossAmount = h.marketValue * (estimatedReturnPct / 100);
    totalLoss += estimatedLossAmount;

    items.push({
      symbol: h.symbol,
      name: h.name || h.symbol,
      marketValue: h.marketValue,
      weight: Math.round(weight * 10) / 10,
      beta: Math.round(beta * 100) / 100,
      estimatedReturnPct: Math.round(estimatedReturnPct * 10) / 10,
      estimatedLossAmount: Math.round(estimatedLossAmount),
    });
  }

  const portfolioLossPct = (totalLoss / totalMarketValue) * 100;
  const projectedEndingValue = Math.max(0, totalMarketValue + totalLoss);

  // 評級邏輯：依預估跌幅給予 A ~ D 韌性等級
  let resilienceRating: 'A' | 'B' | 'C' | 'D' = 'B';
  let resilienceDesc = '投資組合具備常規防禦力';

  if (portfolioLossPct > -20) {
    resilienceRating = 'A';
    resilienceDesc = '極佳抗跌性：防禦性資產與現金配置發揮緩衝效能';
  } else if (portfolioLossPct > -35) {
    resilienceRating = 'B';
    resilienceDesc = '良好韌性：回撤幅度與大盤相當，符合標準指數化配置';
  } else if (portfolioLossPct > -48) {
    resilienceRating = 'C';
    resilienceDesc = '中高波動曝險：成長股佔比較高，建議留意流動性風險';
  } else {
    resilienceRating = 'D';
    resilienceDesc = '高風險集中：極端行情下可能承受巨大本金回撤，建議適度分散';
  }

  return {
    scenario,
    portfolioLossPct: Math.round(portfolioLossPct * 10) / 10,
    portfolioLossAmount: Math.round(totalLoss),
    projectedEndingValue: Math.round(projectedEndingValue),
    resilienceRating,
    resilienceDesc,
    items: items.sort((a, b) => b.marketValue - a.marketValue),
  };
}
