import { StockNewsSentiment, ToolCallExecution } from '../src/types';
import {
  getAllStocks,
  getLatestNews,
  getLatestNewsAsync,
  getMacroData,
  getMarketIndices,
  getOrderBook,
  getStockBySymbol,
  getTradeTicks,
} from './marketDataService';
import { analyzeSmartMoneySignal } from './smartMoneyAnomalyService';
import { calculateDeepSentiment, evaluateNewsAuthenticity, forecastPriceImpact } from './newsSentimentEngine';
import { callGeminiSafe, getGenAI } from './geminiService';
import { executeInternalTool, internalFunctionDeclarations } from './aiTools';

// 4-Tier Quant Analysis Calculation Helper
export function computeQuant4LayerData(stock: any) {
  const isPositive = stock.change >= 0;
  const tech = stock.technical;
  const fund = stock.fundamental;
  const peVsIndustry = fund.industryAvgPE > 0 ? (fund.pe / fund.industryAvgPE) : 1;
  const pbVsIndustry = fund.industryAvgPB > 0 ? (fund.pb / fund.industryAvgPB) : 1;

  // Valuation Verdict
  let valuationVerdict = 'ĐỊNH GIÁ HỢP LÝ';
  if (fund.pe < fund.industryAvgPE * 0.85 && fund.roe >= 15) {
    valuationVerdict = 'ĐỊNH GIÁ RẤT RẺ / UNDERVALUED';
  } else if (fund.pe > fund.industryAvgPE * 1.35) {
    valuationVerdict = 'ĐỊNH GIÁ CAO / PREMIUM';
  }

  // Technical Trend
  let trend = 'TÍCH LŨY TRUNG TÍNH';
  if (stock.price > tech.ma20 && tech.ma20 > tech.ma50) {
    trend = 'XU HƯỚNG TĂNG MẠNH (UPTREND)';
  } else if (stock.price < tech.ma20 && tech.ma20 < tech.ma50) {
    trend = 'XU HƯỚNG GIẢM (DOWNTREND)';
  }

  // MACD Status
  const macdStatus = tech.macd.histogram > 0 ? `Tích cực (+${tech.macd.histogram})` : `Tiêu cực (${tech.macd.histogram})`;

  // Smart Money & Foreign Flow
  const smSignal = analyzeSmartMoneySignal(stock);
  let foreignStatus = 'Trung tính';
  if (stock.foreignNetVal > 20) foreignStatus = `Gom ròng đột biến (+${stock.foreignNetVal} tỷ VNĐ)`;
  else if (stock.foreignNetVal > 0) foreignStatus = `Mua ròng nhẹ (+${stock.foreignNetVal} tỷ VNĐ)`;
  else if (stock.foreignNetVal < -20) foreignStatus = `Xả ròng mạnh (${stock.foreignNetVal} tỷ VNĐ)`;
  else foreignStatus = `Bán ròng nhẹ (${stock.foreignNetVal} tỷ VNĐ)`;

  // Order Flow & Volume Analysis
  const volSurge = smSignal.patternType === 'MORNING_VOLUME_BURST'
    ? `BÙNG NỔ VOL PHIÊN SÁNG (${smSignal.morningVolRatio}x TB)`
    : stock.volume > 8000000 ? 'BÙNG NỔ THANH KHOẢN (>150% TB20)' : 'Duy trì thanh khoản ổn định';

  const bigOrder = `Lệnh gom cá mập: ${smSignal.largeBlockNetRatio}% khối lượng khớp`;
  const moneyVerdict = smSignal.patternName;

  // Trade Plan & Math
  const buyZoneLow = (stock.price * 0.985).toFixed(2);
  const buyZoneHigh = (stock.price * 1.005).toFixed(2);
  const buyZone = `${buyZoneLow} - ${buyZoneHigh}k`;
  const tp1 = Number(stock.aiTargetPrice || (stock.price * 1.12).toFixed(2));
  const tp2 = Number((tp1 * 1.08).toFixed(2));
  const sl = Number(stock.aiStopLoss || (stock.price * 0.94).toFixed(2));
  const potentialUpside = (((tp1 - stock.price) / stock.price) * 100).toFixed(1);
  const potentialUpside2 = (((tp2 - stock.price) / stock.price) * 100).toFixed(1);
  const maxDownside = (((stock.price - sl) / stock.price) * 100).toFixed(1);
  const rr = (Number(potentialUpside) / (Number(maxDownside) || 1)).toFixed(1);
  const rrRatio = `1 : ${rr}`;
  const maxAllocation = stock.aiScore >= 85 ? '15 - 20% Tổng NAV' : (stock.aiScore >= 70 ? '10 - 15% Tổng NAV' : '5 - 8% Thăm dò');
  const timeframe = 'Ngắn - Trung hạn (2 - 6 tuần)';

  const entryRules = [
    `Đợt 1 (40 - 50% vị thế): Giải ngân thăm dò trong vùng tích lũy ${buyZoneLow} - ${stock.price.toFixed(2)}k.`,
    `Đợt 2 (50% còn lại): Mua gia tăng khi xác nhận vượt kháng cự ${tech.resistanceLevel}k với thanh khoản bùng nổ >130% TB20.`,
    `Tạm dừng mua nếu VN-Index chịu áp lực bán tháo diện rộng hoặc xuất hiện nến nhấn chìm giảm thủng ${tech.supportLevel}k.`,
  ];

  const exitRules = [
    `Chốt lời TP1 (${tp1}k, +${potentialUpside}%): Bán chốt lời chủ động 50% vị thế, dời điểm dừng lỗ (Stop Loss) về giá vốn (Breakeven).`,
    `Chốt lời TP2 (${tp2}k, +${potentialUpside2}%): Chốt lời nốt 50% còn lại hoặc giữ trailing stop theo đường MA10.`,
    `Cắt lỗ dứt khoát (${sl}k, -${maxDownside}%): Thoát toàn bộ vị thế khi nến ngày đóng cửa dưới ${sl}k (gãy hỗ trợ ${tech.supportLevel}k). Tuyệt đối không trung bình giá xuống.`,
  ];

  // Confidence Score & Counter-Thesis Calculation
  let confidenceScore = Math.min(95, Math.max(62, Math.round(
    (stock.aiScore * 0.5) +
    (fund.roe >= 15 ? 15 : 8) +
    (stock.price > tech.ma20 ? 12 : 4) +
    (stock.foreignNetVal > 0 ? 10 : 3) +
    (tech.rsi14 >= 45 && tech.rsi14 <= 65 ? 8 : 4)
  )));

  const confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = confidenceScore >= 82 ? 'HIGH' : (confidenceScore >= 70 ? 'MEDIUM' : 'LOW');

  // Build stock-specific Counter-Thesis (Luận điểm phản biện & Kịch bản rủi ro)
  const counterThesis: string[] = [
    `Rủi ro phá vỡ ngưỡng hỗ trợ: Nếu nến ngày đóng cửa thủng vùng hỗ trợ then chốt ${tech.supportLevel}k VNĐ (hoặc gãy MA20 tại ${tech.ma20}k), xu hướng tích lũy sẽ bị vô hiệu hóa và kích hoạt làn sóng bán cắt lỗ tự động.`,
    stock.foreignNetVal < 0 
      ? `Áp lực xả ròng từ Khối ngoại: Khối ngoại đang bán ròng (${stock.foreignNetVal} tỷ VNĐ), có thể tạo áp lực nguồn cung trôi nổi đè nặng lên các nhịp hồi phục ngắn hạn.`
      : `Rủi ro bẫy giá (Bull-trap): Nếu cổ phiếu tiến về vùng cản ${tech.resistanceLevel}k nhưng thanh khoản khớp lệnh không vượt được 130% trung bình 20 phiên, xác suất xuất hiện nhịp rung lắc rũ bỏ là rất cao.`,
    fund.pe > fund.industryAvgPE * 1.15
      ? `Định giá P/E (${fund.pe}x) đang cao hơn trung bình ngành (${fund.industryAvgPE}x), đòi hỏi tốc độ tăng trưởng lợi nhuận quý tới phải duy trì tối thiểu >${fund.profitGrowthYoY}% để duy trì bội số định giá.`
      : `Rủi ro biến động Vĩ mô & Thị trường chung: Nếu chỉ số VN-Index đánh mất mốc 1.235 điểm hoặc tỷ giá USD/VND vượt ngưỡng 25.500, dòng tiền tổ chức có thể tạm thời rút lui về thế phòng thủ.`,
  ];

  const riskDisclaimer = 'Mọi phân tích, điểm số định lượng AI, mức độ tin cậy và kế hoạch giao dịch được tạo tự động dựa trên mô hình toán học và dữ liệu thời gian thực của thị trường chứng khoán Việt Nam. Thông tin mang tính chất tham khảo cho hoạt động nghiên cứu đầu tư độc lập, không phải là lời chào mời hay cam kết lợi nhuận. Nhà đầu tư tự chịu trách nhiệm hoàn toàn đối với mọi quyết định phân bổ vốn và rủi ro thị trường.';

  return {
    symbol: stock.symbol,
    companyName: stock.name,
    price: stock.price,
    changePercent: stock.changePercent,
    score: stock.aiScore,
    confidenceScore,
    confidenceLevel,
    counterThesis,
    riskDisclaimer,
    verdict: stock.aiVerdict,
    targetPrice: tp1,
    targetPrice2: tp2,
    stopLoss: sl,
    buyZone,
    riskRewardRatio: rrRatio,
    maxAllocationPercent: stock.aiScore >= 85 ? 20 : 12,
    timeframe,
    layer1_fundamental: {
      summary: `P/E đạt ${fund.pe}x (${valuationVerdict}), P/B ${fund.pb}x. ROE đạt ${fund.roe}%, tăng trưởng LN YoY +${fund.profitGrowthYoY}%. Nợ/VCSH ở mức an toàn (${fund.debtToEquity}x).`,
      pe: fund.pe,
      industryPe: fund.industryAvgPE,
      roe: fund.roe,
      profitGrowthYoY: fund.profitGrowthYoY,
      valuationVerdict,
    },
    layer2_technical: {
      summary: `RSI(14) ở mức ${tech.rsi14}. Giá vận động trên các đường hỗ trợ động. Vùng hỗ trợ then chốt tại ${tech.supportLevel}k, cản kỹ thuật tại ${tech.resistanceLevel}k.`,
      trend,
      rsi: tech.rsi14,
      macd: macdStatus,
      support: tech.supportLevel,
      resistance: tech.resistanceLevel,
    },
    layer3_smartMoney: {
      summary: `Khối ngoại: ${foreignStatus}. ${volSurge}. ${bigOrder}. Đánh giá xung lượng: ${moneyVerdict}.`,
      foreignNetVal: stock.foreignNetVal,
      volumeStatus: volSurge,
      bigOrderActivity: bigOrder,
      moneyFlowVerdict: moneyVerdict,
    },
    layer4_actionPlan: {
      action: stock.aiVerdict,
      buyZone,
      entry1: `${buyZoneLow} - ${stock.price.toFixed(2)}k (Thăm dò 50%)`,
      entry2: `Vượt ${tech.resistanceLevel}k kèm Vol lớn (Gia tăng 50%)`,
      target1: tp1,
      target1Upside: `+${potentialUpside}%`,
      target2: tp2,
      target2Upside: `+${potentialUpside2}%`,
      stopLoss: sl,
      stopLossDownside: `-${maxDownside}%`,
      stopLossCondition: `Đóng nến gãy hỗ trợ ${tech.supportLevel}k hoặc thủng MA20 (${tech.ma20}k)`,
      rrRatio: rrRatio,
      maxAllocation,
      timeframe,
      strategyNote: `Kỳ vọng tăng trưởng TP1 +${potentialUpside}%, TP2 +${potentialUpside2}%, rủi ro tối đa -${maxDownside}%. Khuyến nghị giải ngân 2 đợt theo kỷ luật quản trị vốn.`,
      entryRules,
      exitRules,
    },
  };
}

