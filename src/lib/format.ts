export function formatCurrency(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('zh-Hant', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('zh-Hant', {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function changeColor(value: number): string {
  if (value > 0) return 'text-up';
  if (value < 0) return 'text-down';
  return 'text-ink-mute';
}
