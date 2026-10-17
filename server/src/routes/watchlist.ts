import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { fetchQuotes } from '../services/market.js';

export async function watchlistRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  fastify.addHook('preHandler', authenticate);

  // 取得自選清單 (聚合即時報價)
  fastify.get('/', async (request, reply) => {
    const userId = request.user!.userId;
    const items = await prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });

    const symbols = items.map((i) => i.symbol);
    const { quotes } = await fetchQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    const enriched = items.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      position: item.position,
      quote: quoteMap.get(item.symbol) || null,
    }));

    return reply.send({
      success: true,
      data: {
        items: enriched,
      },
    });
  });

  // 新增自選股
  fastify.post('/', async (request, reply) => {
    const userId = request.user!.userId;
    const { symbol } = request.body as { symbol: string };

    if (!symbol || typeof symbol !== 'string') {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_SYMBOL', message: '未提供股票代碼' },
      });
    }

    const normSymbol = symbol.trim().toUpperCase();

    const existing = await prisma.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: normSymbol,
        },
      },
    });

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'SYMBOL_EXISTS', message: '該股票已在自選清單中' },
      });
    }

    const maxPos = await prisma.watchlistItem.aggregate({
      where: { userId },
      _max: { position: true },
    });
    const nextPos = (maxPos._max.position ?? -1) + 1;

    const created = await prisma.watchlistItem.create({
      data: {
        userId,
        symbol: normSymbol,
        position: nextPos,
      },
    });

    return reply.status(201).send({
      success: true,
      data: created,
    });
  });

  // 移除自選股
  fastify.delete('/:symbol', async (request, reply) => {
    const userId = request.user!.userId;
    const { symbol } = request.params as { symbol: string };
    const normSymbol = symbol.trim().toUpperCase();

    await prisma.watchlistItem.deleteMany({
      where: { userId, symbol: normSymbol },
    });

    return reply.status(204).send();
  });

  // 批次重新排序
  fastify.put('/reorder', async (request, reply) => {
    const userId = request.user!.userId;
    const { symbols } = request.body as { symbols: string[] };

    if (!Array.isArray(symbols)) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '未提供有效代碼陣列' },
      });
    }

    await prisma.$transaction(
      symbols.map((sym, index) =>
        prisma.watchlistItem.updateMany({
          where: { userId, symbol: sym.toUpperCase() },
          data: { position: index },
        })
      )
    );

    return reply.send({ success: true });
  });
}
