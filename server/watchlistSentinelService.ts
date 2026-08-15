import { StockData } from '../src/types';
import {
  getTelegramConfigStore,
  getWatchlistSentinelConfigStore,
  getWatchlistSignaturesStore,
  setWatchlistSignatureStore,
  getWatchlistStore,
  getPortfolioPositionsStore,
  PortfolioPositionStoreItem,
  addTriggerHistoryItem,
  isSignalInCooldown,
  recordSignalSent,
  clearSignalCooldown,
  WatchlistSentinelConfig,
} from './dataStore';
import { getAllStocks, getOrFetchStockBySymbol } from './marketDataService';
import { sendTelegramMessage, escapeTelegramHtml } from './telegramAlertService';

export interface WatchlistTriggerSignal {
  symbol: string;
  type: 'RSI_CROSSOVER' | 'MA_CROSSOVER' | 'MACD_CROSSOVER' | 'VOLUME_SURGE' | 'BREAKOUT' | 'EXTREME_RSI' | 'PORTFOLIO_STOP_LOSS' | 'PORTFOLIO_TAKE_PROFIT' | 'PORTFOLIO_PANIC_DROP' | 'MARKET_OPPORTUNITY';
  headerBadge: string;
  tier: 'P1' | 'P2' | 'P3' | 'P4';
  indicatorName: string;
  description: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  recommendation: string;
  signature: string;
  cooldownMinutes?: number;
}

export interface WatchlistScanResultItem {
  symbol: string;
  tier: 'P1' | 'P2' | 'P3' | 'P4';
  price: number;
  changePercent: number;
  signals: WatchlistTriggerSignal[];
  telegramSent: boolean;
}

export interface MultiTierSentinelReport {
  timestamp: string;
  tier1PortfolioChecked: number;
  tier2CustomAlertsChecked: number;
  tier3WatchlistChecked: number;
  tier4OpportunitiesChecked: number;
  activeSignalsFound: number;
  telegramMessagesSent: number;
  results: WatchlistScanResultItem[];
}

/**
 * ============================================================================
 * TIER P1: EVALUATE PORTFOLIO HOLDINGS (KHẨN CẤP - BẢO TOÀN VỐN)
 * ============================================================================
 */
export function evaluatePortfolioHoldingSignals(
  position: PortfolioPositionStoreItem,
  stock: StockData
): WatchlistTriggerSignal[] {
  const signals: WatchlistTriggerSignal[] = [];
  const price = stock.price;
  const buyPrice = position.buyPrice || price;
  const pnlPercent = ((price - buyPrice) / buyPrice) * 100;
  const pnlAmount = (price - buyPrice) * (position.quantity || 100) * 1000;
  const pnlStr = `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${pnlAmount >= 0 ? '+' : ''}${(pnlAmount / 1000000).toFixed(2)} tr)`;

  // 1. Vi phạm ngưỡng Cắt Lỗ (Stop-Loss Breach)
  const stopLossThreshold = position.stopLossPrice || buyPrice * 0.93; // Mặc định cắt lỗ -7% nếu chưa đặt
  if (price <= stopLossThreshold) {
    signals.push({
      symbol: stock.symbol,
      tier: 'P1',
      type: 'PORTFOLIO_STOP_LOSS',
      headerBadge: '🚨 <b>[P1 - DANH MỤC ĐANG SỞ HỮU] CẢNH BÁO VI PHẠM CẮT LỖ KHẨN CẤP!</b>',
      indicatorName: `Chạm ngưỡng Cắt Lỗ: Thị giá ${price.toFixed(2)}k ≤ Ngưỡng SL ${stopLossThreshold.toFixed(2)}k (Lỗ: ${pnlPercent.toFixed(2)}%)`,
      description: `Cổ phiếu #${stock.symbol} trong danh mục sở hữu đã vi phạm ngưỡng cắt lỗ bảo toàn vốn. Mức lỗ hiện tại: ${pnlStr}. Khối lượng nắm giữ: ${(position.quantity || 100).toLocaleString('vi-VN')} CP.`,
      severity: 'DANGER',
      recommendation: `KÍCH HOẠT LỆNH BÁN CẮT LỖ NGAY để bảo vệ tổng NAV. Tuyệt đối không gồng lỗ hoặc bắt đáy trung bình giá xuống!`,
      signature: `P1_STOPLOSS_${stock.symbol}_${stopLossThreshold.toFixed(2)}`,
      cooldownMinutes: 60, // Nhắc lại sau 60 phút nếu chưa xử lý
    });
  }

  // 2. Chạm mục tiêu Chốt Lời (Take-Profit Target)
  const targetThreshold = position.targetPrice || buyPrice * 1.15; // Mặc định chốt lời +15% nếu chưa đặt
  if (price >= targetThreshold) {
    signals.push({
      symbol: stock.symbol,
      tier: 'P1',
      type: 'PORTFOLIO_TAKE_PROFIT',
      headerBadge: '🎯 <b>[P1 - DANH MỤC ĐANG SỞ HỮU] CHẠM MỤC TIÊU CHỐT LỜI KỲ VỌNG</b>',
      indicatorName: `Đạt mục tiêu TP: Thị giá ${price.toFixed(2)}k ≥ Ngưỡng TP ${targetThreshold.toFixed(2)}k (Lãi: ${pnlPercent.toFixed(2)}%)`,
      description: `Cổ phiếu #${stock.symbol} đã đạt mục tiêu lợi nhuận kỳ vọng. Lãi tạm tính: ${pnlStr}. Khối lượng nắm giữ: ${(position.quantity || 100).toLocaleString('vi-VN')} CP.`,
      severity: 'SUCCESS',
      recommendation: `Hiện thực hóa lợi nhuận: Chủ động bán chốt lời 50% - 70% vị thế, nâng Trailing Stop phần còn lại để tối đa hóa hiệu suất!`,
      signature: `P1_TAKEPROFIT_${stock.symbol}_${targetThreshold.toFixed(2)}`,
      cooldownMinutes: 120,
    });
  }

  // 3. Biến động giảm sốc bất thường trong phiên (Panic Drop / Flash Dump)
  if (stock.changePercent <= -3.5) {
    signals.push({
      symbol: stock.symbol,
      tier: 'P1',
      type: 'PORTFOLIO_PANIC_DROP',
      headerBadge: '⚡ <b>[P1 - DANH MỤC ĐANG SỞ HỮU] BIẾN ĐỘNG GIẢM MẠNH BẤT THƯỜNG TRONG PHIÊN</b>',
      indicatorName: `Giá giảm ${stock.changePercent.toFixed(2)}% trong phiên (Thị giá: ${price.toFixed(2)}k)`,
      description: `Cổ phiếu đang chịu áp lực bán tháo mạnh với thanh khoản cao. Trạng thái vị thế: ${pnlStr}.`,
      severity: 'WARNING',
      recommendation: `Kiểm tra ngay khối lượng khớp lệnh và tin tức đột xuất. Sẵn sàng hạ tỷ trọng nếu xuất hiện lệnh xả lớn từ khối ngoại/tự doanh.`,
      signature: `P1_PANIC_DROP_${stock.symbol}_${Math.floor(Math.abs(stock.changePercent))}`,
      cooldownMinutes: 60,
    });
  }

  return signals;
}

