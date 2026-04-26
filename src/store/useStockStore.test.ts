import { describe, expect, it } from 'vitest';
import { computeRealizedForSell, reconcileHoldings } from './useStockStore';
import type { Transaction } from '@/types/stock';

function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'symbol' | 'shares' | 'price' | 'tradedAt'>): Transaction {
  return { id: partial.tradedAt + partial.type + partial.symbol, fee: 0, ...partial };
}

describe('reconcileHoldings', () => {
  it('回傳空陣列當沒有交易', () => {
    expect(reconcileHoldings([])).toEqual([]);
  });

  it('單筆 BUY 把手續費攤入成本', () => {
    const result = reconcileHoldings([
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 5, tradedAt: '2025-01-01' }),
    ]);
    // (10 * 100 + 5) / 10 = 100.5
    expect(result).toEqual([{ symbol: 'AAPL', shares: 10, avgCost: 100.5 }]);
  });

  it('多筆 BUY 用加權平均（含手續費）', () => {
    const result = reconcileHoldings([
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 200, fee: 0, tradedAt: '2025-01-02' }),
    ]);
    expect(result[0].avgCost).toBe(150);
    expect(result[0].shares).toBe(20);
  });

  it('SELL 扣減股數但平均成本不變', () => {
    const result = reconcileHoldings([
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
      tx({ type: 'SELL', symbol: 'AAPL', shares: 4, price: 200, fee: 0, tradedAt: '2025-01-02' }),
    ]);
    expect(result).toEqual([{ symbol: 'AAPL', shares: 6, avgCost: 100 }]);
  });

  it('賣到 0 從持股移除', () => {
    const result = reconcileHoldings([
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
      tx({ type: 'SELL', symbol: 'AAPL', shares: 10, price: 200, fee: 0, tradedAt: '2025-01-02' }),
    ]);
    expect(result).toEqual([]);
  });

  it('沒持有就不能賣（SELL 被忽略）', () => {
    const result = reconcileHoldings([
      tx({ type: 'SELL', symbol: 'AAPL', shares: 5, price: 100, fee: 0, tradedAt: '2025-01-01' }),
    ]);
    expect(result).toEqual([]);
  });

  it('依 tradedAt 排序，亂序輸入結果一致', () => {
    const ordered = reconcileHoldings([
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 200, fee: 0, tradedAt: '2025-01-02' }),
    ]);
    const reversed = reconcileHoldings([
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 200, fee: 0, tradedAt: '2025-01-02' }),
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
    ]);
    expect(ordered).toEqual(reversed);
  });

  it('多檔股票各自結算', () => {
    const result = reconcileHoldings([
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
      tx({ type: 'BUY', symbol: 'NVDA', shares: 5, price: 500, fee: 0, tradedAt: '2025-01-01' }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((h) => h.symbol === 'AAPL')?.avgCost).toBe(100);
    expect(result.find((h) => h.symbol === 'NVDA')?.avgCost).toBe(500);
  });
});

describe('computeRealizedForSell', () => {
  it('賣價 > 成本：正損益（扣手續費）', () => {
    const buys: Transaction[] = [
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
    ];
    const realized = computeRealizedForSell(buys, {
      type: 'SELL', symbol: 'AAPL', shares: 5, price: 150, fee: 1, tradedAt: '2025-01-02',
    });
    // (150 - 100) * 5 - 1 = 249
    expect(realized).toBe(249);
  });

  it('賣價 < 成本：負損益', () => {
    const buys: Transaction[] = [
      tx({ type: 'BUY', symbol: 'AAPL', shares: 10, price: 100, fee: 0, tradedAt: '2025-01-01' }),
    ];
    const realized = computeRealizedForSell(buys, {
      type: 'SELL', symbol: 'AAPL', shares: 5, price: 80, fee: 0, tradedAt: '2025-01-02',
    });
    expect(realized).toBe(-100);
  });

  it('沒持有就回 0', () => {
    const realized = computeRealizedForSell([], {
      type: 'SELL', symbol: 'AAPL', shares: 5, price: 100, fee: 0, tradedAt: '2025-01-02',
    });
    expect(realized).toBe(0);
  });
});
