import { AIRecommendation } from '../src/types';
import { getAllStocks } from './marketDataService';
import { analyzeSmartMoneySignal } from './smartMoneyAnomalyService';

export function generateScreenerRecommendations(): AIRecommendation[] {
  const stocks = getAllStocks();
  const recommendations: AIRecommendation[] = [];

  stocks.forEach((stk) => {
    const tech = stk.technical;
    const fund = stk.fundamental;
    const sm = analyzeSmartMoneySignal(stk);

    // 1. Gom Hàng Ngầm (Smart Accumulation)
    if (sm.patternType === 'ACCUMULATION_CLANDESTINE') {
      recommendations.push({
        id: `rec-acc-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'GOM_HÀNG_NGẦM',
        price: stk.price,
        changePercent: stk.changePercent,
        score: Math.min(99, stk.aiScore + 6),
        confidence: 92,
        targetPrice: stk.aiTargetPrice,
        stopLoss: stk.aiStopLoss,
        potentialProfitPercent: Number((((stk.aiTargetPrice - stk.price) / stk.price) * 100).toFixed(1)),
        riskPercent: Number((((stk.price - stk.aiStopLoss) / stk.price) * 100).toFixed(1)),
        timeframe: '2 - 6 Tuần',
        reasons: [
          `🔍 DẤU CHÂN CÁ MẬP: ${sm.description}`,
          `Tỷ lệ lệnh gom lô lớn (>50k CP) đạt ${sm.largeBlockNetRatio}% khối lượng khớp.`,
          `Biên độ tích lũy nén chặt, sẵn sàng kích hoạt sóng bùng nổ vượt đỉnh.`,
        ],
        risks: ['Kiên nhẫn chờ đợi điểm kích hoạt bùng nổ thanh khoản từ nhà cái.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }

    // 2. Đột Biến Khối Lượng Phiên Sáng (Morning Volume Burst)
    if (sm.patternType === 'MORNING_VOLUME_BURST' || sm.morningVolRatio >= 1.8) {
      recommendations.push({
        id: `rec-mvb-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'ĐỘT_BIẾN_PHIÊN_SÁNG',
        price: stk.price,
        changePercent: stk.changePercent,
        score: Math.min(98, stk.aiScore + 5),
        confidence: 89,
        targetPrice: stk.aiTargetPrice,
        stopLoss: stk.aiStopLoss,
        potentialProfitPercent: Number((((stk.aiTargetPrice - stk.price) / stk.price) * 100).toFixed(1)),
        riskPercent: Number((((stk.price - stk.aiStopLoss) / stk.price) * 100).toFixed(1)),
        timeframe: '1 - 4 Tuần',
        reasons: [
          `⚡ THANH KHOẢN ĐỘT BIẾN: Khối lượng phiên sáng đạt gấp ${sm.morningVolRatio}x so với trung bình.`,
          `Lực cầu khớp lệnh chủ động áp đảo bên bán, đẩy giá tăng +${stk.changePercent}%.`,
          `Chỉ báo xung lượng RSI(14) đạt ${tech.rsi14}, bước vào chu kỳ tăng tốc.`,
        ],
        risks: ['Tránh mua đuổi giá quá gần trần, ưu tiên canh nhịp võng trong phiên.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }

    // 3. Phân Kỳ Dòng Tiền Lớn (Smart Money Divergence)
    if (sm.patternType === 'SMART_MONEY_DIVERGENCE' || sm.patternType === 'BEAR_TRAP') {
      recommendations.push({
        id: `rec-div-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'PHÂN_KỲ_DÒNG_TIỀN',
        price: stk.price,
        changePercent: stk.changePercent,
        score: Math.min(97, stk.aiScore + 4),
        confidence: 87,
        targetPrice: stk.aiTargetPrice,
        stopLoss: stk.aiStopLoss,
        potentialProfitPercent: Number((((stk.aiTargetPrice - stk.price) / stk.price) * 100).toFixed(1)),
        riskPercent: Number((((stk.price - stk.aiStopLoss) / stk.price) * 100).toFixed(1)),
        timeframe: '2 - 8 Tuần',
        reasons: [
          `🌊 PHÂN KỲ DƯƠNG: ${sm.description}`,
          `Chỉ báo MACD Histogram và RSI tạo đáy sau cao hơn đáy trước trong khi giá điều chỉnh rũ bỏ nhỏ lẻ.`,
          `Định giá hấp dẫn với P/E = ${fund.pe}x (Thấp hơn trung bình ngành ${fund.industryAvgPE}x).`,
        ],
        risks: ['Cần xác nhận khi giá đóng nến vượt qua đường trung bình MA20.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }

    // 4. Cảnh Báo Bẫy Giá (Bull Trap / Risk Warning)
    if (sm.patternType === 'BULL_TRAP') {
      recommendations.push({
        id: `rec-trap-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'CẢNH_BÁO_BẪY_GIÁ',
        price: stk.price,
        changePercent: stk.changePercent,
        score: 45, // Low score for trap warning
        confidence: 94,
        targetPrice: Number((stk.price * 0.9).toFixed(2)),
        stopLoss: Number((stk.price * 1.02).toFixed(2)),
        potentialProfitPercent: -10.0,
        riskPercent: 12.5,
        timeframe: 'CẢNH BÁO TỨC THÌ (T+0 ~ T+3)',
        reasons: [
          `🚨 ${sm.trapWarning}`,
          `Kéo giá ảo đầu phiên chạm ${stk.highPrice}k nhưng bị dội ngược bán tháo về ${stk.price}k.`,
          `Áp lực xả hàng quyết liệt từ khối ngoại/tổ chức (${stk.foreignNetVal} tỷ VNĐ).`,
        ],
        risks: ['Rủi ro kẹp hàng T+2.5 nếu mua đuổi ở vùng giá hưng phấn.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }

    // 5. Check Breakout
    if (stk.price >= tech.bollingerBands.upper * 0.99 && tech.rsi14 > 60) {
      recommendations.push({
        id: `rec-bo-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'BREAKOUT',
        price: stk.price,
        changePercent: stk.changePercent,
        score: Math.min(99, stk.aiScore + 5),
        confidence: 88,
        targetPrice: stk.aiTargetPrice,
        stopLoss: stk.aiStopLoss,
        potentialProfitPercent: Number((((stk.aiTargetPrice - stk.price) / stk.price) * 100).toFixed(1)),
        riskPercent: Number((((stk.price - stk.aiStopLoss) / stk.price) * 100).toFixed(1)),
        timeframe: '2 - 6 Tuần',
        reasons: [
          `Giá bứt phá vượt qua Bollinger Bands Upper (${tech.bollingerBands.upper}) với khối lượng xác nhận.`,
          `RSI 14 đạt ${tech.rsi14} duy trì đà tăng mạnh mẽ.`,
          `Lợi nhuận YoY tăng trưởng ${fund.profitGrowthYoY}%.`,
        ],
        risks: ['Thị trường chung điều chỉnh bất ngờ.', 'Áp lực chốt lời tại vùng kháng cự lịch sử.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }

    // 6. Check Golden Cross
    if (tech.ma20 > tech.ma50 && tech.macd.histogram > 0) {
      recommendations.push({
        id: `rec-gc-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'GOLDEN_CROSS',
        price: stk.price,
        changePercent: stk.changePercent,
        score: stk.aiScore,
        confidence: 86,
        targetPrice: stk.aiTargetPrice,
        stopLoss: stk.aiStopLoss,
        potentialProfitPercent: Number((((stk.aiTargetPrice - stk.price) / stk.price) * 100).toFixed(1)),
        riskPercent: Number((((stk.price - stk.aiStopLoss) / stk.price) * 100).toFixed(1)),
        timeframe: '1 - 3 Tháng',
        reasons: [
          `Tín hiệu Golden Cross: Đường MA20 (${tech.ma20}) cắt lên trên đường MA50 (${tech.ma50}).`,
          `Phân kỳ MACD Histogram nằm trên trục 0 (${tech.macd.histogram}).`,
          `Tỷ lệ ROE ấn tượng đạt ${fund.roe}%.`,
        ],
        risks: ['Tín hiệu giao cắt giả nếu thanh khoản suy giảm.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }

    // 7. Check Foreign Net Buy
    if (stk.foreignNetVal > 50) {
      recommendations.push({
        id: `rec-fn-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'KHỐI_NGOẠI_MUA',
        price: stk.price,
        changePercent: stk.changePercent,
        score: Math.min(98, stk.aiScore + 4),
        confidence: 90,
        targetPrice: stk.aiTargetPrice,
        stopLoss: stk.aiStopLoss,
        potentialProfitPercent: Number((((stk.aiTargetPrice - stk.price) / stk.price) * 100).toFixed(1)),
        riskPercent: Number((((stk.price - stk.aiStopLoss) / stk.price) * 100).toFixed(1)),
        timeframe: '3 - 6 Tháng',
        reasons: [
          `Khối ngoại mua ròng đột biến +${stk.foreignNetVal} Tỷ VNĐ trong phiên.`,
          `Nền tảng tài chính lành mạnh: Nợ/VCSH chỉ ${fund.debtToEquity}x.`,
          `Khuyến nghị AI: ${stk.aiVerdict}.`,
        ],
        risks: ['Khối ngoại quay đầu bán ròng khi tỷ giá USD/VND biến động.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }

    // 8. Default Top Mua Mạnh / Top Mua
    if (stk.aiVerdict === 'MUA MẠNH') {
      recommendations.push({
        id: `rec-sb-${stk.symbol}`,
        symbol: stk.symbol,
        name: stk.name,
        exchange: stk.exchange,
        sector: stk.sector,
        category: 'TOP_MUA_MẠNH',
        price: stk.price,
        changePercent: stk.changePercent,
        score: stk.aiScore,
        confidence: stk.aiConfidence,
        targetPrice: stk.aiTargetPrice,
        stopLoss: stk.aiStopLoss,
        potentialProfitPercent: Number((((stk.aiTargetPrice - stk.price) / stk.price) * 100).toFixed(1)),
        riskPercent: Number((((stk.price - stk.aiStopLoss) / stk.price) * 100).toFixed(1)),
        timeframe: '1 - 6 Tháng',
        reasons: [stk.aiReasoning, `Định giá P/E = ${fund.pe}x so với trung bình ngành ${fund.industryAvgPE}x.`, `Chỉ báo Ichimoku & Moving Average đồng thuận xu hướng tăng.`],
        risks: ['Rủi ro biến động thị trường chung VN-Index.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }
  });

  // Sort by score descending
  return recommendations.sort((a, b) => b.score - a.score);
}
