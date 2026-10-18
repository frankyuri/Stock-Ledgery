import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation } from './monteCarlo';

describe('Monte Carlo Simulation Engine Tests', () => {
  it('produces repeatable results given a fixed random seed', () => {
    const config = {
      initialNetWorth: 10_000_000,
      annualExpense: 400_000, // 4% SWR
      expectedReturn: 0.07,
      volatility: 0.15,
      years: 20,
      numSimulations: 500,
      seed: 42,
    };

    const res1 = runMonteCarloSimulation(config);
    const res2 = runMonteCarloSimulation(config);

    expect(res1.successRate).toBe(res2.successRate);
    expect(res1.medianEndingNetWorth).toBe(res2.medianEndingNetWorth);
    expect(res1.fanChart.length).toBe(21); // years 0..20
  });

  it('maintains monotonic ordering across percentiles in fan chart', () => {
    const res = runMonteCarloSimulation({
      initialNetWorth: 5_000_000,
      annualExpense: 200_000,
      years: 15,
      numSimulations: 300,
      seed: 123,
    });

    for (const point of res.fanChart) {
      expect(point.p5).toBeLessThanOrEqual(point.p10);
      expect(point.p10).toBeLessThanOrEqual(point.p25);
      expect(point.p25).toBeLessThanOrEqual(point.p50);
      expect(point.p50).toBeLessThanOrEqual(point.p75);
      expect(point.p75).toBeLessThanOrEqual(point.p90);
      expect(point.p90).toBeLessThanOrEqual(point.p95);
    }
  });

  it('achieves 100% survival rate with PERCENTAGE_OF_PORTFOLIO strategy', () => {
    const res = runMonteCarloSimulation({
      initialNetWorth: 5_000_000,
      annualExpense: 250_000,
      years: 25,
      numSimulations: 300,
      withdrawalStrategy: 'PERCENTAGE_OF_PORTFOLIO',
      seed: 777,
    });

    // 因為是以當前資產固定 % 提領，資產絕不會降至 0 以下
    expect(res.successRate).toBe(100);
    expect(res.ruinProbability).toBe(0);
    expect(res.failedRunsCount).toBe(0);
  });

  it('correctly detects critical risk when withdrawal rate is excessively high', () => {
    const res = runMonteCarloSimulation({
      initialNetWorth: 1_000_000,
      annualExpense: 300_000, // 30% SWR, will deplete very quickly
      years: 20,
      numSimulations: 300,
      seed: 999,
    });

    expect(res.successRate).toBeLessThan(50);
    expect(res.srrRiskLevel).toBe('CRITICAL');
    expect(res.earliestRuinYear).toBeDefined();
    expect(res.earliestRuinYear).toBeLessThanOrEqual(10);
  });
});
