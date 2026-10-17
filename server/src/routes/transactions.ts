import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import {
  reconcileHoldings,
  recalculateAllRealizedGains,
  computeRealizedForSell,
  round,
  type TransactionData,
} from '../services/accounting.js';
import { fetchQuotes } from '../services/market.js';

const transactionInputSchema = z.object({
  symbol: z.string().min(1).max(16).toUpperCase(),
  type: z.enum(['BUY', 'SELL']),
  shares: z.number().positive(),
  price: z.number().positive(),
  fee: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  tradedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '格式必須為 YYYY-MM-DD'),
  note: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

function serializeTxn(t: any): TransactionData {
  return {
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
  };
}

export async function transactionRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  fastify.addHook('preHandler', authenticate);

  // 取得交易流水清單
  fastify.get('/', async (request, reply) => {
    const userId = request.user!.userId;
    const query = request.query as Record<string, string | undefined>;
    const symbol = query.symbol?.toUpperCase();
    const type = query.type as 'BUY' | 'SELL' | undefined;
    const from = query.from;
    const to = query.to;

    const where: any = { userId };
    if (symbol) where.symbol = symbol;
    if (type) where.type = type;
    if (from || to) {
      where.tradedAt = {};
      if (from) where.tradedAt.gte = from;
      if (to) where.tradedAt.lte = to;
    }

    const txns = await prisma.transaction.findMany({
      where,
      orderBy: [{ tradedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return reply.send({
      success: true,
      data: {
        items: txns.map(serializeTxn),
        total: txns.length,
      },
    });
  });

  // 新增交易
  fastify.post('/', async (request, reply) => {
    const userId = request.user!.userId;
    const parsed = transactionInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '交易欄位格式不正確', details: parsed.error.format() },
      });
    }

    const input = parsed.data;

    // 冪等性檢查
    if (input.clientId) {
      const existing = await prisma.transaction.findFirst({
        where: { userId, clientId: input.clientId },
      });
      if (existing) {
        const allUserTxns = await prisma.transaction.findMany({ where: { userId } });
        return reply.send({
          success: true,
          data: {
            transaction: serializeTxn(existing),
            holdings: reconcileHoldings(allUserTxns.map(serializeTxn)),
          },
        });
      }
    }

    // 撈取該標的歷史交易以檢驗與結算
    const history = await prisma.transaction.findMany({
      where: { userId, symbol: input.symbol },
      orderBy: { tradedAt: 'asc' },
    });

    const serializedHistory = history.map(serializeTxn);

    // 若為賣出，檢查是否超賣
    if (input.type === 'SELL') {
      const currentHoldings = reconcileHoldings(serializedHistory);
      const curHolding = currentHoldings.find((h) => h.symbol === input.symbol);
      const availableShares = curHolding ? curHolding.shares : 0;

      if (availableShares < input.shares - 1e-6) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'SELL_EXCEEDS_HOLDING',
            message: `賣出股數（${input.shares}）超過目前持有股數（${availableShares}）`,
            details: { symbol: input.symbol, available: availableShares, requested: input.shares },
          },
        });
      }
    }

    // 新增此筆交易並重算損益鏈
    const tempId = 'temp_' + Date.now();
    const newTxnData: TransactionData = {
      id: tempId,
      symbol: input.symbol,
      type: input.type,
      shares: input.shares,
      price: input.price,
      fee: input.fee,
      tax: input.tax,
      tradedAt: input.tradedAt,
      note: input.note,
    };

    const recalculated = recalculateAllRealizedGains([...serializedHistory, newTxnData]);
    const targetCalculated = recalculated.find((t) => t.id === tempId);

    const created = await prisma.transaction.create({
      data: {
        userId,
        symbol: input.symbol,
        type: input.type,
        shares: input.shares,
        price: input.price,
        fee: input.fee,
        tax: input.tax,
        tradedAt: input.tradedAt,
        note: input.note,
        clientId: input.clientId,
        realizedGainLoss: targetCalculated?.realizedGainLoss,
      },
    });

    // 若為插單（交易日期早於某些既有交易），同步更新後續所有交易之損益
    for (const item of recalculated) {
      if (item.id !== tempId) {
        await prisma.transaction.update({
          where: { id: item.id },
          data: { realizedGainLoss: item.realizedGainLoss },
        });
      }
    }

    const allTxns = await prisma.transaction.findMany({ where: { userId } });
    const holdings = reconcileHoldings(allTxns.map(serializeTxn));

    return reply.status(201).send({
      success: true,
      data: {
        transaction: serializeTxn(created),
        holdings,
      },
    });
  });

  // 修改交易
  fastify.put('/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const parsed = transactionInputSchema.partial().safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '修改資料格式錯誤' },
      });
    }

    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'TRANSACTION_NOT_FOUND', message: '找不到指定之交易紀錄' },
      });
    }

    const updatedSymbol = parsed.data.symbol ?? existing.symbol;

    await prisma.transaction.update({
      where: { id },
      data: {
        symbol: updatedSymbol,
        type: parsed.data.type ?? existing.type,
        shares: parsed.data.shares ?? existing.shares,
        price: parsed.data.price ?? existing.price,
        fee: parsed.data.fee ?? existing.fee,
        tax: parsed.data.tax ?? existing.tax,
        tradedAt: parsed.data.tradedAt ?? existing.tradedAt,
        note: parsed.data.note !== undefined ? parsed.data.note : existing.note,
      },
    });

    // 重新結算該標的所有歷史交易
    const symbolHistory = await prisma.transaction.findMany({
      where: { userId, symbol: updatedSymbol },
    });

    const recalculated = recalculateAllRealizedGains(symbolHistory.map(serializeTxn));
    for (const item of recalculated) {
      await prisma.transaction.update({
        where: { id: item.id },
        data: { realizedGainLoss: item.realizedGainLoss },
      });
    }

    const allTxns = await prisma.transaction.findMany({ where: { userId } });
    const holdings = reconcileHoldings(allTxns.map(serializeTxn));

    const finalUpdated = await prisma.transaction.findUnique({ where: { id } });

    return reply.send({
      success: true,
      data: {
        transaction: serializeTxn(finalUpdated),
        holdings,
      },
    });
  });

  // 刪除交易
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'TRANSACTION_NOT_FOUND', message: '找不到欲刪除的交易紀錄' },
      });
    }

    const symbol = existing.symbol;
    await prisma.transaction.delete({ where: { id } });

    // 重新結算該標的剩餘歷史交易
    const remainingSymbolTxns = await prisma.transaction.findMany({
      where: { userId, symbol },
    });
    const recalculated = recalculateAllRealizedGains(remainingSymbolTxns.map(serializeTxn));
    for (const item of recalculated) {
      await prisma.transaction.update({
        where: { id: item.id },
        data: { realizedGainLoss: item.realizedGainLoss },
      });
    }

    const allTxns = await prisma.transaction.findMany({ where: { userId } });
    const holdings = reconcileHoldings(allTxns.map(serializeTxn));

    return reply.send({
      success: true,
      data: { holdings },
    });
  });

  // 即時持股試算 (聚合即時報價與市值損益)
  fastify.get('/holdings', async (request, reply) => {
    const userId = request.user!.userId;
    const txns = await prisma.transaction.findMany({ where: { userId } });
    const baseHoldings = reconcileHoldings(txns.map(serializeTxn));

    if (baseHoldings.length === 0) {
      return reply.send({
        success: true,
        data: { holdings: [], failed: [], stale: false },
      });
    }

    const { quotes, failed, stale } = await fetchQuotes(baseHoldings.map((h) => h.symbol));
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    const enriched = baseHoldings.map((h) => {
      const q = quoteMap.get(h.symbol);
      const price = q?.price ?? h.avgCost;
      const change = q?.change ?? 0;
      const changePercent = q?.changePercent ?? 0;
      const marketValue = round(h.shares * price, 2);
      const cost = round(h.shares * h.avgCost, 2);
      const gainLoss = round(marketValue - cost, 2);
      const gainLossPercent = cost > 0 ? round((gainLoss / cost) * 100, 2) : 0;

      return {
        symbol: h.symbol,
        name: q?.name ?? h.symbol,
        shares: h.shares,
        avgCost: h.avgCost,
        price,
        change,
        changePercent,
        marketValue,
        gainLoss,
        gainLossPercent,
        currency: q?.currency ?? (/\.TW$/i.test(h.symbol) ? 'TWD' : 'USD'),
      };
    });

    return reply.send({
      success: true,
      data: {
        holdings: enriched,
        failed,
        stale,
      },
    });
  });

  // 批次匯入交易
  fastify.post('/batch', async (request, reply) => {
    const userId = request.user!.userId;
    const { items } = request.body as { items: any[] };

    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '未提供有效交易陣列' },
      });
    }

    // 寫入資料庫
    for (const item of items) {
      await prisma.transaction.create({
        data: {
          userId,
          symbol: String(item.symbol).toUpperCase(),
          type: item.type === 'SELL' ? 'SELL' : 'BUY',
          shares: Number(item.shares),
          price: Number(item.price),
          fee: Number(item.fee || 0),
          tax: Number(item.tax || 0),
          tradedAt: String(item.tradedAt),
          note: item.note || null,
        },
      });
    }

    // 依標的分組重新結算所有已實現損益
    const allUserTxns = await prisma.transaction.findMany({ where: { userId } });
    const symbols = Array.from(new Set(allUserTxns.map((t) => t.symbol)));

    for (const sym of symbols) {
      const symTxns = allUserTxns.filter((t) => t.symbol === sym);
      const recalculated = recalculateAllRealizedGains(symTxns.map(serializeTxn));
      for (const item of recalculated) {
        await prisma.transaction.update({
          where: { id: item.id },
          data: { realizedGainLoss: item.realizedGainLoss },
        });
      }
    }

    const finalTxns = await prisma.transaction.findMany({ where: { userId } });
    const holdings = reconcileHoldings(finalTxns.map(serializeTxn));

    return reply.send({
      success: true,
      data: {
        importedCount: items.length,
        holdings,
      },
    });
  });
}
