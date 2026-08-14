export type AlertTriggerType = 
  | 'PRICE_THRESHOLD' 
  | 'MA_CROSSOVER' 
  | 'RSI_LEVEL'
  | 'VOLUME_SURGE'
  | 'STOP_LOSS_TAKE_PROFIT'
  | 'BREAKOUT_LEVEL';

export type PriceCondition = 'ABOVE_PRICE' | 'BELOW_PRICE' | 'GAIN_PERCENT' | 'DROP_PERCENT';
export type MACrossoverCondition = 
  | 'PRICE_CROSS_ABOVE_MA20' 
  | 'PRICE_CROSS_BELOW_MA20' 
  | 'MA20_CROSS_ABOVE_MA50' 
  | 'MA20_CROSS_BELOW_MA50';
export type RSICondition = 'RSI_OVERBOUGHT' | 'RSI_OVERSOLD' | 'RSI_ABOVE_CUSTOM' | 'RSI_BELOW_CUSTOM';
export type VolumeCondition = 'VOL_SURGE_200_MA20' | 'VOL_SURGE_CUSTOM';
export type StopLossTakeProfitCondition = 'TRIGGER_STOP_LOSS' | 'TRIGGER_TAKE_PROFIT' | 'TRAILING_STOP_ATR';
export type BreakoutCondition = 'BREAKOUT_RESISTANCE' | 'BREAKDOWN_SUPPORT';

export type NotificationChannel = 'IN_APP' | 'TELEGRAM' | 'EMAIL';

export interface StockAlert {
  id: string;
  symbol: string;
  triggerType: AlertTriggerType;
  condition: PriceCondition | MACrossoverCondition | RSICondition | VolumeCondition | StopLossTakeProfitCondition | BreakoutCondition;
  targetValue: number;
  secondValue?: number;
  note?: string;
  channel: NotificationChannel;
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
  lastSentSignature?: string;
  triggerCount: number;
}

export interface TelegramFilterSettings {
  filterVolumeSurgeOnly: boolean; // Chỉ gửi khi khối lượng > 200% MA20
  filterStopLossTakeProfitOnly: boolean; // Chỉ gửi khi chạm Stop-loss / Take-profit
  filterBreakoutOnly: boolean; // Chỉ gửi khi có Breakout kháng cự / hỗ trợ
  minPriceChangePercent: number; // Chỉ gửi khi biến động >= %
}

export interface MockNotification {
  id: string;
  alertId?: string;
  symbol: string;
  triggerType: AlertTriggerType;
  title: string;
  message: string;
  timestamp: string;
  channel: NotificationChannel;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  read: boolean;
}
