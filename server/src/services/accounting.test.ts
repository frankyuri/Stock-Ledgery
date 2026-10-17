import { describe, it, expect } from 'vitest';
import {
  reconcileHoldings,
  recalculateAllRealizedGains,
  computeRealizedForSell,
  type TransactionData,
} from './accounting.js';

describe('Accounting Engine (Backend)', () => {
  it('correctly calculates weighted-average cost for multiple BUYs', () => {
    const txns: TransactionData[] = [
      {
        id: '1',
        symbol: '2330.TW',
        type: 'BUY',
        shares: 1000,
        price: 500,
        fee: 20,
        tradedAt: '2026-01-01',
      },
      {
        id: '2',
        symbol: '2330.TW',
        type: 'BUY',
        shares: 1000,
        price: 600,
        fee: 20,
        tradedAt: '2026-01-02',
      },
    ];

    const holdings = reconcileHoldings(txns);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].symbol).toBe('2330.TW');
    expect(holdings[0].shares).toBe(2000);
    // (1000 * 500.02 + 1000 * 600 + 20) / 2000 = (500020 + 600020) / 2000 = 550.02
    expect(holdings[0].avgCost).toBeCloseTo(550.02, 2);
  });

  it('correctly computes realized gain/loss when selling shares', () => {
    const txns: TransactionData[] = [
      {
        id: '1',
        symbol: 'AAPL',
        type: 'BUY',
        shares: 10,
        price: 150,
        fee: 5,
        tradedAt: '2026-01-01',
      },
      {
        id: '2',
        symbol: 'AAPL',
        type: 'SELL',
        shares: 5,
        price: 200,
        fee: 5,
        tradedAt: '2026-01-10',
      },
    ];

    const updated = recalculateAllRealizedGains(txns);
    expect(updated[1].realizedGainLoss).toBeDefined();
    // Buy cost: 150 + 5/10 = 150.5
    // Sell: (200 - 150.5) * 5 - 5 = 49.5 * 5 - 5 = 247.5 - 5 = 242.5
    expect(updated[1].realizedGainLoss).toBe(242.5);

    const holdings = reconcileHoldings(updated);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].shares).toBe(5);
    expect(holdings[0].avgCost).toBe(150.5);
  });

  it('handles complete liquidation (shares become 0)', () => {
    const txns: TransactionData[] = [
      {
        id: '1',
        symbol: 'TSLA',
        type: 'BUY',
        shares: 20,
        price: 200,
        fee: 0,
        tradedAt: '2026-01-01',
      },
      {
        id: '2',
        symbol: 'TSLA',
        type: 'SELL',
        shares: 20,
        price: 250,
        fee: 0,
        tradedAt: '2026-01-05',
      },
    ];

    const holdings = reconcileHoldings(txns);
    expect(holdings).toHaveLength(0);
  });
});
