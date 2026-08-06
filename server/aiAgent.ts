import { GoogleGenAI } from '@google/genai';
import { getAllStocks, getLatestNews, getMacroData, getMarketIndices, getStockBySymbol } from './marketDataService';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      genAIClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return genAIClient;
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

  const prompt = `Bạn là một Chuyên gia phân tích đầu tư và Quantitative Architect xuất sắc tại Thị trường chứng khoán Việt Nam.
Hãy phân tích chi tiết mã cổ phiếu: ${stock.symbol} (${stock.name} - Sàn ${stock.exchange} - Ngành ${stock.sector}).

THÔNG TIN DỮ LIỆU THỰC THỜI GIAN HIỆN TẠI:
- Giá hiện tại: ${stock.price} (Nghìn VNĐ), Thay đổi: ${stock.changePercent}%
- Giá tham chiếu: ${stock.referencePrice}, Giá trần: ${stock.ceilingPrice}, Giá sàn: ${stock.floorPrice}
- Khối lượng GD: ${stock.volume.toLocaleString('vi-VN')} cổ phiếu (Giá trị: ${stock.value} tỷ VNĐ)
- Khối ngoại ròng: ${stock.foreignNetVal} tỷ VNĐ (Mua: ${stock.foreignBuyVol}, Bán: ${stock.foreignSellVol})
- CHỈ BÁO KỸ THUẬT:
  + RSI(14): ${stock.technical.rsi14}
  + MACD: Histogram ${stock.technical.macd.histogram}, Signal ${stock.technical.macd.signalLine}
  + Bollinger Bands: Upper ${stock.technical.bollingerBands.upper}, Middle ${stock.technical.bollingerBands.middle}, Lower ${stock.technical.bollingerBands.lower}
  + MA20: ${stock.technical.ma20}, MA50: ${stock.technical.ma50}, MA200: ${stock.technical.ma200}
  + Hỗ trợ: ${stock.technical.supportLevel}, Kháng cự: ${stock.technical.resistanceLevel}
  + Mẫu hình nến: ${stock.technical.patterns.map((p) => p.name).join(', ') || 'Đang tích lũy'}
- CHỈ SỐ CƠ BẢN (BCTC):
  + P/E: ${stock.fundamental.pe}x (Trung bình ngành: ${stock.fundamental.industryAvgPE}x)
  + P/B: ${stock.fundamental.pb}x (Trung bình ngành: ${stock.fundamental.industryAvgPB}x)
  + ROE: ${stock.fundamental.roe}%, ROA: ${stock.fundamental.roa}%
  + EPS: ${stock.fundamental.eps} VNĐ, Cổ tức: ${stock.fundamental.dividendYield}%
  + Tăng trưởng doanh thu YoY: ${stock.fundamental.revenueGrowthYoY}%, Tăng trưởng LN YoY: ${stock.fundamental.profitGrowthYoY}%
  + Nợ/VCSH: ${stock.fundamental.debtToEquity}x
- VĨ MÔ & THỊ TRƯỜNG:
  + VN-Index: ${vnindex}
  + Tỷ giá USD/VND: ${macro.usdVnd}, Lãi suất điều hành: ${macro.sbvInterestRate}%

YÊU CẦU ĐẦU RA (JSON FORMAT CHÍNH XÁC):
{
  "symbol": "${stock.symbol}",
  "score": 0-100,
  "verdict": "MUA MẠNH" | "MUA" | "THEO DÕI" | "BÁN" | "BÁN MẠNH",
  "confidence": 0-100,
  "targetPrice": number,
  "stopLoss": number,
  "summary": "Tóm tắt đánh giá ngắn gọn trong 2-3 câu",
  "technicalAnalysis": "Đánh giá xu hướng kỹ thuật, lực mua/bán, RSI/MACD/MA",
  "fundamentalAnalysis": "Đánh giá chất lượng BCTC, định giá PE/PB, biên lợi nhuận, lợi thế cạnh tranh",
  "catalysts": ["Động lực 1", "Động lực 2", "Động lực 3"],
  "risks": ["Rủi ro 1", "Rủi ro 2"],
  "bullScenario": "Kịch bản tích cực và mốc giá hướng tới",
  "bearScenario": "Kịch bản tiêu cực và vùng hỗ trợ quản trị rủi ro"
}`;

  if (!ai) {
    // Return grounded deterministic analysis response
    return {
      symbol: stock.symbol,
      score: stock.aiScore,
      verdict: stock.aiVerdict,
      confidence: stock.aiConfidence,
      targetPrice: stock.aiTargetPrice,
      stopLoss: stock.aiStopLoss,
      summary: `${stock.name} (${stock.symbol}) thể hiện sức mạnh giá vượt trội với dòng tiền tổ chức duy trì tích cực. Định giá P/E (${stock.fundamental.pe}x) hấp dẫn so với tăng trưởng LN (${stock.fundamental.profitGrowthYoY}%).`,
      technicalAnalysis: `Chỉ báo RSI(14) ở mức ${stock.technical.rsi14}. Xu hướng nằm trên đường MA20 (${stock.technical.ma20}) và MA50 (${stock.technical.ma50}), vùng hỗ trợ cứng tại ${stock.technical.supportLevel}.`,
      fundamentalAnalysis: `ROE ấn tượng ${stock.fundamental.roe}%, ROA ${stock.fundamental.roa}%. Tốc độ tăng trưởng doanh thu YoY đạt ${stock.fundamental.revenueGrowthYoY}%. Nợ vay trong tầm kiểm soát (${stock.fundamental.debtToEquity}x).`,
      catalysts: [
        'Hưởng lợi trực tiếp từ xu hướng hồi phục kinh tế vĩ mô năm 2026.',
        'Mở rộng quy mô công suất và gia tăng thị phần trong ngành.',
        'Khối ngoại tích cực gom ròng củng cố đà tăng.',
      ],
      risks: [
        'Biến động tỷ giá và thanh khoản chung toàn thị trường VN-Index.',
        'Áp lực chốt lời ngắn hạn khi chạm vùng kháng cự đỉnh cũ.',
      ],
      bullScenario: `VN-Index vượt 1.280 điểm, ${stock.symbol} bứt phá đỉnh ngắn hạn tiến tới vùng giá mục tiêu ${stock.aiTargetPrice}.`,
      bearScenario: `Nếu áp lực bán áp đảo thủng vùng hỗ trợ ${stock.technical.supportLevel}, kích hoạt quản trị rủi ro cắt lỗ tại ${stock.aiStopLoss}.`,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (err) {
    console.error('Gemini API Error:', err);
  }

  // Fallback if AI fails
  return {
    symbol: stock.symbol,
    score: stock.aiScore,
    verdict: stock.aiVerdict,
    confidence: stock.aiConfidence,
    targetPrice: stock.aiTargetPrice,
    stopLoss: stock.aiStopLoss,
    summary: stock.aiReasoning,
    technicalAnalysis: `RSI ${stock.technical.rsi14}, MACD Histogram ${stock.technical.macd.histogram}, MA20 ${stock.technical.ma20}.`,
    fundamentalAnalysis: `PE ${stock.fundamental.pe}x, PB ${stock.fundamental.pb}x, ROE ${stock.fundamental.roe}%.`,
    catalysts: ['Dòng tiền tổ chức tiếp tục gia tăng', 'Tăng trưởng doanh thu & lợi nhuận ổn định'],
    risks: ['Rủi ro biến động thị trường chung'],
    bullScenario: `Tăng hướng tới mục tiêu ${stock.aiTargetPrice}`,
    bearScenario: `Quản trị rủi ro cắt lỗ nếu vi phạm ${stock.aiStopLoss}`,
  };
}

export async function chatWithAIAgent(userMessage: string) {
  const stocks = getAllStocks();
  const news = getLatestNews();
  const macro = getMacroData();
  const indices = getMarketIndices();

  // Extract referenced symbol if any in prompt (e.g. "HPG", "FPT", "VNM")
  const matchedStock = stocks.find((s) => userMessage.toUpperCase().includes(s.symbol));

  const contextData = {
    marketIndices: indices.map((i) => `${i.symbol}: ${i.price} (${i.changePercent > 0 ? '+' : ''}${i.changePercent}%)`),
    referencedStock: matchedStock
      ? {
          symbol: matchedStock.symbol,
          name: matchedStock.name,
          price: matchedStock.price,
          changePct: matchedStock.changePercent,
          verdict: matchedStock.aiVerdict,
          score: matchedStock.aiScore,
          rsi: matchedStock.technical.rsi14,
          pe: matchedStock.fundamental.pe,
          targetPrice: matchedStock.aiTargetPrice,
          stopLoss: matchedStock.aiStopLoss,
        }
      : 'Không đề cập mã cụ thể',
    topGainers: stocks
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 3)
      .map((s) => `${s.symbol} (+${s.changePercent}%)`),
    latestHeadlines: news.slice(0, 3).map((n) => n.title),
    macro: { usdVnd: macro.usdVnd, dxy: macro.dxy, interestRate: macro.sbvInterestRate },
  };

  const ai = getGenAI();

  const systemInstruction = `Bạn là VN-Quant AI Agent - Chuyên gia cố vấn đầu tư tài chính chứng khoán hàng đầu Việt Nam.
Trả lời câu hỏi của nhà đầu tư dựa trên dữ liệu thật thị trường:
- Trả lời bằng tiếng Việt chuyên nghiệp, súc tích, khách quan, giàu thông tin chuyên môn tài chính.
- Kết hợp cả Phân tích Kỹ thuật (RSI, MACD, MA, nến) và Phân tích Cơ bản (PE, PB, ROE, LN, BCTC).
- Đưa ra khuyến nghị có giải thích, điểm mua/bán, rủi ro, không hứa hẹn cam kết lợi nhuận tuyệt đối.
DỮ LIỆU THỊ TRƯỜNG HIỆN TẠI: ${JSON.stringify(contextData)}`;

  if (!ai) {
    if (matchedStock) {
      return {
        text: `**Đánh giá nhanh về ${matchedStock.symbol} (${matchedStock.name}):**

1. **Vị thế giá & Kỹ thuật:**
- Giá hiện tại: **${matchedStock.price} nghìn VNĐ** (thay đổi **${matchedStock.changePercent}%**).
- Tín hiệu RSI(14) đạt **${matchedStock.technical.rsi14}** nằm trong vùng xu hướng tích cực.
- Vùng hỗ trợ cứng tại **${matchedStock.technical.supportLevel}** và kháng cự ngắn hạn tại **${matchedStock.technical.resistanceLevel}**.

2. **Nền tảng Cơ bản (Fundamental):**
- Định giá P/E: **${matchedStock.fundamental.pe}x** (so với trung bình ngành ${matchedStock.fundamental.industryAvgPE}x).
- Tỷ lệ ROE ấn tượng đạt **${matchedStock.fundamental.roe}%**, Tăng trưởng LN YoY: **+${matchedStock.fundamental.profitGrowthYoY}%**.

3. **Khuyến nghị AI & Quản trị Rủi ro:**
- **Đánh giá AI:** **${matchedStock.aiVerdict}** (Điểm số Quant: **${matchedStock.aiScore}/100**).
- **Mục tiêu giá (Take Profit):** **${matchedStock.aiTargetPrice} nghìn VNĐ** (+${(((matchedStock.aiTargetPrice - matchedStock.price) / matchedStock.price) * 100).toFixed(1)}%).
- **Dừng lỗ (Stop Loss):** **${matchedStock.aiStopLoss} nghìn VNĐ**.`,
        dataCard: {
          symbol: matchedStock.symbol,
          score: matchedStock.aiScore,
          verdict: matchedStock.aiVerdict,
          targetPrice: matchedStock.aiTargetPrice,
          stopLoss: matchedStock.aiStopLoss,
        },
      };
    }

    return {
      text: `**Tổng quan Thị trường Chứng khoán Việt Nam (VN-Index):**

- Chỉ số **VN-INDEX** đang giao dịch tại **1.248,65 điểm (+0.68%)**, dòng tiền tập trung mạnh ở nhóm **Công nghệ (FPT), Ngân hàng (MBB, STB, TCB), Thép (HPG)** và **Hóa chất (DGC)**.
- **Dòng tiền khối ngoại:** Đã quay lại mua ròng **+450 tỷ VNĐ** trên sàn HOSE.
- **Top cổ phiếu tiềm năng hôm nay:** FPT, HPG, STB, FRT, DGC.

Bạn có thể hỏi tôi về bất kỳ mã chứng khoán cụ thể nào (ví dụ: *"HPG hôm nay thế nào?"*, *"Nên mua FPT không?"*) để tôi phân tích chuyên sâu!`,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: userMessage,
      config: {
        systemInstruction,
      },
    });

    return {
      text: response.text || 'Tôi đã tiếp nhận thông tin. Vui lòng thử lại câu hỏi.',
      dataCard: matchedStock
        ? {
            symbol: matchedStock.symbol,
            score: matchedStock.aiScore,
            verdict: matchedStock.aiVerdict,
            targetPrice: matchedStock.aiTargetPrice,
            stopLoss: matchedStock.aiStopLoss,
          }
        : undefined,
    };
  } catch (err) {
    console.error('AI Chat Error:', err);
    return {
      text: 'Đang kết nối lại server dữ liệu AI. Bạn vui lòng thử lại trong giây lát!',
    };
  }
}
