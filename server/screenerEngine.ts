import { AIRecommendation } from '../src/types';
import { getAllStocks } from './marketDataService';

export function generateScreenerRecommendations(): AIRecommendation[] {
  const stocks = getAllStocks();
  const recommendations: AIRecommendation[] = [];

  stocks.forEach((stk) => {
    const tech = stk.technical;
    const fund = stk.fundamental;

    // 1. Check Breakout
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

    // 2. Check Golden Cross
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

    // 3. Check Foreign Net Buy
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

    // 4. Default Top Mua Mạnh / Top Mua
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
        reasons: [stk.aiReasoning, `Định giá P/E = ${fund.pe}x so với trung bình ngành ${fund.industryAvgPE}x.`, `Chỉ báoIchimoku & Moving Average đồng thuận xu hướng tăng.`],
        risks: ['Rủi ro biến động thị trường chung VN-Index.'],
        updatedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    }
  });

  // Sort by score descending
  return recommendations.sort((a, b) => b.score - a.score);
}
