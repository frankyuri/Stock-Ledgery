import { describe, it, expect } from 'vitest';
import {
  isTaiwanStock,
  analyzeSecondGenNHI,
  analyzeTaiwanDividendTaxStrategy,
  analyzeUSWithholdingTax,
  analyzeOverseasIncomeAMT,
} from './taxAnalytics';
import type { HoldingDividendAnalysis } from './dividendForecast';

describe('taxAnalytics Unit Tests', () => {
  it('identifies Taiwan stock symbols accurately', () => {
    expect(isTaiwanStock('2330.TW')).toBe(true);
    expect(isTaiwanStock('0050.TW')).toBe(true);
    expect(isTaiwanStock('6547.TWO')).toBe(true);
    expect(isTaiwanStock('2330')).toBe(true);
    expect(isTaiwanStock('AAPL')).toBe(false);
    expect(isTaiwanStock('VOO')).toBe(false);
  });

  describe('二代健保補充保費 (2.11%) 試算', () => {
    it('detects triggered holdings and calculates excess shares for optimization', () => {
      const mockHoldings: HoldingDividendAnalysis[] = [
        {
          symbol: '2330.TW',
          name: '台積電',
          currency: 'TWD',
          shares: 2000,
          avgCost: 600,
          currentPrice: 800,
          marketValue: 1600000,
          cost: 1200000,
          trailing12mPerShare: 16, // 年配 16 元，季配每次 4 元
          estimatedAnnualIncome: 32000, // 2000 * 16 = 32000
          currentYield: 2.0,
          yieldOnCost: 2.6,
          payoutFrequency: 'ANNUAL', // 年配一次，單筆 32,000 >= 20,000 觸發！
          payoutMonths: [7],
          stats: {} as any,
        },
        {
          symbol: '0050.TW',
          name: '元大台灣50',
          currency: 'TWD',
          shares: 500,
          avgCost: 140,
          currentPrice: 160,
          marketValue: 80000,
          cost: 70000,
          trailing12mPerShare: 4,
          estimatedAnnualIncome: 2000, // 500 * 4 = 2000，遠低於 20,000 安全
          currentYield: 2.5,
          yieldOnCost: 2.8,
          payoutFrequency: 'SEMI_ANNUAL',
          payoutMonths: [1, 7],
          stats: {} as any,
        },
      ];

      const report = analyzeSecondGenNHI(mockHoldings);
      expect(report.triggeredCount).toBe(1);
      expect(report.items[0].symbol).toBe('2330.TW');
      expect(report.items[0].isTriggered).toBe(true);
      // 單筆 32,000 * 2.11% = 675.2 -> 675
      expect(report.items[0].nhiTaxPerPayout).toBe(675);
      // 建議調節股數：19,999 / 16 = 1249 股，2000 - 1249 = 751 股
      expect(report.items[0].maxSharesUnderLimit).toBe(1249);
      expect(report.items[0].excessShares).toBe(751);

      expect(report.items[1].symbol).toBe('0050.TW');
      expect(report.items[1].isTriggered).toBe(false);
    });
  });

  describe('台股綜所稅申報模式最佳化', () => {
    it('recommends consolidated taxation with refund for 5% tax bracket', () => {
      const report = analyzeTaiwanDividendTaxStrategy(100_000, 0.05);
      expect(report.recommendedStrategy).toBe('CONSOLIDATED');
      // Gross tax = 5,000, Credit = 8,500 -> Net tax = -3,500 (退稅 3,500 元)
      expect(report.consolidated.netTax).toBe(-3500);
      expect(report.separated.netTax).toBe(28000);
      expect(report.taxDifference).toBe(31500); // 28000 - (-3500) = 31500
    });

    it('recommends separated 28% flat tax for 40% high income bracket', () => {
      const report = analyzeTaiwanDividendTaxStrategy(1_000_000, 0.4);
      expect(report.recommendedStrategy).toBe('SEPARATED');
      // Consolidated: 1M * 0.4 = 400K - 80K cap = 320K
      // Separated: 1M * 0.28 = 280K
      expect(report.consolidated.netTax).toBe(320000);
      expect(report.separated.netTax).toBe(280000);
      expect(report.taxDifference).toBe(40000); // Saves 40,000 NTD
    });
  });

  describe('美股 30% 預扣稅與 UCITS 潛在省稅', () => {
    it('calculates 30% US withholding and 15% UCITS savings', () => {
      const report = analyzeUSWithholdingTax(1000, 32.0); // $1,000 USD dividend
      expect(report.grossDividendUSD).toBe(1000);
      expect(report.usTaxWithheldUSD).toBe(300);
      expect(report.netDividendReceivedUSD).toBe(700);

      // UCITS saves 15% = $150 USD = 4,800 TWD
      expect(report.ucitsAnnualSavingsUSD).toBe(150);
      expect(report.ucitsAnnualSavingsTWD).toBe(4800);
      expect(report.tenYearCompoundSavingsTWD).toBeGreaterThan(60000);
    });
  });

  describe('台灣海外所得最低稅負制 (AMT)', () => {
    it('marks exempt if under 1 million TWD', () => {
      const report = analyzeOverseasIncomeAMT(300000, 200000); // 500,000 total
      expect(report.status).toBe('EXEMPT');
      expect(report.declarationRequired).toBe(false);
      expect(report.amtTaxDue).toBe(0);
      expect(report.safetyBufferTWD).toBe(7000000);
    });

    it('marks report only with zero tax if between 1M and 7.5M TWD', () => {
      const report = analyzeOverseasIncomeAMT(3000000, 1000000); // 4,000,000 total
      expect(report.status).toBe('REPORT_ONLY_ZERO_TAX');
      expect(report.declarationRequired).toBe(true);
      expect(report.amtTaxDue).toBe(0);
      expect(report.safetyBufferTWD).toBe(3500000);
    });

    it('calculates 20% AMT for amount exceeding 7.5 million TWD', () => {
      const report = analyzeOverseasIncomeAMT(7000000, 1500000); // 8,500,000 total
      expect(report.status).toBe('TAXABLE_AMT');
      expect(report.amtTaxableAmount).toBe(1000000);
      expect(report.amtTaxDue).toBe(200000); // 1M * 20% = 200,000
    });
  });
});
