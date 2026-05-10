import type { DividendEvent, Transaction } from '@/types/stock';

export interface DividendIncomeRow {
  /** 除息日（ex-date） */
  date: string;
  /** 該日每股配息金額 */
  amount: number;
  /** 除息日當天持有股數（reconciled） */
  shares: number;
  /** = amount × shares */
  income: number;
}

export interface DividendStats {
  /** 從第一筆買入後算起，累計收到的配息 */
  totalIncome: number;
  /** 有實際領到（shares > 0）的事件數 */
  paidEventCount: number;
  /** 每筆配息明細，新→舊 */
  rows: DividendIncomeRow[];
  /** 過去 365 天每股配息加總（用來估年化） */
  trailing12mPerShare: number;
}

/**
 * 計算單一股票各除息日的個人實領金額。
 * 為了避免 N 個 dividend × N 筆 transaction 的雙迴圈，用線性掃描
 * 同時推進交易游標和配息游標。
 */
export function computeDividendStats(
  symbol: string,
  transactions: Transaction[],
  dividends: DividendEvent[],
): DividendStats {
  const txns = [...transactions]
    .filter((t) => t.symbol === symbol)
    .sort((a, b) => a.tradedAt.localeCompare(b.tradedAt));
  const events = [...dividends].sort((a, b) => a.date.localeCompare(b.date));

  let shares = 0;
  let txnIdx = 0;
  let totalIncome = 0;
  let paidEventCount = 0;
  const rowsAsc: DividendIncomeRow[] = [];

  for (const ev of events) {
    while (txnIdx < txns.length && txns[txnIdx].tradedAt <= ev.date) {
      const t = txns[txnIdx];
      if (t.type === 'BUY') shares += t.shares;
      else if (t.type === 'SELL') shares = Math.max(0, shares - t.shares);
      txnIdx += 1;
    }
    if (shares > 0) {
      const income = round(ev.amount * shares);
      totalIncome += income;
      paidEventCount += 1;
      rowsAsc.push({ date: ev.date, amount: ev.amount, shares, income });
    }
  }

  // trailing 12m per-share：用實際發生的配息（不依賴目前持股）
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const trailing12mPerShare = round(
    events
      .filter((d) => d.date >= cutoffISO)
      .reduce((s, d) => s + d.amount, 0),
  );

  return {
    totalIncome: round(totalIncome),
    paidEventCount,
    rows: rowsAsc.reverse(),
    trailing12mPerShare,
  };
}

/** 給呼叫端：用「最後一個非零持股」當基準也行；這裡單純算 ttm × current shares */
export function estimateAnnualIncome(
  trailing12mPerShare: number,
  currentShares: number,
): number {
  return round(trailing12mPerShare * currentShares);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
