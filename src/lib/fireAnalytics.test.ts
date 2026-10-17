import { describe, it, expect } from 'vitest';
import {
  calculateFireTargets,
  calculateCrossoverMilestones,
  simulateFire,
  DEFAULT_FIRE_SETTINGS,
} from './fireAnalytics';

describe('fireAnalytics', () => {
  it('calculates 4% rule targets correctly for Standard, Lean, Fat, and Barista', () => {
    // Annual expense = 50,000 * 12 = 600,000
    // SWR = 4% -> 600,000 / 0.04 = 15,000,000
    const targets = calculateFireTargets(600_000, 4.0, 'STANDARD');
    expect(targets.standardTarget).toBe(15_000_000);
    // Lean = 75% -> 11,250,000
    expect(targets.leanTarget).toBe(11_250_000);
    // Fat = 135% -> 20,250,000
    expect(targets.fatTarget).toBe(20_250_000);
    // Barista = 50% -> 7,500,000
    expect(targets.baristaTarget).toBe(7_500_000);
    expect(targets.activeTarget).toBe(15_000_000);

    // If lean is selected
    const leanTargets = calculateFireTargets(600_000, 4.0, 'LEAN');
    expect(leanTargets.activeTarget).toBe(11_250_000);
  });

  it('calculates passive dividend crossover milestones properly', () => {
    const annualExpense = 600_000;
    // Current dividends = 180,000 (covers 30%)
    const milestones = calculateCrossoverMilestones(annualExpense, 180_000);

    // 1. Utilities (10% = 60,000) -> should be unlocked
    const utils = milestones.find((m) => m.key === 'utilities')!;
    expect(utils.isUnlocked).toBe(true);
    expect(utils.progressPercent).toBe(100);

    // 2. Groceries (30% = 180,000) -> exactly unlocked
    const groceries = milestones.find((m) => m.key === 'groceries')!;
    expect(groceries.isUnlocked).toBe(true);
    expect(groceries.progressPercent).toBe(100);

    // 3. Housing (60% = 360,000) -> half unlocked (50%)
    const housing = milestones.find((m) => m.key === 'housing')!;
    expect(housing.isUnlocked).toBe(false);
    expect(housing.progressPercent).toBe(50);
    expect(housing.remainingAnnual).toBe(180_000);
  });

  it('simulates compound growth and correctly identifies when FIRE is already reached', () => {
    const settings = {
      ...DEFAULT_FIRE_SETTINGS,
      monthlyExpense: 50_000, // Target = 15,000,000
      swr: 4.0,
    };

    const res = simulateFire(settings, 16_000_000, 650_000);
    expect(res.progressPercent).toBe(100);
    expect(res.remainingGap).toBe(0);
    expect(res.monthsToTarget).toBe(0);
    expect(res.yearsToTarget).toBe(0);
    expect(res.formattedCountdown).toContain('已達成');
    expect(res.dividendCoveragePercent).toBeGreaterThanOrEqual(100);
  });

  it('simulates forward progression and calculates realistic countdown', () => {
    const settings = {
      ...DEFAULT_FIRE_SETTINGS,
      monthlyExpense: 40_000, // Target = 12,000,000
      monthlyInvestment: 30_000,
      expectedAnnualReturn: 8.0,
      inflationRate: 2.0,
      useInflationAdjusted: true,
      swr: 4.0,
    };

    const currentNetWorth = 2_000_000;
    const currentDividends = 80_000;
    const fixedNow = new Date('2026-10-17');

    const res = simulateFire(settings, currentNetWorth, currentDividends, fixedNow);

    expect(res.targets.standardTarget).toBe(12_000_000);
    expect(res.progressPercent).toBeCloseTo((2_000_000 / 12_000_000) * 100, 1);
    expect(res.remainingGap).toBe(10_000_000);
    expect(res.monthsToTarget).toBeGreaterThan(0);
    expect(res.monthsToTarget).toBeLessThan(300); // Should reach within 25 years
    expect(res.projections.length).toBe(31); // 0 to 30 years
    expect(res.projections[0].netWorth).toBe(2_000_000);
    expect(res.projections[30].netWorth).toBeGreaterThan(res.projections[0].netWorth);

    // Accelerators should be computed
    expect(res.accelerators.boostInvestmentAdvanceYears).toBeGreaterThan(0);
    expect(res.accelerators.cutExpenseAdvanceYears).toBeGreaterThan(0);
  });
});
