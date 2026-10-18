import { describe, it, expect } from 'vitest';
import {
  calculateEtfOverlap,
  calculatePortfolioUnderlyingExposures,
} from './etfExposure';

describe('ETF Overlap and Exposure Analyzer', () => {
  it('detects high overlap between twin ETFs (0050 vs 006208)', () => {
    const analysis = calculateEtfOverlap('0050.TW', '006208.TW');
    expect(analysis).not.toBeNull();
    expect(analysis?.overlapPercentage).toBeGreaterThanOrEqual(95);
    expect(analysis?.commonConstituents.length).toBeGreaterThan(5);

    const tsmc = analysis?.commonConstituents.find((c) => c.symbol === '2330.TW');
    expect(tsmc).toBeDefined();
    expect(tsmc?.overlapWeight).toBeGreaterThan(50);
  });

  it('correctly calculates overlap between VOO and QQQ', () => {
    const analysis = calculateEtfOverlap('VOO', 'QQQ');
    expect(analysis).not.toBeNull();
    expect(analysis?.overlapPercentage).toBeGreaterThan(20);
    expect(analysis?.overlapPercentage).toBeLessThan(70);

    const msft = analysis?.commonConstituents.find((c) => c.symbol === 'MSFT');
    expect(msft).toBeDefined();
  });

  it('performs look-through aggregate exposure calculation for portfolio', () => {
    // 假設使用者持有 60% 0050.TW 和 40% 台積電 (2330.TW)
    const holdings = [
      { symbol: '0050.TW', name: '元大台灣50', marketValue: 600_000 },
      { symbol: '2330.TW', name: '台積電', marketValue: 400_000 },
    ];

    const exposures = calculatePortfolioUnderlyingExposures(holdings);
    expect(exposures.length).toBeGreaterThan(0);

    const tsmcExposure = exposures.find((e) => e.symbol === '2330.TW');
    expect(tsmcExposure).toBeDefined();

    // 直接 40% + 0050 裡面的台積電 (54.2% * 60% = 32.52%) => 總曝險約 72.5%
    expect(tsmcExposure?.directWeight).toBe(40);
    expect(tsmcExposure?.etfIndirectWeight).toBeGreaterThan(30);
    expect(tsmcExposure?.totalEffectiveWeight).toBeGreaterThan(70);
  });
});
