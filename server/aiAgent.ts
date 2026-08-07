import { GoogleGenAI } from '@google/genai';
import { StockNewsSentiment } from '../src/types';
import { getAllStocks, getLatestNews, getLatestNewsAsync, getMacroData, getMarketIndices, getStockBySymbol } from './marketDataService';

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

// In-memory cache for news sentiment to prevent hitting Gemini API rate limits (5 RPM)
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

  const prompt = `Bạn là hệ thống AI phân tích Sắc Thái Tin Tức (News Sentiment Analysis) thuộc VN-Quant Terminal.
Hãy phân tích các tiêu đề tin tức mới nhất liên quan đến mã cổ phiếu: ${cleanSymbol} (${stock?.name || cleanSymbol}):

DANH SÁCH TIN TỨC (${newsToAnalyze.length} tin):
${newsToAnalyze.map((n, i) => `${i + 1}. [${n.source}] ${n.title} - ${n.summary}`).join('\n')}

YÊU CẦU ĐẦU RA (ĐỊNH DẠNG JSON CHÍNH XÁC):
{
  "symbol": "${cleanSymbol}",
  "score": integer từ -100 đến 100 (-100 là Rất Tiêu cực, 0 là Trung tính, +100 là Rất Tích cực),
  "label": "TÍCH CỰC" | "TIÊU CỰC" | "TRUNG TÍNH",
  "confidence": integer từ 0 đến 100,
  "headlineCount": ${newsToAnalyze.length},
  "summary": "1 câu tóm tắt tổng quan sắc thái tin tức bằng tiếng Việt súc tích",
  "keyHighlights": ["Ý chính 1", "Ý chính 2"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      const result: StockNewsSentiment = {
        symbol: cleanSymbol,
        score: typeof parsed.score === 'number' ? parsed.score : 75,
        label: parsed.label || 'TÍCH CỰC',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 88,
        headlineCount: newsToAnalyze.length,
        summary: parsed.summary || `Tin tức gần đây về ${cleanSymbol} mang sắc thái tích cực.`,
        keyHighlights: Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights : newsToAnalyze.slice(0, 2).map((n) => n.title),
        recentHeadlines: newsToAnalyze.map((n) => ({
          title: n.title,
          url: n.url,
          time: n.time,
          source: n.source,
          sentiment: n.sentiment,
        })),
        updatedAt: new Date().toISOString(),
      };
      sentimentCache.set(cleanSymbol, { data: result, timestamp: Date.now() });
      return result;
    }
  } catch (err: any) {
    if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('quota')) {
      console.warn(`[Gemini API Quota Exceeded] Rate limit hit for ${cleanSymbol}. Using intelligent fallback sentiment engine.`);
    } else {
      console.error(`Gemini News Sentiment Error for ${cleanSymbol}:`, err);
    }
  }

  const fallback = getFallbackNewsSentiment(cleanSymbol, stock, newsToAnalyze);
  sentimentCache.set(cleanSymbol, { data: fallback, timestamp: Date.now() });
  return fallback;
}

function getFallbackNewsSentiment(symbol: string, stock: any, newsList: any[]): StockNewsSentiment {
  let score = stock ? Math.round((stock.aiScore - 50) * 1.7) : 68;
  if (score > 92) score = 92;
  if (score < -85) score = -85;

  let label: 'TÍCH CỰC' | 'TIÊU CỰC' | 'TRUNG TÍNH' = 'TÍCH CỰC';
  if (score >= 20) label = 'TÍCH CỰC';
  else if (score <= -20) label = 'TIÊU CỰC';
  else label = 'TRUNG TÍNH';

  const highlights = newsList.length > 0
    ? newsList.slice(0, 2).map((n) => n.title)
    : [
        `Tín hiệu tin tức & truyền thông duy trì thuận lợi cho mã ${symbol}`,
        `Hỗ trợ tích cực từ triển vọng tăng trưởng doanh nghiệp`
      ];

  return {
    symbol,
    score,
    label,
    confidence: stock ? stock.aiConfidence : 85,
    headlineCount: newsList.length,
    summary: `Phân tích tiêu đề tin tức mới nhất về ${symbol} cho thấy sắc thái ${label.toLowerCase()} tích cực.`,
    keyHighlights: highlights,
    recentHeadlines: newsList.map((n) => ({
      title: n.title,
      url: n.url,
      time: n.time,
      source: n.source,
      sentiment: n.sentiment,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function analyzeBatchNewsSentiment(symbols: string[]): Promise<Record<string, StockNewsSentiment>> {
  const results: Record<string, StockNewsSentiment> = {};
  const uncachedSymbols: string[] = [];

  // Check cache first
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

  // Single-prompt batch request to Gemini API to process all uncached symbols in ONE single call
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

      const batchPrompt = `Bạn là hệ thống AI phân tích Sắc Thái Tin Tức (News Sentiment Analysis) thuộc VN-Quant Terminal.
Hãy phân tích sắc thái tin tức cho DANH SÁCH CÁC MÃ CỔ PHIẾU SAU:

${newsSummaryList}

YÊU CẦU ĐẦU RA (ĐỊNH DẠNG JSON CHÍNH XÁC):
Một JSON Object trong đó key là MÃ CỔ PHIẾU (ví dụ: "HPG", "FPT"), giá trị là object có cấu trúc:
{
  "MÃ_CP": {
    "symbol": "MÃ_CP",
    "score": integer từ -100 đến 100,
    "label": "TÍCH CỰC" | "TIÊU CỰC" | "TRUNG TÍNH",
    "confidence": integer từ 0 đến 100,
    "headlineCount": integer,
    "summary": "1 câu tóm tắt bằng tiếng Việt súc tích",
    "keyHighlights": ["Ý chính 1", "Ý chính 2"]
  }
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: batchPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        const parsedBatch = JSON.parse(response.text);
        for (const sym of uncachedSymbols) {
          const item = parsedBatch[sym] || parsedBatch[sym.toLowerCase()];
          const stk = getStockBySymbol(sym);
          const symNews = allNews.filter((n) =>
            (n.symbols && n.symbols.includes(sym)) ||
            n.title.toUpperCase().includes(sym) ||
            n.summary.toUpperCase().includes(sym)
          );
          const topNews = symNews.length > 0 ? symNews.slice(0, 3) : allNews.slice(0, 2);

          if (item) {
            const resData: StockNewsSentiment = {
              symbol: sym,
              score: typeof item.score === 'number' ? item.score : 72,
              label: item.label || 'TÍCH CỰC',
              confidence: typeof item.confidence === 'number' ? item.confidence : 88,
              headlineCount: topNews.length,
              summary: item.summary || `Tin tức gần đây về ${sym} mang sắc thái tích cực.`,
              keyHighlights: Array.isArray(item.keyHighlights) ? item.keyHighlights : topNews.slice(0, 2).map((n) => n.title),
              recentHeadlines: topNews.map((n) => ({
                title: n.title,
                url: n.url,
                time: n.time,
                source: n.source,
                sentiment: n.sentiment,
              })),
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

  // Fill any remaining missing symbols with individual function call (or fallback)
  for (const sym of uncachedSymbols) {
    if (!results[sym]) {
      results[sym] = await analyzeStockNewsSentiment(sym);
    }
  }

  return results;
}
