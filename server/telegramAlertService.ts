import { getLatestNewsAsync, getAllStocks, getOrFetchStockBySymbol } from './marketDataService';
import { StockData } from '../src/types';
import { StockAlert } from '../src/types/alert';
import { checkAlertTrigger, formatConditionLabel } from '../src/services/alertService';

// Memory store for Telegram Bot Config & Active Server Alerts
interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

let telegramConfig: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  enabled: true,
};

// In-memory Server-side Active Alerts list (initialized with default stock triggers)
let serverAlerts: StockAlert[] = [
  {
    id: 'srv-alt-1',
    symbol: 'HPG',
    triggerType: 'PRICE_THRESHOLD',
    condition: 'ABOVE_PRICE',
    targetValue: 22.0,
    note: 'Cảnh báo bứt phá HPG vùng giá 22.0',
    channel: 'TELEGRAM',
    isActive: true,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'srv-alt-2',
    symbol: 'FPT',
    triggerType: 'RSI_LEVEL',
    condition: 'RSI_OVERBOUGHT',
    targetValue: 70,
    note: 'Cảnh báo RSI FPT đi vào vùng quá mua (>70)',
    channel: 'TELEGRAM',
    isActive: true,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'srv-alt-3',
    symbol: 'SSI',
    triggerType: 'MA_CROSSOVER',
    condition: 'PRICE_CROSS_ABOVE_MA20',
    targetValue: 36.0,
    note: 'SSI cắt lên MA20',
    channel: 'TELEGRAM',
    isActive: true,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
];

export function getTelegramConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken,
    chatId: process.env.TELEGRAM_CHAT_ID || telegramConfig.chatId,
    enabled: telegramConfig.enabled,
  };
}

export function updateTelegramConfig(config: Partial<TelegramConfig>): TelegramConfig {
  telegramConfig = {
    ...telegramConfig,
    ...config,
  };
  return getTelegramConfig();
}

export function getServerAlerts(): StockAlert[] {
  return serverAlerts;
}

