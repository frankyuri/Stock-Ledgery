export type FireType = 'LEAN' | 'STANDARD' | 'FAT' | 'BARISTA';

export interface FireSettings {
  /** 每月目標生活開銷 (TWD) */
  monthlyExpense: number;
  /** 每月額外定期定額投入 (TWD) */
  monthlyInvestment: number;
  /** 預期名目年化報酬率 (%)，例如 7.0 */
  expectedAnnualReturn: number;
  /** 預期通膨率 (%)，例如 2.0 */
  inflationRate: number;
  /** 安全提領率 (%)，例如 4.0 */
  swr: number;
  /** 目前年齡 (選填) */
  currentAge?: number;
  /** 目標退休年齡 (選填) */
  targetRetirementAge?: number;
  /** 是否進行實質抗通膨調整 */
  useInflationAdjusted: boolean;
  /** 關注的 FIRE 類型 */
  targetFireType: FireType;
}

export const DEFAULT_FIRE_SETTINGS: FireSettings = {
  monthlyExpense: 50_000,
  monthlyInvestment: 20_000,
  expectedAnnualReturn: 7.0,
  inflationRate: 2.0,
  swr: 4.0,
  currentAge: 30,
  targetRetirementAge: 45,
  useInflationAdjusted: true,
  targetFireType: 'STANDARD',
};

export interface FireTargets {
  /** 標準 FIRE 目標本金 (100% 開銷) */
  standardTarget: number;
  /** 極簡 Lean FIRE 目標本金 (75% 開銷) */
  leanTarget: number;
  /** 富裕 Fat FIRE 目標本金 (135% 開銷) */
  fatTarget: number;
  /** 兼職 Barista FIRE 目標本金 (50% 靠投資提領，其餘兼職) */
  baristaTarget: number;
  /** 當前所選目標 */
  activeTarget: number;
}

export interface CrossoverMilestone {
  key: string;
  title: string;
  description: string;
  ratioOfExpense: number;
  targetAnnualAmount: number;
  targetMonthlyAmount: number;
  isUnlocked: boolean;
  progressPercent: number;
  remainingAnnual: number;
}

export interface ProjectionPoint {
  year: number;
  yearIndex: number;
  age?: number;
  netWorth: number;
  totalContributed: number;
  compoundInterest: number;
  annualSafeWithdrawal: number;
  monthlySafeWithdrawal: number;
  standardTarget: number;
  leanTarget: number;
  fatTarget: number;
  isStandardReached: boolean;
  isLeanReached: boolean;
  isFatReached: boolean;
}

export interface FireSimulationResult {
  /** 目標本金分析 */
  targets: FireTargets;
  /** 當前淨值 */
  currentNetWorth: number;
  /** 距目前選定目標之本金差額 */
  remainingGap: number;
  /** 目前達標進度 (0 ~ 100%) */
  progressPercent: number;
  /** 4% 安全提領額 (依目前總資產每年可提領) */
  currentAnnualSafeWithdrawal: number;
  /** 4% 安全提領額 (每月) */
  currentMonthlySafeWithdrawal: number;

  /** 被動股息分析 */
  currentAnnualDividends: number;
  currentMonthlyDividends: number;
  /** 被動股息對目標生活開銷覆蓋率 (%) */
  dividendCoveragePercent: number;
  /** 生活開銷階梯式覆蓋里程碑 */
  milestones: CrossoverMilestone[];

  /** 達標倒數 */
  monthsToTarget: number | null;
  yearsToTarget: number | null;
  formattedCountdown: string;
  estimatedTargetDate: {
    year: number;
    month: number;
    formatted: string;
  } | null;
  estimatedAgeAtRetirement: number | null;

  /** 30年逐年複利與累積曲線 */
  projections: ProjectionPoint[];

  /** 加速優化建議 (敏感度分析) */
  accelerators: {
    boostInvestmentAdvanceYears: number; // 每月多投 $5000 可提早幾年
    cutExpenseAdvanceYears: number; // 每月省 10% 可提早幾年
    cutExpenseTargetReduced: number; // 目標減少金額
    coastFirePossible: boolean; // 若完全停止投入是否仍能在法定年齡達標
  };
}

/**
 * 計算各類型 FIRE 目標本金
 */
export function calculateFireTargets(
  annualExpense: number,
  swrPercent: number = 4.0,
  targetType: FireType = 'STANDARD',
): FireTargets {
  const safeSwr = swrPercent > 0 ? swrPercent / 100 : 0.04;
  const standard = annualExpense / safeSwr;
  const lean = (annualExpense * 0.75) / safeSwr;
  const fat = (annualExpense * 1.35) / safeSwr;
  const barista = (annualExpense * 0.5) / safeSwr;

  let active = standard;
  if (targetType === 'LEAN') active = lean;
  else if (targetType === 'FAT') active = fat;
  else if (targetType === 'BARISTA') active = barista;

  return {
    standardTarget: Math.round(standard),
    leanTarget: Math.round(lean),
    fatTarget: Math.round(fat),
    baristaTarget: Math.round(barista),
    activeTarget: Math.round(active),
  };
}

