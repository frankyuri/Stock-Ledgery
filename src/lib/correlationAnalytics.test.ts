import { describe, it, expect } from 'vitest';
import {
  calculateCorrelationMatrix,
  calculatePortfolioHealthScore,
} from './correlationAnalytics';
import type { Candle } from '@/types/stock';

describe('correlationAnalytics', () => {
  it('correctly calculates Pearson correlation for perfectly correlated and negatively correlated assets', () => {
    // 建立 10 天的價格序列
    // A: 每天上漲 1
    // B: 每天上漲 2 (與 A 相關係數應為 1.0)
    // C: 每天下跌 1 (與 A 相關係數應為 -1.0)
    const dates = [
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ];

    const candlesA: Candle[] = dates.map((time, idx) => {
      // 偶數天上漲 2%，奇數天下跌 2%
      const price = idx % 2 === 0 ? 100 * Math.pow(1.02, idx) : 100 * Math.pow(0.98, idx);
      return {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1000,
      };
    });

    const candlesB: Candle[] = dates.map((time, idx) => {
      // 與 A 步調一致
      const price = idx % 2 === 0 ? 200 * Math.pow(1.02, idx) : 200 * Math.pow(0.98, idx);
      return {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1000,
      };
    });

    const candlesC: Candle[] = dates.map((time, idx) => {
      // 與 A 步調相反：偶數天下跌，奇數天上漲
      const price = idx % 2 === 0 ? 150 * Math.pow(0.98, idx) : 150 * Math.pow(1.02, idx);
      return {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1000,
      };
    });

    const candleMap = new Map<string, Candle[]>([
      ['SYM_A', candlesA],
      ['SYM_B', candlesB],
      ['SYM_C', candlesC],
    ]);

    const result = calculateCorrelationMatrix(['SYM_A', 'SYM_B', 'SYM_C'], candleMap);

    expect(result.symbols).toEqual(['SYM_A', 'SYM_B', 'SYM_C']);
    // Diagonal must be 1.0
    expect(result.matrix[0][0]).toBe(1.0);
    expect(result.matrix[1][1]).toBe(1.0);
    expect(result.matrix[2][2]).toBe(1.0);

    // SYM_A and SYM_B have high positive correlation
    expect(result.matrix[0][1]).toBeGreaterThanOrEqual(0.95);
    expect(result.matrix[1][0]).toBe(result.matrix[0][1]);

    // SYM_A and SYM_C have negative correlation
    expect(result.matrix[0][2]).toBeLessThanOrEqual(-0.95);
    expect(result.matrix[2][0]).toBe(result.matrix[0][2]);

    expect(result.pairs.length).toBe(3);
    expect(result.highRiskPairs.length).toBeGreaterThanOrEqual(1);
    expect(result.hedgingPairs.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty input gracefully', () => {
    const result = calculateCorrelationMatrix([], new Map());
    expect(result.symbols).toEqual([]);
    expect(result.matrix).toEqual([]);
    expect(result.averageCorrelation).toBe(0);
  });

  it('evaluates portfolio health score with balanced diversified input', () => {
    const health = calculatePortfolioHealthScore({
      holdingsCount: 8,
      maxWeight: 18.5,
      top3Weight: 45.0,
      averageCorrelation: 0.28,
      sharpeRatio: 1.45,
      maxDrawdown: -12.5,
      annualizedVolatility: 15.2,
      beta: 0.92,
      stressResilienceRating: 'A',
    });

    expect(health.overallScore).toBeGreaterThanOrEqual(80);
    expect(['S', 'A']).toContain(health.grade);
    expect(health.pillars.diversification).toBeGreaterThanOrEqual(80);
    expect(health.pillars.riskControl).toBeGreaterThanOrEqual(80);
    expect(health.strengths.length).toBeGreaterThan(0);
    expect(health.warnings.length).toBe(0);
  });

  it('triggers warnings and lower grade when concentrated in single holding', () => {
    const health = calculatePortfolioHealthScore({
      holdingsCount: 2,
      maxWeight: 68.0,
      top3Weight: 100.0,
      averageCorrelation: 0.85,
      sharpeRatio: 0.35,
      maxDrawdown: -38.5,
      annualizedVolatility: 34.0,
      beta: 1.6,
      stressResilienceRating: 'D',
    });

    expect(health.overallScore).toBeLessThan(65);
    expect(['C', 'D']).toContain(health.grade);
    expect(health.warnings.some((w) => w.includes('超過 25%'))).toBe(true);
    expect(health.recommendations.length).toBeGreaterThan(0);
  });
});