/**
 * ============================================================================
 * TIER P3: EVALUATE WATCHLIST STOCKS (QUAN TÂM - SENTINEL INDICATORS)
 * ============================================================================
 */
export function evaluateWatchlistStockSignals(
  stock: StockData,
  config: WatchlistSentinelConfig = getWatchlistSentinelConfigStore()
): WatchlistTriggerSignal[] {
  const signals: WatchlistTriggerSignal[] = [];
  const tech = stock.technical;
  const price = stock.price;
  const rsi = tech.rsi14;
  const ma20 = tech.ma20;
  const ma50 = tech.ma50;
  const macd = tech.macd;

  // 1. RSI Crossover & Threshold Evaluation
  if (config.monitorRsi) {
    const oversoldBound = config.rsiOversoldThreshold || 30;
    const overboughtBound = config.rsiOverboughtThreshold || 70;

    // RSI Bullish Reversal (Cắt lên 30)
    if (rsi > oversoldBound && rsi <= oversoldBound + 4 && stock.changePercent > 0) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'RSI_CROSSOVER',
        headerBadge: '✨ <b>[P3 - DANH MỤC QUAN TÂM] RSI ĐẢO CHIỀU TẠO ĐÁY (BULLISH REVERSAL)</b>',
        indicatorName: `RSI(14) = ${rsi.toFixed(1)} (Bứt phá cắt lên mốc Quá Bán ${oversoldBound})`,
        description: `RSI(14) vừa tạo đáy và cắt lên trên mốc ${oversoldBound} kèm xung lực hồi phục (+${stock.changePercent.toFixed(2)}%). Đây là tín hiệu đảo chiều tạo đáy chuẩn theo trường phái Phân tích Kỹ thuật Quant.`,
        severity: 'SUCCESS',
        recommendation: `Xác nhận tạo đáy ngắn hạn. Mở vị thế mua gom thăm dò 30-40% NAV quanh vùng hỗ trợ, dừng lỗ nếu gãy đáy cũ.`,
        signature: `P3_RSI_CROSS_ABOVE_${oversoldBound}_${stock.symbol}`,
        cooldownMinutes: 240, // 4 hours cooldown
      });
    } else if (rsi <= oversoldBound) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'EXTREME_RSI',
        headerBadge: '🔵 <b>[P3 - DANH MỤC QUAN TÂM] RSI VÀO VÙNG QUÁ BÁN CỰC ĐẠI</b>',
        indicatorName: `RSI(14) = ${rsi.toFixed(1)} (Dưới ngưỡng Quá Bán ${oversoldBound})`,
        description: `RSI chạm mức ${rsi.toFixed(1)} nằm sâu trong vùng Quá Bán. Lực bán cạn kiệt, xác suất cao hình thành đáy ngắn hạn và xuất hiện nhịp hồi kỹ thuật.`,
        severity: 'SUCCESS',
        recommendation: `Đưa vào danh sách theo dõi chặt chẽ, chờ tín hiệu nến đảo chiều để giải ngân đón sóng hồi.`,
        signature: `P3_RSI_OVERSOLD_${stock.symbol}`,
        cooldownMinutes: 240,
      });
    }

    // RSI Overbought Bearish Reversal (Cắt xuống 70)
    if (rsi < overboughtBound && rsi >= overboughtBound - 3 && stock.changePercent < 0) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'RSI_CROSSOVER',
        headerBadge: '⚠️ <b>[P3 - DANH MỤC QUAN TÂM] RSI CẮT XUỐNG VÙNG QUÁ MUA (BEARISH REVERSAL)</b>',
        indicatorName: `RSI(14) = ${rsi.toFixed(1)} (Hạ nhiệt cắt xuống mốc ${overboughtBound})`,
        description: `RSI(14) vừa hạ nhiệt cắt xuống dưới mốc Quá Mua ${overboughtBound} kèm đà giảm điểm (-${Math.abs(stock.changePercent).toFixed(2)}%). Áp lực chốt lời gia tăng.`,
        severity: 'WARNING',
        recommendation: `Tạm thời không mua đuổi giá cao. Kiên nhẫn chờ giá tích lũy lại tại vùng hỗ trợ MA20.`,
        signature: `P3_RSI_CROSS_BELOW_${overboughtBound}_${stock.symbol}`,
        cooldownMinutes: 240,
      });
    }
  }

  // 2. Moving Average Crossover Evaluation
  if (config.monitorMa) {
    // Golden Cross: MA20 crosses above MA50
    if (ma20 >= ma50 && (ma20 - ma50) / ma50 <= 0.015) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'MA_CROSSOVER',
        headerBadge: '🌟 <b>[P3 - DANH MỤC QUAN TÂM] GIAO CẮT VÀNG GOLDEN CROSS (MA20/MA50)</b>',
        indicatorName: `MA20 (${ma20.toFixed(2)}k) cắt lên MA50 (${ma50.toFixed(2)}k)`,
        description: `Tín hiệu Golden Cross trung hạn đã chính thức hình thành! Xu hướng tăng trưởng trung và dài hạn được xác nhận và củng cố vững chắc.`,
        severity: 'SUCCESS',
        recommendation: `Mở vị thế mua gom theo xu hướng trung hạn, gia tăng tỷ trọng tại các nhịp võng kiểm định lại đường MA20.`,
        signature: `P3_GOLDEN_CROSS_${stock.symbol}`,
        cooldownMinutes: 360, // 6 hours
      });
    }

    // Price crosses above MA20
    if (price >= ma20 && (price - ma20) / ma20 <= 0.02 && stock.changePercent > 0.5) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'MA_CROSSOVER',
        headerBadge: '🚀 <b>[P3 - DANH MỤC QUAN TÂM] GIÁ BỨT PHÁ VƯỢT MA20</b>',
        indicatorName: `Thị giá (${price.toFixed(2)}k) cắt lên MA20 (${ma20.toFixed(2)}k)`,
        description: `Giá cổ phiếu đã bứt phá thành công lên trên đường trung bình động MA20 (${ma20.toFixed(2)}k). Xu hướng ngắn hạn chuyển biến tích cực.`,
        severity: 'SUCCESS',
        recommendation: `Đường MA20 đóng vai trò hỗ trợ động mới. Có thể giải ngân thăm dò đón đầu nhịp tăng tiếp diễn.`,
        signature: `P3_PRICE_CROSS_ABOVE_MA20_${stock.symbol}`,
        cooldownMinutes: 240,
      });
    }

    // Price breaks down below MA20
    if (price < ma20 && (ma20 - price) / ma20 <= 0.025 && stock.changePercent < -0.8) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'MA_CROSSOVER',
        headerBadge: '🛑 <b>[P3 - DANH MỤC QUAN TÂM] GIÁ VI PHẠM THỦNG MA20</b>',
        indicatorName: `Thị giá (${price.toFixed(2)}k) thủng MA20 (${ma20.toFixed(2)}k)`,
        description: `Giá cổ phiếu bị bán thủng đường trung bình MA20 (${ma20.toFixed(2)}k). Xu hướng ngắn hạn bị suy yếu.`,
        severity: 'DANGER',
        recommendation: `Tạm dừng các vị thế mua mới, theo dõi phản ứng giá tại hỗ trợ MA50 (${ma50.toFixed(2)}k).`,
        signature: `P3_PRICE_CROSS_BELOW_MA20_${stock.symbol}`,
        cooldownMinutes: 240,
      });
    }
  }

  // 3. MACD Crossover Evaluation
  if (config.monitorMacd && macd) {
    if (macd.histogram > 0 && macd.histogram <= 0.35 && stock.changePercent > 0) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'MACD_CROSSOVER',
        headerBadge: '💹 <b>[P3 - DANH MỤC QUAN TÂM] MACD BULLISH CROSSOVER</b>',
        indicatorName: `MACD Histogram = +${macd.histogram.toFixed(2)} (Cắt lên mức 0)`,
        description: `Đường MACD vừa cắt lên trên đường Signal (Histogram đảo sang sắc xanh dương). Động lượng giá đang bứt phá mạnh mẽ.`,
        severity: 'SUCCESS',
        recommendation: `Xác nhận gia tăng xung lực tăng giá. Điểm mua kỹ thuật chuẩn theo phân tích động lượng.`,
        signature: `P3_MACD_BULLISH_${stock.symbol}`,
        cooldownMinutes: 240,
      });
    }
  }

  // 4. Volume Surge & Smart Money Whale
  if (config.monitorVolumeSurge) {
    const estimatedMa20Vol = stock.volume > 0 ? (tech.ma20 ? stock.volume / (price / tech.ma20) : stock.volume * 0.6) : 1000000;
    const volRatio = stock.volume > 0 && estimatedMa20Vol > 0 ? (stock.volume / estimatedMa20Vol) * 100 : 100;

    if (volRatio >= 180 || (stock.volume > 3000000 && stock.changePercent > 2.0)) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'VOLUME_SURGE',
        headerBadge: '🔥 <b>[P3 - DANH MỤC QUAN TÂM] ĐỘT BIẾN KHỐI LƯỢNG & DÒNG TIỀN CÁ MẬP GOM HÀNG</b>',
        indicatorName: `Khối lượng: ${stock.volume.toLocaleString('vi-VN')} CP (${volRatio.toFixed(0)}% so với TB20)`,
        description: `Thanh khoản bùng nổ vượt trội so với trung bình 20 phiên kèm đà tăng giá mạnh mẽ (+${stock.changePercent.toFixed(2)}%). Dòng tiền lớn của tổ chức đang quyết liệt gom hàng!`,
        severity: 'SUCCESS',
        recommendation: `Gia tăng tỷ trọng theo dòng tiền Big Boys, đặt điểm dừng lỗ bám sát giá đáy của phiên bùng nổ.`,
        signature: `P3_VOL_SURGE_${stock.symbol}_${Math.floor(volRatio / 20) * 20}`,
        cooldownMinutes: 240,
      });
    }
  }

  // 5. Breakout / Breakdown Level
  if (config.monitorBreakout) {
    if (price >= tech.resistanceLevel && tech.resistanceLevel > 0) {
      signals.push({
        symbol: stock.symbol,
        tier: 'P3',
        type: 'BREAKOUT',
        headerBadge: '⚡ <b>[P3 - DANH MỤC QUAN TÂM] BỨT PHÁ VƯỢT ĐỈNH KHÁNG CỰ (BREAKOUT)</b>',
        indicatorName: `Vượt Kháng cự ${tech.resistanceLevel.toFixed(2)}k (Thị giá: ${price.toFixed(2)}k)`,
        description: `Giá cổ phiếu đã chính thức bứt phá qua mốc kháng cự then chốt ${tech.resistanceLevel.toFixed(2)}k. Mở ra dư địa tăng giá hướng tới các mốc mục tiêu cao hơn.`,
        severity: 'SUCCESS',
        recommendation: `Mua gia tăng theo trường phái Breakout, kỳ vọng đạt mục tiêu TP1 (+12-15%).`,
        signature: `P3_BREAKOUT_RES_${stock.symbol}_${tech.resistanceLevel}`,
        cooldownMinutes: 240,
      });
    }
  }

  return signals;
}

