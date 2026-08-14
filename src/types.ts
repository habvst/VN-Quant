export type MarketType = 'HOSE' | 'HNX' | 'UPCOM';

export interface Candle {
  time: string; // YYYY-MM-DD or Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  ma20: number;
  ma50: number;
  ma100: number;
  ma200: number;
  ema20: number;
  vwap: number;
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    chikou: number;
  };
  adx14: number;
  atr14: number;
  stochastic: {
    k: number;
    d: number;
  };
  mfi14: number;
  obv: number;
  supportLevel: number;
  resistanceLevel: number;
  pivotPoints: {
    pivot: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  };
  fibonacci: {
    f236: number;
    f382: number;
    f500: number;
    f618: number;
    f786: number;
  };
  patterns: CandlestickPattern[];
}

export interface CandlestickPattern {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 0 - 100
  description: string;
}

export interface FundamentalData {
  pe: number;
  pb: number;
  eps: number;
  roe: number; // %
  roa: number; // %
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  grossMargin: number; // %
  operatingMargin: number; // %
  netMargin: number; // %
  bookValue: number;
  dividendYield: number; // %
  evEbitda: number;
  peg: number;
  revenueGrowthYoY: number; // %
  profitGrowthYoY: number; // %
  fcf: number; // Tỷ VNĐ
  marketCap: number; // Tỷ VNĐ
  sharesOutstanding: number; // Triệu cổ phiếu
  industryAvgPE: number;
  industryAvgPB: number;
  industryAvgROE: number;
}

export interface FinancialStatement {
  quarter: string; // e.g., 'Q1/2026', 'Q4/2025'
  revenue: number; // Tỷ VNĐ
  operatingProfit: number;
  netProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
}

export interface StockData {
  symbol: string;
  name: string;
  exchange: MarketType;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  referencePrice: number; // Giá tham chiếu
  ceilingPrice: number; // Giá trần
  floorPrice: number; // Giá sàn
  volume: number;
  value: number; // Giá trị giao dịch (Tỷ VNĐ)
  foreignBuyVol: number;
  foreignSellVol: number;
  foreignNetVal: number; // Tỷ VNĐ
  technical: TechnicalIndicators;
  fundamental: FundamentalData;
  financialStatements: FinancialStatement[];
  aiScore: number; // 0 - 100
  aiVerdict: 'MUA MẠNH' | 'MUA' | 'THEO DÕI' | 'BÁN' | 'BÁN MẠNH';
  aiConfidence: number; // %
  aiTargetPrice: number;
  aiStopLoss: number;
  aiReasoning: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  totalVolume: number;
  totalValue: number; // Tỷ VNĐ
  advances: number;
  declines: number;
  noChanges: number;
  history: { time: string; value: number }[];
}

export interface SectorData {
  name: string;
  changePercent: number;
  totalValue: number; // Tỷ VNĐ
  topGainer: string;
  stockCount: number;
  foreignNetVal: number;
}

export interface OrderBookLevel {
  price: number;
  volume: number;
}

export interface OrderBook {
  symbol: string;
  bid: OrderBookLevel[];
  ask: OrderBookLevel[];
  lastPrice: number;
  lastVolume: number;
  totalBuyVol: number;
  totalSellVol: number;
}

export interface TradeTick {
  id: string;
  time: string;
  price: number;
  volume: number;
  type: 'BUY' | 'SELL' | 'NEUTRAL';
}

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
  targetPrice?: number;
  stopLoss?: number;
  note?: string;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  buyDate: string;
  buyPrice: number;
  quantity: number;
  availableQuantity?: number; // Số lượng CP khả dụng để bán (Đã qua T+2.5)
  pendingQuantity?: number; // Số lượng CP chờ về T+2.5
  settlementStatus?: 'PENDING_T1' | 'PENDING_T2' | 'SETTLED'; // Trạng thái thanh toán T+2.5
  expectedSettlementDate?: string; // Ngày giờ dự kiến cổ phiếu khả dụng
  feePercent: number; // %
  taxPercent: number; // %
  note?: string;
}

