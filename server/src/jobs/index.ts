import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '../plugins/redis.js';
import { prisma } from '../plugins/prisma.js';
import { fetchQuotes } from '../services/market.js';
import { reconcileHoldings, round } from '../services/accounting.js';
import { config } from '../config/env.js';
import axios from 'axios';

// 建立任務佇列
export const notificationQueue = new Queue('notifications', {
  connection: redis as any,
});

/**
 * 統一發送通知至 LINE 與自訂 Webhook (Discord / Telegram)
 */
export async function dispatchNotification(params: {
  userId: string;
  userName: string;
  title: string;
  text: string;
  kind: 'daily_summary' | 'price_alert' | 'trade_confirm' | 'test_push';
  lineUserId?: string | null;
  webhookUrl?: string | null;
}) {
  const { userId, title, text, kind, lineUserId, webhookUrl } = params;
  let sentAny = false;
  let lastError: string | null = null;

  // 1. 發送至 LINE (若已綁定)
  if (lineUserId) {
    const linePayload = {
      to: lineUserId,
      messages: [{ type: 'text', text: `${title}\n${text}` }],
    };

    if (config.LINE_CHANNEL_ACCESS_TOKEN && !lineUserId.startsWith('U_MOCK_')) {
      try {
        await axios.post('https://api.line.me/v2/bot/message/push', linePayload, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`,
          },
        });
        sentAny = true;
      } catch (err: any) {
        lastError = err?.response?.data?.message || err.message;
        console.error(`[Push to LINE failed for ${userId}]:`, lastError);
      }
    } else {
      // 模擬環境
      sentAny = true;
    }

    await prisma.notificationLog.create({
      data: {
        userId,
        channel: 'LINE',
        kind,
        payload: linePayload,
        status: sentAny ? 'SENT' : 'FAILED',
        error: lastError,
      },
    });
  }

  // 2. 發送至 Webhook (Discord / Telegram / Slack)
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      if (webhookUrl.includes('discord.com/api/webhooks')) {
        // Discord Webhook Rich Embed
        await axios.post(webhookUrl, {
          embeds: [
            {
              title,
              description: text,
              color: kind === 'price_alert' ? 0xf59e0b : 0x0a84ff,
              timestamp: new Date().toISOString(),
              footer: { text: 'Stocktify 智能資產助手' },
            },
          ],
        });
      } else {
        // 通用 Webhook / Slack / Telegram Bot Webhook
        await axios.post(webhookUrl, {
          text: `**${title}**\n${text}`,
        });
      }
      sentAny = true;

      await prisma.notificationLog.create({
        data: {
          userId,
          channel: 'WEBHOOK',
          kind,
          payload: { webhookUrl, title, text },
          status: 'SENT',
        },
      });
    } catch (err: any) {
      const errStr = err?.response?.data?.message || err.message;
      console.error(`[Push to Webhook failed for ${userId}]:`, errStr);
      await prisma.notificationLog.create({
        data: {
          userId,
          channel: 'WEBHOOK',
          kind,
          payload: { webhookUrl, title, text },
          status: 'FAILED',
          error: errStr,
        },
      });
    }
  }

  return { success: sentAny, error: lastError };
}

/**
 * 執行收盤資產損益日報推播任務
 */
export async function sendDailySummaries() {
  console.log('[Job] Starting Daily Summary Push...');
  const usersWithPrefs = await prisma.user.findMany({
    where: {
      linePrefs: {
        dailySummary: true,
      },
    },
    include: {
      lineBinding: true,
      linePrefs: true,
      transactions: true,
    },
  });

  for (const user of usersWithPrefs) {
    const lineUserId = user.lineBinding?.lineUserId;
    const webhookUrl = user.linePrefs?.webhookUrl;
    if (!lineUserId && !webhookUrl) continue;

    const holdings = reconcileHoldings(
      user.transactions.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        type: t.type,
        shares: Number(t.shares),
        price: Number(t.price),
        fee: Number(t.fee),
        tradedAt: t.tradedAt,
      }))
    );

    if (holdings.length === 0) continue;

    const { quotes } = await fetchQuotes(holdings.map((h) => h.symbol));
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    let totalMarketValue = 0;
    let totalCost = 0;
    let dailyChangeTotal = 0;

    for (const h of holdings) {
      const q = quoteMap.get(h.symbol);
      const price = q?.price ?? h.avgCost;
      const change = q?.change ?? 0;

      totalMarketValue += h.shares * price;
      totalCost += h.shares * h.avgCost;
      dailyChangeTotal += h.shares * change;
    }

    const totalGainLoss = totalMarketValue - totalCost;
    const totalGainLossPct =
      totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
    const dailyChangePct =
      totalMarketValue > 0 ? (dailyChangeTotal / totalMarketValue) * 100 : 0;

    const title = `📊【Stocktify 收盤資產報告】`;
    const text =
      `📅 日期：${new Date().toISOString().slice(0, 10)}\n` +
      `👤 用戶：${user.name}\n` +
      `───────────────\n` +
      `💰 總持股市值：$${round(totalMarketValue, 0).toLocaleString()}\n` +
      `📈 今日變動：${dailyChangeTotal >= 0 ? '+' : ''}$${round(dailyChangeTotal, 0).toLocaleString()} (${round(dailyChangePct, 2)}%)\n` +
      `🎯 累計總損益：${totalGainLoss >= 0 ? '+' : ''}$${round(totalGainLoss, 0).toLocaleString()} (${round(totalGainLossPct, 2)}%)\n` +
      `───────────────\n` +
      `持股家數：${holdings.length} 檔\n` +
      `祝您投資順利！📈`;

    await dispatchNotification({
      userId: user.id,
      userName: user.name,
      title,
      text,
      kind: 'daily_summary',
      lineUserId,
      webhookUrl,
    });
  }
}

/**
 * 執行盤中價格警示巡檢
 */
export async function checkPriceAlerts() {
  const activeAlerts = await prisma.priceAlert.findMany({
    where: { isActive: true },
    include: {
      user: {
        include: {
          lineBinding: true,
          linePrefs: true,
        },
      },
    },
  });

  if (activeAlerts.length === 0) return;

  const symbols = Array.from(new Set(activeAlerts.map((a) => a.symbol)));
  const { quotes } = await fetchQuotes(symbols);
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  for (const alert of activeAlerts) {
    const q = quoteMap.get(alert.symbol);
    if (!q || !q.price) continue;

    const threshold = Number(alert.threshold);
    let triggered = false;
    let conditionDesc = '';

    if (alert.direction === 'ABOVE' && q.price >= threshold) {
      triggered = true;
      conditionDesc = `突破目標價 $${threshold}`;
    } else if (alert.direction === 'BELOW' && q.price <= threshold) {
      triggered = true;
      conditionDesc = `跌破支撐價 $${threshold}`;
    } else if (alert.direction === 'PCT_UP' && q.changePercent >= threshold) {
      triggered = true;
      conditionDesc = `當日漲幅超過 +${threshold}%`;
    } else if (alert.direction === 'PCT_DOWN' && q.changePercent <= -threshold) {
      triggered = true;
      conditionDesc = `當日跌幅超過 -${threshold}%`;
    }

    if (triggered) {
      const user = alert.user;
      const title = `🚨【Stocktify 股價警示提醒】`;
      const text =
        `標的：${alert.symbol} (${q.name || alert.symbol})\n` +
        `現價：$${q.price} (${q.changePercent >= 0 ? '+' : ''}${q.changePercent}%)\n` +
        `觸發條件：${conditionDesc}\n` +
        `觸發時間：${new Date().toLocaleTimeString('zh-TW', { hour12: false })}\n` +
        `已自動暫停此警示，您可登入系統重新開啟。`;

      await dispatchNotification({
        userId: user.id,
        userName: user.name,
        title,
        text,
        kind: 'price_alert',
        lineUserId: user.lineBinding?.lineUserId,
        webhookUrl: user.linePrefs?.webhookUrl,
      });

      // 觸發後更新狀態避免重複推播
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          isActive: false,
          lastFiredAt: new Date(),
        },
      });
    }
  }
}

/**
 * 註冊排程任務
 */
export async function initializeScheduledJobs() {
  try {
    // 每日收盤報告：每日 16:30 執行
    await notificationQueue.add(
      'daily-summary',
      {},
      {
        jobId: 'daily-summary-job',
        repeat: { pattern: '30 16 * * 1-5' },
      }
    );

    // 價格警示巡檢：每 60 秒檢查一次
    await notificationQueue.add(
      'price-alerts',
      {},
      {
        jobId: 'price-alerts-job',
        repeat: { every: 60_000 },
      }
    );

    console.log('[BullMQ] Scheduled background jobs registered successfully.');
  } catch (err: any) {
    console.warn('[BullMQ Schedule warn]:', err.message);
  }
}

// 註冊 BullMQ Worker 處理器
export const notificationWorker = new Worker(
  'notifications',
  async (job: Job) => {
    if (job.name === 'daily-summary') {
      await sendDailySummaries();
    } else if (job.name === 'price-alerts') {
      await checkPriceAlerts();
    }
  },
  { connection: redis as any }
);

notificationWorker.on('failed', (job, err) => {
  console.error(`[BullMQ Job ${job?.id} Failed]:`, err.message);
});
