import { StockData } from '../src/types';
import {
  getTelegramConfigStore,
  getWatchlistSentinelConfigStore,
  getWatchlistSignaturesStore,
  setWatchlistSignatureStore,
  clearWatchlistSignatureStore,
  getWatchlistStore,
  addTriggerHistoryItem,
  WatchlistSentinelConfig,
} from './dataStore';
import { getAllStocks, getOrFetchStockBySymbol } from './marketDataService';
import { sendTelegramMessage } from './telegramAlertService';

export interface WatchlistTriggerSignal {
  symbol: string;
  type: 'RSI_CROSSOVER' | 'MA_CROSSOVER' | 'MACD_CROSSOVER' | 'VOLUME_SURGE' | 'BREAKOUT' | 'EXTREME_RSI';
  headerBadge: string;
  indicatorName: string;
  description: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  recommendation: string;
  signature: string;
}

export interface WatchlistScanResultItem {
  symbol: string;
  price: number;
  changePercent: number;
  signals: WatchlistTriggerSignal[];
  telegramSent: boolean;
}

export interface WatchlistSentinelReport {
  timestamp: string;
  totalWatched: number;
  activeSignalsFound: number;
  telegramMessagesSent: number;
  results: WatchlistScanResultItem[];
}

/**
 * Evaluates significant technical indicators for a single stock
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

    // RSI Bullish Bounce / Oversold Reversal (RSI bouncing out of deep oversold or deep in oversold)
    if (rsi <= oversoldBound) {
      signals.push({
        symbol: stock.symbol,
        type: 'EXTREME_RSI',
        headerBadge: '🔵 <b>VIETSTOCK QUANT - WATCHLIST: RSI VÀO VÙNG QUÁ BÁN CỰC ĐẠI</b>',
        indicatorName: `RSI(14) = ${rsi.toFixed(1)} (Dưới ngưỡng Quá Bán ${oversoldBound})`,
        description: `RSI chạm mức ${rsi.toFixed(1)} nằm sâu trong vùng Quá Bán. Tín hiệu cạn kiệt lực bán, xác suất cao hình thành đáy ngắn hạn và xuất hiện nhịp hồi kỹ thuật mạnh.`,
        severity: 'SUCCESS',
        recommendation: `Có thể bắt đầu giải ngân thăm dò 30-40% vị thế quanh vùng hỗ trợ, dừng lỗ nếu thủng đáy cũ.`,
        signature: `RSI_OVERSOLD_${stock.symbol}_${rsi.toFixed(0)}`,
      });
    } else if (rsi > oversoldBound && rsi <= oversoldBound + 4 && stock.changePercent > 0) {
      // RSI Crossover above 30 (Bullish reversal confirmation)
      signals.push({
        symbol: stock.symbol,
        type: 'RSI_CROSSOVER',
        headerBadge: '✨ <b>VIETSTOCK QUANT - WATCHLIST: TÍN HIỆU RSI ĐẢO CHIỀU TĂNG (BULLISH REVERSAL)</b>',
        indicatorName: `RSI(14) = ${rsi.toFixed(1)} (Cắt lên ngưỡng ${oversoldBound})`,
        description: `RSI(14) vừa bứt phá cắt lên trên mốc Quá Bán ${oversoldBound} với xung lực giá đảo chiều tăng (+${stock.changePercent.toFixed(2)}%). Đây là tín hiệu đảo chiều tạo đáy thành công điển hình!`,
        severity: 'SUCCESS',
        recommendation: `Xác nhận tạo đáy ngắn hạn. Đề xuất mở vị thế mua thăm dò hoặc gia tăng tỷ trọng khi dòng tiền tiếp tục cải thiện.`,
        signature: `RSI_CROSS_ABOVE_${oversoldBound}_${stock.symbol}`,
      });
    }

    // RSI Overbought / Bearish Reversal
    if (rsi >= overboughtBound) {
      signals.push({
        symbol: stock.symbol,
        type: 'EXTREME_RSI',
        headerBadge: '🔴 <b>VIETSTOCK QUANT - WATCHLIST: RSI VÀO VÙNG QUÁ MUA CỰC ĐẠI</b>',
        indicatorName: `RSI(14) = ${rsi.toFixed(1)} (Vượt ngưỡng Quá Mua ${overboughtBound})`,
        description: `RSI chạm mức ${rsi.toFixed(1)} đi sâu vào vùng Quá Mua. Cảnh báo rủi ro rung lắc, chốt lời ngắn hạn từ các nhà đầu tư lướt sóng.`,
        severity: 'WARNING',
        recommendation: `Hạn chế mua đuổi giá cao. Cân nhắc hiện thực hóa 50% lợi nhuận (TP1) và nâng điểm dừng lỗ bảo toàn lãi.`,
        signature: `RSI_OVERBOUGHT_${stock.symbol}_${rsi.toFixed(0)}`,
      });
    } else if (rsi < overboughtBound && rsi >= overboughtBound - 3 && stock.changePercent < 0) {
      // RSI Crossover below 70 (Bearish profit-taking reversal)
      signals.push({
        symbol: stock.symbol,
        type: 'RSI_CROSSOVER',
        headerBadge: '⚠️ <b>VIETSTOCK QUANT - WATCHLIST: RSI CẮT XUỐNG VÙNG QUÁ MUA (BEARISH REVERSAL)</b>',
        indicatorName: `RSI(14) = ${rsi.toFixed(1)} (Cắt xuống mốc ${overboughtBound})`,
        description: `RSI(14) vừa hạ nhiệt cắt xuống dưới mốc Quá Mua ${overboughtBound} kèm đà giảm điểm (-${Math.abs(stock.changePercent).toFixed(2)}%). Áp lực chốt lời đang gia tăng.`,
        severity: 'WARNING',
        recommendation: `Chốt lời một phần vị thế, không mua mới cho đến khi giá tìm được điểm cân bằng tại hỗ trợ MA20.`,
        signature: `RSI_CROSS_BELOW_${overboughtBound}_${stock.symbol}`,
      });
    }
  }

  // 2. Moving Average Crossover Evaluation
  if (config.monitorMa) {
    // Price crosses above MA20
    if (price >= ma20 && (price - ma20) / ma20 <= 0.02 && stock.changePercent > 0.5) {
      signals.push({
        symbol: stock.symbol,
        type: 'MA_CROSSOVER',
        headerBadge: '🚀 <b>VIETSTOCK QUANT - WATCHLIST: GIÁ BỨT PHÁ VƯỢT MA20</b>',
        indicatorName: `Thị giá (${price.toFixed(2)}k) cắt lên MA20 (${ma20.toFixed(2)}k)`,
        description: `Giá cổ phiếu đã bứt phá thành công lên trên đường trung bình động MA20 (${ma20.toFixed(2)}k). Xu hướng ngắn hạn chuyển biến tích cực.`,
        severity: 'SUCCESS',
        recommendation: `Đường MA20 đóng vai trò hỗ trợ động mới. Có thể giải ngân đón đầu nhịp tăng tiếp diễn.`,
        signature: `PRICE_CROSS_ABOVE_MA20_${stock.symbol}`,
      });
    }

    // Price breaks down below MA20
    if (price < ma20 && (ma20 - price) / ma20 <= 0.025 && stock.changePercent < -0.8) {
      signals.push({
        symbol: stock.symbol,
        type: 'MA_CROSSOVER',
        headerBadge: '🛑 <b>VIETSTOCK QUANT - WATCHLIST: GIÁ VI PHẠM THỦNG MA20</b>',
        indicatorName: `Thị giá (${price.toFixed(2)}k) thủng MA20 (${ma20.toFixed(2)}k)`,
        description: `Giá cổ phiếu bị bán thủng đường trung bình MA20 (${ma20.toFixed(2)}k). Xu hướng ngắn hạn bị suy yếu.`,
        severity: 'DANGER',
        recommendation: `Cân nhắc hạ bớt tỷ trọng để quản trị rủi ro, chờ phản ứng tại hỗ trợ MA50 (${ma50.toFixed(2)}k).`,
        signature: `PRICE_CROSS_BELOW_MA20_${stock.symbol}`,
      });
    }

    // Golden Cross: MA20 crosses above MA50
    if (ma20 >= ma50 && (ma20 - ma50) / ma50 <= 0.015) {
      signals.push({
        symbol: stock.symbol,
        type: 'MA_CROSSOVER',
        headerBadge: '🌟 <b>VIETSTOCK QUANT - WATCHLIST: GIAO CẮT VÀNG GOLDEN CROSS (MA20/MA50)</b>',
        indicatorName: `MA20 (${ma20.toFixed(2)}k) cắt lên MA50 (${ma50.toFixed(2)}k)`,
        description: `Tín hiệu Golden Cross trung hạn đã hình thành. Xu hướng tăng trưởng trung và dài hạn được củng cố vững chắc.`,
        severity: 'SUCCESS',
        recommendation: `Tín hiệu tích lũy tăng trưởng trung hạn. Nắm giữ hoặc tích lũy thêm các nhịp điều chỉnh.`,
        signature: `GOLDEN_CROSS_${stock.symbol}`,
      });
    }
  }

  // 3. MACD Crossover Evaluation
  if (config.monitorMacd && macd) {
    if (macd.histogram > 0 && macd.histogram <= 0.35 && stock.changePercent > 0) {
      signals.push({
        symbol: stock.symbol,
        type: 'MACD_CROSSOVER',
        headerBadge: '💹 <b>VIETSTOCK QUANT - WATCHLIST: MACD BULLISH CROSSOVER</b>',
        indicatorName: `MACD Histogram = +${macd.histogram.toFixed(2)} (Cắt lên mức 0)`,
        description: `Đường MACD vừa cắt lên trên đường Signal (Histogram đảo sang sắc xanh dương). Động lượng giá đang mạnh dần.`,
        severity: 'SUCCESS',
        recommendation: `Xác nhận gia tăng xung lực tăng giá. Điểm mua kỹ thuật chuẩn theo phân tích động lượng.`,
        signature: `MACD_BULLISH_${stock.symbol}`,
      });
    } else if (macd.histogram < 0 && Math.abs(macd.histogram) <= 0.35 && stock.changePercent < 0) {
      signals.push({
        symbol: stock.symbol,
        type: 'MACD_CROSSOVER',
        headerBadge: '🔻 <b>VIETSTOCK QUANT - WATCHLIST: MACD BEARISH CROSSOVER</b>',
        indicatorName: `MACD Histogram = ${macd.histogram.toFixed(2)} (Cắt xuống mức 0)`,
        description: `Đường MACD vừa cắt xuống dưới đường Signal. Động lượng tăng giá tạm thời bị triệt tiêu.`,
        severity: 'WARNING',
        recommendation: `Tạm dừng các vị thế mua mới, kiên nhẫn quan sát cho đến khi Histogram thu hẹp đà giảm.`,
        signature: `MACD_BEARISH_${stock.symbol}`,
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
        type: 'VOLUME_SURGE',
        headerBadge: '🔥 <b>VIETSTOCK QUANT - WATCHLIST: ĐỘT BIẾN KHỐI LƯỢNG & DÒNG TIỀN CÁ MẬP</b>',
        indicatorName: `Khối lượng: ${stock.volume.toLocaleString('vi-VN')} CP (${volRatio.toFixed(0)}% so với TB20)`,
        description: `Thanh khoản bùng nổ vượt trội so với trung bình 20 phiên kèm đà tăng giá mạnh mẽ (+${stock.changePercent.toFixed(2)}%). Dòng tiền lớn của tổ chức đang quyết liệt gom hàng!`,
        severity: 'SUCCESS',
        recommendation: `Gia tăng tỷ trọng theo dòng tiền Big Boys, đặt điểm dừng lỗ bám sát giá đáy của phiên bùng nổ.`,
        signature: `VOL_SURGE_${stock.symbol}_${Math.floor(volRatio / 20) * 20}`,
      });
    }
  }

  // 5. Breakout / Breakdown Level
  if (config.monitorBreakout) {
    if (price >= tech.resistanceLevel && tech.resistanceLevel > 0) {
      signals.push({
        symbol: stock.symbol,
        type: 'BREAKOUT',
        headerBadge: '⚡ <b>VIETSTOCK QUANT - WATCHLIST: BỨT PHÁ VƯỢT ĐỈNH KHÁNG CỰ (BREAKOUT)</b>',
        indicatorName: `Vượt Kháng cự ${tech.resistanceLevel.toFixed(2)}k (Thị giá: ${price.toFixed(2)}k)`,
        description: `Giá cổ phiếu đã chính thức bứt phá qua mốc kháng cự then chốt ${tech.resistanceLevel.toFixed(2)}k. Mở ra dư địa tăng giá hướng tới các mốc mục tiêu cao hơn.`,
        severity: 'SUCCESS',
        recommendation: `Mua gia tăng theo trường phái Breakout, kỳ vọng đạt mục tiêu TP1 (+12-15%).`,
        signature: `BREAKOUT_RES_${stock.symbol}_${tech.resistanceLevel}`,
      });
    } else if (price <= tech.supportLevel && tech.supportLevel > 0) {
      signals.push({
        symbol: stock.symbol,
        type: 'BREAKOUT',
        headerBadge: '🚨 <b>VIETSTOCK QUANT - WATCHLIST: CẢNH BÁO THỦNG HỖ TRỢ (BREAKDOWN)</b>',
        indicatorName: `Thủng Hỗ trợ ${tech.supportLevel.toFixed(2)}k (Thị giá: ${price.toFixed(2)}k)`,
        description: `Giá cổ phiếu xuyên thủng mốc hỗ trợ cứng ${tech.supportLevel.toFixed(2)}k. Cảnh báo nguy cơ rơi vào chu kỳ giảm kéo dài.`,
        severity: 'DANGER',
        recommendation: `Kích hoạt kỷ luật quản trị rủi ro cắt lỗ Stop Loss ngay, tuyệt đối không trung bình giá xuống.`,
        signature: `BREAKDOWN_SUP_${stock.symbol}_${tech.supportLevel}`,
      });
    }
  }

  return signals;
}

/**
 * Formats a rich, high-contrast HTML notification for Telegram
 */
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

  return `${signal.headerBadge}
━━━━━━━━━━━━━━━━━━━━━
📌 <b>MÃ CP THEO DÕI: #${stock.symbol}</b> (${stock.name})
🏢 <b>Sàn:</b> ${stock.exchange} | <b>Ngành:</b> ${stock.sector}
⚡ <b>TÍN HIỆU ĐỊNH LƯỢNG:</b> <code>${signal.indicatorName}</code>
📣 <b>Chi tiết:</b> ${signal.description}

💲 <b>Thị giá:</b> <b>${stock.price.toFixed(2)}k VNĐ</b> (${changeSign}${stock.changePercent.toFixed(2)}%)
📊 <b>Thanh khoản:</b> ${stock.volume.toLocaleString('vi-VN')} CP (GT: ${stock.value} tỷ)
🐋 <b>Khối ngoại:</b> ${foreignStr} | <b>Smart Money:</b> ${stock.smartMoney?.patternName || 'Tích lũy'}

📈 <b>BỘ CHỈ BÁO KỸ THUẬT:</b>
• RSI(14): <b>${stock.technical.rsi14.toFixed(1)}</b> | MACD: <b>${stock.technical.macd.histogram > 0 ? '+' : ''}${stock.technical.macd.histogram.toFixed(2)}</b>
• MA20: <b>${stock.technical.ma20.toFixed(2)}k</b> | MA50: <b>${stock.technical.ma50.toFixed(2)}k</b>
• Hỗ trợ then chốt: <b>${stock.technical.supportLevel}k</b> | Kháng cự: <b>${stock.technical.resistanceLevel}k</b>

🎯 <b>KẾ HOẠCH GIAO DỊCH 4 TẦNG (ACTION PLAN):</b>
• 🎯 <b>Vùng Mua Gom:</b> <code>${buyZoneLow} - ${buyZoneHigh}k</code> (Thăm dò 50%)
• 📈 <b>Mục tiêu TP1:</b> <code>${tp1}k</code> (+${tp1Upside}%) | <b>TP2:</b> <code>${tp2}k</code>
• 🛑 <b>Cắt lỗ SL:</b> <code>${sl}k</code> (-${slDownside}%) [Gãy MA20/Hỗ trợ]
• ⚖️ <b>Tỷ lệ R:R:</b> <code>1 : ${rr}</code> | <b>Phân bổ:</b> <code>15 - 20% NAV</code>

💡 <b>Lời khuyên Định lượng:</b> <i>${signal.recommendation}</i>
⏰ <b>Thời gian:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━━
🔗 <a href="${tvUrl}">Mở biểu đồ trực tiếp trên TradingView ↗</a>`;
}

