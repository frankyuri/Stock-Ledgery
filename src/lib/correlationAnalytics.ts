import type { Candle } from '@/types/stock';

export interface CorrelationPair {
  symbolA: string;
  symbolB: string;
  correlation: number;
  description: string;
  riskLevel: 'high_positive' | 'moderate_positive' | 'neutral' | 'hedging';
}

export interface CorrelationMatrixResult {
  symbols: string[];
  matrix: number[][]; // [row][col] where row & col correspond to symbols
  averageCorrelation: number;
  pairs: CorrelationPair[];
  highRiskPairs: CorrelationPair[];
  hedgingPairs: CorrelationPair[];
}

export interface HealthScorePillars {
  diversification: number; // 0 ~ 100 分散度
  riskControl: number; // 0 ~ 100 波動與回撤防禦
  efficiency: number; // 0 ~ 100 報酬效率 (Sharpe/Beta)
  resilience: number; // 0 ~ 100 壓力韌性與結構
}

export interface PortfolioHealthScore {
  overallScore: number; // 0 ~ 100
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  gradeTitle: string;
  pillars: HealthScorePillars;
  strengths: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * 計算標的之間的皮爾森相關係數矩陣 (Pearson Correlation Matrix)
 */
export function calculateCorrelationMatrix(
  symbols: string[],
  candleMap: Map<string, Candle[]>,
): CorrelationMatrixResult {
  if (symbols.length === 0) {
    return {
      symbols: [],
      matrix: [],
      averageCorrelation: 0,
      pairs: [],
      highRiskPairs: [],
      hedgingPairs: [],
    };
  }

  // 1. 建立各標的以日期為 key 的收盤價索引
  const priceMapByDate = new Map<string, Map<string, number>>();
  for (const sym of symbols) {
    const candles = candleMap.get(sym) || [];
    for (const c of candles) {
      if (c.close == null || c.close <= 0) continue;
      if (!priceMapByDate.has(c.time)) {
        priceMapByDate.set(c.time, new Map());
      }
      priceMapByDate.get(c.time)!.set(sym, c.close);
    }
  }

  const sortedDates = Array.from(priceMapByDate.keys()).sort();

  // 2. 計算各標的每日收益率序列
  const returnsBySymbol = new Map<string, number[]>();
  for (const sym of symbols) {
    returnsBySymbol.set(sym, []);
  }

  for (let d = 1; d < sortedDates.length; d++) {
    const prevDatePrices = priceMapByDate.get(sortedDates[d - 1])!;
    const currDatePrices = priceMapByDate.get(sortedDates[d])!;

    for (const sym of symbols) {
      const p0 = prevDatePrices.get(sym);
      const p1 = currDatePrices.get(sym);
      const retList = returnsBySymbol.get(sym)!;

      if (p0 != null && p1 != null && p0 > 0) {
        retList.push((p1 - p0) / p0);
      } else {
        // 若缺漏該日資料，補 0 保持序列等長
        retList.push(0);
      }
    }
  }

  // 3. 計算 Pearson 相關係數
  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  const pairs: CorrelationPair[] = [];
  let offDiagonalSum = 0;
  let offDiagonalCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
        continue;
      }

      const symA = symbols[i];
      const symB = symbols[j];
      const retsA = returnsBySymbol.get(symA) || [];
      const retsB = returnsBySymbol.get(symB) || [];

      const corr = computePearson(retsA, retsB);
      matrix[i][j] = corr;
      matrix[j][i] = corr;

      offDiagonalSum += corr;
      offDiagonalCount++;

      let riskLevel: CorrelationPair['riskLevel'] = 'neutral';
      let description = '';

      if (corr >= 0.75) {
        riskLevel = 'high_positive';
        description = '高度同向同步，遇市場系統風險時幾乎同時回撤，無明顯風險分散效果';
      } else if (corr >= 0.4) {
        riskLevel = 'moderate_positive';
        description = '中度正相關，同向趨勢居多，具部分族群連動性';
      } else if (corr <= 0.1) {
        riskLevel = 'hedging';
        description = '低度或負相關，兩者走勢獨立或互補，能有效平滑投組整體波動';
      } else {
        riskLevel = 'neutral';
        description = '弱相關，具備穩健的風險分散特性';
      }

      pairs.push({
        symbolA: symA,
        symbolB: symB,
        correlation: corr,
        description,
        riskLevel,
      });
    }
  }

  // 按相關係數由高到低排序
  pairs.sort((a, b) => b.correlation - a.correlation);

  const averageCorrelation =
    offDiagonalCount > 0
      ? Math.round((offDiagonalSum / offDiagonalCount) * 100) / 100
      : 0;

  const highRiskPairs = pairs.filter((p) => p.correlation >= 0.75);
  const hedgingPairs = pairs.filter((p) => p.correlation <= 0.15);

  return {
    symbols,
    matrix,
    averageCorrelation,
    pairs,
    highRiskPairs,
    hedgingPairs,
  };
}