/**
 * ============================================================================
 * TIER P4: EVALUATE MARKET OPPORTUNITY SIGNALS (CƠ HỘI TOÀN THỊ TRƯỜNG)
 * ============================================================================
 */
export function evaluateMarketOpportunitySignals(stock: StockData): WatchlistTriggerSignal[] {
  const signals: WatchlistTriggerSignal[] = [];
  const score = stock.aiScore || 0;
  const isAccumulating =
    stock.smartMoney &&
    ['ACCUMULATION_CLANDESTINE', 'MORNING_VOLUME_BURST', 'SMART_MONEY_DIVERGENCE'].includes(
      stock.smartMoney.patternType
    );

  if (score >= 85 && isAccumulating && stock.changePercent > 1.5) {
    signals.push({
      symbol: stock.symbol,
      tier: 'P4',
      type: 'MARKET_OPPORTUNITY',
      headerBadge: '💡 <b>[P4 - CƠ HỘI THỊ TRƯỜNG] AI SMART MONEY TOP PICK</b>',
      indicatorName: `Quant Composite Score: ${score}/100 | Smart Money: ${stock.smartMoney?.patternName || 'Gom hàng'}`,
      description: `Mã CP #${stock.symbol} đạt điểm số định lượng xuất sắc ${score}/100 kèm tín hiệu gom hàng từ các dòng tiền tạo lập lớn. Tiềm năng tăng trưởng vượt trội thị trường chung.`,
      severity: 'SUCCESS',
      recommendation: `Cân nhắc thêm #${stock.symbol} vào Danh mục Theo dõi Watchlist hoặc giải ngân phân bổ 10-15% NAV.`,
      signature: `P4_AI_OPPORTUNITY_${stock.symbol}_${Math.floor(score / 5) * 5}`,
      cooldownMinutes: 360,
    });
  }

  return signals;
}

