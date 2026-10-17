import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/env.js';
import { connectPrisma, disconnectPrisma } from './plugins/prisma.js';
import { redis } from './plugins/redis.js';

import { authRoutes } from './routes/auth.js';
import { transactionRoutes } from './routes/transactions.js';
import { assetRoutes } from './routes/assets.js';
import { watchlistRoutes } from './routes/watchlist.js';
import { marketRoutes } from './routes/market.js';
import { backupRoutes } from './routes/backup.js';
import { lineRoutes } from './routes/line.js';
import { initializeScheduledJobs } from './jobs/index.js';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

async function main() {
  await connectPrisma();

  // 1. Plugins
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.COOKIE_SECRET,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // 2. Health Check
  app.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // 3. API Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(transactionRoutes, { prefix: '/api/v1/transactions' });
  await app.register(assetRoutes, { prefix: '/api/v1/assets' });
  await app.register(watchlistRoutes, { prefix: '/api/v1/watchlist' });
  await app.register(marketRoutes, { prefix: '/api/v1/market' });
  await app.register(backupRoutes, { prefix: '/api/v1/backup' });
  await app.register(lineRoutes, { prefix: '/api/v1/line' });

  // 4. Initialize Background Scheduled Jobs
  await initializeScheduledJobs();

  // 4. Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      await app.close();
      await disconnectPrisma();
      redis.disconnect();
      process.exit(0);
    });
  }

  // 5. Start Server
  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    console.log(`🚀 Stocktify Backend Server running at: ${address}`);
    console.log(`📈 Market API: ${address}/api/v1/market/quote?symbols=AAPL,2330.TW`);
    console.log(`💚 Health Check: ${address}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
