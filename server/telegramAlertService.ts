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
  isSignalInCooldown,
  recordSignalSent,
  clearSignalCooldown,
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
 * Escapes characters for Telegram HTML parse_mode
 */
export function escapeTelegramHtml(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send a message via Telegram Bot API with automatic HTML validation and fallback
 */
export async function sendTelegramMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<{ success: boolean; error?: string }> {
  const cfg = getTelegramConfig();
  if (!cfg.botToken || !cfg.chatId) {
    return {
      success: false,
      error: 'TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình!',
    };
  }

  // Clean botToken and chatId (handle accidental 'bot' prefix or whitespace)
  const cleanToken = cfg.botToken.trim().replace(/^bot/i, '');
  const cleanChatId = cfg.chatId.trim();

  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
    });

    const data: any = await response.json();
    if (!response.ok || !data.ok) {
      console.error('Telegram API error:', data);

      // If Telegram failed due to HTML parse error (code 400), automatically fallback to plain text
      if (data.error_code === 400 && parseMode === 'HTML') {
        console.warn('[TELEGRAM] ⚠️ HTML parse failed, trying plain text fallback without HTML tags...');
        const plainText = text.replace(/<[^>]*>/g, '');
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cleanChatId,
            text: plainText,
            disable_web_page_preview: false,
          }),
        });
        const retryData: any = await retryResponse.json();
        if (retryResponse.ok && retryData.ok) {
          console.log('[TELEGRAM] ✅ Gửi tin nhắn thành công qua Plain-text fallback');
          return { success: true };
        }
      }

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
 * Format a detailed, rich HTML alert for Telegram with 4-Tier Quant Matrix (Tier P2: Custom Alert)
 */
export function formatTelegramAlertMessage(alert: StockAlert, stock: StockData, triggerResult: { message: string; severity: string }): string {
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const condLabel = escapeTelegramHtml(formatConditionLabel(alert.triggerType, alert.condition, alert.targetValue));
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
  let badgeHeader = '🔔 <b>[P2 - CẢNH BÁO ĐÃ ĐẶT] TÍN HIỆU THEO YÊU CẦU</b>';
  if (alert.triggerType === 'VOLUME_SURGE') {
    badgeHeader = '🔥 <b>[P2 - CẢNH BÁO ĐÃ ĐẶT] ĐỘT BIẾN KHỐI LƯỢNG (&gt;200% MA20)</b>';
  } else if (alert.triggerType === 'STOP_LOSS_TAKE_PROFIT') {
    badgeHeader = '🛑 <b>[P2 - CẢNH BÁO ĐÃ ĐẶT] CHẠM NGƯỠNG STOP-LOSS / TAKE-PROFIT</b>';
  } else if (alert.triggerType === 'BREAKOUT_LEVEL') {
    badgeHeader = '🚀 <b>[P2 - CẢNH BÁO ĐÃ ĐẶT] BỨT PHÁ KỸ THUẬT BREAKOUT</b>';
  } else if (alert.triggerType === 'MA_CROSSOVER') {
    badgeHeader = '✨ <b>[P2 - CẢNH BÁO ĐÃ ĐẶT] GIAO CẮT VÀNG GOLDEN CROSS (MA20/50)</b>';
  }

  const foreignStr = stock.foreignNetVal > 0 ? `+${stock.foreignNetVal} tỷ` : `${stock.foreignNetVal} tỷ`;
  const safeStockName = escapeTelegramHtml(stock.name);
  const safeMessage = escapeTelegramHtml(triggerResult.message);
  const safeNote = alert.note ? escapeTelegramHtml(alert.note) : '';

  return `${badgeHeader}
━━━━━━━━━━━━━━━━━━━━━
📌 <b>MÃ CP: #${stock.symbol}</b> (${safeStockName})
🏢 <b>Sàn:</b> ${stock.exchange} | <b>Ngành:</b> ${escapeTelegramHtml(stock.sector)}
🎯 <b>Tín hiệu kích hoạt:</b> <code>${condLabel}</code>
💲 <b>Thị giá:</b> <b>${stock.price.toFixed(2)}k VNĐ</b> (${changeSign}${stock.changePercent.toFixed(2)}%)
📊 <b>Thanh khoản:</b> ${stock.volume.toLocaleString('vi-VN')} CP (GT: ${stock.value} tỷ)
🐋 <b>Khối ngoại:</b> ${foreignStr} | <b>Smart Money:</b> ${escapeTelegramHtml(stock.smartMoney?.patternName || 'Tích lũy')}

📈 <b>CHỈ BÁO KỸ THUẬT:</b>
• RSI(14): <b>${stock.technical.rsi14.toFixed(1)}</b> | MACD: <b>${stock.technical.macd.histogram > 0 ? '+' : ''}${stock.technical.macd.histogram.toFixed(2)}</b>
• MA20: <b>${stock.technical.ma20.toFixed(2)}k</b> | MA50: <b>${stock.technical.ma50.toFixed(2)}k</b>
• Hỗ trợ then chốt: <b>${stock.technical.supportLevel}k</b> | Kháng cự: <b>${stock.technical.resistanceLevel}k</b>

🎯 <b>KẾ HOẠCH GIAO DỊCH (QUANT ACTION PLAN):</b>
• <b>Vùng Mua Gom:</b> <code>${buyZoneLow} - ${buyZoneHigh}k</code> (Chia 2 đợt 50/50)
• <b>Mục tiêu TP1:</b> <code>${tp1}k</code> (+${tp1Upside}%) | <b>TP2:</b> <code>${tp2}k</code>
• <b>Cắt lỗ SL:</b> <code>${sl}k</code> (-${slDownside}%) [Gãy MA20/Hỗ trợ]
• <b>Tỷ lệ R:R:</b> <code>1 : ${rr}</code> | <b>Phân bổ:</b> <code>15 - 20% NAV</code>

📣 <b>Phân tích AI:</b> ${safeMessage}
${safeNote ? `📝 <b>Ghi chú người dùng:</b> <i>${safeNote}</i>\n` : ''}
⏰ <b>Thời gian:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━━
🔗 <a href="${tvUrl}">Mở biểu đồ trực tiếp trên TradingView ↗</a>`;
}