/**
 * ============================================================================
 * FORMATTERS FOR TELEGRAM HTML MESSAGES (TIER-AWARE)
 * ============================================================================
 */

export function formatPortfolioTelegramAlert(
  position: PortfolioPositionStoreItem,
  stock: StockData,
  signal: WatchlistTriggerSignal
): string {
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const changeSign = stock.change >= 0 ? '+' : '';
  const tvExchange = ['HNX', 'UPCOM'].includes((stock.exchange || '').toUpperCase()) ? stock.exchange.toUpperCase() : 'HOSE';
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${stock.symbol}`;

  const buyPrice = position.buyPrice || stock.price;
  const pnlPercent = ((stock.price - buyPrice) / buyPrice) * 100;
  const pnlAmount = (stock.price - buyPrice) * (position.quantity || 100) * 1000;
  const pnlSign = pnlPercent >= 0 ? '+' : '';

  const safeStockName = escapeTelegramHtml(stock.name);
  const safeSector = escapeTelegramHtml(stock.sector);
  const safeIndicator = escapeTelegramHtml(signal.indicatorName);
  const safeDescription = escapeTelegramHtml(signal.description);
  const safeRec = escapeTelegramHtml(signal.recommendation);

  return `${signal.headerBadge}
━━━━━━━━━━━━━━━━━━━━━
💼 <b>DANH MỤC ĐANG NẮM GIỮ: #${stock.symbol}</b> (${safeStockName})
🏢 <b>Sàn:</b> ${stock.exchange} | <b>Ngành:</b> ${safeSector}
📦 <b>Khối lượng sở hữu:</b> <b>${(position.quantity || 100).toLocaleString('vi-VN')} CP</b>
💰 <b>Giá vốn trung bình:</b> <code>${buyPrice.toFixed(2)}k VNĐ</code>
💲 <b>Thị giá hiện tại:</b> <b>${stock.price.toFixed(2)}k VNĐ</b> (${changeSign}${stock.changePercent.toFixed(2)}%)
📊 <b>Hiệu suất vị thế:</b> <b>${pnlSign}${pnlPercent.toFixed(2)}%</b> (${pnlSign}${(pnlAmount / 1000000).toFixed(2)} triệu VNĐ)

⚡ <b>TÌNH TRẠNG KÍCH HOẠT:</b>
• <b>Sự kiện:</b> <code>${safeIndicator}</code>
• <b>Mô tả:</b> ${safeDescription}

🎯 <b>HÀNH ĐỘNG KHẨN CẤP ĐỀ XUẤT:</b>
👉 <b>${safeRec}</b>

⏰ <b>Thời gian quét:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━━
🔗 <a href="${tvUrl}">Mở biểu đồ TradingView của #${stock.symbol} ↗</a>`;
}

