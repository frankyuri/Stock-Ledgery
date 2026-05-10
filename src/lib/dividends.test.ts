import { describe, expect, it } from 'vitest';
import { computeDividendStats, estimateAnnualIncome } from './dividends';
import type { DividendEvent, Transaction } from '@/types/stock';

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, 'type' | 'symbol' | 'shares' | 'price' | 'tradedAt'>,
): Transaction {
  return {
    id: partial.tradedAt + partial.type + partial.symbol,
    fee: 0,
    ...partial,
  };
}

const div = (date: string, amount: number): DividendEvent => ({ date, amount });

describe('computeDividendStats', () => {
  it('沒持股時所有配息都不計入', () => {
    const txns: Transaction[] = [
      tx({
        type: 'BUY',
        symbol: 'AAPL',
        shares: 10,
        price: 100,
        tradedAt: '2025-02-01',
      }),
    ];
    const events = [div('2025-01-15', 0.25)]; // 早於買入 → 不算
    const stats = computeDividendStats('AAPL', txns, events);
    expect(stats.totalIncome).toBe(0);
    expect(stats.paidEventCount).toBe(0);
  });

  it('依除息日當下持股計算', () => {
    const txns: Transaction[] = [
      tx({
        type: 'BUY',
        symbol: 'AAPL',
        shares: 10,
        price: 100,
        tradedAt: '2025-01-01',
      }),
      tx({
        type: 'BUY',
        symbol: 'AAPL',
        shares: 5,
        price: 110,
        tradedAt: '2025-04-01',
      }),
    ];
    const events = [
      div('2025-02-15', 0.25), // 此時 10 股 → 2.5
      div('2025-05-15', 0.25), // 此時 15 股 → 3.75
    ];
    const stats = computeDividendStats('AAPL', txns, events);
    expect(stats.totalIncome).toBeCloseTo(6.25, 2);
    expect(stats.paidEventCount).toBe(2);
    expect(stats.rows).toHaveLength(2);
    // rows 應為新→舊
    expect(stats.rows[0].date).toBe('2025-05-15');
  });

  it('賣光後不再領到配息', () => {
    const txns: Transaction[] = [
      tx({
        type: 'BUY',
        symbol: 'AAPL',
        shares: 10,
        price: 100,
        tradedAt: '2025-01-01',
      }),
      tx({
        type: 'SELL',
        symbol: 'AAPL',
        shares: 10,
        price: 120,
        tradedAt: '2025-03-01',
      }),
    ];
    const events = [div('2025-04-15', 0.25)];
    const stats = computeDividendStats('AAPL', txns, events);
    expect(stats.totalIncome).toBe(0);
    expect(stats.paidEventCount).toBe(0);
  });

  it('其他 symbol 的交易不影響本 symbol 的配息計算', () => {
    const txns: Transaction[] = [
      tx({
        type: 'BUY',
        symbol: 'NVDA',
        shares: 100,
        price: 600,
        tradedAt: '2025-01-01',
      }),
      tx({
        type: 'BUY',
        symbol: 'AAPL',
        shares: 10,
        price: 100,
        tradedAt: '2025-01-01',
      }),
    ];
    const events = [div('2025-02-15', 0.25)];
    const stats = computeDividendStats('AAPL', txns, events);
    // 只算 AAPL 的 10 股
    expect(stats.totalIncome).toBeCloseTo(2.5, 2);
  });
});

describe('estimateAnnualIncome', () => {
  it('= per-share × shares', () => {
    expect(estimateAnnualIncome(1, 100)).toBe(100);
    expect(estimateAnnualIncome(0.96, 50)).toBe(48);
  });
});
