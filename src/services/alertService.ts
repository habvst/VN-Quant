import { StockData } from '../types';
import {
  AlertTriggerType,
  BreakoutCondition,
  MACrossoverCondition,
  MockNotification,
  NotificationChannel,
  PriceCondition,
  RSICondition,
  StockAlert,
  StopLossTakeProfitCondition,
  VolumeCondition,
} from '../types/alert';

const STORAGE_KEY_ALERTS = 'vietstock_terminal_alerts_v1';
const STORAGE_KEY_NOTIFS = 'vietstock_terminal_notifications_v1';

export const INITIAL_ALERTS: StockAlert[] = [
  {
    id: 'alt-1',
    symbol: 'FPT',
    triggerType: 'PRICE_THRESHOLD',
    condition: 'ABOVE_PRICE',
    targetValue: 142.0,
    note: 'Cảnh báo chốt lời FPT vùng đỉnh lịch sử',
    channel: 'IN_APP',
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    triggerCount: 1,
    lastTriggeredAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'alt-2',
    symbol: 'FPT',
    triggerType: 'RSI_LEVEL',
    condition: 'RSI_OVERBOUGHT',
    targetValue: 70,
    note: 'RSI đi vào vùng Quá Mua (>70) - Cảnh báo điều chỉnh',
    channel: 'TELEGRAM',
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    triggerCount: 0,
  },
  {
    id: 'alt-3',
    symbol: 'SSI',
    triggerType: 'MA_CROSSOVER',
    condition: 'PRICE_CROSS_ABOVE_MA20',
    targetValue: 36.8,
    note: 'Tín hiệu Golden Cross ngắn hạn khi giá vượt MA20',
    channel: 'IN_APP',
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    triggerCount: 2,
    lastTriggeredAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'alt-4',
    symbol: 'HPG',
    triggerType: 'RSI_LEVEL',
    condition: 'RSI_OVERSOLD',
    targetValue: 30,
    note: 'Bắt đáy HPG khi RSI < 30',
    channel: 'EMAIL',
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    triggerCount: 0,
  },
];

export const INITIAL_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'notif-1',
    alertId: 'alt-1',
    symbol: 'FPT',
    triggerType: 'PRICE_THRESHOLD',
    title: '🚨 THÔNG BÁO VƯỢT GIÁ MỤC TIÊU',
    message: 'Cổ phiếu FPT vừa vượt mốc 142.00 VNĐ (Giá hiện tại: 142.50 VNĐ). Tín hiệu vượt đỉnh thành công!',
    timestamp: '10:45:12 - Hôm nay',
    channel: 'IN_APP',
    severity: 'SUCCESS',
    read: false,
  },
  {
    id: 'notif-2',
    alertId: 'alt-3',
    symbol: 'SSI',
    triggerType: 'MA_CROSSOVER',
    title: '📈 CẢNH BÁO TÍN HIỆU MA20',
    message: 'SSI vừa bứt phá cắt lên đường MA20 (36.80) với thanh khoản tăng đột biến.',
    timestamp: '09:30:05 - Hôm nay',
    channel: 'TELEGRAM',
    severity: 'INFO',
    read: true,
  },
];

export const getStoredAlerts = (): StockAlert[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERTS);
    if (!raw) return INITIAL_ALERTS;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load alerts from storage:', err);
    return INITIAL_ALERTS;
  }
};

export const saveAlertsToStorage = (alerts: StockAlert[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(alerts));
  } catch (err) {
    console.error('Failed to save alerts to storage:', err);
  }
};

export const getStoredNotifications = (): MockNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
    if (!raw) return INITIAL_NOTIFICATIONS;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load notifications:', err);
    return INITIAL_NOTIFICATIONS;
  }
};

export const saveNotificationsToStorage = (notifications: MockNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifications));
  } catch (err) {
    console.error('Failed to save notifications:', err);
  }
};

