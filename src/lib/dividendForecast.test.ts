import { describe, it, expect } from 'vitest';
import {
  detectPayoutPattern,
  calculatePortfolioDividends,
} from './dividendForecast';
import type { DividendEvent, Holding, Quote, Transaction } from '@/types/stock';

describe('dividendForecast', () => {
  it('detects payout pattern correctly', () => {
    const divs: DividendEvent[] = [
      { date: '2025-03-15', amount: 0.25 },
      { date: '2025-06-15', amount: 0.25 },
      { date: '2025-09-15', amount: 0.25 },
      { date: '2025-12-15', amount: 0.25 },
    ];
    const pattern = detectPayoutPattern(divs);
    expect(pattern.frequency).toBe('QUARTERLY');
    expect(pattern.months).toEqual([3, 6, 9, 12]);
  });

  it('calculates portfolio dividends correctly', () => {
    const holdings: Holding[] = [
      { symbol: 'AAPL', shares: 100, avgCost: 150 },
      { symbol: 'MSFT', shares: 50, avgCost: 300 },
    ];

    const transactions: Transaction[] = [
      {
        id: 't1',
        symbol: 'AAPL',
        type: 'BUY',
        shares: 100,
        price: 150,
        fee: 0,
        tradedAt: '2024-01-01',
      },
      {
        id: 't2',
        symbol: 'MSFT',
        type: 'BUY',
        shares: 50,
        price: 300,
        fee: 0,
        tradedAt: '2024-01-01',
      },
    ];

    const quotesMap = new Map<string, Quote>([
      [
        'AAPL',
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          price: 200,
          change: 2,
          changePercent: 1,
          previousClose: 198,
          currency: 'USD',
        },
      ],
      [
        'MSFT',
        {
          symbol: 'MSFT',
          name: 'Microsoft Corp',
          price: 400,
          change: 5,
          changePercent: 1.2,
          previousClose: 395,
          currency: 'USD',
        },
      ],
    ]);

    const todayISO = new Date().toISOString().slice(0, 10);
    const recentDate = todayISO;

    const dividendsMap = new Map<string, DividendEvent[]>([
      [
        'AAPL',
        [
          { date: recentDate, amount: 1.0 }, // trailing 12m = 1.0
        ],
      ],
      [
        'MSFT',
        [
          { date: recentDate, amount: 3.0 }, // trailing 12m = 3.0
        ],
      ],
    ]);

    const result = calculatePortfolioDividends(
      holdings,
      transactions,
      quotesMap,
      dividendsMap,
    );

    // AAPL: 100 shares * 1.0 = 100
    // MSFT: 50 shares * 3.0 = 150
    // Total annual income: 250
    expect(result.totalAnnualIncome).toBe(250);
    expect(result.avgMonthlyIncome).toBeCloseTo(20.83, 1);
    expect(result.items.length).toBe(2);
    expect(result.monthlyForecast.length).toBe(12);
  });
});