/**
 * Main 5-minute Cron Job Handler
 * Evaluates:
 * 1. P2 Custom Alerts with edge-triggering & deduplication
 * 2. P1 Portfolio & P3 Watchlist Sentinel scan
 */
export async function runCronMarketSyncAndCheckAlerts() {
  const startTime = Date.now();
  console.log(`[CRON] 🚀 Bắt đầu chu kỳ cập nhật dữ liệu & kiểm tra cảnh báo 4 tầng (${new Date().toISOString()})...`);

  // 1. Refresh news and stocks data
  const latestNews = await getLatestNewsAsync();
  const stocks = getAllStocks();

  let alertsEvaluated = 0;
  let alertsTriggered = 0;
  let telegramSentCount = 0;
  const triggerLog: Array<{ symbol: string; alertId: string; message: string; telegramSuccess: boolean }> = [];

  const cfg = getTelegramConfig();

  // 2. Evaluate active server alerts (Tier P2)
  if (cfg.enableP2CustomAlerts !== false) {
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
        // Unique signature for this specific trigger condition
        const currentSignature = `${alert.id}_${alert.symbol}_${alert.triggerType}_${alert.condition}_${alert.targetValue}`;
        const cooldownKey = `P2_${currentSignature}`;

        // Deduplication check: Single-shot / cooldown
        if (alert.lastSentSignature === currentSignature || isSignalInCooldown(cooldownKey, 120)) {
          console.log(`[CRON P2] ⚠️ Bỏ qua gửi Telegram cho ${alert.symbol} (${alert.id}): Thông báo trùng lặp đã được gửi trước đó.`);
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
            alert.lastSentSignature = currentSignature;
            alert.triggerCount = (alert.triggerCount || 0) + 1;
            alert.lastTriggeredAt = new Date().toISOString();
            recordSignalSent(cooldownKey, 'SENT');
            stateChanged = true;
          }
        } else {
          alert.lastSentSignature = currentSignature;
          alert.triggerCount = (alert.triggerCount || 0) + 1;
          alert.lastTriggeredAt = new Date().toISOString();
          recordSignalSent(cooldownKey, 'LOGGED_NO_TELEGRAM');
          stateChanged = true;
        }

        // Record to persistent trigger history
        addTriggerHistoryItem({
          symbol: alert.symbol,
          alertId: alert.id,
          tier: 'P2',
          message: `[P2 ĐÃ ĐẶT] ${evalResult.message}`,
          telegramSuccess,
        });

        triggerLog.push({
          symbol: alert.symbol,
          alertId: alert.id,
          message: evalResult.message,
          telegramSuccess,
        });
      } else {
        // Condition no longer met: clear state so future triggers notify again
        if (alert.lastSentSignature !== undefined) {
          alert.lastSentSignature = undefined;
          clearSignalCooldown(`P2_${alert.id}_${alert.symbol}_${alert.triggerType}_${alert.condition}_${alert.targetValue}`);
          stateChanged = true;
        }
      }
    }

    if (stateChanged) {
      saveStore();
    }
  }

  // 3. Automated Multi-Tier Sentinel Scan (Tier P1 Portfolio, Tier P3 Watchlist, Tier P4 Market)
  let multiTierReport: any = null;
  try {
    multiTierReport = await runWatchlistSentinelScan();
    telegramSentCount += multiTierReport.telegramMessagesSent || 0;
  } catch (sentinelErr) {
    console.error('[CRON MULTI-TIER SENTINEL ERROR]:', sentinelErr);
  }

  const durationMs = Date.now() - startTime;
  console.log(`[CRON] ✅ Cập nhật xong trong ${durationMs}ms: ${stocks.length} CP, ${alertsTriggered}/${alertsEvaluated} P2 kích hoạt, ${telegramSentCount} tin Telegram đã gửi.`);

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    durationMs,
    summary: {
      totalStocksUpdated: stocks.length,
      totalNewsFetched: latestNews.length,
      alertsEvaluated,
      alertsTriggered,
      tier1PortfolioChecked: multiTierReport?.tier1PortfolioChecked || 0,
      tier3WatchlistChecked: multiTierReport?.tier3WatchlistChecked || 0,
      watchlistSentinelSignals: multiTierReport?.activeSignalsFound || 0,
      telegramSentCount,
      telegramConfigured: Boolean(cfg.botToken && cfg.chatId),
    },
    triggeredAlerts: triggerLog,
    multiTierReport,
  };
}
