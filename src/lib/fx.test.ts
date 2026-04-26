import { describe, expect, it } from 'vitest';
import { convert, isSupported } from './fx';

describe('convert', () => {
  it('同幣別回傳原值', () => {
    expect(convert(100, 'USD', 'USD')).toBe(100);
    expect(convert(100, 'TWD', 'TWD')).toBe(100);
  });

  it('直接表查找：TWD → USD', () => {
    // 1 / 32.5
    expect(convert(325, 'TWD', 'USD')).toBeCloseTo(10, 5);
  });

  it('反向查找：USD → EUR（表內只有 EUR_USD）', () => {
    // EUR_USD = 1.08，所以 USD_EUR = 1/1.08
    expect(convert(108, 'USD', 'EUR')).toBeCloseTo(100, 5);
  });

  it('經 USD 中轉：JPY → EUR', () => {
    // JPY → USD → EUR：(155 / 155) * (1/1.08) = 1/1.08
    expect(convert(155, 'JPY', 'EUR')).toBeCloseTo(1 / 1.08, 5);
  });

  it('完全找不到：回 null（不要靜默回原值）', () => {
    expect(convert(100, 'XYZ', 'USD')).toBeNull();
    expect(convert(100, 'USD', 'XYZ')).toBeNull();
  });

  it('NaN / Infinity 回 null', () => {
    expect(convert(NaN, 'USD', 'TWD')).toBeNull();
    expect(convert(Infinity, 'USD', 'TWD')).toBeNull();
  });
});

describe('isSupported', () => {
  it('已知幣別回 true', () => {
    expect(isSupported('USD')).toBe(true);
    expect(isSupported('TWD')).toBe(true);
    expect(isSupported('JPY')).toBe(true);
    expect(isSupported('EUR')).toBe(true);
  });

  it('未知幣別回 false', () => {
    expect(isSupported('XYZ')).toBe(false);
  });
});
