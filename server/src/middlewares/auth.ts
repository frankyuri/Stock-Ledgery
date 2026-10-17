import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { prisma } from '../plugins/prisma.js';

export interface TokenPayload {
  userId: string;
  email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateTokens(fastify: any, payload: TokenPayload) {
  const accessToken = fastify.jwt.sign(payload, { expiresIn: '15m' });
  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  return { accessToken, rawRefreshToken };
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '缺少或無效的身分驗證憑證' },
      });
    }

    const token = authHeader.slice(7);
    const decoded = await (request.server as any).jwt.verify(token);
    request.user = decoded as TokenPayload;
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: { code: 'TOKEN_EXPIRED_OR_INVALID', message: '憑證已過期或無效，請重新整理' },
    });
  }
}

export async function storeRefreshToken(
  userId: string,
  rawToken: string,
  userAgent?: string,
  ip?: string
) {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent || null,
      ip: ip || null,
    },
  });
}

export async function rotateRefreshToken(rawToken: string, userAgent?: string, ip?: string) {
  const tokenHash = hashToken(rawToken);
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new Error('REFRESH_TOKEN_NOT_FOUND');
  }

  if (tokenRecord.revokedAt) {
    // 異常重放！可能遭受 Token 竊取，撤銷該用戶所有 Token
    await prisma.refreshToken.updateMany({
      where: { userId: tokenRecord.userId },
      data: { revokedAt: new Date() },
    });
    throw new Error('TOKEN_REUSED_COMPROMISED');
  }

  if (new Date() > tokenRecord.expiresAt) {
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }

  // 作廢舊 Token
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() },
  });

  // 產生新 Token
  const newRawToken = crypto.randomBytes(32).toString('hex');
  await storeRefreshToken(tokenRecord.userId, newRawToken, userAgent, ip);

  return {
    user: tokenRecord.user,
    newRawToken,
  };
}
