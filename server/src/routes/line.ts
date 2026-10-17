import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import axios from 'axios';
import crypto from 'node:crypto';
import { prisma } from '../plugins/prisma.js';
import { redis } from '../plugins/redis.js';
import { authenticate } from '../middlewares/auth.js';
import { config } from '../config/env.js';
import { dispatchNotification, sendDailySummaries } from '../jobs/index.js';

export async function lineRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // 啟動 LINE 授權綁定
  fastify.get('/oauth/start', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const state = crypto.randomBytes(16).toString('hex');

    // 將 state 與 userId 存入 Redis，效期 10 分鐘
    await redis.set(`oauth:line:${state}`, userId, 'EX', 600);

    const redirectUri = encodeURIComponent(config.LINE_OAUTH_REDIRECT_URI);
    const channelId = config.LINE_CHANNEL_ID;

    // 若未填寫 LINE_CHANNEL_ID，支援直接模擬綁定模式方便本機開發驗證
    if (!channelId) {
      const mockId = 'U_MOCK_' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await prisma.lineBinding.upsert({
        where: { userId },
        create: {
          userId,
          lineUserId: mockId,
          lineDisplayName: 'LINE 測試用戶 (Dev Mock)',
        },
        update: {
          lineUserId: mockId,
          lineDisplayName: 'LINE 測試用戶 (Dev Mock)',
        },
      });

      return reply.send({
        success: true,
        data: {
          authorizeUrl: `${config.FRONTEND_URL}/settings/line?bound=1&mock=true`,
          mock: true,
        },
      });
    }

    const authorizeUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid`;

    return reply.send({
      success: true,
      data: { authorizeUrl, mock: false },
    });
  });

  // LINE OAuth 回呼
  fastify.get('/oauth/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error || !code || !state) {
      return reply.redirect(`${config.FRONTEND_URL}/settings/line?error=auth_denied`);
    }

    const userId = await redis.get(`oauth:line:${state}`);
    if (!userId) {
      return reply.redirect(`${config.FRONTEND_URL}/settings/line?error=state_expired`);
    }

    await redis.del(`oauth:line:${state}`);

    try {
      // 換取 Access Token
      const tokenRes = await axios.post(
        'https://api.line.me/oauth2/v2.1/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.LINE_OAUTH_REDIRECT_URI,
          client_id: config.LINE_CHANNEL_ID,
          client_secret: config.LINE_CHANNEL_SECRET,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const accessToken = tokenRes.data.access_token;

      // 取得 Profile
      const profileRes = await axios.get('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const { userId: lineUserId, displayName: lineDisplayName } = profileRes.data;

      await prisma.lineBinding.upsert({
        where: { userId },
        create: {
          userId,
          lineUserId,
          lineDisplayName,
        },
        update: {
          lineUserId,
          lineDisplayName,
          boundAt: new Date(),
        },
      });

      return reply.redirect(`${config.FRONTEND_URL}/settings/line?bound=1`);
    } catch (err: any) {
      console.error('[LINE OAuth Callback Error]', err?.response?.data || err.message);
      return reply.redirect(`${config.FRONTEND_URL}/settings/line?error=token_exchange_failed`);
    }
  });

  // 解除 LINE 綁定
  fastify.delete('/binding', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    await prisma.lineBinding.deleteMany({ where: { userId } });
    return reply.status(204).send();
  });

  // 取得通知偏好
  fastify.get('/prefs', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const prefs = await prisma.linePreference.findUnique({ where: { userId } });
    return reply.send({
      success: true,
      data: prefs || {
        priceAlert: true,
        dailySummary: true,
        tradeConfirm: true,
        webhookUrl: null,
      },
    });
  });

  // 更新通知偏好（含 Discord / Telegram Webhook URL）
  fastify.put('/prefs', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { priceAlert, dailySummary, tradeConfirm, webhookUrl } = request.body as any;

    const updated = await prisma.linePreference.upsert({
      where: { userId },
      create: {
        userId,
        priceAlert: Boolean(priceAlert),
        dailySummary: Boolean(dailySummary),
        tradeConfirm: Boolean(tradeConfirm),
        webhookUrl: typeof webhookUrl === 'string' ? webhookUrl.trim() || null : null,
      },
      update: {
        priceAlert: priceAlert !== undefined ? Boolean(priceAlert) : undefined,
        dailySummary: dailySummary !== undefined ? Boolean(dailySummary) : undefined,
        tradeConfirm: tradeConfirm !== undefined ? Boolean(tradeConfirm) : undefined,
        webhookUrl:
          webhookUrl !== undefined ? (typeof webhookUrl === 'string' ? webhookUrl.trim() || null : null) : undefined,
      },
    });

    return reply.send({ success: true, data: updated });
  });

  // 發送測試推播訊息（同時支援 LINE 與 Webhook）
  fastify.post('/test', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const [binding, prefs, user] = await Promise.all([
      prisma.lineBinding.findUnique({ where: { userId } }),
      prisma.linePreference.findUnique({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!binding?.lineUserId && !prefs?.webhookUrl) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: '尚未綁定 LINE 帳號或填寫 Webhook URL' },
      });
    }

    const title = `🔔【Stocktify 系統推播測試】`;
    const text = `您好，${user?.name || '投資朋友'}！您的推播管道已配置成功，將於每日收盤後自動為您推播資產損益日報與價格警示！`;

    const res = await dispatchNotification({
      userId,
      userName: user?.name || '用戶',
      title,
      text,
      kind: 'test_push',
      lineUserId: binding?.lineUserId,
      webhookUrl: prefs?.webhookUrl,
    });

    return reply.send({
      success: res.success,
      data: {
        message: res.success ? '測試訊息已成功送達' : `發送失敗：${res.error}`,
      },
    });
  });

  // 手動立即觸發收盤日報推播
  fastify.post('/trigger-daily', { preHandler: [authenticate] }, async (request, reply) => {
    await sendDailySummaries();
    return reply.send({
      success: true,
      data: { message: '已成功觸發收盤日報背景推播任務' },
    });
  });

  // 取得個人價格警示列表
  fastify.get('/alerts', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const alerts = await prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: alerts });
  });

  // 建立價格警示
  fastify.post('/alerts', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { symbol, direction, threshold } = request.body as any;

    if (!symbol || !direction || threshold == null) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '缺少必要欄位 (symbol, direction, threshold)' },
      });
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId,
        symbol: String(symbol).toUpperCase().trim(),
        direction,
        threshold: Number(threshold),
        isActive: true,
      },
    });

    return reply.status(201).send({ success: true, data: alert });
  });

  // 刪除價格警示
  fastify.delete('/alerts/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    await prisma.priceAlert.deleteMany({
      where: { id, userId },
    });

    return reply.status(204).send();
  });

  // LINE Webhook 接收點
  fastify.post('/webhook', async (request, reply) => {
    const signature = request.headers['x-line-signature'] as string;
    if (config.LINE_CHANNEL_SECRET && signature) {
      const bodyStr = JSON.stringify(request.body);
      const hash = crypto
        .createHmac('sha256', config.LINE_CHANNEL_SECRET)
        .update(bodyStr)
        .digest('base64');

      if (hash !== signature) {
        return reply.status(403).send({ error: 'INVALID_SIGNATURE' });
      }
    }

    return reply.send({ status: 'ok' });
  });
}
