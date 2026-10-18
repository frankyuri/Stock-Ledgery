import { useStockStore } from '@/store/useStockStore';
import { formatNumber } from '@/lib/format';

export type CurrencyType = 'TWD' | 'USD';

/**
 * 純函數：換算金額
 */
export function convertCurrency(
  amount: number,
  from: CurrencyType,
  to: CurrencyType,
  fxRate: number = 32.5,
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  if (from === 'TWD' && to === 'USD') {
    return fxRate > 0 ? amount / fxRate : amount;
  }
  if (from === 'USD' && to === 'TWD') {
    return amount * fxRate;
  }
  return amount;
}

/**
 * 純函數：格式化金額與幣別符號
 */
export function formatCurrencyWithSymbol(
  amount: number,
  from: CurrencyType,
  to: CurrencyType,
  fxRate: number = 32.5,
  digits?: number,
): string {
  const val = convertCurrency(amount, from, to, fxRate);
  const d = digits ?? (to === 'USD' ? 2 : 0);
  const prefix = to === 'TWD' ? 'NT$ ' : '$ ';
  return `${prefix}${formatNumber(val, d)}`;
}

export function useCurrency() {
  const baseCurrency = useStockStore((s) => s.baseCurrency ?? 'TWD');
  const fxRate = useStockStore((s) => s.fxRate ?? 32.5);
  const setBaseCurrency = useStockStore((s) => s.setBaseCurrency);
  const setFxRate = useStockStore((s) => s.setFxRate);

  /**
   * 將特定金額依當前匯率折算為使用者的基底幣別 (baseCurrency)
   */
  const convertToBase = (amount: number, from: CurrencyType = 'TWD'): number => {
    return convertCurrency(amount, from, baseCurrency, fxRate);
  };

  /**
   * 格式化為包含幣別符號之金額字串
   */
  const formatMoney = (
    amount: number,
    from: CurrencyType = 'TWD',
    digits?: number,
  ): string => {
    return formatCurrencyWithSymbol(amount, from, baseCurrency, fxRate, digits);
  };

  const currencySymbol = baseCurrency === 'TWD' ? 'NT$' : '$';

  const toggleCurrency = () => {
    setBaseCurrency(baseCurrency === 'TWD' ? 'USD' : 'TWD');
  };

  return {
    baseCurrency,
    setBaseCurrency,
    fxRate,
    setFxRate,
    convertToBase,
    formatMoney,
    currencySymbol,
    toggleCurrency,
  };
}
