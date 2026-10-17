export interface MarketState {
  market: 'TW' | 'US';
  name: string;
  isOpen: boolean;
  statusText: string;
}

export function getTaiwanMarketStatus(): MarketState {
  const now = new Date();
  // UTC time + 8 hours for Taipei
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const twDate = new Date(utc + 3600000 * 8);

  const day = twDate.getDay(); // 0: Sun, 6: Sat
  const hour = twDate.getHours();
  const minute = twDate.getMinutes();
  const timeNum = hour * 100 + minute;

  const isWeekend = day === 0 || day === 6;
  const isTradingHour = !isWeekend && timeNum >= 900 && timeNum < 1330;

  let statusText = '已休市';
  if (isTradingHour) {
    statusText = '開盤中';
  } else if (!isWeekend && timeNum >= 830 && timeNum < 900) {
    statusText = '試撮中';
  }

  return {
    market: 'TW',
    name: '台股',
    isOpen: isTradingHour,
    statusText,
  };
}

export function getUSMarketStatus(): MarketState {
  // Use Intl to get Eastern Time (New York) correctly handling daylight saving
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value) || 0;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value) || 0;
  const timeNum = hour * 100 + minute;

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isRegular = !isWeekend && timeNum >= 930 && timeNum < 1600;
  const isPreMarket = !isWeekend && timeNum >= 400 && timeNum < 930;
  const isAfterHours = !isWeekend && timeNum >= 1600 && timeNum < 2000;

  let statusText = '已休市';
  if (isRegular) {
    statusText = '美股開盤中';
  } else if (isPreMarket) {
    statusText = '美股盤前';
  } else if (isAfterHours) {
    statusText = '美股盤後';
  }

  return {
    market: 'US',
    name: '美股',
    isOpen: isRegular,
    statusText,
  };
}