export function formatWatchlistTelegramAlert(stock: StockData, signal: WatchlistTriggerSignal): string {
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const changeSign = stock.change >= 0 ? '+' : '';
  const tvExchange = ['HNX', 'UPCOM'].includes((stock.exchange || '').toUpperCase()) ? stock.exchange.toUpperCase() : 'HOSE';
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${stock.symbol}`;

  // Trade Plan parameters
  const buyZoneLow = (stock.price * 0.985).toFixed(2);
  const buyZoneHigh = (stock.price * 1.005).toFixed(2);
  const tp1 = stock.aiTargetPrice || Number((stock.price * 1.12).toFixed(2));
  const tp2 = Number((tp1 * 1.08).toFixed(2));
  const sl = stock.aiStopLoss || Number((stock.price * 0.94).toFixed(2));
  const tp1Upside = (((tp1 - stock.price) / stock.price) * 100).toFixed(1);
  const slDownside = (((stock.price - sl) / stock.price) * 100).toFixed(1);
  const rr = (Number(tp1Upside) / (Number(slDownside) || 1)).toFixed(1);

  const foreignStr = stock.foreignNetVal > 0 ? `+${stock.foreignNetVal} tỷ` : `${stock.foreignNetVal} tỷ`;
  const safeStockName = escapeTelegramHtml(stock.name);
  const safeSector = escapeTelegramHtml(stock.sector);
  const safeSmartMoney = escapeTelegramHtml(stock.smartMoney?.patternName || 'Tích lũy');
  const safeIndicator = escapeTelegramHtml(signal.indicatorName);
  const safeDescription = escapeTelegramHtml(signal.description);
  const safeRec = escapeTelegramHtml(signal.recommendation);

  return `${signal.headerBadge}
━━━━━━━━━━━━━━━━━━━━━
📌 <b>MÃ CP QUAN TÂM: #${stock.symbol}</b> (${safeStockName})
🏢 <b>Sàn:</b> ${stock.exchange} | <b>Ngành:</b> ${safeSector}
⚡ <b>TÍN HIỆU ĐỊNH LƯỢNG:</b> <code>${safeIndicator}</code>
📣 <b>Chi tiết:</b> ${safeDescription}

💲 <b>Thị giá:</b> <b>${stock.price.toFixed(2)}k VNĐ</b> (${changeSign}${stock.changePercent.toFixed(2)}%)
📊 <b>Thanh khoản:</b> ${stock.volume.toLocaleString('vi-VN')} CP (GT: ${stock.value} tỷ)
🐋 <b>Khối ngoại:</b> ${foreignStr} | <b>Smart Money:</b> ${safeSmartMoney}

📈 <b>BỘ CHỈ BÁO KỸ THUẬT:</b>
• RSI(14): <b>${stock.technical.rsi14.toFixed(1)}</b> | MACD: <b>${stock.technical.macd.histogram > 0 ? '+' : ''}${stock.technical.macd.histogram.toFixed(2)}</b>
• MA20: <b>${stock.technical.ma20.toFixed(2)}k</b> | MA50: <b>${stock.technical.ma50.toFixed(2)}k</b>
• Hỗ trợ then chốt: <b>${stock.technical.supportLevel}k</b> | Kháng cự: <b>${stock.technical.resistanceLevel}k</b>

🎯 <b>KẾ HOẠCH GIAO DỊCH 4 TẦNG (ACTION PLAN):</b>
• 🎯 <b>Vùng Mua Gom:</b> <code>${buyZoneLow} - ${buyZoneHigh}k</code> (Thăm dò 50%)
• 📈 <b>Mục tiêu TP1:</b> <code>${tp1}k</code> (+${tp1Upside}%) | <b>TP2:</b> <code>${tp2}k</code>
• 🛑 <b>Cắt lỗ SL:</b> <code>${sl}k</code> (-${slDownside}%) [Gãy MA20/Hỗ trợ]
• ⚖️ <b>Tỷ lệ R:R:</b> <code>1 : ${rr}</code> | <b>Phân bổ:</b> <code>15 - 20% NAV</code>

💡 <b>Lời khuyên Định lượng:</b> <i>${safeRec}</i>
⏰ <b>Thời gian:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━━
🔗 <a href="${tvUrl}">Mở biểu đồ trực tiếp trên TradingView ↗</a>`;
}

export function formatMarketOpportunityTelegramAlert(stock: StockData, signal: WatchlistTriggerSignal): string {
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const changeSign = stock.change >= 0 ? '+' : '';
  const tvExchange = ['HNX', 'UPCOM'].includes((stock.exchange || '').toUpperCase()) ? stock.exchange.toUpperCase() : 'HOSE';
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${stock.symbol}`;

  const safeStockName = escapeTelegramHtml(stock.name);
  const safeSector = escapeTelegramHtml(stock.sector);
  const safeSmartMoney = escapeTelegramHtml(stock.smartMoney?.patternName || 'Dòng tiền vào mạnh');
  const safeIndicator = escapeTelegramHtml(signal.indicatorName);
  const safeDescription = escapeTelegramHtml(signal.description);
  const safeRec = escapeTelegramHtml(signal.recommendation);

  return `${signal.headerBadge}
━━━━━━━━━━━━━━━━━━━━━
🌟 <b>CƠ HỘI BÙNG NỔ THỊ TRƯỜNG: #${stock.symbol}</b> (${safeStockName})
🏢 <b>Sàn:</b> ${stock.exchange} | <b>Ngành:</b> ${safeSector}
⚡ <b>ĐÁNH GIÁ ĐỊNH LƯỢNG:</b> <code>${safeIndicator}</code>
📣 <b>Phân tích AI:</b> ${safeDescription}

💲 <b>Thị giá:</b> <b>${stock.price.toFixed(2)}k VNĐ</b> (${changeSign}${stock.changePercent.toFixed(2)}%)
📊 <b>Thanh khoản:</b> ${stock.volume.toLocaleString('vi-VN')} CP (GT: ${stock.value} tỷ)
🐋 <b>Smart Money:</b> ${safeSmartMoney}

💡 <b>Khuyến nghị AI:</b> <i>${safeRec}</i>
⏰ <b>Thời gian:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━━
🔗 <a href="${tvUrl}">Xem phân tích kỹ thuật trên TradingView ↗</a>`;
}

