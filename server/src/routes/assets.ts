import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { getExchangeRates } from '../services/market.js';
import { round } from '../services/accounting.js';

const assetInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().min(1).max(8).default('TWD'),
  cash: z.number().default(0),
  securities: z.number().default(0),
  other: z.number().default(0),
  note: z.string().optional().nullable(),
});

export async function assetRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.addHook('preHandler', authenticate);

  // 取得快照列表
  fastify.get('/', async (request, reply) => {
    const userId = request.user!.userId;
    const query = request.query as Record<string, string | undefined>;
    const where: any = { userId };
    if (query.currency) where.currency = query.currency.toUpperCase();
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = query.from;
      if (query.to) where.date.lte = query.to;
    }

    const items = await prisma.assetSnapshot.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return reply.send({
      success: true,
      data: items.map((a) => ({
        id: a.id,
        date: a.date,
        currency: a.currency,
        cash: Number(a.cash),
        securities: Number(a.securities),
        other: Number(a.other),
        note: a.note,
      })),
    });
  });

  // 新增或更新特定日期貨幣之快照
  fastify.post('/', async (request, reply) => {
    const userId = request.user!.userId;
    const parsed = assetInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '資產資料格式錯誤', details: parsed.error.format() },
      });
    }

    const { date, currency, cash, securities, other, note } = parsed.data;
    const normCurrency = currency.toUpperCase();

    const snapshot = await prisma.assetSnapshot.upsert({
      where: {
        userId_date_currency: {
          userId,
          date,
          currency: normCurrency,
        },
      },
      create: {
        userId,
        date,
        currency: normCurrency,
        cash,
        securities,
        other,
        note,
      },
      update: {
        cash,
        securities,
        other,
        note,
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: snapshot.id,
        date: snapshot.date,
        currency: snapshot.currency,
        cash: Number(snapshot.cash),
        securities: Number(snapshot.securities),
        other: Number(snapshot.other),
        note: snapshot.note,
      },
    });
  });

  // 刪除快照
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    await prisma.assetSnapshot.deleteMany({
      where: { id, userId },
    });

    return reply.send({ success: true });
  });

  // 多幣別換算聚合走勢
  fastify.get('/timeseries', async (request, reply) => {
    const userId = request.user!.userId;
    const query = request.query as Record<string, string | undefined>;
    const baseCurrency = (query.baseCurrency || 'TWD').toUpperCase();

    const snapshots = await prisma.assetSnapshot.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    const rates = await getExchangeRates(); // rates to TWD
    const baseToTwd = rates[baseCurrency] || 1;

    // 依日期聚合
    const dateMap = new Map<
      string,
      { date: string; cash: number; securities: number; other: number; total: number }
    >();

    for (const s of snapshots) {
      const cur = s.currency.toUpperCase();
      const curToTwd = rates[cur] || 1;
      const rate = curToTwd / baseToTwd;

      const cashInBase = Number(s.cash) * rate;
      const secInBase = Number(s.securities) * rate;
      const otherInBase = Number(s.other) * rate;

      const existing = dateMap.get(s.date) || {
        date: s.date,
        cash: 0,
        securities: 0,
        other: 0,
        total: 0,
      };

      existing.cash += cashInBase;
      existing.securities += secInBase;
      existing.other += otherInBase;
      existing.total += cashInBase + secInBase + otherInBase;

      dateMap.set(s.date, existing);
    }

    const points = Array.from(dateMap.values()).map((p) => ({
      date: p.date,
      cash: round(p.cash, 2),
      securities: round(p.securities, 2),
      other: round(p.other, 2),
      total: round(p.total, 2),
    }));

    return reply.send({
      success: true,
      data: {
        baseCurrency,
        points,
      },
    });
  });
}
