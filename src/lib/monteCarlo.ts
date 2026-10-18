/**
 * 蒙地卡羅投資組合隨機過程與動態提領壓力測試引擎
 * (Monte Carlo Portfolio Simulation & Dynamic SWR Stress Testing)
 */

export type WithdrawalStrategy =
  | 'FIXED_INFLATION_ADJUSTED' // 經典固定金額 (隨通膨逐年調整)
  | 'PERCENTAGE_OF_PORTFOLIO' // 固定比例提領 (依每年資產市值固定%提領)
  | 'GUYTON_KLINGER'; // 蓋頓-克林格 (Guyton-Klinger) 護欄法則動態調整

export interface MonteCarloConfig {
  initialNetWorth: number; // 起始本金 (TWD)
  annualInvestment: number; // 退休前每年定期投入 (TWD)
  annualExpense: number; // 退休後每年目標提領開銷 (TWD)
  expectedReturn: number; // 名目預期年化報酬率 (e.g. 0.08 = 8%)
  volatility: number; // 年化波動度/標準差 (e.g. 0.16 = 16%)
  inflationRate: number; // 預期年化通膨率 (e.g. 0.025 = 2.5%)
  years: number; // 模擬年期 (預設 30 年)
  numSimulations: number; // 模擬路徑數 (如 1,000 ~ 5,000 次)
  withdrawalStrategy: WithdrawalStrategy;
  retirementYearOffset?: number; // 幾年後開始退休提領 (0 代表立即退休)
  seed?: number; // 可選固定隨機種子 (用於單元測試保證確定性)
}

export interface FanChartPoint {
  year: number; // 0, 1, ..., N
  p5: number; // 5th 百分位 (極度悲觀/金融海嘯情境)
  p10: number; // 10th 百分位 (悲觀情境)
  p25: number; // 25th 百分位 (保守情境)
  p50: number; // 50th 百分位 (中位數穩健情境)
  p75: number; // 75th 百分位 (樂觀情境)
  p90: number; // 90th 百分位
  p95: number; // 95th 百分位 (大牛市情境)
  medianSpending: number; // 中位數該年實質提領金額
}

export interface MonteCarloSimulationResult {
  config: MonteCarloConfig;
  successRate: number; // 成功率 % (在第 N 年資產仍 > 0 的路徑比例)
  ruinProbability: number; // 破產率 % (100 - successRate)
  failedRunsCount: number;
  totalRuns: number;
  medianEndingNetWorth: number; // 期末資產中位數
  worstEndingNetWorth: number; // 10th 百分位期末資產
  bestEndingNetWorth: number; // 90th 百分位期末資產
  fanChart: FanChartPoint[];
  earliestRuinYear: number | null; // 若有破產，最早破產年份
  medianRuinYear: number | null; // 破產路徑的中位數破產年份
  srrRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  recommendationNote: string;
}

/**
 * 簡易偽隨機數生成器 (PRNG)，支援種子以提供確定性測試
 */
