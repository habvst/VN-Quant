import { getLatestNewsAsync, getAllStocks, getOrFetchStockBySymbol } from './marketDataService';
import { StockData } from '../src/types';
import { StockAlert } from '../src/types/alert';
import { checkAlertTrigger, formatConditionLabel } from '../src/services/alertService';
import { runWatchlistSentinelScan } from './watchlistSentinelService';
import {
  getTelegramConfigStore,
  updateTelegramConfigStore,
  getServerAlertsStore,
  addServerAlertStore,
  deleteServerAlertStore,
  saveStore,
  addTriggerHistoryItem,
  TelegramConfig,
} from './dataStore';

export function getTelegramConfig(): TelegramConfig {
  return getTelegramConfigStore();
}

export function updateTelegramConfig(config: Partial<TelegramConfig>): TelegramConfig {
  return updateTelegramConfigStore(config);
}

export function getServerAlerts(): StockAlert[] {
  return getServerAlertsStore();
}

export function addServerAlert(alert: Omit<StockAlert, 'id' | 'createdAt' | 'triggerCount'>): StockAlert {
  return addServerAlertStore(alert);
}

export function deleteServerAlert(id: string): boolean {
  return deleteServerAlertStore(id);
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
 * Format a detailed, rich HTML alert for Telegram with 4-Tier Quant Matrix
 */
export function formatTelegramAlertMessage(alert: StockAlert, stock: StockData, triggerResult: { message: string; severity: string }): string {
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const condLabel = formatConditionLabel(alert.triggerType, alert.condition, alert.targetValue);
  const changeSign = stock.change >= 0 ? '+' : '';
  const tvExchange = ['HNX', 'UPCOM'].includes((stock.exchange || '').toUpperCase()) ? stock.exchange.toUpperCase() : 'HOSE';
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${stock.symbol}`;

  // Calculate quick trade parameters
  const buyZoneLow = (stock.price * 0.985).toFixed(2);
  const buyZoneHigh = (stock.price * 1.005).toFixed(2);
  const tp1 = stock.aiTargetPrice || Number((stock.price * 1.12).toFixed(2));
  const tp2 = Number((tp1 * 1.08).toFixed(2));
  const sl = stock.aiStopLoss || Number((stock.price * 0.94).toFixed(2));
  const tp1Upside = (((tp1 - stock.price) / stock.price) * 100).toFixed(1);
  const slDownside = (((stock.price - sl) / stock.price) * 100).toFixed(1);
  const rr = (Number(tp1Upside) / (Number(slDownside) || 1)).toFixed(1);

  // Custom visual badge based on trigger type
  let badgeHeader = '🚨 <b>VIETSTOCK QUANT - CẢNH BÁO TÍN HIỆU 4 TẦNG</b>';
  if (alert.triggerType === 'VOLUME_SURGE') {
    badgeHeader = '🔥 <b>VIETSTOCK QUANT - ĐỘT BIẾN KHỐI LƯỢNG (>200% MA20)</b>';
  } else if (alert.triggerType === 'STOP_LOSS_TAKE_PROFIT') {
    badgeHeader = '🛑 <b>VIETSTOCK QUANT - CẢNH BÁO STOP-LOSS / TAKE-PROFIT</b>';
  } else if (alert.triggerType === 'BREAKOUT_LEVEL') {
    badgeHeader = '🚀 <b>VIETSTOCK QUANT - BỨT PHÁ KỸ THUẬT BREAKOUT</b>';
  } else if (alert.triggerType === 'MA_CROSSOVER') {
    badgeHeader = '✨ <b>VIETSTOCK QUANT - GIAO CẮT VÀNG GOLDEN CROSS (MA20/50)</b>';
  }

  const foreignStr = stock.foreignNetVal > 0 ? `+${stock.foreignNetVal} tỷ` : `${stock.foreignNetVal} tỷ`;

  return `${badgeHeader}
━━━━━━━━━━━━━━━━━━━━━
📌 <b>MÃ CP: #${stock.symbol}</b> (${stock.name})
🏢 <b>Sàn:</b> ${stock.exchange} | <b>Ngành:</b> ${stock.sector}
🎯 <b>Tín hiệu kích hoạt:</b> <code>${condLabel}</code>
💲 <b>Thị giá:</b> <b>${stock.price.toFixed(2)}k VNĐ</b> (${changeSign}${stock.changePercent.toFixed(2)}%)
📊 <b>Thanh khoản:</b> ${stock.volume.toLocaleString('vi-VN')} CP (GT: ${stock.value} tỷ)
🐋 <b>Khối ngoại:</b> ${foreignStr} | <b>Smart Money:</b> ${stock.smartMoney?.patternName || 'Tích lũy'}

📈 <b>CHỈ BÁO KỸ THUẬT:</b>
• RSI(14): <b>${stock.technical.rsi14.toFixed(1)}</b> | MACD: <b>${stock.technical.macd.histogram > 0 ? '+' : ''}${stock.technical.macd.histogram.toFixed(2)}</b>
• MA20: <b>${stock.technical.ma20.toFixed(2)}k</b> | MA50: <b>${stock.technical.ma50.toFixed(2)}k</b>
• Hỗ trợ then chốt: <b>${stock.technical.supportLevel}k</b> | Kháng cự: <b>${stock.technical.resistanceLevel}k</b>

🎯 <b>KẾ HOẠCH GIAO DỊCH (QUANT ACTION PLAN):</b>
• <b>Vùng Mua Gom:</b> <code>${buyZoneLow} - ${buyZoneHigh}k</code> (Chia 2 đợt 50/50)
• <b>Mục tiêu TP1:</b> <code>${tp1}k</code> (+${tp1Upside}%) | <b>TP2:</b> <code>${tp2}k</code>
• <b>Cắt lỗ SL:</b> <code>${sl}k</code> (-${slDownside}%) [Gãy MA20/Hỗ trợ]
• <b>Tỷ lệ R:R:</b> <code>1 : ${rr}</code> | <b>Phân bổ:</b> <code>15 - 20% NAV</code>

📣 <b>Phân tích AI:</b> ${triggerResult.message}
${alert.note ? `📝 <b>Ghi chú:</b> <i>${alert.note}</i>\n` : ''}
⏰ <b>Thời gian:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━━
🔗 <a href="${tvUrl}">Mở biểu đồ trực tiếp trên TradingView ↗</a>`;
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
  const serverAlerts = getServerAlertsStore();
  let stateChanged = false;

  for (const alert of serverAlerts) {
    if (!alert.isActive) continue;
    alertsEvaluated++;

    const stock = stocks.find((s) => s.symbol === alert.symbol) || (await getOrFetchStockBySymbol(alert.symbol));
    if (!stock) continue;

    // Check user-configured Telegram smart filters
    if (cfg.enabled) {
      if (cfg.filterVolumeSurgeOnly && alert.triggerType !== 'VOLUME_SURGE') {
        continue;
      }
      if (cfg.filterStopLossTakeProfitOnly && alert.triggerType !== 'STOP_LOSS_TAKE_PROFIT') {
        continue;
      }
      if (cfg.filterBreakoutOnly && alert.triggerType !== 'BREAKOUT_LEVEL' && alert.triggerType !== 'MA_CROSSOVER') {
        continue;
      }
      if (cfg.minPriceChangePercent && Math.abs(stock.changePercent) < cfg.minPriceChangePercent) {
        continue;
      }
    }

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
          stateChanged = true;
        }
      } else {
        // Record signature even if Telegram isn't configured so trigger state is tracked
        alert.lastSentSignature = currentSignature;
        alert.triggerCount = (alert.triggerCount || 0) + 1;
        alert.lastTriggeredAt = new Date().toISOString();
        stateChanged = true;
      }

      // Record to persistent trigger history
      addTriggerHistoryItem({
        symbol: alert.symbol,
        alertId: alert.id,
        message: evalResult.message,
        telegramSuccess,
      });

      triggerLog.push({
        symbol: alert.symbol,
        alertId: alert.id,
        message: evalResult.message,
        telegramSuccess,
      });
    } else {
      // If condition is no longer met, reset lastSentSignature so future cross-overs will notify again
      if (alert.lastSentSignature !== undefined) {
        alert.lastSentSignature = undefined;
        stateChanged = true;
      }
    }
  }

  if (stateChanged) {
    saveStore();
  }

  // 3. Automated Watchlist Sentinel Technical Indicator Scan (RSI crossover, MA cross, etc.)
  let watchlistSentinelReport: any = null;
  try {
    watchlistSentinelReport = await runWatchlistSentinelScan();
    telegramSentCount += watchlistSentinelReport.telegramMessagesSent || 0;
  } catch (sentinelErr) {
    console.error('[CRON WATCHLIST SENTINEL ERROR]:', sentinelErr);
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
      watchlistSentinelSignals: watchlistSentinelReport?.activeSignalsFound || 0,
      telegramSentCount,
      telegramConfigured: Boolean(cfg.botToken && cfg.chatId),
    },
    triggeredAlerts: triggerLog,
    watchlistSentinel: watchlistSentinelReport,
  };
}