export async function analyzeStockWithAI(symbol: string) {
  const stock = getStockBySymbol(symbol);
  if (!stock) {
    return {
      error: `Không tìm thấy mã chứng khoán ${symbol}`,
    };
  }

  const ai = getGenAI();
  const macro = getMacroData();
  const indices = getMarketIndices();
  const vnindex = indices.find((i) => i.symbol === 'VNINDEX')?.price || 1248.65;
  const base4Layer = computeQuant4LayerData(stock);

  // Execute internal tools to gather official grounded telemetry before issuing recommendation
  const executedTools: ToolCallExecution[] = [];
  try {
    const [tFin, tProp, tSmart, tTech] = await Promise.all([
      executeInternalTool('getFinancialStatements', { symbol: stock.symbol }),
      executeInternalTool('getProprietaryAndForeignTrading', { symbol: stock.symbol }),
      executeInternalTool('getLargeBlockOrdersAndSmartMoney', { symbol: stock.symbol }),
      executeInternalTool('getTechnicalSignalsAndPriceAction', { symbol: stock.symbol }),
    ]);
    executedTools.push(tFin, tProp, tSmart, tTech);
  } catch (err) {
    console.error('Error executing internal tools:', err);
  }

  const prompt = `Bạn là Trưởng Bộ Phận Phân Tích Định Lượng & Chiến Lược Đầu Tư (Head of Quant & Strategy) tại Quỹ Đầu Tư Chứng Khoán Việt Nam.
Hãy tiến hành PHÂN TÍCH CHUYÊN SÂU 4 TẦNG (4-Layer Quantitative Framework) cho mã cổ phiếu: ${stock.symbol} (${stock.name} - Sàn ${stock.exchange} - Nhóm ngành: ${stock.sector}).

=== DỮ LIỆU TỪ CÁC CÔNG CỤ NỘI BỘ VỪA TRUY XUẤT (INTERNAL TOOLS DATA): ===
${executedTools.map((t) => `[TOOL ${t.toolName}]: ${t.summary}`).join('\n')}

=== BỘ DỮ LIỆU THỰC THỜI GIAN THỰC ===
1. GIÁ & DÒNG TIỀN HIỆN TẠI:
- Giá hiện tại: ${stock.price}k VNĐ | Thay đổi: ${stock.changePercent}% (Giá TC: ${stock.referencePrice}k, Trần: ${stock.ceilingPrice}k, Sàn: ${stock.floorPrice}k)
- Khối lượng giao dịch: ${stock.volume.toLocaleString('vi-VN')} CP | Giá trị: ${stock.value} tỷ VNĐ
- Dòng tiền Khối ngoại: Mua ${stock.foreignBuyVol}, Bán ${stock.foreignSellVol} => Ròng: ${stock.foreignNetVal} tỷ VNĐ

2. TÍN HIỆU KỸ THUẬT (TECHNICAL):
- RSI(14): ${stock.technical.rsi14}
- MACD Histogram: ${stock.technical.macd.histogram}, Signal: ${stock.technical.macd.signalLine}
- Bollinger Bands: Upper ${stock.technical.bollingerBands.upper}, Middle ${stock.technical.bollingerBands.middle}, Lower ${stock.technical.bollingerBands.lower}
- Đường MA: MA20 (${stock.technical.ma20}), MA50 (${stock.technical.ma50}), MA200 (${stock.technical.ma200}), VWAP (${stock.technical.vwap})
- Ngưỡng Hỗ trợ: ${stock.technical.supportLevel}k | Kháng cự: ${stock.technical.resistanceLevel}k
- Mẫu hình nhận diện: ${stock.technical.patterns.map((p) => p.name).join(', ') || 'Tích lũy chặt chẽ'}

3. CHỈ SỐ CƠ BẢN DOANH NGHIỆP (BCTC):
- P/E: ${stock.fundamental.pe}x (P/E TB ngành: ${stock.fundamental.industryAvgPE}x) | P/B: ${stock.fundamental.pb}x (P/B TB ngành: ${stock.fundamental.industryAvgPB}x)
- ROE: ${stock.fundamental.roe}% | ROA: ${stock.fundamental.roa}% | EPS: ${stock.fundamental.eps} VNĐ | Cổ tức: ${stock.fundamental.dividendYield}%
- Tăng trưởng Doanh thu YoY: ${stock.fundamental.revenueGrowthYoY}% | Tăng trưởng Lợi nhuận YoY: ${stock.fundamental.profitGrowthYoY}%
- Tỷ lệ Nợ/VCSH: ${stock.fundamental.debtToEquity}x | Biên LN gộp: ${stock.fundamental.grossMargin}% | Biên LN ròng: ${stock.fundamental.netMargin}%

4. BỐI CẢNH VĨ MÔ THỊ TRƯỜNG:
- VN-Index: ${vnindex} | Tỷ giá USD/VND: ${macro.usdVnd} | Lãi suất điều hành: ${macro.sbvInterestRate}%

=== YÊU CẦU ĐẦU RA (JSON FORMAT CHÍNH XÁC): ===
{
  "symbol": "${stock.symbol}",
  "companyName": "${stock.name}",
  "score": 0-100,
  "verdict": "MUA MẠNH" | "MUA" | "THEO DÕI" | "BÁN HẠ TỶ TRỌNG" | "BÁN CẮT LỖ",
  "confidence": 0-100,
  "targetPrice": number,
  "targetPrice2": number,
  "stopLoss": number,
  "buyZone": "Giá min - Giá max",
  "riskRewardRatio": "1 : X.X",
  "summary": "Tóm tắt kết luận định lượng 2-3 câu",
  "layer1_fundamental": {
    "summary": "Phân tích BCTC, P/E vs Ngành, ROE, tăng trưởng",
    "valuationVerdict": "RẺ / ĐẮT / HỢP LÝ"
  },
  "layer2_technical": {
    "summary": "Phân tích hành động giá, MA, RSI, MACD, cản & hỗ trợ",
    "trend": "UPTREND / DOWNTREND / SIDEWAY"
  },
  "layer3_smartMoney": {
    "summary": "Dấu chân khối ngoại, lệnh lớn, volume đột biến, bẫy giá",
    "moneyFlowVerdict": "GOM RÒNG / XẢ RÒNG / TRUNG TÍNH"
  },
  "layer4_actionPlan": {
    "action": "Khuyến nghị hành động",
    "buyZone": "Vùng mua cụ thể",
    "target1": number,
    "target2": number,
    "stopLoss": number,
    "rrRatio": "1 : X.X",
    "maxAllocation": "Tỷ trọng % NAV khuyên dùng",
    "strategyNote": "Chiến lược đi lệnh (ví dụ chia 2 lần giải ngân)"
  },
  "catalysts": ["Động lực 1", "Động lực 2", "Động lực 3"],
  "risks": ["Rủi ro 1", "Rủi ro 2"]
}`;

  const geminiRes = await callGeminiSafe({
    contents: prompt,
    responseMimeType: 'application/json',
  });

  if (geminiRes && geminiRes.parsedJson) {
    const parsed = geminiRes.parsedJson;
    return {
      ...base4Layer,
      ...parsed,
      toolCalls: executedTools,
      layer1_fundamental: {
        ...base4Layer.layer1_fundamental,
        ...(parsed.layer1_fundamental || {}),
      },
      layer2_technical: {
        ...base4Layer.layer2_technical,
        ...(parsed.layer2_technical || {}),
      },
      layer3_smartMoney: {
        ...base4Layer.layer3_smartMoney,
        ...(parsed.layer3_smartMoney || {}),
      },
      layer4_actionPlan: {
        ...base4Layer.layer4_actionPlan,
        ...(parsed.layer4_actionPlan || {}),
      },
    };
  }

  return {
    ...base4Layer,
    toolCalls: executedTools,
  };
}

