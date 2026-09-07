import { PortfolioPosition, StockData } from '../types';
import { MockNotification } from '../types/alert';
import { getStoredNotifications, playAlertSound, saveNotificationsToStorage } from './alertService';

export const PORTFOLIO_STORAGE_KEY = 'vnquant_portfolio_positions';
export const PORTFOLIO_UPDATED_EVENT = 'vnquant_portfolio_updated';

export function getStoredPositions(): PortfolioPosition[] {
  try {
    const saved = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse portfolio positions:', e);
  }
  return [];
}

export function getStoredPortfolioSymbols(): string[] {
  return getStoredPositions().map((p) => p.symbol.toUpperCase());
}

const ALERT_COOLDOWN_MAP = new Map<string, number>();

/**
 * Synchronizes client-side portfolio positions (including SL/TP settings) to the Server Sentinel
 */
export async function syncPortfolioToServer(positions: PortfolioPosition[]): Promise<boolean> {
  try {
    const payload = positions.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      buyPrice: p.buyPrice,
      quantity: p.quantity,
      stopLossPrice: p.stopLossPrice,
      stopLossPercent: p.stopLossPercent,
      targetPrice: p.targetPrice,
      targetPercent: p.targetPercent,
      targetPrice2: p.targetPrice2,
      trailingStopPercent: p.trailingStopPercent,
      highestPriceSinceBuy: p.highestPriceSinceBuy,
      alertEnabled: p.alertEnabled !== false,
      alertChannel: p.alertChannel || 'TELEGRAM',
      tradeDate: p.buyDate || new Date().toISOString(),
    }));

    const res = await fetch('/api/portfolio/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: payload }),
    });

    if (res.ok) {
      console.log(`[PORTFOLIO SYNC] ✅ Đã đồng bộ ${positions.length} vị thế kèm SL/TP lên máy chủ.`);
      return true;
    }
  } catch (err) {
    console.warn('[PORTFOLIO SYNC] ⚠️ Không thể kết nối tới server sentinel:', err);
  }
  return false;
}

/**
 * Evaluates real-time portfolio holdings for Stop-Loss, Take-Profit, and Trailing Stop events
 */