export const formatConditionLabel = (
  triggerType: AlertTriggerType,
  condition: PriceCondition | MACrossoverCondition | RSICondition | VolumeCondition | StopLossTakeProfitCondition | BreakoutCondition,
  targetValue: number
): string => {
  if (triggerType === 'PRICE_THRESHOLD') {
    switch (condition) {
      case 'ABOVE_PRICE':
        return `Giá vượt trên ${targetValue.toFixed(2)} VNĐ`;
      case 'BELOW_PRICE':
        return `Giá giảm xuống dưới ${targetValue.toFixed(2)} VNĐ`;
      case 'GAIN_PERCENT':
        return `Giá tăng >= +${targetValue}% trong phiên`;
      case 'DROP_PERCENT':
        return `Giá giảm <= -${targetValue}% trong phiên`;
      default:
        return `Chỉ số giá = ${targetValue}`;
    }
  }

  if (triggerType === 'VOLUME_SURGE') {
    switch (condition) {
      case 'VOL_SURGE_200_MA20':
        return `Đột biến khối lượng > 200% trung bình MA20 phiên`;
      case 'VOL_SURGE_CUSTOM':
        return `Đột biến khối lượng >= ${targetValue}% trung bình MA20`;
      default:
        return 'Đột biến khối lượng giao dịch';
    }
  }

  if (triggerType === 'STOP_LOSS_TAKE_PROFIT') {
    switch (condition) {
      case 'TRIGGER_STOP_LOSS':
        return `Chạm ngưỡng CẮT LỖ (Stop-Loss <= ${targetValue.toFixed(2)} VNĐ)`;
      case 'TRIGGER_TAKE_PROFIT':
        return `Chạm ngưỡng CHỐT LỜI (Take-Profit >= ${targetValue.toFixed(2)} VNĐ)`;
      case 'TRAILING_STOP_ATR':
        return `Vi phạm ngưỡng Trailing Stop theo ATR động`;
      default:
        return 'Ngưỡng Chốt lời / Cắt lỗ';
    }
  }

  if (triggerType === 'BREAKOUT_LEVEL') {
    switch (condition) {
      case 'BREAKOUT_RESISTANCE':
        return `Bứt phá vượt kháng cự (${targetValue.toFixed(2)} VNĐ)`;
      case 'BREAKDOWN_SUPPORT':
        return `Thủng hỗ trợ kỹ thuật (${targetValue.toFixed(2)} VNĐ)`;
      default:
        return 'Bứt phá kỹ thuật';
    }
  }

  if (triggerType === 'MA_CROSSOVER') {
    switch (condition) {
      case 'PRICE_CROSS_ABOVE_MA20':
        return `Giá bứt phá CẮT LÊN MA20 (${targetValue.toFixed(2)})`;
      case 'PRICE_CROSS_BELOW_MA20':
        return `Giá thủng CẮT XUỐNG MA20 (${targetValue.toFixed(2)})`;
      case 'MA20_CROSS_ABOVE_MA50':
        return `Đường MA20 cắt lên MA50 (Golden Cross)`;
      case 'MA20_CROSS_BELOW_MA50':
        return `Đường MA20 cắt xuống MA50 (Death Cross)`;
      default:
        return 'Tín hiệu giao cắt đường trung bình MA';
    }
  }

  if (triggerType === 'RSI_LEVEL') {
    switch (condition) {
      case 'RSI_OVERBOUGHT':
        return `RSI (14) đi vào vùng Quá Mua (>${targetValue})`;
      case 'RSI_OVERSOLD':
        return `RSI (14) đi vào vùng Quá Bán (<${targetValue})`;
      case 'RSI_ABOVE_CUSTOM':
        return `RSI (14) vượt ngưỡng ${targetValue}`;
      case 'RSI_BELOW_CUSTOM':
        return `RSI (14) giảm xuống dưới ${targetValue}`;
      default:
        return `RSI = ${targetValue}`;
    }
  }

  return 'Điều kiện cảnh báo';
};

// Play audio alert sound effect (synthesized sound via Web Audio API)
export const playAlertSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play dual tone beep (high pitch synth notification)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1108.73, ctx.currentTime); // C#6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (err) {
    // Ignore audio autoplay policy restriction silently
  }
};