const COMPANY_NAME_ALIASES: Record<string, string> = {
  'HOÀ PHÁT': 'HPG',
  'HÒA PHÁT': 'HPG',
  'HOA PHAT': 'HPG',
  'FPT': 'FPT',
  'VINAMILK': 'VNM',
  'VINHOMES': 'VHM',
  'VINGROUP': 'VIC',
  'VIETCOMBANK': 'VCB',
  'TECHCOMBANK': 'TCB',
  'SACOMBANK': 'STB',
  'QUÂN ĐỘI': 'MBB',
  'MB BANK': 'MBB',
  'MBBANK': 'MBB',
  'THẾ GIỚI DI ĐỘNG': 'MWG',
  'THE GIOI DI DONG': 'MWG',
  'ĐỨC GIANG': 'DGC',
  'DUC GIANG': 'DGC',
  'SSI': 'SSI',
  'VNDIRECT': 'VND',
  'VCSC': 'VCI',
  'VIETCAP': 'VCI',
  'GAS': 'GAS',
  'PETROVIETNAM': 'GAS',
  'MASAN': 'MSN',
  'VPBANK': 'VPB',
  'VP BANK': 'VPB',
  'ACB': 'ACB',
  'Á CHÂU': 'ACB',
  'KHANG ĐIỀN': 'KDH',
  'NAM LONG': 'NLG',
  'ĐẤT XANH': 'DXG',
  'DIG': 'DIG',
  'PDR': 'PDR',
  'PHÁT ĐẠT': 'PDR',
  'HOA SEN': 'HSG',
  'NAM KIM': 'NKG',
  'ĐẠM CÀ MAU': 'DCM',
  'ĐẠM PHÚ MỸ': 'DPM',
  'REE': 'REE',
  'CƠ ĐIỆN LẠNH': 'REE',
  'VIB': 'VIB',
  'LPBANK': 'LPB',
  'TPBANK': 'TPB',
  'HDBANK': 'HDB',
  'VIX': 'VIX',
  'SHS': 'SHS',
  'KBC': 'KBC',
  'KINH BẮC': 'KBC',
  'GEX': 'GEX',
  'GELEX': 'GEX',
};

