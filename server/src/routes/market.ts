import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  fetchQuote,
  fetchQuotes,
  fetchChartBundle,
  searchTickers,
  getExchangeRates,
} from '../services/market.js';

function getTaiwanMarketStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekday = get('weekday');
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  if (isWeekend) return { isOpen: false, state: 'CLOSED', text: '休市 (週末)' };
  const currentMinutes = hour * 60 + minute;
  const openMinutes = 9 * 60;
  const closeMinutes = 13 * 60 + 30;

  if (currentMinutes < openMinutes) return { isOpen: false, state: 'PRE_MARKET', text: '未開盤' };
  if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
    return { isOpen: true, state: 'OPEN', text: '盤中交易中' };
  }
  return { isOpen: false, state: 'CLOSED', text: '已收盤' };
}

function getUSMarketStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekday = get('weekday');
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  if (isWeekend) return { isOpen: false, state: 'CLOSED', text: '休市 (週末)' };
  const currentMinutes = hour * 60 + minute;
  const preMinutes = 4 * 60;
  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 16 * 60;
  const postMinutes = 20 * 60;

  if (currentMinutes < preMinutes) return { isOpen: false, state: 'CLOSED', text: '休市' };
  if (currentMinutes >= preMinutes && currentMinutes < openMinutes) {
    return { isOpen: false, state: 'PRE_MARKET', text: '盤前交易' };
  }
  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return { isOpen: true, state: 'OPEN', text: '美股盤中' };
  }
  if (currentMinutes >= closeMinutes && currentMinutes < postMinutes) {
    return { isOpen: false, state: 'AFTER_HOURS', text: '盤後交易' };
  }
  return { isOpen: false, state: 'CLOSED', text: '已收盤' };
}

export async function marketRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // 批次或單一報價
  fastify.get('/quote', async (request, reply) => {
    const { symbols } = request.query as { symbols?: string };
    if (!symbols) {
      return reply.status(422).send({
        success: false,
        error: { code: 'MISSING_SYMBOLS', message: '未指定股票代碼 symbols' },
      });
    }

    const list = symbols.split(',').map((s) => s.trim()).filter(Boolean);
    const result = await fetchQuotes(list);

    return reply.send({
      success: true,
      data: result,
    });
  });

  // 個股 K 線與詳細走勢
  fastify.get('/chart/:symbol', async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const { resolution = '1D' } = request.query as { resolution?: string };

    try {
      const bundle = await fetchChartBundle(symbol, resolution);
      return reply.send({
        success: true,
        data: bundle,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'CHART_FETCH_ERROR', message: err.message },
      });
    }
  });

  // 代碼模糊搜尋
  fastify.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q) {
      return reply.send({ success: true, data: [] });
    }

    const results = await searchTickers(q);
    return reply.send({
      success: true,
      data: results,
    });
  });

  // 最新匯率表
  fastify.get('/rates', async (_request, reply) => {
    const rates = await getExchangeRates();
    return reply.send({
      success: true,
      data: rates,
    });
  });

  // 台美股即時開休市狀態
  fastify.get('/status', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        taiwan: getTaiwanMarketStatus(),
        us: getUSMarketStatus(),
      },
    });
  });
}
