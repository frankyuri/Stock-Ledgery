import { describe, it, expect } from 'vitest';
import {
  HISTORICAL_SCENARIOS,
  evaluateStressScenario,
  estimateAssetRiskProfile,
} from './stressTesting';

describe('Stress Testing Engine', () => {
  it('correctly classifies assets and default betas', () => {
    const tsla = estimateAssetRiskProfile('TSLA');
    expect(tsla.isTechOrGrowth).toBe(true);
    expect(tsla.isTaiwan).toBe(false);

    const tw2330 = estimateAssetRiskProfile('2330.TW');
    expect(tw2330.isTaiwan).toBe(true);
    expect(tw2330.isTechOrGrowth).toBe(true);

    const highDiv = estimateAssetRiskProfile('00878.TW');
    expect(highDiv.isDefensiveOrDividend).toBe(true);

    const cash = estimateAssetRiskProfile('CASH');
    expect(cash.isBondOrCash).toBe(true);
  });

  it('calculates portfolio stress impact under 2008 GFC scenario', () => {
    const scenario = HISTORICAL_SCENARIOS.find((s) => s.id === 'GFC_2008')!;
    expect(scenario).toBeDefined();

    const holdings = [
      { symbol: 'AAPL', name: 'Apple Inc.', marketValue: 600_000, beta: 1.2 },
      { symbol: '2330.TW', name: '台積電', marketValue: 400_000, beta: 1.1 },
    ];

    const result = evaluateStressScenario(scenario, holdings);
    expect(result.portfolioLossPct).toBeLessThan(-40);
    expect(result.portfolioLossAmount).toBeLessThan(-400_000);
    expect(result.projectedEndingValue).toBeGreaterThan(0);
    expect(result.items).toHaveLength(2);
    expect(['C', 'D']).toContain(result.resilienceRating);
  });

  it('handles empty portfolio gracefully', () => {
    const scenario = HISTORICAL_SCENARIOS[0];
    const result = evaluateStressScenario(scenario, []);
    expect(result.portfolioLossPct).toBe(0);
    expect(result.portfolioLossAmount).toBe(0);
    expect(result.projectedEndingValue).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});