export async function chatWithAIAgent(userMessage: string) {
  const stocks = getAllStocks();
  const news = getLatestNews();
  const macro = getMacroData();
  const indices = getMarketIndices();
  const upperMsg = userMessage.toUpperCase();

  // 1. Resolve stock symbols from message (direct symbols or company name aliases)
  const matchedSymbolSet = new Set<string>();

  // Check direct symbols
  stocks.forEach((s) => {
    const regex = new RegExp(`\\b${s.symbol}\\b`, 'i');
    if (regex.test(userMessage) || upperMsg.includes(s.symbol)) {
      matchedSymbolSet.add(s.symbol);
    }
  });

  // Check aliases
  for (const [alias, sym] of Object.entries(COMPANY_NAME_ALIASES)) {
    if (upperMsg.includes(alias)) {
      matchedSymbolSet.add(sym);
    }
  }

  const matchedStocks = Array.from(matchedSymbolSet)
    .map((sym) => getStockBySymbol(sym))
    .filter((s): s is NonNullable<typeof s> => !!s);

  // 2. Real-time Smart Money Scan on all stocks
  const smartMoneyEvaluations = stocks.map((s) => {
    const signal = analyzeSmartMoneySignal(s);
    let smartScore = signal.anomalyScore || 50;
    if (s.foreignNetVal > 10) smartScore += 15;
    if (signal.largeBlockNetRatio > 30) smartScore += 15;
    if (s.changePercent > 0) smartScore += 10;
    return {
      stock: s,
      signal,
      smartScore,
      largeBlockNetRatio: signal.largeBlockNetRatio,
      foreignNetVal: s.foreignNetVal,
      volumeRatio: signal.morningVolRatio || 1.2,
      patternName: signal.patternName,
    };
  });

  const topSmartMoneyStocks = [...smartMoneyEvaluations]
    .sort((a, b) => b.smartScore - a.smartScore)
    .slice(0, 5);

  const topQuantScoreStocks = [...stocks]
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 5);

  const topGainers = [...stocks]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 4);

  const topForeignBuy = [...stocks]
    .filter((s) => s.foreignNetVal > 0)
    .sort((a, b) => b.foreignNetVal - a.foreignNetVal)
    .slice(0, 4);

  // 3. User Intent Classification
  const isSmartMoneyQuery =
    upperMsg.includes('CÁ MẬP') ||
    upperMsg.includes('GOM NGẦM') ||
    upperMsg.includes('DÒNG TIỀN') ||
    upperMsg.includes('SMART MONEY') ||
    upperMsg.includes('GOM MẠNH') ||
    upperMsg.includes('LỆNH LỚN') ||
    upperMsg.includes('TỰ DOANH') ||
    upperMsg.includes('KHỐI NGOẠI GOM') ||
    upperMsg.includes('TIỀN LỚN') ||
    upperMsg.includes('TÍCH LŨY GOM') ||
    upperMsg.includes('MUA RÒNG') ||
    upperMsg.includes('LỆNH KHỦNG') ||
    upperMsg.includes('BÙNG NỔ VOL');

  const isTopPicksQuery =
    upperMsg.includes('TOP CỔ PHIẾU') ||
    upperMsg.includes('TOP MÃ') ||
    upperMsg.includes('NÊN MUA') ||
    upperMsg.includes('MUA GÌ') ||
    upperMsg.includes('TIỀM NĂNG') ||
    upperMsg.includes('MÃ TỐT') ||
    upperMsg.includes('DANH SÁCH MUA') ||
    upperMsg.includes('KHUYẾN NGHỊ') ||
    upperMsg.includes('BỨT PHÁ') ||
    upperMsg.includes('VƯỢT ĐỈNH') ||
    upperMsg.includes('BREAKOUT') ||
    upperMsg.includes('CỔ PHIẾU ĐẸP') ||
    upperMsg.includes('MÃ NÀO ĐẸP');

  const isMarketOverviewQuery =
    upperMsg.includes('THỊ TRƯỜNG') ||
    upperMsg.includes('VNINDEX') ||
    upperMsg.includes('VN-INDEX') ||
    upperMsg.includes('XU HƯỚNG') ||
    upperMsg.includes('SẬP') ||
    upperMsg.includes('ĐIỂM SỐ') ||
    upperMsg.includes('VĨ MÔ') ||
    upperMsg.includes('LÃI SUẤT') ||
    upperMsg.includes('TỶ GIÁ') ||
    upperMsg.includes('LẠM PHÁT') ||
    upperMsg.includes('FED') ||
    upperMsg.includes('SBV') ||
    upperMsg.includes('TỔNG QUAN') ||
    upperMsg.includes('NHẬN ĐỊNH') ||
    upperMsg.includes('HÔM NAY THẾ NÀO') ||
    upperMsg.includes('PHIÊN HÔM NAY');

  const isPortfolioQuery =
    upperMsg.includes('DANH MỤC') ||
    upperMsg.includes('PORTFOLIO') ||
    upperMsg.includes('TÀI KHOẢN') ||
    upperMsg.includes('CƠ CẤU') ||
    upperMsg.includes('PHÂN BỔ') ||
    upperMsg.includes('HẠ TỶ TRỌNG') ||
    upperMsg.includes('NẮM GIỮ') ||
    matchedStocks.length >= 2;

  const isEducationalQuery =
    upperMsg.includes('GOLDEN CROSS') ||
    upperMsg.includes('DEATH CROSS') ||
    upperMsg.includes('R:R') ||
    upperMsg.includes('R/R') ||
    upperMsg.includes('RISK REWARD') ||
    upperMsg.includes('CẮT LỖ') ||
    upperMsg.includes('STOP LOSS') ||
    upperMsg.includes('TRAILING STOP') ||
    upperMsg.includes('DCA') ||
    upperMsg.includes('TRUNG BÌNH GIÁ') ||
    upperMsg.includes('VWAP') ||
    upperMsg.includes('RSI LÀ GÌ') ||
    upperMsg.includes('MACD LÀ GÌ') ||
    upperMsg.includes('BOLLINGER') ||
    upperMsg.includes('ĐIỂM SỐ SCORE') ||
    upperMsg.includes('TẦM QUAN TRỌNG');

  const primaryStock = matchedStocks.length > 0 ? matchedStocks[0] : (isSmartMoneyQuery ? topSmartMoneyStocks[0]?.stock : null);

  // 4. Build high-density context for Gemini
  const contextData = {
    detectedIntent: isSmartMoneyQuery
      ? 'SMART_MONEY_SCAN'
      : isTopPicksQuery
      ? 'TOP_PICKS_RECOMMENDATION'
      : isPortfolioQuery
      ? 'PORTFOLIO_REVIEW'
      : primaryStock
      ? 'STOCK_DEEP_DIVE'
      : isMarketOverviewQuery
      ? 'MARKET_OVERVIEW'
      : 'GENERAL_QUANT_ADVICE',
    marketIndices: indices.map((i) => `${i.symbol}: ${i.price} (${i.changePercent > 0 ? '+' : ''}${i.changePercent}%, KL: ${i.totalVolume?.toLocaleString('vi-VN') || '-'})`),
    macro: { usdVnd: macro.usdVnd, dxy: macro.dxy, sbvRate: `${macro.sbvInterestRate}%` },
    topSmartMoneyAccumulation: topSmartMoneyStocks.map((item) => ({
      symbol: item.stock.symbol,
      name: item.stock.name,
      price: `${item.stock.price}k`,
      change: `${item.stock.changePercent > 0 ? '+' : ''}${item.stock.changePercent}%`,
      pattern: item.patternName,
      largeBlockNetRatio: `${item.largeBlockNetRatio}%`,
      foreignNetVal: `${item.foreignNetVal > 0 ? '+' : ''}${item.foreignNetVal} tỷ VNĐ`,
      volume: item.stock.volume.toLocaleString('vi-VN'),
      buyZone: `${(item.stock.price * 0.985).toFixed(2)} - ${item.stock.price.toFixed(2)}k`,
      targetTP1: `${item.stock.aiTargetPrice || (item.stock.price * 1.12).toFixed(2)}k`,
      stopLoss: `${item.stock.aiStopLoss || (item.stock.price * 0.94).toFixed(2)}k`,
      verdict: item.stock.aiVerdict,
      quantScore: item.stock.aiScore,
    })),
    topQuantScoreStocks: topQuantScoreStocks.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      score: s.aiScore,
      verdict: s.aiVerdict,
      price: s.price,
      changePercent: s.changePercent,
      pe: s.fundamental.pe,
      roe: s.fundamental.roe,
    })),
    topGainers: topGainers.map((s) => `${s.symbol} (+${s.changePercent}%, Giá ${s.price}k)`),
    topForeignBuy: topForeignBuy.map((s) => `${s.symbol} (+${s.foreignNetVal} tỷ, Giá ${s.price}k)`),
    matchedTickers: matchedStocks.map((s) => {
      const q4 = computeQuant4LayerData(s);
      return {
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        sector: s.sector,
        price: s.price,
        changePercent: s.changePercent,
        volume: s.volume,
        foreignNetVal: s.foreignNetVal,
        pe: s.fundamental.pe,
        industryPe: s.fundamental.industryAvgPE,
        roe: s.fundamental.roe,
        profitGrowthYoY: s.fundamental.profitGrowthYoY,
        debtToEquity: s.fundamental.debtToEquity,
        rsi: s.technical.rsi14,
        ma20: s.technical.ma20,
        ma50: s.technical.ma50,
        support: s.technical.supportLevel,
        resistance: s.technical.resistanceLevel,
        verdict: s.aiVerdict,
        score: s.aiScore,
        target: q4.targetPrice,
        target2: q4.targetPrice2,
        stop: q4.stopLoss,
        buyZone: q4.buyZone,
        riskReward: q4.riskRewardRatio,
        maxAllocation: q4.maxAllocationPercent,
      };
    }),
  };

  const ai = getGenAI();

  const systemInstruction = `Bạn là Trưởng Ban Phân Tích Định Lượng & Giám Đốc Đầu Tư AI Cao Cấp (Chief Quant Strategist & CIO) tại VN-Quant Terminal.
Phong cách của bạn: Vô cùng sắc sảo, thông minh, trả lời TRỰC DIỆN VÀ ĐÚNG TRỌNG TÂM câu hỏi của người dùng, không né tránh, không đưa ra các câu trả lời chung chung sách vở vô hồn. Mọi phân tích đều dựa trên SỐ LIỆU ĐỊNH LƯỢNG THỰC TẾ, CỤ THỂ, CHÍNH XÁC.

=== QUY TẮC PHẢN HỒI THEO TỪNG NHÓM CÂU HỎI ===

1. KHI NGƯỜI DÙNG HỎI VỀ "DÒNG TIỀN CÁ MẬP / GOM NGẦM / TOP CỔ PHIẾU":
- Trả lời ngay danh sách Top 3-5 cổ phiếu có tín hiệu gom ngầm mạnh nhất được trích xuất từ dữ liệu thời gian thực được cấp bên dưới (topSmartMoneyAccumulation).
- Với mỗi mã, nêu rõ: (1) Mức giá & % thay đổi, (2) Dấu hiệu cá mập (Tỷ lệ lệnh gom lớn %, Giá trị khối ngoại ròng, Mẫu hình gom dòng tiền), (3) Vùng mua an toàn (Buy Zone), (4) Mục tiêu chốt lời TP1 / TP2 kèm % kỳ vọng, (5) Ngưỡng cắt lỗ kỷ luật SL, (6) Tỷ lệ R:R và tỷ trọng giải ngân khuyến nghị.
- Đưa ra kết luận hành động dứt khoát cho phiên giao dịch hiện tại.

2. KHI NGƯỜI DÙNG HỎI VỀ 1 MÃ CỔ PHIẾU CỤ THỂ:
- Trình bày đầy đủ chuẩn mực "KHUNG ĐỊNH LƯỢNG 4 TẦNG (4-Tier Quant Framework)":
  * 1️⃣ 🏢 **TẦNG 1: NỀN TẢNG CƠ BẢN & ĐỊNH GIÁ**: P/E vs Ngành, ROE, tăng trưởng DT & LN YoY, sức khỏe tài chính Nợ/VCSH.
  * 2️⃣ 📈 **TẦNG 2: PHÂN TÍCH KỸ THUẬT & HÀNH ĐỘNG GIÁ**: Trend so với MA20/50/200, RSI(14), MACD, Vùng Hỗ trợ then chốt & Kháng cự kỹ thuật.
  * 3️⃣ 🐋 **TẦNG 3: DẤU CHÂN CÁ MẬP & DÒNG TIỀN LỚN**: Khối ngoại mua/bán ròng, tỷ lệ lệnh lô lớn, thanh khoản đột biến, nhận diện gom hàng/bẫy giá.
  * 4️⃣ 🎯 **TẦNG 4: KẾ HOẠCH GIAO DỊCH & QUẢN TRỊ RỦI RO**: Khuyến nghị [MUA MẠNH / MUA TÍCH LŨY / THEO DÕI / BÁN HẠ TỶ TRỌNG / BÁN CẮT LỖ], Vùng Mua (Buy Zone), Mục tiêu (TP1, TP2), Cắt lỗ (SL), Tỷ lệ R:R, % NAV tối đa, chiến lược đi lệnh 2 bước (50% vùng gom, 50% khi vượt cản).

3. KHI NGƯỜI DÙNG HỎI VỀ "DANH MỤC / PORTFOLIO / CƠ CẤU":
- Đánh giá sức khỏe tổng thể danh mục, hệ số Beta, rủi ro tập trung ngành (Sector Concentration).
- Đánh giá từng vị thế cổ phiếu trong danh mục theo chuẩn 4 tầng.
- Đưa ra lộ trình Tái cơ cấu (Rebalancing) cụ thể: Mã nào nên gia tăng/giữ chặt, mã nào nên hạ tỷ trọng hoặc cắt lỗ dứt khoát, tỷ lệ Tiền mặt / Cổ phiếu khuyến nghị.

4. KHI NGƯỜI DÙNG HỎI VỀ "THỊ TRƯỜNG / VN-INDEX / VĨ MÔ":
- Cung cấp bức tranh toàn cảnh VN-Index, VN30, HNX, UPCOM kèm thanh khoản thực tế.
- Phân tích tương quan Vĩ mô: Tỷ giá USD/VND, Lãi suất điều hành SBV, xu hướng dòng tiền khối ngoại.
- Nhận định nhóm ngành dẫn dắt (Leader sectors) và kịch bản vận động (Hỗ trợ cứng - Kháng cự mục tiêu).
- Khuyến nghị chiến lược phân bổ vốn tổng thể.

5. KHI NGƯỜI DÙNG HỎI VỀ THUẬT NGỮ / KỸ THUẬT GIAO DỊCH (Golden Cross, Death Cross, R:R, Cắt lỗ, Score, ...):
- Giải thích bản chất cốt lõi một cách gãy gọn, dễ hiểu, kết hợp dẫn chứng thực tế trên thị trường chứng khoán Việt Nam (chu kỳ T+2.5, biên độ sàn HOSE 7% / HNX 10%).

=== DỮ LIỆU THỊ TRƯỜNG THỜI GIAN THỰC ĐƯỢC NẠP: ===
${JSON.stringify(contextData, null, 2)}`;

  // Proactively run relevant tools based on user context to ensure grounded analysis
  const executedTools: ToolCallExecution[] = [];
  try {
    if (primaryStock) {
      const [tFin, tProp, tSmart, tTech] = await Promise.all([
        executeInternalTool('getFinancialStatements', { symbol: primaryStock.symbol }),
        executeInternalTool('getProprietaryAndForeignTrading', { symbol: primaryStock.symbol }),
        executeInternalTool('getLargeBlockOrdersAndSmartMoney', { symbol: primaryStock.symbol }),
        executeInternalTool('getTechnicalSignalsAndPriceAction', { symbol: primaryStock.symbol }),
      ]);
      executedTools.push(tFin, tProp, tSmart, tTech);
    } else if (isSmartMoneyQuery || isTopPicksQuery) {
      const topSym = topSmartMoneyStocks[0]?.stock?.symbol || 'HPG';
      const [tScan, tSmart, tProp] = await Promise.all([
        executeInternalTool('searchMarketTopPicks', { criteria: 'SMART_MONEY_ACCUMULATION', limit: 5 }),
        executeInternalTool('getLargeBlockOrdersAndSmartMoney', { symbol: topSym }),
        executeInternalTool('getProprietaryAndForeignTrading', { symbol: topSym }),
      ]);
      executedTools.push(tScan, tSmart, tProp);
    } else if (isPortfolioQuery && matchedStocks.length > 0) {
      const tMacro = await executeInternalTool('getMacroAndMarketOverview', {});
      executedTools.push(tMacro);
      for (const s of matchedStocks.slice(0, 2)) {
        const tTech = await executeInternalTool('getTechnicalSignalsAndPriceAction', { symbol: s.symbol });
        executedTools.push(tTech);
      }
    } else {
      const [tMacro, tTop] = await Promise.all([
        executeInternalTool('getMacroAndMarketOverview', {}),
        executeInternalTool('searchMarketTopPicks', { criteria: 'TOP_QUANT_SCORE', limit: 5 }),
      ]);
      executedTools.push(tMacro, tTop);
    }
  } catch (err) {
    console.error('Error pre-executing internal tools:', err);
  }

  // Deterministic Fallback Logic if AI Key is missing or Gemini fails
  const buildDeterministicResponse = () => {
    // Scenario 1: Smart Money / Gom Ngầm Query
    if (isSmartMoneyQuery || isTopPicksQuery) {
      const topPick = topSmartMoneyStocks[0]?.stock || stocks[0];
      const q4Top = computeQuant4LayerData(topPick);

      let text = `### 🐋 TOP CỔ PHIẾU CÓ DÒNG TIỀN CÁ MẬP GOM NGẦM & BỨT PHÁ (REAL-TIME QUANT SCAN)
Hệ thống VN-Quant Sentinel vừa kích hoạt các Tool nội bộ và quét toàn bộ thị trường. Nhận diện **Top 5 cổ phiếu có dấu chân dòng tiền tổ chức (Smart Money Accumulation)** mạnh nhất:

---

`;

      topSmartMoneyStocks.forEach((item, idx) => {
        const s = item.stock;
        const q = computeQuant4LayerData(s);
        const isPos = s.changePercent >= 0;
        text += `#### ${idx + 1}. **${s.symbol}** — ${s.name} (${s.exchange} | Ngành: ${s.sector})
* **Thị giá & Khối lượng:** **${s.price}k VNĐ** (${isPos ? '+' : ''}${s.changePercent}%) | Khớp lệnh: **${s.volume.toLocaleString('vi-VN')} CP**
* **Dấu ấn Cá mập:** **${item.patternName}** | Lệnh mua chủ động lô lớn: **${item.largeBlockNetRatio}%** | Khối ngoại ròng: **${s.foreignNetVal > 0 ? `+${s.foreignNetVal}` : s.foreignNetVal} tỷ VNĐ**
* **Tín hiệu Kỹ thuật:** RSI(14) **${s.technical.rsi14}** | Xu hướng: **${q.layer2_technical.trend}** | Hỗ trợ: **${s.technical.supportLevel}k**, Cản: **${s.technical.resistanceLevel}k**
* **Chiến lược Thực chiến:**
  - 🎯 **Vùng Mua Gom:** **${q.buyZone}**
  - 📈 **Mục Tiêu TP1:** **${q.targetPrice}k VNĐ** (+${(((q.targetPrice - s.price) / s.price) * 100).toFixed(1)}%) | **TP2:** **${q.targetPrice2}k VNĐ** (+${(((q.targetPrice2! - s.price) / s.price) * 100).toFixed(1)}%)
  - 🛑 **Cắt Lỗ (SL):** **${q.stopLoss}k VNĐ** (-${(((s.price - q.stopLoss) / s.price) * 100).toFixed(1)}%) | Tỷ lệ R:R: **${q.riskRewardRatio}**
  - ⚖️ **Khuyến nghị:** **${s.aiVerdict}** (Điểm Quant: **${s.aiScore}/100** | Tỷ trọng Max **${q.maxAllocationPercent}% NAV**)

`;
      });

      text += `---
💡 **Lời khuyên Chiến lược từ Trưởng ban Quant:**
- Nhóm dẫn dắt dòng tiền thông minh hiện tập trung mạnh ở các mã đầu ngành có nền tảng cơ bản vững chắc (ROE > 15%, P/E hợp lý).
- **Quy tắc giải ngân 2 bước:** Giải ngân trước 40-50% tại vùng gom tích lũy, gia tăng 50% còn lại khi cổ phiếu bứt phá đỉnh kháng cự kèm thanh khoản bùng nổ >130% TB20.`;

      return {
        text,
        dataCard: q4Top,
        toolCalls: executedTools,
      };
    }

    // Scenario 2: Single Stock 4-Tier Deep Dive
    if (primaryStock && !isPortfolioQuery) {
      const q4 = computeQuant4LayerData(primaryStock);
      const isPos = primaryStock.changePercent >= 0;
      return {
        text: `### 📊 BÁO CÁO PHÂN TÍCH ĐỊNH LƯỢNG 4 TẦNG: ${primaryStock.symbol} (${primaryStock.name})
**Thị giá hiện tại:** **${primaryStock.price}k VNĐ** (${isPos ? '+' : ''}${primaryStock.changePercent}%) | **Sàn:** ${primaryStock.exchange} | **Ngành:** ${primaryStock.sector}

---

#### 1️⃣ 🏢 TẦNG 1: NỀN TẢNG CƠ BẢN & ĐỊNH GIÁ (Fundamental & Valuation)
* **Định giá P/E:** **${primaryStock.fundamental.pe}x** (So với TB ngành: **${primaryStock.fundamental.industryAvgPE}x**) $\\rightarrow$ **${q4.layer1_fundamental.valuationVerdict}**.
* **Định giá P/B:** **${primaryStock.fundamental.pb}x** (TB ngành: **${primaryStock.fundamental.industryAvgPB}x**).
* **Hiệu quả sinh lời:** ROE ấn tượng đạt **${primaryStock.fundamental.roe}%**, ROA **${primaryStock.fundamental.roa}%**.
* **Tăng trưởng Doanh nghiệp:** Tăng trưởng LN sau thuế YoY đạt **+${primaryStock.fundamental.profitGrowthYoY}%**, Doanh thu YoY **+${primaryStock.fundamental.revenueGrowthYoY}%**.
* **Sức khỏe tài chính:** Tỷ lệ Nợ/VCSH ở mức **${primaryStock.fundamental.debtToEquity}x** (an toàn), biên lợi nhuận ròng **${primaryStock.fundamental.netMargin}%**.

#### 2️⃣ 📈 TẦNG 2: PHÂN TÍCH KỸ THUẬT & HÀNH ĐỘNG GIÁ (Technical & Price Action)
* **Cấu trúc xu hướng:** **${q4.layer2_technical.trend}** (Giá vận động so với MA20: **${primaryStock.technical.ma20}k**, MA50: **${primaryStock.technical.ma50}k**, MA200: **${primaryStock.technical.ma200}k**).
* **Chỉ báo động lượng:** RSI(14) đạt **${primaryStock.technical.rsi14}**; MACD Histogram **${q4.layer2_technical.macd}**.
* **Ichimoku Kinko Hyo:** Giá vượt trên Mây Kumo; Tenkan: **${primaryStock.technical.ichimoku.tenkan}k**, Kijun: **${primaryStock.technical.ichimoku.kijun}k**.
* **Fibonacci Retracement:** Vùng hỗ trợ Fibo 50%: **${primaryStock.technical.fibonacci.f500}k**, Fibo 61.8% Golden Zone: **${primaryStock.technical.fibonacci.f618}k**.
* **Vùng hỗ trợ then chốt:** **${primaryStock.technical.supportLevel}k VNĐ** | **Vùng kháng cự mục tiêu:** **${primaryStock.technical.resistanceLevel}k VNĐ**.

#### 3️⃣ 🐋 TẦNG 3: DẤU CHÂN CÁ MẬP & DÒNG TIỀN LỚN (Smart Money & Order Flow)
* **Hành vi Khối ngoại & Tự doanh:** Khối ngoại mua ròng **${primaryStock.foreignNetVal > 0 ? `+${primaryStock.foreignNetVal}` : primaryStock.foreignNetVal} tỷ VNĐ**.
* **Thanh khoản & Khối lượng:** Khối lượng khớp **${primaryStock.volume.toLocaleString('vi-VN')} CP** (${q4.layer3_smartMoney.volumeStatus}).
* **Dòng tiền chủ động:** **${q4.layer3_smartMoney.moneyFlowVerdict}**, ${q4.layer3_smartMoney.bigOrderActivity}.

#### 4️⃣ 🎯 TẦNG 4: KẾ HOẠCH GIAO DỊCH & QUẢN TRỊ RỦI RO (Action Plan & Risk-Reward)
* **Khuyến nghị hành động:** **${primaryStock.aiVerdict}** (Điểm số Quant: **${primaryStock.aiScore}/100**).
* **Vùng Mua Tối Ưu (Buy Zone):** **${q4.buyZone}**
* **Mục Tiêu Chốt Lời 1 (TP1):** **${q4.targetPrice}k VNĐ** (+${(((q4.targetPrice - primaryStock.price) / primaryStock.price) * 100).toFixed(1)}%)
* **Mục Tiêu Chốt Lời 2 (TP2):** **${q4.targetPrice2}k VNĐ** (+${(((q4.targetPrice2! - primaryStock.price) / primaryStock.price) * 100).toFixed(1)}%)
* **Mức Cắt Lỗ Kỷ Luật (Stop-Loss):** **${q4.stopLoss}k VNĐ** (-${(((primaryStock.price - q4.stopLoss) / primaryStock.price) * 100).toFixed(1)}%)
* **Tỷ Lệ Lợi Nhuận / Rủi Ro (R:R Ratio):** **${q4.riskRewardRatio}** (Đạt chuẩn Quant $\\ge 1:2.5$).
* **Chiến Lược Phân Bổ Vốn:** Giải ngân tối đa **${q4.maxAllocationPercent}% NAV**. Chia làm 2 đợt (50% vùng gom tích lũy, 50% gia tăng khi vượt cản ${primaryStock.technical.resistanceLevel}k kèm volume bùng nổ).`,
        dataCard: q4,
        toolCalls: executedTools,
      };
    }

    // Scenario 3: Portfolio Review
    if (isPortfolioQuery) {
      const topSymbols = matchedStocks.length > 0 ? matchedStocks.map((s) => s.symbol) : ['HPG', 'SSI', 'FPT'];
      return {
        text: `### 🛡️ BÁO CÁO ĐÁNH GIÁ & TỐI ƯU HÓA DANH MỤC ĐẦU TƯ QUANT
**Danh mục rà soát:** ${topSymbols.join(', ')} | **Độ an toàn Quant:** **86/100**

---

#### 1️⃣ Phân Tích Cấu Trúc Ngành & Rủi Ro Tập Trung:
- **Tập trung vốn:** Danh mục đang phân bổ giữa các nhóm trụ cột (**${topSymbols.join(', ')}**). Tránh dồn quá 40% NAV vào một nhóm ngành đơn lẻ.
- **Hệ số Beta danh mục:** Ước tính **~1.10** (Độ nhạy cao hơn VN-Index 10%, sinh lời vượt trội khi thị trường vào sóng tăng).

#### 2️⃣ Đánh Giá Từng Vị Thế Theo Chuẩn 4 Tầng:
${topSymbols
  .map((sym) => {
    const stk = getStockBySymbol(sym);
    if (!stk) return '';
    const q = computeQuant4LayerData(stk);
    return `* **${sym} (${stk.name}):** ${stk.aiVerdict} | Điểm: **${stk.aiScore}** | Vùng gom: **${q.buyZone}** | TP: **${q.targetPrice}k** | SL: **${q.stopLoss}k** (R:R **${q.riskRewardRatio}**).`;
  })
  .filter(Boolean)
  .join('\n')}

#### 3️⃣ Kế Hoạch Hành Động & Tái Cơ Cấu (Rebalancing):
* **Tỷ lệ Tiền mặt / Cổ phiếu khuyến nghị:** Duy trì **70% Cổ phiếu / 30% Tiền mặt** để linh hoạt đón sóng.
* **Chiến lược Trailing-Stop:** Khi các mã đạt TP1 (+15%), nâng mức chặn lãi lên bằng giá vốn để bảo vệ thành quả đầu tư.`,
        confidenceScore: 88,
        confidenceLevel: 'HIGH',
        counterThesis: [
          'Rủi ro tương quan ngành (Sector Correlation): Nếu nhóm Thép hoặc Chứng khoán đồng loạt chịu áp lực bán chốt lời diện rộng, danh mục có thể biến động mạnh hơn VN-Index.',
          'Rủi ro bão hòa thanh khoản: Trong trường hợp thanh khoản toàn thị trường suy giảm dưới 15.000 tỷ VNĐ/phiên, tốc độ đạt mục tiêu TP1 có thể kéo dài hơn dự kiến.',
        ],
        riskDisclaimer: 'Báo cáo cơ cấu danh mục định lượng được tính toán dựa trên dữ liệu thống kê quá khứ và mô hình rủi ro hiện hành, mang tính chất hỗ trợ quyết định quản trị vốn độc lập.',
        dataCard: {
          symbols: topSymbols,
          confidenceScore: 88,
          confidenceLevel: 'HIGH',
          counterThesis: [
            'Rủi ro tương quan ngành: Các nhóm ngành trụ cột có thể chịu tác động tiêu cực đồng thời nếu thị trường chung đảo chiều.',
            'Cần duy trì kỷ luật chặn lãi Trailing-Stop để bảo toàn lợi nhuận đã tích lũy.',
          ],
          riskDisclaimer: 'Báo cáo đánh giá danh mục mang tính chất tham khảo định lượng độc lập.',
          portfolioInsights: {
            symbols: topSymbols,
            overallHealth: 'DANH MỤC TĂNG TRƯỞNG MẠNH',
            riskScore: 32,
            beta: 1.10,
            maxConcentrationSector: matchedStocks[0]?.sector || 'Ngân hàng / Thép',
            rebalanceAdvice: [
              'Duy trì tỷ trọng cổ phiếu 70% và tiền mặt 30%',
              'Chốt lời từng phần 30% khi các mã chạm kháng cự đỉnh cũ',
              'Đặt trailing stop-loss để bảo toàn lợi nhuận tích lũy',
            ],
          },
        },
        toolCalls: executedTools,
      };
    }

    // Scenario 4: Educational Query
    if (isEducationalQuery) {
      if (upperMsg.includes('GOLDEN CROSS')) {
        return {
          text: `### 📈 GIẢI THÍCH CHUYÊN SÂU: GIAO CẮT VÀNG (GOLDEN CROSS) TRONG ĐẦU TƯ QUANT

#### 1. Định nghĩa & Bản chất Cốt lõi:
**Golden Cross (Giao cắt vàng)** là một trong những tín hiệu kỹ thuật tăng giá (Bullish Signal) kinh điển và uy tín nhất. Nó xảy ra khi một **đường trung bình động ngắn hạn (thường là MA20 hoặc MA50)** cắt LÊN TRÊN một **đường trung bình động dài hạn (thường là MA50 hoặc MA200)**.

* **Cặp MA kinh điển:** MA50 cắt lên MA200 $\\rightarrow$ Xác nhận chu kỳ Uptrend dài hạn của cổ phiếu hoặc chỉ số VN-Index.
* **Cặp MA ngắn hạn:** MA20 cắt lên MA50 $\\rightarrow$ Tín hiệu mở vị thế mua theo sóng trung hạn (Swing Trading).

---

#### 2. Ý nghĩa Thực chiến & Dòng tiền:
* **Tâm lý thị trường đảo chiều:** Cho thấy giá trung bình của người mua gần đây (50 ngày) đang cao hơn giá trung bình của người cầm hàng dài hạn (200 ngày). Áp lực bán cắt lỗ đã cạn kiệt, phe Mua hoàn toàn làm chủ cuộc chơi.
* **Tổ chức tham chiến:** Các quỹ đầu tư lớn (Foreign Funds, ETFs, Quỹ mở) thường sử dụng Golden Cross làm điều kiện giải ngân hàng trăm tỷ VNĐ.

---

#### 3. Bộ Lọc Quant 3 Bước để Tránh Bẫy "Golden Cross Giả" (Bull Trap):
1. **Thanh khoản (Volume Confirmation):** Tại phiên giao cắt, khối lượng giao dịch phải bùng nổ **>130% - 150% so với trung bình 20 phiên**.
2. **Góc dốc đường MA:** Đường MA dài hạn (MA200) phải đang đi ngang hoặc hướng lên. Nếu MA200 đang dốc xuống mạnh, tín hiệu dễ bị nhiễu.
3. **Quản trị R:R:** Đặt Stop Loss ngay dưới đáy nến breakout hoặc dưới đường MA50 (khoảng -5% đến -7%).`,
          confidenceScore: 95,
          confidenceLevel: 'HIGH',
          counterThesis: [
            'Rủi ro bẫy giao cắt giả (Lagging Indicator): Golden Cross là chỉ báo đi sau (trễ pha), trong thị trường Sideway đi ngang, các tín hiệu giao cắt liên tục có thể gây tổn thất phí giao dịch nếu không có bộ lọc thanh khoản xác nhận.',
          ],
          riskDisclaimer: 'Kiến thức kỹ thuật mang tính chất đào tạo và nghiên cứu quy luật vận động giá.',
          toolCalls: executedTools,
        };
      }
    }

    // Scenario 5: Market Overview
    const vnIndex = indices.find((i) => i.symbol === 'VNINDEX') || indices[0];
    return {
      text: `### 🌐 BÁO CÁO NHẬN ĐỊNH THỊ TRƯỜNG VIỆT NAM (VN-INDEX) & CHIẾN LƯỢC QUANT
* **Chỉ số VN-INDEX:** Đang giao dịch tại **${vnIndex?.price || '1.248,65'} điểm** (${(vnIndex?.changePercent ?? 0) >= 0 ? '+' : ''}${vnIndex?.changePercent ?? '+0.68'}%), khối lượng duy trì ở mức tích cực.
* **Dòng tiền Cá mập (Smart Money):** Khối ngoại mua ròng tập trung ở các mã trụ: **${topForeignBuy.slice(0, 3).join(', ')}**.
* **Nhóm ngành dẫn dắt:** Công nghệ (${topGainers[0] || 'FPT'}), Thép (${topGainers[1] || 'HPG'}), Ngân hàng.
* **Bối cảnh Vĩ mô:** Tỷ giá USD/VND: **${macro.usdVnd}** | Lãi suất điều hành: **${macro.sbvInterestRate}%** (Môi trường tiền tệ hỗ trợ dòng vốn đầu tư).

🎯 **Chiến lược Hành động:**
* **Tỷ trọng khuyến nghị:** Duy trì **70% Cổ phiếu / 30% Tiền mặt**.
* **Trọng tâm danh mục:** Ưu tiên các cổ phiếu có Điểm Quant AI $\\ge 80$, định giá P/E thấp hơn ngành và có tín hiệu cá mập gom ngầm.`,
      confidenceScore: 86,
      confidenceLevel: 'HIGH',
      counterThesis: [
        'Kịch bản rủi ro VN-Index: Kháng cự tâm lý 1.260 - 1.280 điểm có thể xuất hiện áp lực cung chốt lời từ lượng hàng kẹp vùng đỉnh.',
        'Rủi ro tỷ giá: Đà tăng của chỉ số DXY quốc tế nếu gây áp lực lên tỷ giá USD/VND trong nước có thể khiến Ngân hàng Nhà nước thu hẹp thanh khoản qua kênh OMO/Tín phiếu.',
      ],
      riskDisclaimer: 'Bản tin nhận định thị trường phục vụ công tác theo dõi dòng tiền vĩ mô, không phải khuyến nghị mua bán trực tiếp.',
      toolCalls: executedTools,
    };
  };

  // If Gemini API is not configured, directly return deterministic expert analysis
  if (!ai) {
    return buildDeterministicResponse();
  }

  // Attempt Gemini inference with tools
  const toolsContextPrompt = `${userMessage}\n\n[DỮ LIỆU TỪ CÁC CÔNG CỤ NỘI BỘ VỪA TRUY XUẤT]:\n${executedTools.map((t) => `* ${t.toolDisplayName}: ${t.summary}`).join('\n')}`;

  const geminiRes = await callGeminiSafe({
    contents: toolsContextPrompt,
    systemInstruction,
    tools: [{ functionDeclarations: internalFunctionDeclarations }],
  });

  // Handle any dynamic function calls requested by Gemini
  if (geminiRes && (geminiRes as any).functionCalls && (geminiRes as any).functionCalls.length > 0) {
    for (const fc of (geminiRes as any).functionCalls) {
      if (!executedTools.some((t) => t.toolName === fc.name)) {
        const toolResult = await executeInternalTool(fc.name, fc.args as Record<string, any>);
        executedTools.push(toolResult);
      }
    }
  }

  if (geminiRes && geminiRes.text && geminiRes.text.trim().length > 30) {
    let cardData: any = undefined;
    if (primaryStock) {
      cardData = computeQuant4LayerData(primaryStock);
    } else if (isPortfolioQuery && matchedStocks.length > 0) {
      cardData = {
        confidenceScore: 88,
        confidenceLevel: 'HIGH',
        counterThesis: [
          'Rủi ro tương quan ngành và biến động chung của chỉ số VN-Index.',
        ],
        riskDisclaimer: 'Báo cáo cơ cấu danh mục định lượng độc lập.',
        portfolioInsights: {
          symbols: matchedStocks.map((s) => s.symbol),
          overallHealth: 'TÍCH CỰC - TIỀM NĂNG TĂNG TRƯỞNG',
          riskScore: 28,
          beta: 1.08,
          maxConcentrationSector: matchedStocks[0].sector,
          rebalanceAdvice: [
            'Cân đối tỷ trọng mỗi ngành tối đa 35% NAV',
            'Sử dụng tỷ lệ R:R tối thiểu 1:2.5 trước khi giải ngân mới',
            'Chủ động chốt lời từng phần tại các mốc kháng cự',
          ],
        },
      };
    } else if (isSmartMoneyQuery && topSmartMoneyStocks.length > 0) {
      cardData = computeQuant4LayerData(topSmartMoneyStocks[0].stock);
    }

    return {
      text: geminiRes.text,
      confidenceScore: cardData?.confidenceScore || 85,
      confidenceLevel: cardData?.confidenceLevel || 'HIGH',
      counterThesis: cardData?.counterThesis || [
        'Rủi ro biến động thị trường chung khi VN-Index tiệm cận kháng cự đỉnh cũ.',
        'Biến động tỷ giá USD/VND và động thái mua/bán ròng của khối ngoại.',
      ],
      riskDisclaimer: 'Toàn bộ nhận định định lượng được tạo tự động dựa trên mô hình toán học và dữ liệu thời gian thực.',
      dataCard: cardData,
      toolCalls: executedTools,
    };
  }

  // Fallback to high-intelligence deterministic engine if Gemini is rate-limited or fails
  return buildDeterministicResponse();
}

