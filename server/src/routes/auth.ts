import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import {
  authenticate,
  generateTokens,
  storeRefreshToken,
  rotateRefreshToken,
  hashToken,
} from '../middlewares/auth.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  currency: z.string().default('TWD'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.number().optional(),
  feeDiscount: z.number().optional(),
});

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', '2330.TW'];

export async function authRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // 註冊
  fastify.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '輸入欄位格式不正確', details: parsed.error.format() },
      });
    }

    const { email, password, name, currency } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_TAKEN', message: '此電子郵件已被註冊' },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        currency,
        watchlist: {
          create: DEFAULT_WATCHLIST.map((symbol, idx) => ({
            symbol,
            position: idx,
          })),
        },
        linePrefs: {
          create: {
            priceAlert: true,
            dailySummary: true,
            tradeConfirm: true,
          },
        },
      },
    });

    const { accessToken, rawRefreshToken } = generateTokens(fastify, {
      userId: user.id,
      email: user.email,
    });

    await storeRefreshToken(user.id, rawRefreshToken, request.headers['user-agent'], request.ip);

    reply.setCookie('rt', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          currency: user.currency,
        },
        accessToken,
      },
    });
  });

  // 登入
  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '帳號或密碼格式錯誤' },
      });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { lineBinding: true, linePrefs: true },
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: '電子郵件或密碼不正確' },
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: '電子郵件或密碼不正確' },
      });
    }

    const { accessToken, rawRefreshToken } = generateTokens(fastify, {
      userId: user.id,
      email: user.email,
    });

    await storeRefreshToken(user.id, rawRefreshToken, request.headers['user-agent'], request.ip);

    reply.setCookie('rt', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          currency: user.currency,
          lineUserId: user.lineBinding?.lineUserId,
          lineDisplayName: user.lineBinding?.lineDisplayName,
          lineBoundAt: user.lineBinding?.boundAt,
        },
        accessToken,
      },
    });
  });

  // 刷新權杖 (Silent Refresh)
  fastify.post('/refresh', async (request, reply) => {
    const rawToken = request.cookies.rt;
    if (!rawToken) {
      return reply.status(401).send({
        success: false,
        error: { code: 'MISSING_REFRESH_TOKEN', message: '未提供 Refresh Token' },
      });
    }

    try {
      const { user, newRawToken } = await rotateRefreshToken(
        rawToken,
        request.headers['user-agent'],
        request.ip
      );

      const { accessToken } = generateTokens(fastify, {
        userId: user.id,
        email: user.email,
      });

      reply.setCookie('rt', newRawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: 30 * 24 * 60 * 60,
      });

      return reply.send({
        success: true,
        data: { accessToken },
      });
    } catch (err: any) {
      reply.clearCookie('rt', { path: '/api/v1/auth' });
      return reply.status(401).send({
        success: false,
        error: { code: err.message || 'REFRESH_REVOKED', message: 'Session 已失效，請重新登入' },
      });
    }
  });

  // 登出
  fastify.post('/logout', async (request, reply) => {
    const rawToken = request.cookies.rt;
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }

    reply.clearCookie('rt', { path: '/api/v1/auth' });
    return reply.status(204).send();
  });

  // 取得目前使用者帳戶狀態
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      include: { lineBinding: true, linePrefs: true },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '使用者不存在' },
      });
    }

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          currency: user.currency,
          taxRate: Number(user.taxRate),
          feeDiscount: Number(user.feeDiscount),
          lineUserId: user.lineBinding?.lineUserId,
          lineDisplayName: user.lineBinding?.lineDisplayName,
          lineBoundAt: user.lineBinding?.boundAt,
        },
        linePrefs: user.linePrefs,
      },
    });
  });

  // 更新個人設定
  fastify.patch('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '更新參數格式錯誤' },
      });
    }

    const updated = await prisma.user.update({
      where: { id: request.user!.userId },
      data: parsed.data,
    });

    return reply.send({
      success: true,
      data: {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          avatarUrl: updated.avatarUrl,
          currency: updated.currency,
          taxRate: Number(updated.taxRate),
          feeDiscount: Number(updated.feeDiscount),
        },
      },
    });
  });
}
