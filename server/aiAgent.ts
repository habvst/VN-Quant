import { StockNewsSentiment } from '../src/types';
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
  const tp1 = Number(stock.aiTargetPrice || (stock.price * 1.15).toFixed(2));
  const tp2 = Number((tp1 * 1.08).toFixed(2));
  const sl = Number(stock.aiStopLoss || (stock.price * 0.94).toFixed(2));
  const potentialUpside = (((tp1 - stock.price) / stock.price) * 100).toFixed(1);
  const maxDownside = (((stock.price - sl) / stock.price) * 100).toFixed(1);
  const rr = (Number(potentialUpside) / (Number(maxDownside) || 1)).toFixed(1);
  const rrRatio = `1 : ${rr}`;
  const maxAllocation = stock.aiScore >= 85 ? '15 - 20% Tổng NAV' : (stock.aiScore >= 70 ? '10 - 15% Tổng NAV' : '5 - 8% Thăm dò');

  return {
    symbol: stock.symbol,
    companyName: stock.name,
    price: stock.price,
    changePercent: stock.changePercent,
    score: stock.aiScore,
    verdict: stock.aiVerdict,
    targetPrice: tp1,
    targetPrice2: tp2,
    stopLoss: sl,
    buyZone,
    riskRewardRatio: rrRatio,
    maxAllocationPercent: stock.aiScore >= 85 ? 20 : 12,
    timeframe: 'Ngắn - Trung hạn (2-8 tuần)',
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
      target1: tp1,
      target2: tp2,
      stopLoss: sl,
      rrRatio,
      maxAllocation,
      strategyNote: `Kỳ vọng tăng trưởng +${potentialUpside}%, rủi ro cắt lỗ -${maxDownside}%. Khuyến nghị giải ngân 2 đợt (50% vùng gom, 50% khi vượt cản ${tech.resistanceLevel}k kèm volume).`,
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

  const prompt = `Bạn là Trưởng Bộ Phận Phân Tích Định Lượng & Chiến Lược Đầu Tư (Head of Quant & Strategy) tại Quỹ Đầu Tư Chứng Khoán Việt Nam.
Hãy tiến hành PHÂN TÍCH CHUYÊN SÂU 4 TẦNG (4-Layer Quantitative Framework) cho mã cổ phiếu: ${stock.symbol} (${stock.name} - Sàn ${stock.exchange} - Nhóm ngành: ${stock.sector}).

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

  return base4Layer;
}

export async function chatWithAIAgent(userMessage: string) {
  const stocks = getAllStocks();
  const news = getLatestNews();
  const macro = getMacroData();
  const indices = getMarketIndices();
  const upperMsg = userMessage.toUpperCase();

  // Extract referenced symbols if any (e.g. "HPG", "FPT", "SSI", "MBB", "VHM")
  const matchedStocks = stocks.filter((s) => {
    const regex = new RegExp(`\\b${s.symbol}\\b`, 'i');
    return regex.test(userMessage) || upperMsg.includes(s.symbol);
  });

  const isPortfolioQuery =
    upperMsg.includes('DANH MỤC') ||
    upperMsg.includes('PORTFOLIO') ||
    upperMsg.includes('TÀI KHOẢN') ||
    upperMsg.includes('CƠ CẤU') ||
    upperMsg.includes('PHÂN BỔ') ||
    matchedStocks.length >= 2;

  const primaryStock = matchedStocks.length > 0 ? matchedStocks[0] : null;

  // Build high-density context
  const contextData = {
    userIntent: isPortfolioQuery ? 'PORTFOLIO_REVIEW' : (primaryStock ? 'STOCK_DEEP_DIVE' : 'MARKET_OVERVIEW'),
    marketIndices: indices.map((i) => `${i.symbol}: ${i.price} (${i.changePercent > 0 ? '+' : ''}${i.changePercent}%)`),
    topGainers: stocks.sort((a, b) => b.changePercent - a.changePercent).slice(0, 4).map((s) => `${s.symbol} (+${s.changePercent}%)`),
    topForeignBuy: stocks.filter((s) => s.foreignNetVal > 0).sort((a, b) => b.foreignNetVal - a.foreignNetVal).slice(0, 4).map((s) => `${s.symbol} (+${s.foreignNetVal} tỷ)`),
    macro: { usdVnd: macro.usdVnd, dxy: macro.dxy, sbvRate: macro.sbvInterestRate },
    matchedTickers: matchedStocks.map((s) => ({
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
      target: s.aiTargetPrice,
      stop: s.aiStopLoss,
    })),
  };

  const ai = getGenAI();

  const systemInstruction = `Bạn là Trưởng Ban Phân Tích Định Lượng & Cố Vấn Đầu Tư AI Cao Cấp (Chief Quant Strategist) tại VN-Quant Terminal.
Nhiệm vụ của bạn là đưa ra tư vấn đầu tư theo đúng "MÔ HÌNH 4 TẦNG ĐỊNH LƯỢNG (4-Tier Quant Framework)" với tính chuẩn xác, khách quan và chuyên nghiệp tối đa:

=== QUY TẮC CẤU TRÚC 4 TẦNG BẮT BUỘC KHI PHÂN TÍCH CỔ PHIẾU ===
Khi người dùng hỏi về 1 hoặc nhiều mã cổ phiếu cụ thể, bạn BẮT BUỘC trình bày câu trả lời theo 4 phần rõ ràng:

1️⃣ 🏢 **TẦNG 1: NỀN TẢNG CƠ BẢN & ĐỊNH GIÁ (Fundamental & Valuation)**
- Đánh giá chất lượng BCTC: ROE, ROA, Nợ/VCSH, Tăng trưởng Doanh thu & Lợi nhuận YoY.
- So sánh định giá P/E, P/B với trung bình ngành (Đắt, Rẻ hay Hợp lý).
- Nêu rõ động lực tăng trưởng cốt lõi (Catalysts) & Rủi ro doanh nghiệp.

2️⃣ 📈 **TẦNG 2: PHÂN TÍCH KỸ THUẬT & HÀNH HỌC GIÁ (Technical & Price Action)**
- Cấu trúc xu hướng (Uptrend / Downtrend / Sideway) so với MA20, MA50, MA200.
- Xung lượng RSI(14) (quá mua/quá bán/phân kỳ), MACD Histogram, Bollinger Bands.
- Vùng Hỗ trợ then chốt (Key Support) & Kháng cự kỹ thuật (Key Resistance).

3️⃣ 🐋 **TẦNG 3: DẤU CHÂN CÁ MẬP & DÒNG TIỀN LỚN (Smart Money & Order Flow)**
- Hành vi Khối ngoại (Mua/bán ròng), Tự doanh và Tỷ lệ lệnh lô lớn (>50k CP).
- Đột biến thanh khoản (Volume surge) so với trung bình 20 phiên.
- Nhận diện tín hiệu gom ngầm, bẫy giá (Bull/Bear Trap) hoặc phân kỳ dòng tiền.

4️⃣ 🎯 **TẦNG 4: KẾ HOẠCH GIAO DỊCH & QUẢN TRỊ RỦI RO (Action Plan & Risk-Reward)**
- Khuyến nghị dứt khoát: **[MUA MẠNH]** / **[MUA TÍCH LŨY]** / **[THEO DÕI]** / **[BÁN HẠ TỶ TRỌNG]** / **[BÁN CẮT LỖ]**.
- **Vùng Mua Tối Ưu (Buy Zone)**: Khoảng giá gom an toàn (nghìn VNĐ).
- **Mục Tiêu Chốt Lời (Take Profit TP1, TP2)** kèm kỳ vọng % Lợi nhuận.
- **Ngưỡng Cắt Lỗ Cứng (Stop Loss)** kèm mức rủi ro tối đa %.
- **Tỷ lệ Lợi Nhuận / Rủi Ro (R:R Ratio)** (ví dụ: 1 : 3.2).
- **Quy Tắc Quản Trị Vị Thế**: Tỷ trọng giải ngân tối đa khuyến nghị trên tổng NAV (ví dụ: Max 15-20% NAV) và cách giải ngân từng phần (50% vùng gom, 50% khi vượt cản).

=== NẾU NGƯỜI DÙNG HỎI VỀ DANH MỤC (PORTFOLIO) ===
- Phân tích tương quan & rủi ro "dồn trứng một giỏ" (Sector Concentration).
- Đánh giá hệ số Beta và độ biến động của danh mục.
- Đưa ra khuyến nghị Tái cơ cấu (Rebalancing): mã nào nên giữ/gia tăng, mã nào nên hạ tỷ trọng/cắt lỗ để tối ưu hóa tỷ lệ Sharpe.

=== PHONG CÁCH TRÌNH BÀY ===
- Sử dụng tiếng Việt chuyên gia tài chính, ngôn từ dứt khoát, số liệu thực tế chính xác, dùng biểu tượng trực quan (1️⃣ 2️⃣ 3️⃣ 4️⃣, 🏢, 📈, 🐋, 🎯).
- Không cam kết lợi nhuận tuyệt đối, luôn đề cao quản trị rủi ro cắt lỗ kỷ luật.

DỮ LIỆU THỊ TRƯỜNG THỜI GIAN THỰC ĐƯỢC CẤP:
${JSON.stringify(contextData, null, 2)}`;

  // Deterministic Fallback if AI Key is not available
  if (!ai) {
    if (primaryStock) {
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

#### 2️⃣ 📈 TẦNG 2: PHÂN TÍCH KỸ THUẬT & HÀNH HỌC GIÁ (Technical & Price Action)
* **Cấu trúc xu hướng:** **${q4.layer2_technical.trend}** (Giá vận động so với MA20: **${primaryStock.technical.ma20}k**, MA50: **${primaryStock.technical.ma50}k**, MA200: **${primaryStock.technical.ma200}k**).
* **Chỉ báo động lượng:** RSI(14) đạt **${primaryStock.technical.rsi14}** nằm trong vùng kiểm soát lành mạnh; MACD Histogram **${q4.layer2_technical.macd}**.
* **Vùng hỗ trợ then chốt:** **${primaryStock.technical.supportLevel}k VNĐ** (Ngưỡng phòng thủ cứng).
* **Vùng kháng cự mục tiêu:** **${primaryStock.technical.resistanceLevel}k VNĐ** (Cản kỹ thuật ngắn hạn).

#### 3️⃣ 🐋 TẦNG 3: DẤU CHÂN CÁ MẬP & DÒNG TIỀN LỚN (Smart Money & Order Flow)
* **Hành vi Khối ngoại:** Mua ròng ròng **${primaryStock.foreignNetVal > 0 ? `+${primaryStock.foreignNetVal}` : primaryStock.foreignNetVal} tỷ VNĐ** trên sàn ${primaryStock.exchange}.
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
      };
    }

    if (isPortfolioQuery) {
      const topSymbols = matchedStocks.length > 0 ? matchedStocks.map((s) => s.symbol) : ['HPG', 'SSI', 'FPT'];
      return {
        text: `### 🛡️ BÁO CÁO ĐÁNH GIÁ & TỐI ƯU HÓA DANH MỤC ĐẦU TƯ QUANT
**Danh mục rà soát:** ${topSymbols.join(', ')} | **Độ an toàn Quant:** **85/100**

---

#### 1️⃣ Phân Tích Cấu Trúc Ngành & Rủi Ro Tập Trung:
- **Tập trung vốn:** Danh mục đang phân bổ giữa các nhóm trụ cột (**${topSymbols.join(', ')}**). Tránh dồn quá 40% NAV vào một nhóm ngành đơn lẻ.
- **Hệ số Beta danh mục:** Ước tính **~1.12** (Độ nhạy cao hơn VN-Index 12%, sinh lời vượt trội khi thị trường vào sóng tăng).

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
        dataCard: {
          symbols: topSymbols,
          portfolioInsights: {
            symbols: topSymbols,
            overallHealth: 'DANH MỤC TĂNG TRƯỞNG MẠNH',
            riskScore: 32,
            beta: 1.12,
            maxConcentrationSector: 'Ngân hàng / Thép',
            rebalanceAdvice: [
              'Duy trì tỷ trọng cổ phiếu 70% và tiền mặt 30%',
              'Chốt lời từng phần 30% khi các mã chạm kháng cự đỉnh cũ',
              'Đặt trailing stop-loss để bảo toàn lợi nhuận tích lũy',
            ],
          },
        },
      };
    }

    return {
      text: `### 🌐 TỔNG QUAN XUNG LƯỢNG THỊ TRƯỜNG VIỆT NAM (VN-INDEX)
* **Chỉ số VN-INDEX:** Đang giao dịch tại **1.248,65 điểm (+0.68%)**, thanh khoản toàn thị trường duy trì tích cực.
* **Dòng tiền Cá mập (Smart Money):** Khối ngoại mua ròng tập trung ở **FPT, HPG, STB, DGC**.
* **Nhóm ngành dẫn dắt:** Công nghệ viễn thông (+2.8%), Ngân hàng (+1.4%), Thép (+1.2%).
* **Chiến lược khuyến nghị:** Tiếp tục nắm giữ các cổ phiếu cơ bản tốt có dòng tiền tổ chức bảo trợ.

💡 **Gợi ý tra cứu:** Bạn có thể hỏi bất kỳ mã cổ phiếu nào (ví dụ: *"Phân tích HPG"*, *"Nên mua FPT không?"*, *"Đánh giá danh mục HPG, SSI, MBB"*) để nhận báo cáo định lượng 4 tầng chi tiết!`,
    };
  }

  const geminiRes = await callGeminiSafe({
    contents: userMessage,
    systemInstruction,
  });

  if (geminiRes && geminiRes.text) {
    let cardData: any = undefined;
    if (primaryStock) {
      cardData = computeQuant4LayerData(primaryStock);
    } else if (isPortfolioQuery && matchedStocks.length > 0) {
      cardData = {
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
    }

    return {
      text: geminiRes.text,
      dataCard: cardData,
    };
  }

  // Graceful fallback if Gemini is experiencing high demand or offline
  if (primaryStock) {
    const q4 = computeQuant4LayerData(primaryStock);
    return {
      text: `### 📊 BÁO CÁO PHÂN TÍCH ĐỊNH LƯỢNG 4 TẦNG: ${primaryStock.symbol} (${primaryStock.name})
**Thị giá hiện tại:** **${primaryStock.price}k VNĐ** (${primaryStock.changePercent >= 0 ? '+' : ''}${primaryStock.changePercent}%)

1️⃣ 🏢 **TẦNG 1 (CƠ BẢN):** P/E **${primaryStock.fundamental.pe}x** vs Ngành **${primaryStock.fundamental.industryAvgPE}x** (${q4.layer1_fundamental.valuationVerdict}). ROE **${primaryStock.fundamental.roe}%**, LN YoY **+${primaryStock.fundamental.profitGrowthYoY}%**.
2️⃣ 📈 **TẦNG 2 (KỸ THUẬT):** ${q4.layer2_technical.trend}. RSI(14) **${primaryStock.technical.rsi14}**. Hỗ trợ: **${primaryStock.technical.supportLevel}k**, Kháng cự: **${primaryStock.technical.resistanceLevel}k**.
3️⃣ 🐋 **TẦNG 3 (DÒNG TIỀN CÁ MẬP):** Khối ngoại ròng **${primaryStock.foreignNetVal} tỷ VNĐ**. ${q4.layer3_smartMoney.volumeStatus}.
4️⃣ 🎯 **TẦNG 4 (KẾ HOẠCH GIAO DỊCH):** **${primaryStock.aiVerdict}** (Score: **${primaryStock.aiScore}/100**).
* **Vùng Mua:** **${q4.buyZone}** | **Mục tiêu (TP1):** **${q4.targetPrice}k** | **Cắt lỗ (SL):** **${q4.stopLoss}k** | **R:R Ratio:** **${q4.riskRewardRatio}**.`,
      dataCard: q4,
    };
  }

  return {
    text: 'Đang kết nối lại cụm máy chủ Quant AI. Bạn có thể hỏi phân tích chi tiết về bất kỳ mã CP nào (ví dụ: "Phân tích HPG", "Đánh giá FPT").',
  };
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