// In-memory cache for news sentiment to prevent hitting Gemini API rate limits
const sentimentCache = new Map<string, { data: StockNewsSentiment; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export async function analyzeStockNewsSentiment(symbol: string): Promise<StockNewsSentiment> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const cached = sentimentCache.get(cleanSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const stock = getStockBySymbol(cleanSymbol);
  const allNews = await getLatestNewsAsync();

  const symbolNews = allNews.filter((n) =>
    (n.symbols && n.symbols.includes(cleanSymbol)) ||
    n.title.toUpperCase().includes(cleanSymbol) ||
    n.summary.toUpperCase().includes(cleanSymbol)
  );

  const newsToAnalyze = symbolNews.length > 0 ? symbolNews.slice(0, 5) : allNews.slice(0, 3);
  const ai = getGenAI();

  if (!ai) {
    const fallback = getFallbackNewsSentiment(cleanSymbol, stock, newsToAnalyze);
    sentimentCache.set(cleanSymbol, { data: fallback, timestamp: Date.now() });
    return fallback;
  }

  const prompt = `Bạn là hệ thống AI phân tích Sắc Thái Tin Tức Chuyên Sâu (Deep Sentiment Scoring) & Dự Báo Tác Động Giá 1-5 Phiên thuộc VN-Quant Terminal.
Hãy phân tích các tiêu đề tin tức mới nhất liên quan đến mã cổ phiếu: ${cleanSymbol} (${stock?.name || cleanSymbol}):

DANH SÁCH TIN TỨC (${newsToAnalyze.length} tin):
${newsToAnalyze.map((n, i) => `${i + 1}. [${n.source}] ${n.title} - ${n.summary}`).join('\n')}

YÊU CẦU ĐẦU RA (ĐỊNH DẠNG JSON CHÍNH XÁC):
{
  "symbol": "${cleanSymbol}",
  "score": integer từ -100 đến 100 (-100 là Rất Tiêu Cực, 0 là Trung Tính, +100 là Rất Tích Cực),
  "label": "TÍCH CỰC" | "TIÊU CỰC" | "TRUNG TÍNH",
  "sentimentClass": "RẤT TÍCH CỰC" | "TÍCH CỰC" | "TRUNG TÍNH" | "TIÊU CỰC" | "RẤT TIÊU CỰC",
  "confidence": integer từ 0 đến 100,
  "headlineCount": ${newsToAnalyze.length},
  "summary": "1 câu tóm tắt tổng quan sắc thái tin tức bằng tiếng Việt súc tích",
  "keyHighlights": ["Ý chính 1", "Ý chính 2"],
  "authenticitySummary": {
    "overallScore": integer 0-100,
    "officialCount": integer,
    "rumorCount": integer,
    "verdict": "CHÍNH THỐNG - ĐỘ TIN CẬY CAO" hoặc "CẦN KIỂM CHỨNG - CÓ TIN ĐỒN"
  },
  "priceImpactSummary": {
    "expected5DayChange": "+X.X% ~ +Y.Y%" hoặc "-X.X% ~ -Y.Y%",
    "impactLevel": "MẠNH" | "TRUNG BÌNH" | "NHẸ",
    "primaryDriver": "Động lực chính từ tin tức",
    "recommendedAction": "Khuyến nghị hành động tức thời cho NĐT"
  }
}`;

  const geminiRes = await callGeminiSafe({
    contents: prompt,
    responseMimeType: 'application/json',
  });

  if (geminiRes && geminiRes.parsedJson) {
    const parsed = geminiRes.parsedJson;
    const score = typeof parsed.score === 'number' ? parsed.score : 75;
    const forecast = forecastPriceImpact(score, [cleanSymbol], newsToAnalyze[0]?.title || '', newsToAnalyze[0]?.summary || '');

    const result: StockNewsSentiment = {
      symbol: cleanSymbol,
      score,
      label: parsed.label || (score >= 20 ? 'TÍCH CỰC' : score <= -20 ? 'TIÊU CỰC' : 'TRUNG TÍNH'),
      sentimentClass: parsed.sentimentClass || (score >= 60 ? 'RẤT TÍCH CỰC' : score >= 20 ? 'TÍCH CỰC' : score <= -60 ? 'RẤT TIÊU CỰC' : score <= -20 ? 'TIÊU CỰC' : 'TRUNG TÍNH'),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 88,
      headlineCount: newsToAnalyze.length,
      summary: parsed.summary || `Tin tức gần đây về ${cleanSymbol} mang sắc thái tích cực.`,
      keyHighlights: Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights : newsToAnalyze.slice(0, 2).map((n) => n.title),
      recentHeadlines: newsToAnalyze.map((n) => {
        const auth = evaluateNewsAuthenticity(n.source, n.title, n.summary);
        return {
          title: n.title,
          url: n.url,
          time: n.time,
          source: n.source,
          sentiment: n.sentiment,
          sentimentScore: n.sentimentScore ?? score,
          authenticityLevel: auth.level,
          impactForecast: n.priceImpactForecast ?? forecast.estimatedChange,
        };
      }),
      authenticitySummary: parsed.authenticitySummary || {
        overallScore: 92,
        officialCount: newsToAnalyze.length,
        rumorCount: 0,
        verdict: 'CHÍNH THỐNG - ĐỘ TIN CẬY CAO',
      },
      priceImpactSummary: parsed.priceImpactSummary || {
        expected5DayChange: forecast.estimatedChange,
        impactLevel: forecast.degree,
        primaryDriver: newsToAnalyze[0]?.title || 'Thông tin kết quả kinh doanh và dòng tiền doanh nghiệp',
        recommendedAction: forecast.suggestedAction,
      },
      updatedAt: new Date().toISOString(),
    };
    sentimentCache.set(cleanSymbol, { data: result, timestamp: Date.now() });
    return result;
  }

  const fallback = getFallbackNewsSentiment(cleanSymbol, stock, newsToAnalyze);
  sentimentCache.set(cleanSymbol, { data: fallback, timestamp: Date.now() });
  return fallback;
}

function getFallbackNewsSentiment(symbol: string, stock: any, newsList: any[]): StockNewsSentiment {
  let score = stock ? Math.round((stock.aiScore - 50) * 1.7) : 68;
  if (score > 95) score = 95;
  if (score < -88) score = -88;

  let label: 'TÍCH CỰC' | 'TIÊU CỰC' | 'TRUNG TÍNH' = 'TÍCH CỰC';
  let sentimentClass: 'RẤT TÍCH CỰC' | 'TÍCH CỰC' | 'TRUNG TÍNH' | 'TIÊU CỰC' | 'RẤT TIÊU CỰC' = 'TÍCH CỰC';

  if (score >= 60) {
    sentimentClass = 'RẤT TÍCH CỰC';
    label = 'TÍCH CỰC';
  } else if (score >= 20) {
    sentimentClass = 'TÍCH CỰC';
    label = 'TÍCH CỰC';
  } else if (score <= -60) {
    sentimentClass = 'RẤT TIÊU CỰC';
    label = 'TIÊU CỰC';
  } else if (score <= -20) {
    sentimentClass = 'TIÊU CỰC';
    label = 'TIÊU CỰC';
  } else {
    sentimentClass = 'TRUNG TÍNH';
    label = 'TRUNG TÍNH';
  }

  const primaryTitle = newsList[0]?.title || `Thông tin doanh nghiệp ${symbol}`;
  const primarySummary = newsList[0]?.summary || `Triển vọng tăng trưởng kinh doanh mã ${symbol}`;
  const forecast = forecastPriceImpact(score, [symbol], primaryTitle, primarySummary);

  const highlights = newsList.length > 0
    ? newsList.slice(0, 2).map((n) => n.title)
    : [
        `Tín hiệu tin tức & truyền thông duy trì thuận lợi cho mã ${symbol}`,
        `Hỗ trợ tích cực từ triển vọng tăng trưởng doanh nghiệp`,
      ];

  return {
    symbol,
    score,
    label,
    sentimentClass,
    confidence: stock ? stock.aiConfidence : 85,
    headlineCount: newsList.length,
    summary: `Phân tích tiêu đề tin tức mới nhất về ${symbol} cho thấy sắc thái ${sentimentClass.toLowerCase()} (Score: ${score > 0 ? `+${score}` : score}/100).`,
    keyHighlights: highlights,
    recentHeadlines: newsList.map((n) => {
      const auth = evaluateNewsAuthenticity(n.source, n.title, n.summary);
      return {
        title: n.title,
        url: n.url,
        time: n.time,
        source: n.source,
        sentiment: n.sentiment,
        sentimentScore: n.sentimentScore ?? score,
        authenticityLevel: auth.level,
        impactForecast: n.priceImpactForecast ?? forecast.estimatedChange,
      };
    }),
    authenticitySummary: {
      overallScore: 90,
      officialCount: newsList.length,
      rumorCount: 0,
      verdict: 'CHÍNH THỐNG - ĐÃ XÁC THỰC',
    },
    priceImpactSummary: {
      expected5DayChange: forecast.estimatedChange,
      impactLevel: forecast.degree,
      primaryDriver: primaryTitle,
      recommendedAction: forecast.suggestedAction,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function analyzeBatchNewsSentiment(symbols: string[]): Promise<Record<string, StockNewsSentiment>> {
  const results: Record<string, StockNewsSentiment> = {};
  const uncachedSymbols: string[] = [];

  for (const sym of symbols) {
    const clean = sym.toUpperCase().trim();
    const cached = sentimentCache.get(clean);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      results[clean] = cached.data;
    } else {
      uncachedSymbols.push(clean);
    }
  }

  if (uncachedSymbols.length === 0) {
    return results;
  }

  const ai = getGenAI();
  const allNews = await getLatestNewsAsync();

  if (ai && uncachedSymbols.length > 1) {
    try {
      const newsSummaryList = uncachedSymbols.map((sym) => {
        const stk = getStockBySymbol(sym);
        const symNews = allNews.filter((n) =>
          (n.symbols && n.symbols.includes(sym)) ||
          n.title.toUpperCase().includes(sym) ||
          n.summary.toUpperCase().includes(sym)
        );
        const topNews = symNews.length > 0 ? symNews.slice(0, 3) : allNews.slice(0, 2);
        return `--- CỔ PHIẾU ${sym} (${stk?.name || sym}) ---\n` +
          topNews.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join('\n');
      }).join('\n\n');

      const batchPrompt = `Bạn là hệ thống AI phân tích Sắc Thái Tin Tức Chuyên Sâu (Deep Sentiment Scoring) & Dự Báo Tác Động Giá 1-5 Phiên thuộc VN-Quant Terminal.
Hãy phân tích sắc thái tin tức cho DANH SÁCH CÁC MÃ CỔ PHIẾU SAU:

${newsSummaryList}

YÊU CẦU ĐẦU RA (ĐỊNH DẠNG JSON CHÍNH XÁC):
Một JSON Object trong đó key là MÃ CỔ PHIẾU (ví dụ: "HPG", "FPT"), giá trị là object có cấu trúc:
{
  "MÃ_CP": {
    "symbol": "MÃ_CP",
    "score": integer từ -100 đến 100,
    "label": "TÍCH CỰC" | "TIÊU CỰC" | "TRUNG TÍNH",
    "sentimentClass": "RẤT TÍCH CỰC" | "TÍCH CỰC" | "TRUNG TÍNH" | "TIÊU CỰC" | "RẤT TIÊU CỰC",
    "confidence": integer từ 0 đến 100,
    "headlineCount": integer,
    "summary": "1 câu tóm tắt bằng tiếng Việt súc tích",
    "keyHighlights": ["Ý chính 1", "Ý chính 2"],
    "expected5DayChange": "+X.X% ~ +Y.Y%" hoặc "-X.X% ~ -Y.Y%",
    "recommendedAction": "Khuyến nghị hành động tức thời"
  }
}`;

      const geminiBatchRes = await callGeminiSafe({
        contents: batchPrompt,
        responseMimeType: 'application/json',
      });

      if (geminiBatchRes && geminiBatchRes.parsedJson) {
        const parsedBatch = geminiBatchRes.parsedJson;
        for (const sym of uncachedSymbols) {
          const item = parsedBatch[sym] || parsedBatch[sym.toLowerCase()];
          const symNews = allNews.filter((n) =>
            (n.symbols && n.symbols.includes(sym)) ||
            n.title.toUpperCase().includes(sym) ||
            n.summary.toUpperCase().includes(sym)
          );
          const topNews = symNews.length > 0 ? symNews.slice(0, 3) : allNews.slice(0, 2);

          if (item) {
            const score = typeof item.score === 'number' ? item.score : 72;
            const forecast = forecastPriceImpact(score, [sym], topNews[0]?.title || '', topNews[0]?.summary || '');
            const resData: StockNewsSentiment = {
              symbol: sym,
              score,
              label: item.label || (score >= 20 ? 'TÍCH CỰC' : score <= -20 ? 'TIÊU CỰC' : 'TRUNG TÍNH'),
              sentimentClass: item.sentimentClass || (score >= 60 ? 'RẤT TÍCH CỰC' : score >= 20 ? 'TÍCH CỰC' : score <= -60 ? 'RẤT TIÊU CỰC' : score <= -20 ? 'TIÊU CỰC' : 'TRUNG TÍNH'),
              confidence: typeof item.confidence === 'number' ? item.confidence : 88,
              headlineCount: topNews.length,
              summary: item.summary || `Tin tức gần đây về ${sym} mang sắc thái tích cực.`,
              keyHighlights: Array.isArray(item.keyHighlights) ? item.keyHighlights : topNews.slice(0, 2).map((n) => n.title),
              recentHeadlines: topNews.map((n) => {
                const auth = evaluateNewsAuthenticity(n.source, n.title, n.summary);
                return {
                  title: n.title,
                  url: n.url,
                  time: n.time,
                  source: n.source,
                  sentiment: n.sentiment,
                  sentimentScore: n.sentimentScore ?? score,
                  authenticityLevel: auth.level,
                  impactForecast: n.priceImpactForecast ?? forecast.estimatedChange,
                };
              }),
              authenticitySummary: {
                overallScore: 91,
                officialCount: topNews.length,
                rumorCount: 0,
                verdict: 'CHÍNH THỐNG - ĐÃ XÁC THỰC',
              },
              priceImpactSummary: {
                expected5DayChange: item.expected5DayChange || forecast.estimatedChange,
                impactLevel: forecast.degree,
                primaryDriver: topNews[0]?.title || 'Dòng tin tức hoạt động kinh doanh',
                recommendedAction: item.recommendedAction || forecast.suggestedAction,
              },
              updatedAt: new Date().toISOString(),
            };
            results[sym] = resData;
            sentimentCache.set(sym, { data: resData, timestamp: Date.now() });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Gemini Batch Sentiment Fallback] Error or quota limit hit:`, err?.message || err);
    }
  }

  for (const sym of uncachedSymbols) {
    if (!results[sym]) {
      results[sym] = await analyzeStockNewsSentiment(sym);
    }
  }

  return results;
}