/**
 * 計算被動股息生活支出覆蓋階梯里程碑
 */
export function calculateCrossoverMilestones(
  annualExpense: number,
  currentAnnualDividends: number,
): CrossoverMilestone[] {
  const milestonesDef = [
    {
      key: 'utilities',
      title: '基礎水電與網費',
      description: '電信通訊、水電瓦斯、網路串流基礎開銷',
      ratio: 0.1,
    },
    {
      key: 'groceries',
      title: '日常伙食與採買',
      description: '滿足每日餐飲飲食與生活必需品物資',
      ratio: 0.3,
    },
    {
      key: 'housing',
      title: '居住與租金車貸',
      description: '涵蓋主要租金、房貸利息或居家維護',
      ratio: 0.6,
    },
    {
      key: 'lean',
      title: '極簡生活自由 (Lean)',
      description: '完全覆蓋 75% 基本生活維生與必要支出',
      ratio: 0.75,
    },
    {
      key: 'full',
      title: '完全財務自由 (Full FIRE)',
      description: '被動現金流 100% 覆蓋完整生活總預算',
      ratio: 1.0,
    },
    {
      key: 'fat',
      title: '奢華富裕自由 (Fat FIRE)',
      description: '超額 135% 自由支出，享受旅行娛樂投資',
      ratio: 1.35,
    },
  ];

  return milestonesDef.map((m) => {
    const targetAnnual = Math.round(annualExpense * m.ratio);
    const targetMonthly = Math.round(targetAnnual / 12);
    const isUnlocked = currentAnnualDividends >= targetAnnual;
    const progressPercent =
      targetAnnual > 0
        ? Math.min(
            Math.round((currentAnnualDividends / targetAnnual) * 1000) / 10,
            100,
          )
        : 100;
    const remainingAnnual = Math.max(0, targetAnnual - currentAnnualDividends);

    return {
      key: m.key,
      title: m.title,
      description: m.description,
      ratioOfExpense: m.ratio,
      targetAnnualAmount: targetAnnual,
      targetMonthlyAmount: targetMonthly,
      isUnlocked,
      progressPercent,
      remainingAnnual,
    };
  });
}

/**
 * 核心 FIRE 複利成長模擬與倒數推算引擎
 */
