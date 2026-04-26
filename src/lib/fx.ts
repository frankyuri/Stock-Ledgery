/**
 * 簡易匯率折算。離線靜態值（更新頻率：低），用於 Asset 走勢圖把不同幣別
 * 折算成 base currency 做合計。實際成交價請以即時報價為準。
 *
 * 之後若接 ECB / Yahoo X=X 即時匯率 API，把這支抽成 fetcher 即可。
 */

/** 1 單位 from 換成多少 to */
const RATE_TABLE: Record<string, number> = {
  // base = USD
  USD_USD: 1,
  TWD_USD: 1 / 32.5,
  HKD_USD: 1 / 7.8,
  JPY_USD: 1 / 155,
  EUR_USD: 1.08,
  CNY_USD: 1 / 7.2,
  GBP_USD: 1.27,

  // base = TWD
  USD_TWD: 32.5,
  TWD_TWD: 1,
  HKD_TWD: 32.5 / 7.8,
  JPY_TWD: 32.5 / 155,
  EUR_TWD: 1.08 * 32.5,
  CNY_TWD: 32.5 / 7.2,
  GBP_TWD: 1.27 * 32.5,
};

/** 直查或反查；找不到回 null（不要靜默回 1） */
function lookup(from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = RATE_TABLE[`${from}_${to}`];
  if (direct != null) return direct;
  const inverse = RATE_TABLE[`${to}_${from}`];
  if (inverse != null && inverse !== 0) return 1 / inverse;
  return null;
}

/**
 * 換算 amount 從 from 到 to。換不到時回傳 null（呼叫端自行決定要 skip
 * 還是顯示警告，避免「USD 數值套上 EUR 標籤」這種靜默錯誤）。
 */
export function convert(amount: number, from: string, to: string): number | null {
  if (!Number.isFinite(amount)) return null;
  const direct = lookup(from, to);
  if (direct != null) return amount * direct;
  // 經 USD 中轉（兩段都允許用反查）
  const fromUsd = lookup(from, 'USD');
  const usdTo = lookup('USD', to);
  if (fromUsd != null && usdTo != null) return amount * fromUsd * usdTo;
  return null;
}

export function isSupported(currency: string): boolean {
  return lookup(currency, 'USD') != null;
}

export const SUPPORTED_BASE_CURRENCIES = ['TWD', 'USD'] as const;
export type BaseCurrency = (typeof SUPPORTED_BASE_CURRENCIES)[number];
