import { describe, it, expect, beforeEach } from 'vitest';
import { useStockStore, buildBackupSnapshot } from '@/store/useStockStore';
import { convertCurrency, formatCurrencyWithSymbol } from './useCurrency';

describe('Currency conversion and formatting logic', () => {
  describe('convertCurrency', () => {
    it('同幣別轉換維持原值', () => {
      expect(convertCurrency(100, 'TWD', 'TWD', 32.5)).toBe(100);
      expect(convertCurrency(50, 'USD', 'USD', 32.5)).toBe(50);
    });

    it('TWD 轉 USD：正確除以匯率', () => {
      expect(convertCurrency(325, 'TWD', 'USD', 32.5)).toBe(10);
      expect(convertCurrency(650, 'TWD', 'USD', 32.5)).toBe(20);
    });

    it('USD 轉 TWD：正確乘以匯率', () => {
      expect(convertCurrency(10, 'USD', 'TWD', 32.5)).toBe(325);
      expect(convertCurrency(100, 'USD', 'TWD', 30.0)).toBe(3000);
    });

    it('非有限數值回傳 0', () => {
      expect(convertCurrency(NaN, 'USD', 'TWD', 32.5)).toBe(0);
      expect(convertCurrency(Infinity, 'TWD', 'USD', 32.5)).toBe(0);
    });
  });

  describe('formatCurrencyWithSymbol', () => {
    it('TWD 格式化加上 NT$ 前綴', () => {
      expect(formatCurrencyWithSymbol(1250, 'TWD', 'TWD', 32.5)).toBe('NT$ 1,250');
      expect(formatCurrencyWithSymbol(100, 'USD', 'TWD', 32.5)).toBe('NT$ 3,250');
    });

    it('USD 格式化加上 $ 前綴', () => {
      expect(formatCurrencyWithSymbol(10, 'USD', 'USD', 32.5)).toBe('$ 10');
      expect(formatCurrencyWithSymbol(325, 'TWD', 'USD', 32.5)).toBe('$ 10');
    });

    it('小數金額正常顯示', () => {
      expect(formatCurrencyWithSymbol(10.55, 'USD', 'USD', 32.5, 2)).toBe('$ 10.55');
    });
  });

  describe('useStockStore 幣別設定與快照備份還原', () => {
    beforeEach(() => {
      useStockStore.setState({
        baseCurrency: 'TWD',
        fxRate: 32.5,
      });
    });

    it('預設為 TWD 與 32.5', () => {
      const state = useStockStore.getState();
      expect(state.baseCurrency).toBe('TWD');
      expect(state.fxRate).toBe(32.5);
    });

    it('可切換 baseCurrency 與修改 fxRate', () => {
      useStockStore.getState().setBaseCurrency('USD');
      useStockStore.getState().setFxRate(31.8);

      const state = useStockStore.getState();
      expect(state.baseCurrency).toBe('USD');
      expect(state.fxRate).toBe(31.8);
    });

    it('備份快照 buildBackupSnapshot 包含 baseCurrency 與 fxRate', () => {
      useStockStore.getState().setBaseCurrency('USD');
      useStockStore.getState().setFxRate(33.0);

      const snapshot = buildBackupSnapshot();
      expect(snapshot.baseCurrency).toBe('USD');
      expect(snapshot.fxRate).toBe(33.0);
    });

    it('還原備份 importBackup 正確恢復 baseCurrency 與 fxRate', () => {
      useStockStore.getState().importBackup({
        version: 1,
        exportedAt: '2026-10-18T00:00:00Z',
        transactions: [],
        assets: [],
        watchlist: [],
        baseCurrency: 'USD',
        fxRate: 31.5,
      });

      const state = useStockStore.getState();
      expect(state.baseCurrency).toBe('USD');
      expect(state.fxRate).toBe(31.5);
    });
  });
});