export function addServerAlert(alert: Omit<StockAlert, 'id' | 'createdAt' | 'triggerCount'>): StockAlert {
  const newAlert: StockAlert = {
    ...alert,
    id: `srv-alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  };
  serverAlerts.unshift(newAlert);
  return newAlert;
}

export function deleteServerAlert(id: string): boolean {
  const initialLength = serverAlerts.length;
  serverAlerts = serverAlerts.filter((a) => a.id !== id);
  return serverAlerts.length < initialLength;
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<{ success: boolean; error?: string }> {
  const cfg = getTelegramConfig();
  if (!cfg.botToken || !cfg.chatId) {
    return {
      success: false,
      error: 'TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình!',
    };
  }

  try {
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
    });

    const data: any = await response.json();
    if (!response.ok || !data.ok) {
      console.error('Telegram API error:', data);
      return {
        success: false,
        error: data.description || 'Lỗi gửi tin nhắn Telegram',
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send Telegram message:', err);
    return {
      success: false,
      error: err.message || 'Lỗi kết nối tới Telegram API',
    };
  }
}

/**
 * Format a detailed, rich HTML alert for Telegram
 */
export function formatTelegramAlertMessage(alert: StockAlert, stock: StockData, triggerResult: { message: string; severity: string }): string {
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const condLabel = formatConditionLabel(alert.triggerType, alert.condition, alert.targetValue);
  const changeSign = stock.change >= 0 ? '+' : '';
  const tvExchange = ['HNX', 'UPCOM'].includes((stock.exchange || '').toUpperCase()) ? stock.exchange.toUpperCase() : 'HOSE';
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${stock.symbol}`;

  return `🚨 <b>VIETSTOCK QUANT - CẢNH BÁO TÍN HIỆU CỔ PHIẾU</b> 🚨
---------------------------------------------
📌 <b>Mã CP:</b> #${stock.symbol} (${stock.name})
🏢 <b>Sàn:</b> ${stock.exchange} | <b>Ngành:</b> ${stock.sector}
🎯 <b>Tín hiệu:</b> ${condLabel}
💲 <b>Giá hiện tại:</b> <b>${stock.price.toFixed(2)} VNĐ</b> (${changeSign}${stock.changePercent.toFixed(2)}%)
📈 <b>Chỉ báo Kỹ thuật:</b>
   • RSI (14): <b>${stock.technical.rsi14.toFixed(1)}</b>
   • MA20: <b>${stock.technical.ma20.toFixed(2)}</b> | MA50: <b>${stock.technical.ma50.toFixed(2)}</b>
   • Kháng cự: ${stock.technical.resistanceLevel} | Hỗ trợ: ${stock.technical.supportLevel}
📣 <b>Nội dung cảnh báo:</b> ${triggerResult.message}
${alert.note ? `📝 <b>Ghi chú cá nhân:</b> <i>${alert.note}</i>\n` : ''}
⏰ <b>Thời gian cập nhật:</b> ${timeStr}
---------------------------------------------
🔗 <a href="${tvUrl}">Xem biểu đồ trực tiếp trên TradingView ↗</a>`;
}

/**
 * Main 5-minute Cron Job Handler
 * 1. Refreshes live market data & news from internet
 * 2. Evaluates all active alerts
 * 3. Sends Telegram alerts if triggers are hit
 */
export async function runCronMarketSyncAndCheckAlerts() {
  const startTime = Date.now();
  console.log(`[CRON] 🚀 Bắt đầu chu kỳ cập nhật dữ liệu & kiểm tra cảnh báo 5 phút (${new Date().toISOString()})...`);

  // 1. Refresh news and stocks data
  const latestNews = await getLatestNewsAsync();
  const stocks = getAllStocks();

  let alertsEvaluated = 0;
  let alertsTriggered = 0;
  let telegramSentCount = 0;
  const triggerLog: Array<{ symbol: string; alertId: string; message: string; telegramSuccess: boolean }> = [];

  const cfg = getTelegramConfig();

  // 2. Evaluate active server alerts
  for (const alert of serverAlerts) {
    if (!alert.isActive) continue;
    alertsEvaluated++;

    const stock = stocks.find((s) => s.symbol === alert.symbol) || (await getOrFetchStockBySymbol(alert.symbol));
    if (!stock) continue;

    const evalResult = checkAlertTrigger(alert, stock);

    if (evalResult.isTriggered) {
      // Build unique signature for this specific trigger condition
      const currentSignature = `${alert.id}_${alert.symbol}_${alert.triggerType}_${alert.condition}_${alert.targetValue}_${evalResult.message}`;

      // Deduplication check: Do NOT resend if this exact notification signature was already sent
      if (alert.lastSentSignature === currentSignature) {
        console.log(`[CRON] ⚠️ Bỏ qua gửi Telegram cho ${alert.symbol} (${alert.id}): Thông báo trùng lặp đã được gửi trước đó.`);
        triggerLog.push({
          symbol: alert.symbol,
          alertId: alert.id,
          message: `${evalResult.message} [ĐÃ BỎ QUA - THÔNG BÁO LẶP]`,
          telegramSuccess: false,
        });
        continue;
      }

      alertsTriggered++;
      
      let telegramSuccess = false;
      if (cfg.enabled && cfg.botToken && cfg.chatId) {
        const msg = formatTelegramAlertMessage(alert, stock, evalResult);
        const res = await sendTelegramMessage(msg);
        telegramSuccess = res.success;
        if (res.success) {
          telegramSentCount++;
          alert.lastSentSignature = currentSignature; // Record sent signature
          alert.triggerCount = (alert.triggerCount || 0) + 1;
          alert.lastTriggeredAt = new Date().toISOString();
        }
      } else {
        // Record signature even if Telegram isn't configured so trigger state is tracked
        alert.lastSentSignature = currentSignature;
        alert.triggerCount = (alert.triggerCount || 0) + 1;
        alert.lastTriggeredAt = new Date().toISOString();
      }

      triggerLog.push({
        symbol: alert.symbol,
        alertId: alert.id,
        message: evalResult.message,
        telegramSuccess,
      });
    } else {
      // If condition is no longer met, reset lastSentSignature so future cross-overs will notify again
      alert.lastSentSignature = undefined;
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[CRON] ✅ Cập nhật xong trong ${durationMs}ms: ${stocks.length} cổ phiếu, ${latestNews.length} tin tức, ${alertsTriggered}/${alertsEvaluated} cảnh báo kích hoạt, ${telegramSentCount} tin Telegram đã gửi.`);

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    durationMs,
    summary: {
      totalStocksUpdated: stocks.length,
      totalNewsFetched: latestNews.length,
      alertsEvaluated,
      alertsTriggered,
      telegramSentCount,
      telegramConfigured: Boolean(cfg.botToken && cfg.chatId),
    },
    triggeredAlerts: triggerLog,
  };
}
