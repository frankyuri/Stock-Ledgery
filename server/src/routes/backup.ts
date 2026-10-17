import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { prisma } from '../plugins/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import {
  reconcileHoldings,
  recalculateAllRealizedGains,
  type TransactionData,
} from '../services/accounting.js';

export async function backupRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  fastify.addHook('preHandler', authenticate);

  // 匯出雲端全站備份
  fastify.get('/export', async (request, reply) => {
    const userId = request.user!.userId;

    const [txns, assets, watchlistItems, linePrefs] = await Promise.all([
      prisma.transaction.findMany({ where: { userId }, orderBy: { tradedAt: 'asc' } }),
      prisma.assetSnapshot.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      prisma.watchlistItem.findMany({ where: { userId }, orderBy: { position: 'asc' } }),
      prisma.linePreference.findUnique({ where: { userId } }),
    ]);

    const snapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      watchlist: watchlistItems.map((w) => w.symbol),
      transactions: txns.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        type: t.type,
        shares: Number(t.shares),
        price: Number(t.price),
        fee: Number(t.fee),
        tax: Number(t.tax || 0),
        tradedAt: t.tradedAt,
        note: t.note,
        realizedGainLoss: t.realizedGainLoss != null ? Number(t.realizedGainLoss) : null,
      })),
      assets: assets.map((a) => ({
        id: a.id,
        date: a.date,
        currency: a.currency,
        cash: Number(a.cash),
        securities: Number(a.securities),
        other: Number(a.other),
        note: a.note,
      })),
      linePrefs: linePrefs
        ? {
            priceAlert: linePrefs.priceAlert,
            dailySummary: linePrefs.dailySummary,
            tradeConfirm: linePrefs.tradeConfirm,
          }
        : undefined,
    };

    return reply.send({
      success: true,
      data: snapshot,
    });
  });

  // 從備份檔/前端 localStorage 匯入並覆寫至雲端資料庫
  fastify.post('/import', async (request, reply) => {
    const userId = request.user!.userId;
    const body = request.body as any;

    if (!body || !Array.isArray(body.transactions) || !Array.isArray(body.assets)) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_BACKUP_FORMAT', message: '備份資料格式不符' },
      });
    }

    // 採用單一交易操作清空並覆寫
    await prisma.$transaction(async (tx) => {
      // 1. 清空既有資料
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.assetSnapshot.deleteMany({ where: { userId } });
      if (Array.isArray(body.watchlist)) {
        await tx.watchlistItem.deleteMany({ where: { userId } });
      }

      // 2. 寫入交易紀錄
      for (const t of body.transactions) {
        await tx.transaction.create({
          data: {
            userId,
            symbol: String(t.symbol).toUpperCase(),
            type: t.type === 'SELL' ? 'SELL' : 'BUY',
            shares: Number(t.shares),
            price: Number(t.price),
            fee: Number(t.fee || 0),
            tax: Number(t.tax || 0),
            tradedAt: String(t.tradedAt),
            note: t.note || null,
          },
        });
      }

      // 3. 寫入淨值快照
      for (const a of body.assets) {
        await tx.assetSnapshot.create({
          data: {
            userId,
            date: String(a.date),
            currency: String(a.currency || 'TWD').toUpperCase(),
            cash: Number(a.cash || 0),
            securities: Number(a.securities || 0),
            other: Number(a.other || 0),
            note: a.note || null,
          },
        });
      }

      // 4. 寫入自選清單
      if (Array.isArray(body.watchlist)) {
        const uniqueSymbols = Array.from(
          new Set(body.watchlist.map((s: string) => String(s).toUpperCase()))
        );
        for (let idx = 0; idx < uniqueSymbols.length; idx += 1) {
          await tx.watchlistItem.create({
            data: {
              userId,
              symbol: uniqueSymbols[idx] as string,
              position: idx,
            },
          });
        }
      }

      // 5. 更新通知設定
      if (body.linePrefs) {
        await tx.linePreference.upsert({
          where: { userId },
          create: {
            userId,
            priceAlert: Boolean(body.linePrefs.priceAlert),
            dailySummary: Boolean(body.linePrefs.dailySummary),
            tradeConfirm: Boolean(body.linePrefs.tradeConfirm),
          },
          update: {
            priceAlert: Boolean(body.linePrefs.priceAlert),
            dailySummary: Boolean(body.linePrefs.dailySummary),
            tradeConfirm: Boolean(body.linePrefs.tradeConfirm),
          },
        });
      }
    });

    // 重新結算所有已實現損益
    const allTxns = await prisma.transaction.findMany({ where: { userId } });
    const symbols = Array.from(new Set(allTxns.map((t) => t.symbol)));

    for (const sym of symbols) {
      const symTxns = allTxns.filter((t) => t.symbol === sym);
      const serialized: TransactionData[] = symTxns.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        type: t.type,
        shares: Number(t.shares),
        price: Number(t.price),
        fee: Number(t.fee),
        tax: Number(t.tax || 0),
        tradedAt: t.tradedAt,
        note: t.note,
      }));

      const recalculated = recalculateAllRealizedGains(serialized);
      for (const item of recalculated) {
        await prisma.transaction.update({
          where: { id: item.id },
          data: { realizedGainLoss: item.realizedGainLoss },
        });
      }
    }

    const finalTxns = await prisma.transaction.findMany({ where: { userId } });
    const holdings = reconcileHoldings(
      finalTxns.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        type: t.type,
        shares: Number(t.shares),
        price: Number(t.price),
        fee: Number(t.fee),
        tax: Number(t.tax || 0),
        tradedAt: t.tradedAt,
        note: t.note,
      }))
    );

    return reply.send({
      success: true,
      data: {
        message: '雲端同步與備份還原完成',
        importedTransactions: body.transactions.length,
        importedAssets: body.assets.length,
        holdings,
      },
    });
  });
}
