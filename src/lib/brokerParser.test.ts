import { describe, it, expect } from 'vitest';
import {
  parseCSVToRows,
  sanitizeNumber,
  normalizeDate,
  normalizeSymbol,
  normalizeAction,
  parseBrokerCSV,
} from './brokerParser';
import type { Transaction } from '@/types/stock';

describe('brokerParser Unit Tests', () => {
  describe('Utility functions', () => {
    it('parses CSV with quotes and commas properly', () => {
      const csv = `Date,Symbol,"Note, with comma",Price\n2024-01-01,AAPL,"Bought, test",180.5`;
      const rows = parseCSVToRows(csv);
      expect(rows.length).toBe(2);
      expect(rows[0][2]).toBe('Note, with comma');
      expect(rows[1][2]).toBe('Bought, test');
      expect(rows[1][3]).toBe('180.5');
    });

    it('sanitizes strings with currency symbols and commas to numbers', () => {
      expect(sanitizeNumber('$1,234.50')).toBe(1234.5);
      expect(sanitizeNumber('NT$ 50,000')).toBe(50000);
      expect(sanitizeNumber('(150.25)')).toBe(-150.25);
      expect(sanitizeNumber('')).toBe(0);
    });

    it('normalizes various date formats including ROC calendar year', () => {
      expect(normalizeDate('2024/03/15')).toBe('2024-03-15');
      expect(normalizeDate('2024-03-15')).toBe('2024-03-15');
      expect(normalizeDate('20240315')).toBe('2024-03-15');
      // 113年 = 2024
      expect(normalizeDate('113/03/15')).toBe('2024-03-15');
      expect(normalizeDate('03/15/2024')).toBe('2024-03-15');
    });

    it('normalizes Taiwan stock codes to .TW extension', () => {
      expect(normalizeSymbol('2330')).toBe('2330.TW');
      expect(normalizeSymbol('0050')).toBe('0050.TW');
      expect(normalizeSymbol('2330 台積電')).toBe('2330.TW');
      expect(normalizeSymbol('AAPL')).toBe('AAPL');
      expect(normalizeSymbol('VOO')).toBe('VOO');
    });

    it('normalizes action to BUY or SELL', () => {
      expect(normalizeAction('現買')).toBe('BUY');
      expect(normalizeAction('定額買進')).toBe('BUY');
      expect(normalizeAction('BUY')).toBe('BUY');
      expect(normalizeAction('現賣')).toBe('SELL');
      expect(normalizeAction('賣出')).toBe('SELL');
      expect(normalizeAction('SELL')).toBe('SELL');
    });
  });

  describe('Broker Auto-Detection and Parsing', () => {
    it('detects and parses 永豐金證券 (Sinopac / 大戶投) CSV', () => {
      const csv = `成交日期,市場,委託書號,股票代碼,股票名稱,買賣,成交股數,成交單價,成交價金,手續費,交易稅,淨收付金額
113/03/15,上市,A0001,2330,台積電,現買,"1,000",750.00,750000,1068,0,-751068
113/03/18,上市,A0002,0050,元大台灣50,現買,500,150.00,75000,106,0,-75106`;

      const result = parseBrokerCSV(csv);
      expect(result.broker).toBe('SINOPAC');
      expect(result.totalRows).toBe(2);
      expect(result.validCount).toBe(2);

      const [r1, r2] = result.candidates;
      expect(r1.tradedAt).toBe('2024-03-15');
      expect(r1.symbol).toBe('2330.TW');
      expect(r1.type).toBe('BUY');
      expect(r1.shares).toBe(1000);
      expect(r1.price).toBe(750);
      expect(r1.fee).toBe(1068);

      expect(r2.symbol).toBe('0050.TW');
      expect(r2.shares).toBe(500);
      expect(r2.price).toBe(150);
    });

    it('detects and parses 富邦證券 CSV', () => {
      const csv = `成交日期,委託序號,股票代號,股票名稱,買賣別,成交股數,成交單價,成交金額,手續費,交易稅
2024/04/01,B1234,2454,聯發科,現買,200,1100.0,220000,313,0`;

      const result = parseBrokerCSV(csv);
      expect(result.broker).toBe('FUBON');
      expect(result.candidates[0].symbol).toBe('2454.TW');
      expect(result.candidates[0].shares).toBe(200);
      expect(result.candidates[0].price).toBe(1100);
    });

    it('detects and parses Interactive Brokers (IBKR) CSV', () => {
      const csv = `Date/Time,Symbol,Quantity,T. Price,Comm/Fee
2024-05-10,AAPL,50,185.25,-1.00
2024-05-12,VOO,20,460.00,-1.00`;

      const result = parseBrokerCSV(csv);
      expect(result.broker).toBe('IBKR');
      expect(result.totalRows).toBe(2);
      expect(result.candidates[0].symbol).toBe('AAPL');
      expect(result.candidates[0].shares).toBe(50);
      expect(result.candidates[0].price).toBe(185.25);
      expect(result.candidates[0].fee).toBe(1);
    });

    it('detects and parses Firstrade CSV', () => {
      const csv = `Date,Action,Symbol,Quantity,Price,Commission,Amount
06/15/2024,BUY,NVDA,30,120.00,0,3600.00
06/20/2024,SELL,NVDA,10,135.00,0,1350.00`;

      const result = parseBrokerCSV(csv);
      expect(result.broker).toBe('FIRSTRADE');
      expect(result.totalRows).toBe(2);
      expect(result.candidates[0].type).toBe('BUY');
      expect(result.candidates[0].symbol).toBe('NVDA');
      expect(result.candidates[1].type).toBe('SELL');
      expect(result.candidates[1].shares).toBe(10);
    });

    it('detects duplicates against existing transactions', () => {
      const existing: Transaction[] = [
        {
          id: 'tx-existing-1',
          symbol: '2330.TW',
          type: 'BUY',
          shares: 1000,
          price: 750,
          fee: 1068,
          tradedAt: '2024-03-15',
        },
      ];

      const csv = `成交日期,市場,委託書號,股票代碼,股票名稱,買賣,成交股數,成交單價,成交價金,手續費,交易稅,淨收付金額
113/03/15,上市,A0001,2330,台積電,現買,1000,750.00,750000,1068,0,-751068
113/03/18,上市,A0002,0050,元大台灣50,現買,500,150.00,75000,106,0,-75106`;

      const result = parseBrokerCSV(csv, existing);
      expect(result.totalRows).toBe(2);
      expect(result.duplicateCount).toBe(1);
      expect(result.validCount).toBe(1);

      expect(result.candidates[0].isDuplicate).toBe(true);
      expect(result.candidates[0].duplicateMatchId).toBe('tx-existing-1');
      expect(result.candidates[1].isDuplicate).toBe(false);
    });
  });
});