/**
 * Scan all watchlist symbols, evaluate indicators, and send Telegram alerts for new signals
 */
export async function runWatchlistSentinelScan(options: { forceSendAll?: boolean } = {}): Promise<WatchlistSentinelReport> {
  const startTime = Date.now();
  const watchlistSymbols = getWatchlistStore();
  const telegramConfig = getTelegramConfigStore();
  const sentinelConfig = getWatchlistSentinelConfigStore();
  const existingSignatures = getWatchlistSignaturesStore();

  console.log(`[SENTINEL] 🛡️ Quét danh mục theo dõi Watchlist (${watchlistSymbols.length} mã)...`);

  const results: WatchlistScanResultItem[] = [];
  let totalSignals = 0;
  let telegramMessagesSent = 0;

  const allStocks = getAllStocks();

  for (const sym of watchlistSymbols) {
    const stock = allStocks.find((s) => s.symbol === sym) || (await getOrFetchStockBySymbol(sym));
    if (!stock) continue;

    const signals = evaluateWatchlistStockSignals(stock, sentinelConfig);
    let sentForStock = false;

    if (signals.length > 0) {
      totalSignals += signals.length;

      for (const sig of signals) {
        const sigKey = `${stock.symbol}_${sig.type}_${sig.signature}`;
        const alreadySent = existingSignatures[sigKey];

        // Deduplication check
        if (alreadySent && !options.forceSendAll) {
          console.log(`[SENTINEL] ⚠️ Bỏ qua tín hiệu trùng lặp cho ${stock.symbol}: ${sig.indicatorName}`);
          continue;
        }

        // Push Telegram message if configured
        if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
          const text = formatWatchlistTelegramAlert(stock, sig);
          const sendRes = await sendTelegramMessage(text);

          if (sendRes.success) {
            telegramMessagesSent++;
            sentForStock = true;
            setWatchlistSignatureStore(sigKey, new Date().toISOString());

            // Add to trigger history log
            addTriggerHistoryItem({
              symbol: stock.symbol,
              alertId: `sentinel-${sig.type.toLowerCase()}`,
              message: `[WATCHLIST SENTINEL] ${sig.indicatorName}: ${sig.description}`,
              telegramSuccess: true,
            });
          }
        } else {
          // Log even without Telegram configured
          setWatchlistSignatureStore(sigKey, new Date().toISOString());
          addTriggerHistoryItem({
            symbol: stock.symbol,
            alertId: `sentinel-${sig.type.toLowerCase()}`,
            message: `[WATCHLIST SENTINEL] ${sig.indicatorName}: ${sig.description}`,
            telegramSuccess: false,
          });
        }
      }
    }

    results.push({
      symbol: stock.symbol,
      price: stock.price,
      changePercent: stock.changePercent,
      signals,
      telegramSent: sentForStock,
    });
  }

  const durationMs = Date.now() - startTime;
  console.log(`[SENTINEL] ✅ Hoàn thành quét Watchlist trong ${durationMs}ms: ${totalSignals} tín hiệu, ${telegramMessagesSent} tin Telegram.`);

  return {
    timestamp: new Date().toISOString(),
    totalWatched: watchlistSymbols.length,
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

  console.log(`[SENTINEL DAEMON] 🤖 Khởi động Daemon Giám Sát Watchlist chu kỳ ${intervalMs / 1000}s`);

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
