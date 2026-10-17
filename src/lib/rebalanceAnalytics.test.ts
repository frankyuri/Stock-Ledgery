import { describe, it, expect } from 'vitest';
import {
  calculatePortfolioDrift,
  calculateCashInRebalance,
  calculateFullRebalance,
  validateAndNormalizeAllocations,
  type HoldingPosition,
  type TargetAllocationItem,
} from './rebalanceAnalytics';

describe('rebalanceAnalytics', () => {
  const mockHoldings: HoldingPosition[] = [
    {
      symbol: '0050.TW',
      name: '元大台灣50',
      shares: 1000,
      currentPrice: 180,
      marketValue: 180_000, // 60%
      currency: 'TWD',
    },
    {
      symbol: 'VTI',
      name: 'VTI',
      shares: 10,
      currentPrice: 8000, // 8,000 TWD
      marketValue: 80_000, // 26.7%
      currency: 'TWD',
    },
    {
      symbol: 'BND',
      name: 'BND',
      shares: 20,
      currentPrice: 2000, // 2,000 TWD
      marketValue: 40_000, // 13.3%
      currency: 'TWD',
    },
  ]; // Total = 300,000

  const targetAllocations: TargetAllocationItem[] = [
    { symbol: '0050.TW', targetWeight: 40 }, // Target: 40% (current: 60% -> OVERWEIGHT +20%)
    { symbol: 'VTI', targetWeight: 40 }, // Target: 40% (current: 26.7% -> UNDERWEIGHT -13.3%)
    { symbol: 'BND', targetWeight: 20 }, // Target: 20% (current: 13.3% -> UNDERWEIGHT -6.7%)
  ];

  it('validates target allocation total weight correctly', () => {
    const valid = validateAndNormalizeAllocations(targetAllocations);
    expect(valid.isValid).toBe(true);
    expect(valid.totalWeight).toBe(100);

    const invalid = validateAndNormalizeAllocations([
      { symbol: 'AAPL', targetWeight: 50 },
      { symbol: 'MSFT', targetWeight: 40 },
    ]);
    expect(invalid.isValid).toBe(false);
    expect(invalid.totalWeight).toBe(90);
  });

  it('calculates portfolio drift and labels overweight/underweight positions accurately', () => {
    const res = calculatePortfolioDrift(mockHoldings, targetAllocations, 2.0);
    expect(res.totalMarketValue).toBe(300_000);
    expect(res.isPortfolioBalanced).toBe(false);

    const tw50 = res.drifts.find((d) => d.symbol === '0050.TW')!;
    expect(tw50.status).toBe('OVERWEIGHT');
    expect(tw50.drift).toBeGreaterThan(15);

    const vti = res.drifts.find((d) => d.symbol === 'VTI')!;
    expect(vti.status).toBe('UNDERWEIGHT');
    expect(vti.drift).toBeLessThan(-10);

    const bnd = res.drifts.find((d) => d.symbol === 'BND')!;
    expect(bnd.status).toBe('UNDERWEIGHT');
  });

  it('optimally distributes new cash only to underweighted assets (Buy-Only Rebalance)', () => {
    // Inject 60,000 new cash
    const newCash = 60_000;
    const res = calculateCashInRebalance(
      mockHoldings,
      targetAllocations,
      newCash,
      'FRACTIONAL_OR_ODD',
    );

    expect(res.totalCurrentValue).toBe(300_000);
    expect(res.newCashInput).toBe(newCash);
    expect(res.totalPostValue).toBe(300_000 + (newCash - res.cashRemaining));

    // 0050.TW is already overweight (60% vs 40%), so it should NOT be recommended for purchase
    const tw50 = res.recommendations.find((r) => r.symbol === '0050.TW')!;
    expect(tw50.recommendedShares).toBe(0);
    expect(tw50.cost).toBe(0);

    // VTI and BND are underweight, so all cash should go to VTI and BND
    const vti = res.recommendations.find((r) => r.symbol === 'VTI')!;
    const bnd = res.recommendations.find((r) => r.symbol === 'BND')!;

    expect(vti.recommendedShares).toBeGreaterThan(0);
    expect(bnd.recommendedShares).toBeGreaterThan(0);

    // After rebalancing, drift of VTI and BND should be significantly closer to 0
    expect(Math.abs(vti.driftAfter)).toBeLessThan(Math.abs(vti.driftBefore));
    expect(Math.abs(bnd.driftAfter)).toBeLessThan(Math.abs(bnd.driftBefore));
  });

  it('calculates full rebalance buy and sell actions with estimated fees and taxes', () => {
    const res = calculateFullRebalance(mockHoldings, targetAllocations, 0.6);

    expect(res.totalCurrentValue).toBe(300_000);
    expect(res.actions.length).toBeGreaterThanOrEqual(3);

    // 0050.TW should have SELL action
    const tw50Action = res.actions.find((a) => a.symbol === '0050.TW')!;
    expect(tw50Action.action).toBe('SELL');
    expect(tw50Action.deltaShares).toBeLessThan(0);
    expect(tw50Action.estimatedTax).toBeGreaterThan(0);

    // VTI and BND should have BUY action
    const vtiAction = res.actions.find((a) => a.symbol === 'VTI')!;
    expect(vtiAction.action).toBe('BUY');
    expect(vtiAction.deltaShares).toBeGreaterThan(0);

    expect(res.totalSellAmount).toBeGreaterThan(0);
    expect(res.totalBuyAmount).toBeGreaterThan(0);
    expect(res.totalFeesAndTaxes).toBeGreaterThan(0);
  });
});
