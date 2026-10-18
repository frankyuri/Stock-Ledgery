import { describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import {
  useStockStore,
  buildBackupSnapshot,
} from '@/store/useStockStore';
import { simulateFire } from '@/lib/fireAnalytics';
import {
  calculatePortfolioDrift,
  calculateCashInRebalance,
  type HoldingPosition,
} from '@/lib/rebalanceAnalytics';

describe('QA Full Lifecycle: Personal Assets & Guest Experience', () => {
  beforeEach(() => {
    useStockStore.getState().clearAllData();
  });

  it('1. Initial Guest Mode: cleanly initialized with empty portfolio and default watchlist', () => {
    const state = useStockStore.getState();
    expect(state.isDemo).toBe(false);
    expect(state.transactions).toHaveLength(0);
    expect(state.holdings).toHaveLength(0);
    expect(state.assets).toHaveLength(0);
    expect(state.watchlist).toEqual(['AAPL', 'MSFT', 'NVDA', 'TSLA', '2330.TW']);
  });

  it('2. Load Demo Portfolio: accurately calculates weighted average costs and realized PnL', () => {
    const store = useStockStore.getState();
    store.loadDemoData();

    const state = useStockStore.getState();
    expect(state.isDemo).toBe(true);
    expect(state.transactions.length).toBeGreaterThan(0);
    expect(state.holdings.length).toBeGreaterThan(0);
    expect(state.assets.length).toBe(4);

    // Verify holdings for demo snapshot:
    // AAPL: Buy 40 @ 175.5 (fee 2) -> (40*175.5 + 2)/40 = 175.55
    // AAPL: Buy 10 @ 210 (fee 2) -> (40*175.55 + 10*210 + 2)/50 = 182.48
    // AAPL: Sell 10 @ 232 (fee 2) -> Remaining: 40 shares, cost basis preserved @ 182.48
    const aapl = state.holdings.find((h) => h.symbol === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl?.shares).toBe(40);
    expect(aapl?.avgCost).toBeCloseTo(182.48, 1);

    // Verify 2330.TW: Buy 1000 @ 880 (fee 20) -> (1000*880 + 20)/1000 = 880.02
    const tsmc = state.holdings.find((h) => h.symbol === '2330.TW');
    expect(tsmc).toBeDefined();
    expect(tsmc?.shares).toBe(1000);
    expect(tsmc?.avgCost).toBeCloseTo(880.02, 1);

    // Verify 0050.TW: Buy 2000 @ 165
    const etf0050 = state.holdings.find((h) => h.symbol === '0050.TW');
    expect(etf0050).toBeDefined();
    expect(etf0050?.shares).toBe(2000);

    // Realized gain on the sell of AAPL: (232 - 182.48) * 10 - 2 = 493.2
    const sellTx = state.transactions.find((t) => t.type === 'SELL');
    expect(sellTx).toBeDefined();
    expect(sellTx?.realizedGainLoss).toBeGreaterThan(490);
  });

  it('3. Manual Guest Operations: Prevents overselling & accurately handles round trips', async () => {
    const store = useStockStore.getState();

    // Buy 50 shares of TSLA @ 200
    const buyRes = await store.addTransaction({
      symbol: 'TSLA',
      type: 'BUY',
      shares: 50,
      price: 200,
      fee: 5,
      tradedAt: '2026-01-10',
    });
    expect(buyRes.ok).toBe(true);

    const holdingsAfterBuy = useStockStore.getState().holdings;
    const tslaHolding = holdingsAfterBuy.find((h) => h.symbol === 'TSLA');
    expect(tslaHolding?.shares).toBe(50);
    expect(tslaHolding?.avgCost).toBeCloseTo((50 * 200 + 5) / 50, 2);

    // Attempt to sell 60 shares (oversell test) -> Should reject!
    const oversellRes = await store.addTransaction({
      symbol: 'TSLA',
      type: 'SELL',
      shares: 60,
      price: 220,
      fee: 5,
      tradedAt: '2026-01-15',
    });
    expect(oversellRes.ok).toBe(false);
    expect((oversellRes as any).error).toContain('超過持有');

    // Sell exactly 20 shares @ 250 -> Should succeed with realized gain!
    const sellRes = await store.addTransaction({
      symbol: 'TSLA',
      type: 'SELL',
      shares: 20,
      price: 250,
      fee: 5,
      tradedAt: '2026-01-20',
    });
    expect(sellRes.ok).toBe(true);

    const holdingsAfterSell = useStockStore.getState().holdings;
    const tslaRemaining = holdingsAfterSell.find((h) => h.symbol === 'TSLA');
    expect(tslaRemaining?.shares).toBe(30);

    // Sell remaining 30 shares -> Holding should be removed completely
    const closeRes = await store.addTransaction({
      symbol: 'TSLA',
      type: 'SELL',
      shares: 30,
      price: 260,
      fee: 5,
      tradedAt: '2026-01-25',
    });
    expect(closeRes.ok).toBe(true);

    const finalHoldings = useStockStore.getState().holdings;
    expect(finalHoldings.find((h) => h.symbol === 'TSLA')).toBeUndefined();
  });

  it('4. FIRE Analytics with Demo Portfolio: computes target age and safe withdrawal threshold', () => {
    const store = useStockStore.getState();
    store.loadDemoData();

    const state = useStockStore.getState();
    const sim = simulateFire(
      state.fireSettings,
      2_500_000,
      45_000,
    );

    expect(sim.targets.standardTarget).toBe(
      (state.fireSettings.monthlyExpense * 12) / (state.fireSettings.swr / 100),
    );
    expect(sim.projections.length).toBeGreaterThan(0);
    expect(sim.estimatedAgeAtRetirement).toBeDefined();
  });

  it('5. Rebalance Analytics with Demo Portfolio: computes drift and optimal cash-in distribution', () => {
    const store = useStockStore.getState();
    store.loadDemoData();

    const state = useStockStore.getState();
    const positions: HoldingPosition[] = state.holdings.map((h) => ({
      symbol: h.symbol,
      shares: h.shares,
      currentPrice: h.avgCost * 1.1,
      marketValue: h.shares * h.avgCost * 1.1,
      currency: 'TWD',
    }));

    const driftRes = calculatePortfolioDrift(
      positions,
      state.rebalanceSettings.allocations,
      state.rebalanceSettings.driftThreshold,
    );
    expect(driftRes.drifts.length).toBeGreaterThan(0);

    const cashInRes = calculateCashInRebalance(
      positions,
      state.rebalanceSettings.allocations,
      100_000,
      'FRACTIONAL_OR_ODD',
    );
    expect(cashInRes.recommendations.length).toBeGreaterThan(0);
    expect(cashInRes.cashRemaining).toBeLessThanOrEqual(100_000);
  });

  it('6. Backup Snapshot & Restore: exports valid JSON and restores completely offline', () => {
    const store = useStockStore.getState();
    store.loadDemoData();

    const snapshot = buildBackupSnapshot();
    expect(snapshot.transactions.length).toBeGreaterThan(0);
    expect(snapshot.assets.length).toBeGreaterThan(0);
    expect(snapshot.watchlist).toContain('AAPL');

    // Wipe store
    store.clearAllData();
    expect(useStockStore.getState().transactions).toHaveLength(0);

    // Restore from snapshot
    store.importBackup(snapshot);
    const restored = useStockStore.getState();
    expect(restored.transactions.length).toBe(snapshot.transactions.length);
    expect(restored.holdings.length).toBeGreaterThan(0);
    expect(restored.assets.length).toBe(snapshot.assets.length);
  });
});

let isBackendRunning = false;
try {
  const healthCheck = await axios.get('http://localhost:8080/health', { timeout: 800 });
  isBackendRunning = healthCheck.status === 200;
} catch {
  isBackendRunning = false;
}

describe.runIf(isBackendRunning)('QA Backend API E2E Smoke & Real Server Integration', () => {
  const API_URL = 'http://localhost:8080/api/v1';

  it('Backend Health Check returns 200 OK', async () => {
    const res = await axios.get('http://localhost:8080/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.version).toBe('1.0.0');
  });

  it('Backend Market Quote and Chart endpoints serve live data', async () => {
    const quoteRes = await axios.get(`${API_URL}/market/quote`, {
      params: { symbols: 'AAPL,MSFT' },
    });
    expect(quoteRes.status).toBe(200);
    expect(quoteRes.data.success).toBe(true);
    expect(quoteRes.data.data.quotes.length).toBeGreaterThanOrEqual(1);

    const chartRes = await axios.get(`${API_URL}/market/chart/AAPL`);
    expect(chartRes.status).toBe(200);
    expect(chartRes.data.success).toBe(true);
    expect(chartRes.data.data.candles.length).toBeGreaterThan(10);
  });

  it('Backend User Registration, Transaction CRUD & Cloud Backup', async () => {
    const testEmail = `qa_test_${Date.now()}@stocktify.local`;
    const testPassword = 'Password123!';

    // 1. Register
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'QA Automation Engineer',
    });
    expect(regRes.status).toBe(201);
    const token = regRes.data.data.accessToken;
    expect(token).toBeDefined();

    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. Auth /me
    const meRes = await axios.get(`${API_URL}/auth/me`, { headers: authHeaders });
    expect(meRes.status).toBe(200);
    expect(meRes.data.data.user.email).toBe(testEmail);

    // 3. Create Cloud Transaction
    const createTxRes = await axios.post(
      `${API_URL}/transactions`,
      {
        symbol: 'NVDA',
        type: 'BUY',
        shares: 25,
        price: 120.5,
        fee: 1.5,
        tradedAt: '2026-02-01',
        note: 'QA automated trade creation',
      },
      { headers: authHeaders },
    );
    expect(createTxRes.status).toBe(201);
    const txId = createTxRes.data.data.transaction.id;
    expect(txId).toBeDefined();

    // 4. List Cloud Transactions
    const listTxRes = await axios.get(`${API_URL}/transactions`, {
      headers: authHeaders,
    });
    expect(listTxRes.status).toBe(200);
    expect(listTxRes.data.data.items.length).toBe(1);
    expect(listTxRes.data.data.items[0].symbol).toBe('NVDA');

    // 5. Create Cloud Asset Snapshot
    const assetRes = await axios.post(
      `${API_URL}/assets`,
      {
        date: '2026-02-01',
        currency: 'USD',
        cash: 10000,
        securities: 3012.5,
        other: 500,
        note: 'QA initial cloud snapshot',
      },
      { headers: authHeaders },
    );
    expect(assetRes.status).toBe(201);

    // 6. Backup Export
    const exportRes = await axios.get(`${API_URL}/backup/export`, {
      headers: authHeaders,
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.data.data.transactions.length).toBe(1);
    expect(exportRes.data.data.assets.length).toBe(1);

    // 7. Delete Transaction
    const delRes = await axios.delete(`${API_URL}/transactions/${txId}`, {
      headers: authHeaders,
    });
    expect(delRes.status).toBe(200);

    const listAfterDel = await axios.get(`${API_URL}/transactions`, {
      headers: authHeaders,
    });
    expect(listAfterDel.data.data.items.length).toBe(0);
  });
});