export function simulateFire(
  settings: FireSettings,
  currentNetWorth: number,
  currentAnnualDividends: number,
  now: Date = new Date(),
): FireSimulationResult {
  const annualExpense = settings.monthlyExpense * 12;
  const targets = calculateFireTargets(
    annualExpense,
    settings.swr,
    settings.targetFireType,
  );
  const activeTarget = targets.activeTarget;

  const currentSwrRate = settings.swr > 0 ? settings.swr / 100 : 0.04;
  const currentAnnualSafeWithdrawal = Math.round(
    currentNetWorth * currentSwrRate,
  );
  const currentMonthlySafeWithdrawal = Math.round(
    currentAnnualSafeWithdrawal / 12,
  );

  const remainingGap = Math.max(0, activeTarget - currentNetWorth);
  const progressPercent =
    activeTarget > 0
      ? Math.min(
          Math.round((currentNetWorth / activeTarget) * 1000) / 10,
          100,
        )
      : 100;

  // 股息覆蓋率
  const dividendCoveragePercent =
    annualExpense > 0
      ? Math.round((currentAnnualDividends / annualExpense) * 1000) / 10
      : 0;
  const currentMonthlyDividends = Math.round(currentAnnualDividends / 12);
  const milestones = calculateCrossoverMilestones(
    annualExpense,
    currentAnnualDividends,
  );

  // 實質實質報酬率計算
  const nominalRate = settings.expectedAnnualReturn / 100;
  const inflationRate = settings.inflationRate / 100;
  const effectiveAnnualRate = settings.useInflationAdjusted
    ? (1 + nominalRate) / (1 + inflationRate) - 1
    : nominalRate;

  // 月複利率
  const monthlyRate =
    effectiveAnnualRate !== 0
      ? Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1
      : 0;

  // 計算達成月數 (上限 40 年 = 480 個月)
  const MAX_MONTHS = 480;
  let monthsToTarget: number | null = null;
  let runningNetWorth = currentNetWorth;

  if (currentNetWorth >= activeTarget) {
    monthsToTarget = 0;
  } else {
    for (let m = 1; m <= MAX_MONTHS; m++) {
      runningNetWorth =
        runningNetWorth * (1 + monthlyRate) + settings.monthlyInvestment;
      if (runningNetWorth >= activeTarget) {
        monthsToTarget = m;
        break;
      }
    }
  }

  // 產生 30 年逐年預測資料 (30 年 = 360 個月)
  const projections: ProjectionPoint[] = [];
  let simWealth = currentNetWorth;
  let simContributed = currentNetWorth;
  const startYear = now.getFullYear();
  const baseAge = settings.currentAge ?? 30;

  for (let yearIdx = 0; yearIdx <= 30; yearIdx++) {
    const curYear = startYear + yearIdx;
    const curAge = baseAge + yearIdx;
    const annualSafe = Math.round(simWealth * currentSwrRate);

    projections.push({
      year: curYear,
      yearIndex: yearIdx,
      age: curAge,
      netWorth: Math.round(simWealth),
      totalContributed: Math.round(simContributed),
      compoundInterest: Math.round(Math.max(0, simWealth - simContributed)),
      annualSafeWithdrawal: annualSafe,
      monthlySafeWithdrawal: Math.round(annualSafe / 12),
      standardTarget: targets.standardTarget,
      leanTarget: targets.leanTarget,
      fatTarget: targets.fatTarget,
      isStandardReached: simWealth >= targets.standardTarget,
      isLeanReached: simWealth >= targets.leanTarget,
      isFatReached: simWealth >= targets.fatTarget,
    });

    // 推進 12 個月
    for (let m = 0; m < 12; m++) {
      simWealth = simWealth * (1 + monthlyRate) + settings.monthlyInvestment;
      simContributed += settings.monthlyInvestment;
    }
  }

  // 倒數文字與預計達標年月
  let formattedCountdown = '資產累積中';
  let yearsToTarget: number | null = null;
  let estimatedTargetDate: {
    year: number;
    month: number;
    formatted: string;
  } | null = null;
  let estimatedAgeAtRetirement: number | null = null;

  if (monthsToTarget === 0) {
    formattedCountdown = '🎉 已達成 FIRE 財務自由！';
    yearsToTarget = 0;
    estimatedTargetDate = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      formatted: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 (已達成)`,
    };
    estimatedAgeAtRetirement = baseAge;
  } else if (monthsToTarget !== null) {
    yearsToTarget = Math.round((monthsToTarget / 12) * 10) / 10;
    const y = Math.floor(monthsToTarget / 12);
    const remainMonths = monthsToTarget % 12;
    formattedCountdown =
      y > 0
        ? remainMonths > 0
          ? `${y} 年 ${remainMonths} 個月`
          : `${y} 年`
        : `${remainMonths} 個月`;

    const targetDate = new Date(now);
    targetDate.setMonth(targetDate.getMonth() + monthsToTarget);
    const targetY = targetDate.getFullYear();
    const targetM = targetDate.getMonth() + 1;
    estimatedTargetDate = {
      year: targetY,
      month: targetM,
      formatted: `${targetY} 年 ${targetM} 月`,
    };
    estimatedAgeAtRetirement = baseAge + y;
  } else {
    formattedCountdown = '超過 40 年 (建議提高投入或調整開銷)';
  }

  // 敏感度分析 (加速建議)
  // 1. 每月多投資 5000 元
  const boostMonths = runMonthSimulation(
    currentNetWorth,
    settings.monthlyInvestment + 5000,
    monthlyRate,
    activeTarget,
    MAX_MONTHS,
  );
  const boostAdvanceYears =
    monthsToTarget !== null && boostMonths !== null
      ? Math.max(
          0,
          Math.round(((monthsToTarget - boostMonths) / 12) * 10) / 10,
        )
      : 0;

  // 2. 開銷減少 10%
  const reducedExpense = annualExpense * 0.9;
  const reducedTarget = calculateFireTargets(
    reducedExpense,
    settings.swr,
    settings.targetFireType,
  ).activeTarget;
  const cutMonths = runMonthSimulation(
    currentNetWorth,
    settings.monthlyInvestment,
    monthlyRate,
    reducedTarget,
    MAX_MONTHS,
  );
  const cutAdvanceYears =
    monthsToTarget !== null && cutMonths !== null
      ? Math.max(0, Math.round(((monthsToTarget - cutMonths) / 12) * 10) / 10)
      : 0;

  // 3. Coast FIRE: 停止新投入，純靠複利成長至 60 歲
  const yearsTo60 = Math.max(0, 60 - baseAge);
  const coastWealthAt60 =
    currentNetWorth * Math.pow(1 + effectiveAnnualRate, yearsTo60);
  const coastFirePossible = coastWealthAt60 >= activeTarget;

  return {
    targets,
    currentNetWorth,
    remainingGap,
    progressPercent,
    currentAnnualSafeWithdrawal,
    currentMonthlySafeWithdrawal,
    currentAnnualDividends,
    currentMonthlyDividends,
    dividendCoveragePercent,
    milestones,
    monthsToTarget,
    yearsToTarget,
    formattedCountdown,
    estimatedTargetDate,
    estimatedAgeAtRetirement,
    projections,
    accelerators: {
      boostInvestmentAdvanceYears: boostAdvanceYears,
      cutExpenseAdvanceYears: cutAdvanceYears,
      cutExpenseTargetReduced: Math.max(0, activeTarget - reducedTarget),
      coastFirePossible,
    },
  };
}

function runMonthSimulation(
  initialNetWorth: number,
  monthlyInv: number,
  monthlyRate: number,
  target: number,
  maxMonths: number,
): number | null {
  if (initialNetWorth >= target) return 0;
  let w = initialNetWorth;
  for (let m = 1; m <= maxMonths; m++) {
    w = w * (1 + monthlyRate) + monthlyInv;
    if (w >= target) return m;
  }
  return null;
}