export interface PortfolioSummary {
  totalCapital: number;
  currentValue: number;
  cashBalance?: number; // Tiền mặt khả dụng
  pendingCashSettlement?: number; // Tiền chờ về T+2.5 từ lệnh bán
  totalPnL: number;
  totalPnLPercent: number;
  realizedPnL: number;
  unrealizedPnL: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  nav: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
  riskScore: number; // 0 - 100
  diversificationScore: number; // 0 - 100
  positions: (PortfolioPosition & {
    currentPrice: number;
    currentValue: number;
    costBasis: number;
    pnl: number;
    pnlPercent: number;
    weight: number; // %
    riskContribution: number;
    aiRecommendation: 'GIỮ' | 'MUA THÊM' | 'CHỐT LỜI' | 'CẮT LỖ';
    kellyOptimalWeight: number; // %
    kellyOptimalVnd: number; // VNĐ khuyên dùng
    kellyOptimalShares: number; // Cổ phiếu khuyên dùng
    atr: number; // Giá trị ATR biến động (VNĐ)
    atrStopLossPrice: number; // Giá cắt lỗ ATR động (1.8 * ATR)
  })[];
}

export interface AIRecommendation {
  id: string;
  symbol: string;
  name: string;
  exchange: MarketType;
  sector: string;
  category: 
    | 'TOP_MUA_MẠNH' 
    | 'TOP_MUA' 
    | 'TOP_THEO_DÕI' 
    | 'TOP_BÁN' 
    | 'TOP_RỦI_RO' 
    | 'BREAKOUT' 
    | 'TÍCH_LŨY' 
    | 'GOLDEN_CROSS' 
    | 'RSI_QUÁ_BÁN' 
    | 'DÒNG_TIỀN_MẠNH' 
    | 'KHỐI_NGOẠI_MUA';
  price: number;
  changePercent: number;
  score: number;
  confidence: number;
  targetPrice: number;
  stopLoss: number;
  potentialProfitPercent: number;
  riskPercent: number;
  timeframe: string;
  reasons: string[];
  risks: string[];
  updatedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  time: string;
  timestamp?: string;
  summary: string;
  symbols: string[];
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'TÍCH CỰC' | 'TIÊU CỰC' | 'TRUNG TÍNH';
  impactScore: number; // 1 - 5
  sentimentScore?: number; // -100 to +100
  priceImpactForecast?: string; // e.g. "+2.5% ~ +4.0%" or "-1.5% ~ -3.0%"
  impactDuration?: string; // e.g. "1-3 phiên"
  impactDegree?: 'MẠNH' | 'TRUNG BÌNH' | 'NHẸ';
  aiReasoning?: string;
}

export interface StockNewsSentiment {
  symbol: string;
  score: number; // -100 to +100
  label: 'TÍCH CỰC' | 'TIÊU CỰC' | 'TRUNG TÍNH';
  confidence: number; // 0 to 100
  headlineCount: number;
  summary: string;
  keyHighlights: string[];
  recentHeadlines?: { title: string; url: string; time: string; source: string; sentiment: string }[];
  updatedAt?: string;
}

export interface RealtimeAlert {
  id: string;
  timestamp: string;
  symbol: string;
  type: 
    | 'BREAKOUT' 
    | 'GOLDEN_CROSS' 
    | 'RSI_OVERBOUGHT' 
    | 'RSI_OVERSOLD' 
    | 'VOLUME_SURGE' 
    | 'GAP' 
    | 'PRICE_CROSS_MA' 
    | 'FOREIGN_BUY_SURGE';
  message: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
}

export interface MacroData {
  usdVnd: number;
  usdVndChange: number;
  dxy: number;
  dxyChange: number;
  sbvInterestRate: number; // %
  fedRate: number; // %
  goldPriceVnd: number; // Triệu/lượng
  goldPriceChange: number;
  brentOilPrice: number; // USD/thùng
  brentOilChange: number;
  inflation: number; // %
  gdpGrowth: number; // %
}

export interface AIChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: string;
  dataCard?: {
    symbol?: string;
    score?: number;
    verdict?: string;
    targetPrice?: number;
    stopLoss?: number;
    recommendations?: Partial<AIRecommendation>[];
  };
}