function createPRNG(seed?: number) {
  if (typeof seed !== 'number') {
    return Math.random;
  }
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Box-Muller 轉換：生成標準常態分佈隨機變數 Z ~ N(0, 1)
 */
function generateStandardNormal(rng: () => number): number {
  let u1 = rng();
  let u2 = rng();
  while (u1 <= 1e-15) u1 = rng(); // 避免 log(0)
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * 取得陣列之特定百分位數 (0 ~ 100)
 */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (q <= 0) return sorted[0];
  if (q >= 100) return sorted[sorted.length - 1];

  const pos = ((sorted.length - 1) * q) / 100;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * 執行高階蒙地卡羅情境壓力測試
 */
export function runMonteCarloSimulation(
  cfg: Partial<MonteCarloConfig> & { initialNetWorth: number },
): MonteCarloSimulationResult {
  const initialNetWorth = Math.max(1, cfg.initialNetWorth);
  const annualInvestment = Math.max(0, cfg.annualInvestment ?? 0);
  const annualExpense = Math.max(0, cfg.annualExpense ?? initialNetWorth * 0.04);
  const expectedReturn = cfg.expectedReturn ?? 0.07;
  const volatility = Math.max(0.01, cfg.volatility ?? 0.15);
  const inflationRate = cfg.inflationRate ?? 0.02;
  const years = Math.min(50, Math.max(5, cfg.years ?? 30));
  const numSimulations = Math.min(10000, Math.max(100, cfg.numSimulations ?? 2000));
  const withdrawalStrategy = cfg.withdrawalStrategy ?? 'FIXED_INFLATION_ADJUSTED';
  const retirementYearOffset = Math.max(0, cfg.retirementYearOffset ?? 0);

  const config: MonteCarloConfig = {
    initialNetWorth,
    annualInvestment,
    annualExpense,
    expectedReturn,
    volatility,
    inflationRate,
    years,
    numSimulations,
    withdrawalStrategy,
    retirementYearOffset,
    seed: cfg.seed,
  };

  const rng = createPRNG(cfg.seed);

  // 幾何布朗運動的對數漂移項: mu - 0.5 * sigma^2
  const drift = expectedReturn - 0.5 * volatility * volatility;

  // 矩陣: [yearIndex: 0..years][runIndex: 0..numSimulations]
  const trajectories: number[][] = Array.from({ length: years + 1 }, () =>
    new Array(numSimulations).fill(0),
  );
  const spendingTrajectories: number[][] = Array.from({ length: years + 1 }, () =>
    new Array(numSimulations).fill(0),
  );

  // 第 0 年初始資產
  for (let s = 0; s < numSimulations; s++) {
    trajectories[0][s] = initialNetWorth;
    spendingTrajectories[0][s] = 0;
  }

  const ruinYears: number[] = [];

  for (let s = 0; s < numSimulations; s++) {
    let balance = initialNetWorth;
    let baseExpense = annualExpense;
    let isDepleted = false;

    for (let yr = 1; yr <= years; yr++) {
      if (isDepleted) {
        trajectories[yr][s] = 0;
        spendingTrajectories[yr][s] = 0;
        continue;
      }

      // 生成本年度市場隨機報酬率 (Lognormal)
      const z = generateStandardNormal(rng);
      const annualReturn = Math.exp(drift + volatility * z) - 1;

      // 年初資產成長
      balance = balance * (1 + annualReturn);

      // 判斷當前處於「累積期 (退休前)」或「提領期 (退休後)」
      if (yr <= retirementYearOffset) {
        // 累積期：投入新資金，無開銷提領
        balance += annualInvestment;
        spendingTrajectories[yr][s] = 0;
      } else {
        // 提領期：根據策略計算當年度提領金額
        let withdrawal = 0;
        const initialSWR = initialNetWorth > 0 ? annualExpense / initialNetWorth : 0.04;

        if (withdrawalStrategy === 'FIXED_INFLATION_ADJUSTED') {
          // 通膨隨時間複利調整
          const inflationFactor = Math.pow(1 + inflationRate, yr - retirementYearOffset);
          withdrawal = annualExpense * inflationFactor;
        } else if (withdrawalStrategy === 'PERCENTAGE_OF_PORTFOLIO') {
          // 永遠提領當前餘額的固定百分比
          withdrawal = balance * initialSWR;
        } else if (withdrawalStrategy === 'GUYTON_KLINGER') {
          // 護欄法則：
          // 1. 若前一年報酬為負，不因通膨增加開銷 (Capital Preservation Rule)
          if (annualReturn > 0) {
            baseExpense = baseExpense * (1 + inflationRate);
          }
          withdrawal = baseExpense;

          const currentRate = balance > 0 ? withdrawal / balance : 1;
          // 上護欄：若提領率比初始高出 20%（資產大縮水），支出砍 10%
          if (currentRate > initialSWR * 1.2) {
            withdrawal *= 0.9;
            baseExpense *= 0.9;
          }
          // 下護欄：若提領率比初始低 20%（資產大幅暴增），支出可加碼 10%
          else if (currentRate < initialSWR * 0.8) {
            withdrawal *= 1.1;
            baseExpense *= 1.1;
          }
        }

        spendingTrajectories[yr][s] = withdrawal;
        balance -= withdrawal;

        if (balance <= 0) {
          balance = 0;
          isDepleted = true;
          ruinYears.push(yr);
        }
      }

      trajectories[yr][s] = Math.max(0, balance);
    }
  }

  // 統計成功率與破產率
  const failedRunsCount = ruinYears.length;
  const successRate = Math.round(((numSimulations - failedRunsCount) / numSimulations) * 1000) / 10;
  const ruinProbability = Math.round((failedRunsCount / numSimulations) * 1000) / 10;

  // 破產年份分析
  ruinYears.sort((a, b) => a - b);
  const earliestRuinYear = ruinYears.length > 0 ? ruinYears[0] : null;
  const medianRuinYear = ruinYears.length > 0 ? quantile(ruinYears, 50) : null;

  // 產出扇形圖百分位數據
  const fanChart: FanChartPoint[] = [];
  for (let yr = 0; yr <= years; yr++) {
    const sortedBalances = [...trajectories[yr]].sort((a, b) => a - b);
    const sortedSpending = [...spendingTrajectories[yr]].sort((a, b) => a - b);

    fanChart.push({
      year: yr,
      p5: Math.round(quantile(sortedBalances, 5)),
      p10: Math.round(quantile(sortedBalances, 10)),
      p25: Math.round(quantile(sortedBalances, 25)),
      p50: Math.round(quantile(sortedBalances, 50)),
      p75: Math.round(quantile(sortedBalances, 75)),
      p90: Math.round(quantile(sortedBalances, 90)),
      p95: Math.round(quantile(sortedBalances, 95)),
      medianSpending: Math.round(quantile(sortedSpending, 50)),
    });
  }

  const finalBalances = [...trajectories[years]].sort((a, b) => a - b);
  const medianEndingNetWorth = Math.round(quantile(finalBalances, 50));
  const worstEndingNetWorth = Math.round(quantile(finalBalances, 10));
  const bestEndingNetWorth = Math.round(quantile(finalBalances, 90));

  // 報酬順序風險評估 (SRR Assessment)
  let srrRiskLevel: MonteCarloSimulationResult['srrRiskLevel'] = 'LOW';
  let recommendationNote = '';

  if (successRate >= 95) {
    srrRiskLevel = 'LOW';
    recommendationNote =
      '極佳的安全邊際！30 年測試中具備 95% 以上不破產成功率，在極端黑天鵝事件下資產仍穩如磐石。';
  } else if (successRate >= 85) {
    srrRiskLevel = 'MODERATE';
    recommendationNote =
      '穩健配置。多數市場情境下能安度 30 年，建議搭配 Guyton-Klinger 護欄法則在熊市適度彈性調降開銷。';
  } else if (successRate >= 70) {
    srrRiskLevel = 'HIGH';
    recommendationNote =
      '警戒區間。若退休前幾年遭遇連續大跌（報酬順序風險），有近三成機率提早耗盡本金。建議降低提領率或提高累積期儲蓄率。';
  } else {
    srrRiskLevel = 'CRITICAL';
    recommendationNote =
      '高度破產風險！當前提領開銷相對資本規模過大，超過 30% 機率在 30 年內資金枯竭，強烈建議修正提領計畫。';
  }

  return {
    config,
    successRate,
    ruinProbability,
    failedRunsCount,
    totalRuns: numSimulations,
    medianEndingNetWorth,
    worstEndingNetWorth,
    bestEndingNetWorth,
    fanChart,
    earliestRuinYear,
    medianRuinYear,
    srrRiskLevel,
    recommendationNote,
  };
}
