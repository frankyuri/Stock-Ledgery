import { describe, it, expect } from 'vitest';
import { calculateRiskMetrics } from './riskAnalytics';
import type { Candle } from '@/types/stock';

describe('riskAnalytics', () => {
  it('handles empty inputs safely', () => {
    const res = calculateRiskMetrics(new Map(), new Map());
    expect(res.cumulativeReturn).toBe(0);
    expect(res.sharpeRatio).toBe(0);
    expect(res.maxDrawdown).toBe(0);
  });

  it('calculates metrics for a known sequence', () => {
    const weights = new Map([['AAPL', 1.0]]);
    const candles: Candle[] = [
      { time: '2026-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
      { time: '2026-01-02', open: 100, high: 110, low: 99, close: 105, volume: 1000 }, // +5%
      { time: '2026-01-03', open: 105, high: 105, low: 95, close: 95, volume: 1000 },  // -9.52% (peak 105 -> 95, DD = -9.52%)
      { time: '2026-01-04', open: 95, high: 102, low: 94, close: 100, volume: 1000 },   // +5.26%
      { time: '2026-01-05', open: 100, high: 112, low: 99, close: 110, volume: 1000 },  // +10%
      { time: '2026-01-06', open: 110, high: 115, low: 108, close: 112, volume: 1000 }, // +1.8%
    ];

    const candleMap = new Map([['AAPL', candles]]);
    const res = calculateRiskMetrics(weights, candleMap);

    expect(res.dataPointsCount).toBe(5);
    // Cumulative return: 112 / 100 - 1 = +12%
    expect(res.cumulativeReturn).toBe(12);
    // Max drawdown was (95 - 105) / 105 = -9.52%
    expect(res.maxDrawdown).toBeCloseTo(-9.52, 1);
    expect(res.timeSeries.length).toBe(5);
  });
});