/**
 * ============================================================================
 * UNIFIED 4-TIER SENTINEL SCAN (P1 -> P2 -> P3 -> P4)
 * ============================================================================
 */
export async function runWatchlistSentinelScan(options: { forceSendAll?: boolean } = {}): Promise<MultiTierSentinelReport> {
  const startTime = Date.now();
  const telegramConfig = getTelegramConfigStore();
  const sentinelConfig = getWatchlistSentinelConfigStore();
  const portfolioPositions = getPortfolioPositionsStore();
  const watchlistSymbols = getWatchlistStore();
  const allStocks = getAllStocks();

  console.log(`[MULTI-TIER SENTINEL] 🛡️ Bắt đầu quét phân cấp 4 tầng (P1: ${portfolioPositions.length} sở hữu, P3: ${watchlistSymbols.length} theo dõi)...`);

  const results: WatchlistScanResultItem[] = [];
  let totalSignals = 0;
  let telegramMessagesSent = 0;

  // --------------------------------------------------------------------------
  // TIER P1: CHECK PORTFOLIO HOLDINGS (HIGHEST PRIORITY - IMMEDIATE DISPATCH)
  // --------------------------------------------------------------------------
  if (telegramConfig.enableP1Portfolio !== false) {
    for (const pos of portfolioPositions) {
      const stock = allStocks.find((s) => s.symbol === pos.symbol) || (await getOrFetchStockBySymbol(pos.symbol));
      if (!stock) continue;

      const p1Signals = evaluatePortfolioHoldingSignals(pos, stock);
      if (p1Signals.length > 0) {
        totalSignals += p1Signals.length;
        let sentForStock = false;

        for (const sig of p1Signals) {
          const sigKey = `P1_${pos.symbol}_${sig.signature}`;
          const inCooldown = isSignalInCooldown(sigKey, sig.cooldownMinutes || 60);

          if (inCooldown && !options.forceSendAll) {
            console.log(`[SENTINEL P1] ⚠️ Bỏ qua thông báo trùng lặp cho ${pos.symbol}: ${sig.indicatorName}`);
            continue;
          }

          if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
            const htmlMsg = formatPortfolioTelegramAlert(pos, stock, sig);
            const sendRes = await sendTelegramMessage(htmlMsg);
            if (sendRes.success) {
              telegramMessagesSent++;
              sentForStock = true;
              recordSignalSent(sigKey, 'SENT');
              addTriggerHistoryItem({
                symbol: stock.symbol,
                alertId: `p1-${sig.type.toLowerCase()}`,
                tier: 'P1',
                message: `[P1 SỞ HỮU] ${sig.indicatorName}`,
                telegramSuccess: true,
              });
            }
          } else {
            recordSignalSent(sigKey, 'LOGGED_NO_TELEGRAM');
            addTriggerHistoryItem({
              symbol: stock.symbol,
              alertId: `p1-${sig.type.toLowerCase()}`,
              tier: 'P1',
              message: `[P1 SỞ HỮU] ${sig.indicatorName}`,
              telegramSuccess: false,
            });
          }
        }

        results.push({
          symbol: pos.symbol,
          tier: 'P1',
          price: stock.price,
          changePercent: stock.changePercent,
          signals: p1Signals,
          telegramSent: sentForStock,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // TIER P3: CHECK WATCHLIST SYMBOLS (MEDIUM PRIORITY - TECHNICAL SIGNALS)
  // --------------------------------------------------------------------------
  if (telegramConfig.enableP3Watchlist !== false) {
    const configuredCooldown = telegramConfig.cooldownMinutes || 120;

    for (const sym of watchlistSymbols) {
      // Avoid duplicate checking if already evaluated in P1
      if (portfolioPositions.some((p) => p.symbol === sym)) {
        continue;
      }

      const stock = allStocks.find((s) => s.symbol === sym) || (await getOrFetchStockBySymbol(sym));
      if (!stock) continue;

      const p3Signals = evaluateWatchlistStockSignals(stock, sentinelConfig);
      if (p3Signals.length > 0) {
        totalSignals += p3Signals.length;
        let sentForStock = false;

        for (const sig of p3Signals) {
          const sigKey = `P3_${stock.symbol}_${sig.signature}`;
          const inCooldown = isSignalInCooldown(sigKey, sig.cooldownMinutes || configuredCooldown);

          if (inCooldown && !options.forceSendAll) {
            console.log(`[SENTINEL P3] ⚠️ Bỏ qua tín hiệu trùng lặp cho ${stock.symbol}: ${sig.indicatorName}`);
            continue;
          }

          if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
            const htmlMsg = formatWatchlistTelegramAlert(stock, sig);
            const sendRes = await sendTelegramMessage(htmlMsg);
            if (sendRes.success) {
              telegramMessagesSent++;
              sentForStock = true;
              recordSignalSent(sigKey, 'SENT');
              addTriggerHistoryItem({
                symbol: stock.symbol,
                alertId: `p3-${sig.type.toLowerCase()}`,
                tier: 'P3',
                message: `[P3 WATCHLIST] ${sig.indicatorName}`,
                telegramSuccess: true,
              });
            }
          } else {
            recordSignalSent(sigKey, 'LOGGED_NO_TELEGRAM');
            addTriggerHistoryItem({
              symbol: stock.symbol,
              alertId: `p3-${sig.type.toLowerCase()}`,
              tier: 'P3',
              message: `[P3 WATCHLIST] ${sig.indicatorName}`,
              telegramSuccess: false,
            });
          }
        }

        results.push({
          symbol: stock.symbol,
          tier: 'P3',
          price: stock.price,
          changePercent: stock.changePercent,
          signals: p3Signals,
          telegramSent: sentForStock,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // TIER P4: CHECK MARKET OPPORTUNITIES (OPTIONAL)
  // --------------------------------------------------------------------------
  if (telegramConfig.enableP4MarketOpportunities) {
    for (const stock of allStocks) {
      if (watchlistSymbols.includes(stock.symbol) || portfolioPositions.some((p) => p.symbol === stock.symbol)) {
        continue;
      }

      const p4Signals = evaluateMarketOpportunitySignals(stock);
      if (p4Signals.length > 0) {
        totalSignals += p4Signals.length;
        for (const sig of p4Signals) {
          const sigKey = `P4_${stock.symbol}_${sig.signature}`;
          const inCooldown = isSignalInCooldown(sigKey, sig.cooldownMinutes || 360);

          if (inCooldown && !options.forceSendAll) continue;

          if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
            const htmlMsg = formatMarketOpportunityTelegramAlert(stock, sig);
            const sendRes = await sendTelegramMessage(htmlMsg);
            if (sendRes.success) {
              telegramMessagesSent++;
              recordSignalSent(sigKey, 'SENT');
              addTriggerHistoryItem({
                symbol: stock.symbol,
                alertId: `p4-${sig.type.toLowerCase()}`,
                tier: 'P4',
                message: `[P4 CƠ HỘI] ${sig.indicatorName}`,
                telegramSuccess: true,
              });
            }
          }
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[MULTI-TIER SENTINEL] ✅ Hoàn thành quét trong ${durationMs}ms: ${totalSignals} tín hiệu, ${telegramMessagesSent} tin Telegram đã gửi.`);

  return {
    timestamp: new Date().toISOString(),
    tier1PortfolioChecked: portfolioPositions.length,
    tier2CustomAlertsChecked: 0,
    tier3WatchlistChecked: watchlistSymbols.length,
    tier4OpportunitiesChecked: allStocks.length,
    activeSignalsFound: totalSignals,
    telegramMessagesSent,
    results,
  };
}

let sentinelIntervalTimer: NodeJS.Timeout | null = null;

/**
 * Start Background Automated Sentinel Daemon
 */
export function startWatchlistSentinelDaemon() {
  if (sentinelIntervalTimer) {
    clearInterval(sentinelIntervalTimer);
  }

  const config = getWatchlistSentinelConfigStore();
  const intervalMs = Math.max(30, config.autoScanIntervalSeconds || 60) * 1000;

  console.log(`[SENTINEL DAEMON] 🤖 Khởi động Daemon Giám Sát Phân Cấp Đa Tầng chu kỳ ${intervalMs / 1000}s`);

  sentinelIntervalTimer = setInterval(async () => {
    try {
      const cfg = getWatchlistSentinelConfigStore();
      if (!cfg.enabled) return;
      await runWatchlistSentinelScan();
    } catch (err) {
      console.error('[SENTINEL DAEMON ERROR]:', err);
    }
  }, intervalMs);
}