/**
 * 核心公式：皮爾森相關係數
 */
function computePearson(x: number[], y: number[]): number {
  const len = Math.min(x.length, y.length);
  if (len < 3) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < len; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / len;
  const meanY = sumY / len;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < len; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  const r = numerator / denominator;
  // 邊界防禦與小數點四捨五入
  const clamped = Math.max(-1, Math.min(1, r));
  return Math.round(clamped * 100) / 100;
}

export interface HealthParams {
  holdingsCount: number;
  maxWeight: number; // 最大單一持股權重 % (例如 32.5)
  top3Weight: number; // 前三大持股累計權重 % (例如 65.0)
  averageCorrelation: number; // 投組平均相關係數 (-1 ~ 1)
  sharpeRatio: number; // 夏普值
  maxDrawdown: number; // 最大回撤 (負數，如 -14.2)
  annualizedVolatility: number; // 年化波動度 (如 18.5)
  beta: number; // 貝他值 (如 0.95)
  stressResilienceRating?: 'A+' | 'A' | 'B' | 'C' | 'D';
}

/**
 * 計算投資組合健康度評分 (Portfolio Health Diagnostics Engine)
 */
export function calculatePortfolioHealthScore(params: HealthParams): PortfolioHealthScore {
  const {
    holdingsCount,
    maxWeight,
    top3Weight,
    averageCorrelation,
    sharpeRatio,
    maxDrawdown,
    annualizedVolatility,
    beta,
    stressResilienceRating = 'B',
  } = params;

  // 1. 分散度評分 (Diversification: 0 ~ 100)
  let divBase = 40;
  if (holdingsCount >= 10) divBase = 95;
  else if (holdingsCount >= 7) divBase = 90;
  else if (holdingsCount >= 5) divBase = 80;
  else if (holdingsCount >= 3) divBase = 65;
  else if (holdingsCount === 2) divBase = 50;
  else divBase = 30;

  // 單一持股過度集中懲罰
  let maxWeightPenalty = 0;
  if (maxWeight > 40) {
    maxWeightPenalty = (maxWeight - 40) * 1.5 + 12;
  } else if (maxWeight > 25) {
    maxWeightPenalty = (maxWeight - 25) * 0.8;
  }

  // 相關性加減分 (平均相關性低於 0.3 加分，高於 0.7 扣分)
  let corrAdjustment = 0;
  if (averageCorrelation < 0.3) {
    corrAdjustment = +10;
  } else if (averageCorrelation > 0.7) {
    corrAdjustment = -15;
  } else if (averageCorrelation > 0.5) {
    corrAdjustment = -5;
  }

  const diversificationScore = Math.max(
    10,
    Math.min(100, Math.round(divBase - maxWeightPenalty + corrAdjustment)),
  );

  // 2. 波動防禦評分 (Risk Control: 0 ~ 100)
  // MDD 評分
  const absDD = Math.abs(maxDrawdown);
  let mddScore = 50;
  if (absDD <= 10) mddScore = 95;
  else if (absDD <= 18) mddScore = 85;
  else if (absDD <= 25) mddScore = 75;
  else if (absDD <= 35) mddScore = 60;
  else mddScore = 40;

  // 波動度評分
  let volScore = 50;
  if (annualizedVolatility <= 14) volScore = 95;
  else if (annualizedVolatility <= 20) volScore = 85;
  else if (annualizedVolatility <= 28) volScore = 70;
  else if (annualizedVolatility <= 36) volScore = 55;
  else volScore = 40;

  const riskControlScore = Math.round(mddScore * 0.6 + volScore * 0.4);

  // 3. 報酬效率評分 (Efficiency: 0 ~ 100)
  let sharpeScore = 50;
  if (sharpeRatio >= 1.6) sharpeScore = 98;
  else if (sharpeRatio >= 1.2) sharpeScore = 90;
  else if (sharpeRatio >= 0.8) sharpeScore = 80;
  else if (sharpeRatio >= 0.4) sharpeScore = 68;
  else if (sharpeRatio >= 0) sharpeScore = 55;
  else sharpeScore = 35;

  let betaScore = 80;
  if (beta >= 0.7 && beta <= 1.2) betaScore = 92;
  else if (beta < 0.7) betaScore = 82;
  else if (beta <= 1.5) betaScore = 72;
  else betaScore = 55;

  const efficiencyScore = Math.round(sharpeScore * 0.7 + betaScore * 0.3);

  // 4. 壓力韌性與結構評分 (Resilience: 0 ~ 100)
  let resilienceBase = 70;
  if (stressResilienceRating === 'A+') resilienceBase = 96;
  else if (stressResilienceRating === 'A') resilienceBase = 88;
  else if (stressResilienceRating === 'B') resilienceBase = 76;
  else if (stressResilienceRating === 'C') resilienceBase = 62;
  else resilienceBase = 45;

  let top3Penalty = 0;
  if (top3Weight > 75) top3Penalty = 15;
  else if (top3Weight > 60) top3Penalty = 8;

  const resilienceScore = Math.max(
    10,
    Math.min(100, Math.round(resilienceBase - top3Penalty)),
  );

  // 總評分 (各權重 25%)
  const overallScore = Math.round(
    diversificationScore * 0.3 +
      riskControlScore * 0.25 +
      efficiencyScore * 0.25 +
      resilienceScore * 0.2,
  );

  let grade: PortfolioHealthScore['grade'] = 'B';
  let gradeTitle = '體質健全';

  if (overallScore >= 90) {
    grade = 'S';
    gradeTitle = '卓越抗震投組';
  } else if (overallScore >= 80) {
    grade = 'A';
    gradeTitle = '績效防禦兼備';
  } else if (overallScore >= 70) {
    grade = 'B';
    gradeTitle = '體質穩健良好';
  } else if (overallScore >= 60) {
    grade = 'C';
    gradeTitle = '配置尚可但具潛在盲點';
  } else {
    grade = 'D';
    gradeTitle = '高度集中與脆弱';
  }

  // 優勢與警示生成
  const strengths: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // 分析 strengths
  if (diversificationScore >= 80) {
    strengths.push('持股檔數充裕且權重分佈均衡，有效防範非系統性個股崩跌風險。');
  }
  if (averageCorrelation < 0.35 && averageCorrelation !== 0) {
    strengths.push(
      `投組資產平均相關係數僅 ${averageCorrelation}，標的間走勢具備良好互補抗震效果。`,
    );
  }
  if (sharpeRatio >= 1.0) {
    strengths.push(
      `夏普比率達 ${sharpeRatio}，在承受單位波動風險下能萃取高水準超額收益。`,
    );
  }
  if (absDD <= 18) {
    strengths.push(
      `歷史最大回撤僅 ${absDD}%，下檔風險控制相當沉穩，有利於長期複利持有。`,
    );
  }
  if (strengths.length === 0) {
    strengths.push('投資組合已建立核心持股骨幹，具備基礎市場追蹤能力。');
  }

  // 分析 warnings
  if (maxWeight > 25) {
    warnings.push(
      `最大單一持股佔比達 ${maxWeight}%，超過 25% 風險警戒線，個股暴跌時將重創整體淨值。`,
    );
  }
  if (top3Weight > 65) {
    warnings.push(
      `前三大重倉標的合計權重達 ${top3Weight}%，資產重心過度傾斜。`,
    );
  }
  if (averageCorrelation >= 0.65) {
    warnings.push(
      `持股間平均相關係數高達 ${averageCorrelation}，多數標的同向連動，缺乏真正避險對沖防線。`,
    );
  }
  if (absDD > 30) {
    warnings.push(
      `歷史波段最大跌幅達 ${absDD}%，震盪幅度劇烈，可能在空頭熊市中考驗持股信心。`,
    );
  }
  if (sharpeRatio < 0.5 && sharpeRatio !== 0) {
    warnings.push(
      `夏普值偏低 (${sharpeRatio})，承受之波動風險未完全轉化為相稱之淨回報。`,
    );
  }

  // 分析 recommendations
  if (maxWeight > 25) {
    recommendations.push(
      '可趁波段反彈或除息時逐步調節最大持股，將資金分流至市值型 ETF 或其他低相關產業。',
    );
  }
  if (averageCorrelation >= 0.65) {
    recommendations.push(
      '建議引入跨市場標的（如台股搭配美股、科技股搭配防禦型傳產或債券 ETF）以降低總體相關度。',
    );
  }
  if (holdingsCount < 4) {
    recommendations.push(
      '建議至少持有 5 ~ 8 檔跨產業不同屬性的核心資產，以達成馬科維茨效率前緣分散效果。',
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      '目前投組配置健康，維持定期定額紀律投入，並於每季或每半年執行一次再平衡即可。',
    );
  }

  return {
    overallScore,
    grade,
    gradeTitle,
    pillars: {
      diversification: diversificationScore,
      riskControl: riskControlScore,
      efficiency: efficiencyScore,
      resilience: resilienceScore,
    },
    strengths,
    warnings,
    recommendations,
  };
}