// Helper function to evaluate alert triggers against current stock data
export const checkAlertTrigger = (
  alert: StockAlert,
  stock: StockData
): { isTriggered: boolean; message: string; severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER' } => {
  const currentPrice = stock.price;
  const rsi = stock.technical.rsi14;
  const ma20 = stock.technical.ma20;
  const ma50 = stock.technical.ma50;

  if (alert.triggerType === 'VOLUME_SURGE') {
    // Check volume surge compared to estimated 20-session average volume
    const estimatedMa20Vol = stock.volume > 0 ? (stock.technical.ma20 ? stock.volume / (stock.price / stock.technical.ma20) : stock.volume * 0.6) : 1000000;
    const volSurgeRatio = stock.volume > 0 && estimatedMa20Vol > 0 ? (stock.volume / estimatedMa20Vol) * 100 : 100;
    const thresholdPct = alert.condition === 'VOL_SURGE_200_MA20' ? 200 : alert.targetValue || 200;

    if (volSurgeRatio >= thresholdPct || (stock.volume > 2000000 && stock.changePercent > 2.5)) {
      return {
        isTriggered: true,
        message: `🔥 ĐỘT BIẾN KHỐI LƯỢNG: ${stock.symbol} khớp ${stock.volume.toLocaleString('vi-VN')} CP (${volSurgeRatio.toFixed(0)}% so với MA20 vol). Dòng tiền cá mập nhập cuộc!`,
        severity: 'SUCCESS',
      };
    }
  }

  if (alert.triggerType === 'STOP_LOSS_TAKE_PROFIT') {
    if (alert.condition === 'TRIGGER_STOP_LOSS' && currentPrice <= alert.targetValue) {
      return {
        isTriggered: true,
        message: `🛑 CẢNH BÁO CẮT LỖ: Giá ${stock.symbol} (${currentPrice.toFixed(2)}) đã CHẠM HOẶC XUYÊN THỦNG NGƯỠNG CẮT LỖ ${alert.targetValue.toFixed(2)} VNĐ. Đề xuất thoát hàng bảo toàn vốn!`,
        severity: 'DANGER',
      };
    }
    if (alert.condition === 'TRIGGER_TAKE_PROFIT' && currentPrice >= alert.targetValue) {
      return {
        isTriggered: true,
        message: `🎯 CẢNH BÁO CHỐT LỜI: Giá ${stock.symbol} (${currentPrice.toFixed(2)}) đã ĐẠT MỤC TIÊU CHỐT LỜI ${alert.targetValue.toFixed(2)} VNĐ. Khuyên thực hiện hóa lợi nhuận!`,
        severity: 'SUCCESS',
      };
    }
    if (alert.condition === 'TRAILING_STOP_ATR') {
      const atrTrailingPrice = currentPrice - (1.8 * (stock.technical.atr14 || currentPrice * 0.025));
      if (currentPrice <= atrTrailingPrice) {
        return {
          isTriggered: true,
          message: `⚠️ VI PHẠM TRAILING STOP ATR: Giá ${stock.symbol} (${currentPrice.toFixed(2)}) thủng mốc bảo vệ ${atrTrailingPrice.toFixed(2)} VNĐ.`,
          severity: 'WARNING',
        };
      }
    }
  }

  if (alert.triggerType === 'BREAKOUT_LEVEL') {
    if (alert.condition === 'BREAKOUT_RESISTANCE' && currentPrice >= (alert.targetValue || stock.technical.resistanceLevel)) {
      return {
        isTriggered: true,
        message: `🚀 BỨT PHÁ KHÁNG CỰ: ${stock.symbol} (${currentPrice.toFixed(2)}) vừa vượt đỉnh kháng cự ${alert.targetValue || stock.technical.resistanceLevel} VNĐ với đà tăng mạnh!`,
        severity: 'SUCCESS',
      };
    }
    if (alert.condition === 'BREAKDOWN_SUPPORT' && currentPrice <= (alert.targetValue || stock.technical.supportLevel)) {
      return {
        isTriggered: true,
        message: `🔻 THỦNG HỖ TRỢ: ${stock.symbol} (${currentPrice.toFixed(2)}) bị bán thủng mốc hỗ trợ ${alert.targetValue || stock.technical.supportLevel} VNĐ. Rủi ro bước vào nhịp giảm sâu.`,
        severity: 'DANGER',
      };
    }
  }

  if (alert.triggerType === 'PRICE_THRESHOLD') {
    if (alert.condition === 'ABOVE_PRICE' && currentPrice >= alert.targetValue) {
      return {
        isTriggered: true,
        message: `Giá ${stock.symbol} hiện tại (${currentPrice.toFixed(2)}) đã ĐẠT HOẶC VƯỢT MỨC CẢNH BÁO ${alert.targetValue.toFixed(2)} VNĐ.`,
        severity: 'SUCCESS',
      };
    }
    if (alert.condition === 'BELOW_PRICE' && currentPrice <= alert.targetValue) {
      return {
        isTriggered: true,
        message: `Giá ${stock.symbol} hiện tại (${currentPrice.toFixed(2)}) đã GIẢM XUỐNG DƯỚI MỨC MỤC TIÊU ${alert.targetValue.toFixed(2)} VNĐ.`,
        severity: 'DANGER',
      };
    }
    if (alert.condition === 'GAIN_PERCENT' && stock.changePercent >= alert.targetValue) {
      return {
        isTriggered: true,
        message: `Giá ${stock.symbol} tăng mạnh +${stock.changePercent.toFixed(2)}% trong phiên (vượt ngưỡng +${alert.targetValue}%).`,
        severity: 'SUCCESS',
      };
    }
    if (alert.condition === 'DROP_PERCENT' && stock.changePercent <= -alert.targetValue) {
      return {
        isTriggered: true,
        message: `Giá ${stock.symbol} giảm -${Math.abs(stock.changePercent).toFixed(2)}% trong phiên (vượt mốc giảm -${alert.targetValue}%).`,
        severity: 'DANGER',
      };
    }
  }

  if (alert.triggerType === 'MA_CROSSOVER') {
    if (alert.condition === 'PRICE_CROSS_ABOVE_MA20' && currentPrice >= ma20) {
      return {
        isTriggered: true,
        message: `Tín hiệu bứt phá: ${stock.symbol} (${currentPrice.toFixed(2)}) vượt lên đường trung bình MA20 (${ma20.toFixed(2)}).`,
        severity: 'INFO',
      };
    }
    if (alert.condition === 'PRICE_CROSS_BELOW_MA20' && currentPrice < ma20) {
      return {
        isTriggered: true,
        message: `Cảnh báo vi phạm kỹ thuật: ${stock.symbol} (${currentPrice.toFixed(2)}) cắt xuống đường MA20 (${ma20.toFixed(2)}).`,
        severity: 'WARNING',
      };
    }
    if (alert.condition === 'MA20_CROSS_ABOVE_MA50' && ma20 >= ma50) {
      return {
        isTriggered: true,
        message: `Tín hiệu Golden Cross: Đường MA20 (${ma20.toFixed(2)}) vừa cắt lên MA50 (${ma50.toFixed(2)}). Xu hướng tăng trung hạn hình thành!`,
        severity: 'SUCCESS',
      };
    }
    if (alert.condition === 'MA20_CROSS_BELOW_MA50' && ma20 < ma50) {
      return {
        isTriggered: true,
        message: `Tín hiệu Death Cross: Đường MA20 (${ma20.toFixed(2)}) cắt xuống MA50 (${ma50.toFixed(2)}). Cảnh báo áp lực bán trung hạn.`,
        severity: 'DANGER',
      };
    }
  }

  if (alert.triggerType === 'RSI_LEVEL') {
    if (alert.condition === 'RSI_OVERBOUGHT' && rsi >= alert.targetValue) {
      return {
        isTriggered: true,
        message: `Cảnh báo Quá Mua: RSI (14) của ${stock.symbol} đạt ${rsi.toFixed(1)} (vượt ngưỡng Quá Mua ${alert.targetValue}). Khả năng cao sắp có nhịp chỉnh.`,
        severity: 'WARNING',
      };
    }
    if (alert.condition === 'RSI_OVERSOLD' && rsi <= alert.targetValue) {
      return {
        isTriggered: true,
        message: `Tín hiệu Quá Bán: RSI (14) của ${stock.symbol} đạt ${rsi.toFixed(1)} (dưới ngưỡng Quá Bán ${alert.targetValue}). Cơ hội bắt đáy sinh lời!`,
        severity: 'SUCCESS',
      };
    }
    if (alert.condition === 'RSI_ABOVE_CUSTOM' && rsi >= alert.targetValue) {
      return {
        isTriggered: true,
        message: `RSI (14) của ${stock.symbol} chạm mức ${rsi.toFixed(1)} (ngưỡng cài đặt: ${alert.targetValue}).`,
        severity: 'INFO',
      };
    }
    if (alert.condition === 'RSI_BELOW_CUSTOM' && rsi <= alert.targetValue) {
      return {
        isTriggered: true,
        message: `RSI (14) của ${stock.symbol} giảm xuống ${rsi.toFixed(1)} (ngưỡng cài đặt: ${alert.targetValue}).`,
        severity: 'INFO',
      };
    }
  }

  return {
    isTriggered: false,
    message: '',
    severity: 'INFO',
  };
};