export function evaluateClientPortfolioRiskAlerts(
  positions: PortfolioPosition[],
  stockMap: Record<string, StockData>,
  onTriggerAction?: (actionType: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP', position: PortfolioPosition, stock: StockData) => void
): { triggeredAlerts: Array<{ symbol: string; type: string; message: string; severity: 'DANGER' | 'WARNING' | 'SUCCESS' }> } {
  const triggeredAlerts: Array<{ symbol: string; type: string; message: string; severity: 'DANGER' | 'WARNING' | 'SUCCESS' }> = [];
  const now = Date.now();

  for (const pos of positions) {
    if (pos.alertEnabled === false) continue;

    const stock = stockMap[pos.symbol];
    if (!stock || stock.price <= 0) continue;

    const currentPrice = stock.price;
    const buyPrice = pos.buyPrice;
    const quantity = pos.quantity;
    const effectiveStopLoss = pos.stopLossPrice || (pos.stopLossPercent ? Number((buyPrice * (1 - pos.stopLossPercent / 100)).toFixed(2)) : Number((buyPrice * 0.93).toFixed(2)));
    const effectiveTarget = pos.targetPrice || (pos.targetPercent ? Number((buyPrice * (1 + pos.targetPercent / 100)).toFixed(2)) : Number((buyPrice * 1.15).toFixed(2)));
    const effectiveTarget2 = pos.targetPrice2 || Number((effectiveTarget * 1.08).toFixed(2));
    const highestPrice = Math.max(pos.highestPriceSinceBuy || buyPrice, currentPrice);

    // Update highestPriceSinceBuy if currentPrice breaks higher
    if (currentPrice > (pos.highestPriceSinceBuy || buyPrice)) {
      pos.highestPriceSinceBuy = currentPrice;
    }

    const pnlPercent = ((currentPrice - buyPrice) / buyPrice) * 100;
    const pnlAmount = (currentPrice - buyPrice) * quantity * 1000;
    const pnlStr = `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${pnlAmount >= 0 ? '+' : ''}${(pnlAmount / 1000000).toFixed(2)} tr)`;

    // 1. VI PHẠM CẮT LỖ (STOP-LOSS BREACH)
    if (currentPrice <= effectiveStopLoss) {
      const sig = `CLIENT_SL_${pos.symbol}_${effectiveStopLoss}`;
      const lastSent = ALERT_COOLDOWN_MAP.get(sig) || 0;
      if (now - lastSent > 30 * 60 * 1000) { // 30 mins cooldown
        ALERT_COOLDOWN_MAP.set(sig, now);
        playAlertSound();

        const notif: MockNotification = {
          id: `p1-sl-${Date.now()}-${pos.symbol}`,
          symbol: pos.symbol,
          triggerType: 'STOP_LOSS_TAKE_PROFIT',
          title: `🚨 [DANH MỤC] VI PHẠM CẮT LỖ: #${pos.symbol}`,
          message: `Thị giá ${currentPrice.toFixed(2)}k đã vi phạm ngưỡng Cắt Lỗ ${effectiveStopLoss.toFixed(2)}k. Lỗ: ${pnlStr}. Khối lượng: ${quantity.toLocaleString('vi-VN')} CP. Đề xuất: BÁN CẮT LỖ NGAY!`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          channel: pos.alertChannel || 'IN_APP',
          severity: 'DANGER',
          read: false,
        };

        dispatchNotification(notif);
        triggeredAlerts.push({
          symbol: pos.symbol,
          type: 'STOP_LOSS',
          message: notif.message,
          severity: 'DANGER',
        });

        if (onTriggerAction) onTriggerAction('STOP_LOSS', pos, stock);
      }
    }

    // 2. TRAILING STOP BREACH
    if (pos.trailingStopPercent && pos.trailingStopPercent > 0) {
      const trailingStopPrice = Number((highestPrice * (1 - pos.trailingStopPercent / 100)).toFixed(2));
      if (currentPrice <= trailingStopPrice && highestPrice >= buyPrice * 1.05) {
        const sig = `CLIENT_TS_${pos.symbol}_${trailingStopPrice}`;
        const lastSent = ALERT_COOLDOWN_MAP.get(sig) || 0;
        if (now - lastSent > 45 * 60 * 1000) {
          ALERT_COOLDOWN_MAP.set(sig, now);
          playAlertSound();

          const isProfitable = pnlPercent >= 0;
          const notif: MockNotification = {
            id: `p1-ts-${Date.now()}-${pos.symbol}`,
            symbol: pos.symbol,
            triggerType: 'STOP_LOSS_TAKE_PROFIT',
            title: isProfitable
              ? `📉 [DANH MỤC] VI PHẠM TRAILING STOP: #${pos.symbol}`
              : `⚠️ [DANH MỤC] GÃY ĐÀ TĂNG - RƠI DƯỚI GIÁ VỐN: #${pos.symbol}`,
            message: isProfitable
              ? `Thị giá ${currentPrice.toFixed(2)}k lùi từ đỉnh ${highestPrice.toFixed(2)}k chạm Trailing Stop ${trailingStopPrice.toFixed(2)}k. Lợi nhuận còn: ${pnlStr}. Khuyến nghị: Bán chốt lời chủ động bảo toàn lãi!`
              : `Thị giá ${currentPrice.toFixed(2)}k rơi từ đỉnh ${highestPrice.toFixed(2)}k thủng Trailing Stop và rơi về dưới giá vốn (${buyPrice.toFixed(2)}k). Trạng thái: Đang lỗ ${pnlStr}. Đề xuất: Bán hạ tỷ trọng / cắt lỗ sớm bảo toàn vốn!`,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            channel: pos.alertChannel || 'IN_APP',
            severity: isProfitable ? 'WARNING' : 'DANGER',
            read: false,
          };

          dispatchNotification(notif);
          triggeredAlerts.push({
            symbol: pos.symbol,
            type: 'TRAILING_STOP',
            message: notif.message,
            severity: isProfitable ? 'WARNING' : 'DANGER',
          });

          if (onTriggerAction) onTriggerAction('TRAILING_STOP', pos, stock);
        }
      }
    }

    // 3. ĐẠT MỤC TIÊU CHỐT LỜI TP1
    if (currentPrice >= effectiveTarget) {
      const sig = `CLIENT_TP1_${pos.symbol}_${effectiveTarget}`;
      const lastSent = ALERT_COOLDOWN_MAP.get(sig) || 0;
      if (now - lastSent > 60 * 60 * 1000) {
        ALERT_COOLDOWN_MAP.set(sig, now);
        playAlertSound();

        const notif: MockNotification = {
          id: `p1-tp1-${Date.now()}-${pos.symbol}`,
          symbol: pos.symbol,
          triggerType: 'STOP_LOSS_TAKE_PROFIT',
          title: `🎯 [DANH MỤC] ĐẠT MỤC TIÊU CHỐT LỜI TP1: #${pos.symbol}`,
          message: `Thị giá ${currentPrice.toFixed(2)}k đã chạm mốc TP1 ${effectiveTarget.toFixed(2)}k. Lãi: ${pnlStr}. Đề xuất: Chủ động bán chốt lời 50% vị thế!`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          channel: pos.alertChannel || 'IN_APP',
          severity: 'SUCCESS',
          read: false,
        };

        dispatchNotification(notif);
        triggeredAlerts.push({
          symbol: pos.symbol,
          type: 'TAKE_PROFIT',
          message: notif.message,
          severity: 'SUCCESS',
        });

        if (onTriggerAction) onTriggerAction('TAKE_PROFIT', pos, stock);
      }
    }
  }

  return { triggeredAlerts };
}

function dispatchNotification(notif: MockNotification) {
  try {
    const list = getStoredNotifications();
    const updated = [notif, ...list.slice(0, 49)];
    saveNotificationsToStorage(updated);
    window.dispatchEvent(new CustomEvent('new-stock-notification', { detail: notif }));
  } catch (err) {
    console.error('Failed to dispatch portfolio risk notification:', err);
  }
}
