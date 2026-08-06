export type AlertTriggerType = 'PRICE_THRESHOLD' | 'MA_CROSSOVER' | 'RSI_LEVEL';

export type PriceCondition = 'ABOVE_PRICE' | 'BELOW_PRICE' | 'GAIN_PERCENT' | 'DROP_PERCENT';
export type MACrossoverCondition = 
  | 'PRICE_CROSS_ABOVE_MA20' 
  | 'PRICE_CROSS_BELOW_MA20' 
  | 'MA20_CROSS_ABOVE_MA50' 
  | 'MA20_CROSS_BELOW_MA50';
export type RSICondition = 'RSI_OVERBOUGHT' | 'RSI_OVERSOLD' | 'RSI_ABOVE_CUSTOM' | 'RSI_BELOW_CUSTOM';

export type NotificationChannel = 'IN_APP' | 'TELEGRAM' | 'EMAIL';

export interface StockAlert {
  id: string;
  symbol: string;
  triggerType: AlertTriggerType;
  condition: PriceCondition | MACrossoverCondition | RSICondition;
  targetValue: number;
  secondValue?: number;
  note?: string;
  channel: NotificationChannel;
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
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
