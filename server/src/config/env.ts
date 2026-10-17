import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  COOKIE_SECRET: z.string().min(16),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173'),
  YAHOO_BASE_URL: z.string().default('https://query1.finance.yahoo.com'),
  YAHOO_USER_AGENT: z.string().default('Mozilla/5.0'),
  LINE_CHANNEL_ID: z.string().optional().default(''),
  LINE_CHANNEL_SECRET: z.string().optional().default(''),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional().default(''),
  LINE_OAUTH_REDIRECT_URI: z.string().default('http://localhost:8080/api/v1/line/oauth/callback'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

export const config = envSchema.parse(process.env);
