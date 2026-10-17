export interface TransactionData {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  fee: number;
  tax?: number;
  tradedAt: string;
  note?: string | null;
  realizedGainLoss?: number | null;
}

export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
}

export function round(n: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * 從歷史交易記錄依時間序列重新計算持股（加權平均成本法）
 */
export function reconcileHoldings(transactions: TransactionData[]): Holding[] {
  const sorted = [...transactions].sort((a, b) =>
    a.tradedAt.localeCompare(b.tradedAt) || a.id.localeCompare(b.id)
  );

  const map = new Map<string, Holding>();

  for (const t of sorted) {
    const prev = map.get(t.symbol);
    const shares = Number(t.shares);
    const price = Number(t.price);
    const fee = Number(t.fee || 0);

    if (t.type === 'BUY') {
      if (!prev) {
        const avg = shares > 0 ? price + fee / shares : price;
        map.set(t.symbol, {
          symbol: t.symbol,
          shares: round(shares, 8),
          avgCost: round(avg, 4),
        });
      } else {
        const newShares = prev.shares + shares;
        const newAvg =
          newShares > 0
            ? (prev.shares * prev.avgCost + shares * price + fee) / newShares
            : prev.avgCost;
        map.set(t.symbol, {
          symbol: t.symbol,
          shares: round(newShares, 8),
          avgCost: round(newAvg, 4),
        });
      }
    } else if (t.type === 'SELL') {
      if (!prev) continue;
      const newShares = prev.shares - shares;
      if (newShares <= 1e-6) {
        map.delete(t.symbol);
      } else {
        map.set(t.symbol, {
          symbol: t.symbol,
          shares: round(newShares, 8),
          avgCost: prev.avgCost,
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * 依時間順序重新計算所有 SELL 交易的已實現損益
 */
export function recalculateAllRealizedGains(
  transactions: TransactionData[]
): TransactionData[] {
  const sorted = [...transactions].sort((a, b) =>
    a.tradedAt.localeCompare(b.tradedAt) || a.id.localeCompare(b.id)
  );

  const runningHoldings = new Map<string, Holding>();
  const updatedList: TransactionData[] = [];

  for (const t of sorted) {
    const shares = Number(t.shares);
    const price = Number(t.price);
    const fee = Number(t.fee || 0);
    const tax = Number(t.tax || 0);
    const prev = runningHoldings.get(t.symbol);

    if (t.type === 'BUY') {
      if (!prev) {
        const avg = shares > 0 ? price + fee / shares : price;
        runningHoldings.set(t.symbol, {
          symbol: t.symbol,
          shares: round(shares, 8),
          avgCost: round(avg, 4),
        });
      } else {
        const newShares = prev.shares + shares;
        const newAvg =
          newShares > 0
            ? (prev.shares * prev.avgCost + shares * price + fee) / newShares
            : prev.avgCost;
        runningHoldings.set(t.symbol, {
          symbol: t.symbol,
          shares: round(newShares, 8),
          avgCost: round(newAvg, 4),
        });
      }
      updatedList.push({ ...t, realizedGainLoss: null });
    } else if (t.type === 'SELL') {
      const avgCostBeforeSell = prev ? prev.avgCost : 0;
      const realized = round(
        (price - avgCostBeforeSell) * shares - fee - tax,
        4
      );

      if (prev) {
        const remainingShares = prev.shares - shares;
        if (remainingShares <= 1e-6) {
          runningHoldings.delete(t.symbol);
        } else {
          runningHoldings.set(t.symbol, {
            symbol: t.symbol,
            shares: round(remainingShares, 8),
            avgCost: prev.avgCost,
          });
        }
      }

      updatedList.push({ ...t, realizedGainLoss: realized });
    }
  }

  return updatedList;
}

/**
 * 計算單筆 SELL 新單之預計已實現損益（在寫入資料庫前）
 */
export function computeRealizedForSell(
  transactions: TransactionData[],
  pending: { symbol: string; shares: number; price: number; fee: number; tax?: number }
): { realizedGainLoss: number; holdingBeforeSell: Holding | null } {
  const currentHoldings = reconcileHoldings(transactions);
  const holding = currentHoldings.find((h) => h.symbol === pending.symbol) || null;
  const avgCost = holding ? holding.avgCost : 0;
  const fee = pending.fee || 0;
  const tax = pending.tax || 0;

  const realizedGainLoss = round(
    (pending.price - avgCost) * pending.shares - fee - tax,
    4
  );

  return { realizedGainLoss, holdingBeforeSell: holding };
}
