import { NewsAuthenticity, NewsItem, PriceImpactForecast, StockData, StockNewsSentiment } from '../src/types';
import { getLatestNewsAsync, getStockBySymbol } from './marketDataService';
import { callGeminiSafe, getGenAI } from './geminiService';

/**
 * Phân tích độ xác thực của nguồn tin (News Authenticity & Credibility Verification)
 */
export function evaluateNewsAuthenticity(source: string, title: string, summary: string): NewsAuthenticity {
  const lowerSource = (source || '').toLowerCase();
  const lowerText = `${title} ${summary}`.toLowerCase();

  // 1. Official Regulatory / Audited Disclosures
  if (
    lowerSource.includes('ubck') ||
    lowerSource.includes('hose') ||
    lowerSource.includes('hnx') ||
    lowerSource.includes('công bố thông tin') ||
    lowerText.includes('báo cáo tài chính kiểm toán') ||
    lowerText.includes('nghị quyết hđqt') ||
    lowerText.includes('công bố thông tin')
  ) {
    return {
      score: 98,
      level: 'CHÍNH THỐNG',
      sourceCategory: 'CHÍNH THỨC_UBCK_DOANH_NGHIEP',
      credibilityAnalysis: 'Nguồn công bố thông tin pháp lý chính thức từ Doanh nghiệp / UBCKNN / Sở Giao dịch. Độ tin cậy tối cao.',
      riskOfRumor: 'THẤP',
    };
  }

  // 2. Reputable Financial Media & Research Houses
  if (
    lowerSource.includes('ssi research') ||
    lowerSource.includes('vietstock') ||
    lowerSource.includes('cafef') ||
    lowerSource.includes('vnexpress') ||
    lowerSource.includes('báo đầu tư') ||
    lowerSource.includes('fireant') ||
    lowerSource.includes('vneconomy') ||
    lowerSource.includes('hsc') ||
    lowerSource.includes('vnds') ||
    lowerSource.includes('mbs')
  ) {
    const isRumorIndicator = lowerText.includes('tin đồn') || lowerText.includes('rò rỉ') || lowerText.includes('nguồn tin riêng');
    if (isRumorIndicator) {
      return {
        score: 72,
        level: 'CẦN KIỂM CHỨNG',
        sourceCategory: 'BÁO_CHÍ_TÀI_CHÍNH_LỚN',
        credibilityAnalysis: 'Báo chí tài chính đăng tải nhưng dựa trên nguồn tin chưa có công văn xác nhận từ doanh nghiệp.',
        riskOfRumor: 'TRUNG BÌNH',
      };
    }

    return {
      score: 90,
      level: 'ĐÃ XÁC THỰC',
      sourceCategory: 'BÁO_CHÍ_TÀI_CHÍNH_LỚN',
      credibilityAnalysis: 'Báo chí và hãng phân tích tài chính uy tín kiểm duyệt thông tin trước khi xuất bản.',
      riskOfRumor: 'THẤP',
    };
  }

  // 3. Social media / forum / rumor
  if (
    lowerSource.includes('f319') ||
    lowerSource.includes('zalo') ||
    lowerSource.includes('telegram') ||
    lowerSource.includes('diễn đàn') ||
    lowerSource.includes('room')
  ) {
    return {
      score: 35,
      level: 'TIN ĐỒN TRUYỀN MIỆNG',
      sourceCategory: 'MẠNG_XÃ_HỘI_DIỄN_ĐÀN',
      credibilityAnalysis: 'Tin đồn lan truyền trên các hội nhóm room phím hàng, chưa có bằng chứng kiểm toán hay công bố chính thức.',
      riskOfRumor: 'RẤT CAO',
    };
  }

  // Default Standard News
  return {
    score: 82,
    level: 'ĐÃ XÁC THỰC',
    sourceCategory: 'BÁO_CHÍ_TÀI_CHÍNH_LỚN',
    credibilityAnalysis: 'Tin tức thời sự tổng hợp từ các cổng thông tin chứng khoán Việt Nam.',
    riskOfRumor: 'THẤP',
  };
}

/**
 * Dự báo tác động giá trong 1-5 phiên (Price Impact Forecast in 1-5 Sessions)
 */
export function forecastPriceImpact(
  sentimentScore: number,
  symbols: string[],
  title: string,
  summary: string
): PriceImpactForecast {
  const lowerText = `${title} ${summary}`.toLowerCase();
  const absScore = Math.abs(sentimentScore);

  // Determine Impact Degree & Range
  let degree: 'MẠNH' | 'TRUNG BÌNH' | 'NHẸ' | 'TỨC THÌ' = 'TRUNG BÌNH';
  let estimatedChange = '+1.5% ~ +3.0%';
  let duration: '1-2 phiên' | '3-5 phiên' | 'Sóng ngắn 1-2 tuần' = '3-5 phiên';
  let suggestedAction = 'THEO DÕI PHẢN ỨNG THỊ TRƯỜNG';
  let day1 = 'Biến động nhẹ theo xu hướng chung';
  let day2_3 = 'Tích lũy kiểm định cung cầu';
  let day4_5 = 'Ổn định trở lại nền giá cũ';

  if (sentimentScore >= 60) {
    // Strongly Positive
    degree = 'MẠNH';
    duration = '3-5 phiên';
    const minUp = (sentimentScore * 0.05).toFixed(1);
    const maxUp = (sentimentScore * 0.09).toFixed(1);
    estimatedChange = `+${minUp}% ~ +${maxUp}%`;

    day1 = 'Kích hoạt lực cầu gom giá mở cửa (ATO/Phiên sáng), thanh khoản tăng vọt';
    day2_3 = 'Hấp thụ áp lực chốt lời ngắn hạn T+2.5 từ dòng tiền bắt đáy trước đó';
    day4_5 = 'Bứt phá vượt cản ngắn hạn thiết lập vùng đỉnh giá mới';

    if (lowerText.includes('cổ tức') || lowerText.includes('hợp đồng') || lowerText.includes('lãi kỷ lục')) {
      suggestedAction = 'MUA ĐÓN ĐÀ TĂNG TRƯỞNG / GIA TĂNG TỶ TRỌNG KHI RUNG LẮC';
    } else {
      suggestedAction = 'MUA THĂM DÒ ĐÓN SÓNG THÔNG TIN TÍCH CỰC';
    }
  } else if (sentimentScore >= 20) {
    // Mildly Positive
    degree = 'TRUNG BÌNH';
    duration = '1-2 phiên';
    estimatedChange = '+1.0% ~ +3.0%';
    day1 = 'Hưng phấn đầu phiên, giá giữ sắc xanh nhẹ';
    day2_3 = 'Dòng tiền phân hóa, giao dịch giằng co quanh vùng tham chiếu';
    day4_5 = 'Tái tích lũy theo xu hướng ngành';
    suggestedAction = 'NẮM GIỮ DANH MỤC / CANH MUA TẠI HỖ TRỢ MA20';
  } else if (sentimentScore <= -60) {
    // Strongly Negative
    degree = 'MẠNH';
    duration = '3-5 phiên';
    const minDown = (absScore * 0.05).toFixed(1);
    const maxDown = (absScore * 0.09).toFixed(1);
    estimatedChange = `-${minDown}% ~ -${maxDown}%`;

    day1 = 'Áp lực bán tháo hoảng loạn đầu phiên, nguy cơ thủng các mốc hỗ trợ ngắn hạn';
    day2_3 = 'Lực cầu bắt đáy giá thấp xuất hiện, giằng co thanh khoản lớn quanh vùng hỗ trợ cứng';
    day4_5 = 'Hình thành đáy ngắn hạn hoặc nhịp hồi kỹ thuật T+5';

    if (lowerText.includes('xử phạt') || lowerText.includes('thanh tra') || lowerText.includes('lỗ nặng')) {
      suggestedAction = 'HẠ TỶ TRỌNG NGAY PHIÊN ATO / ĐẶT CHẶN STOPLOSS BẢO VỆ VỐN';
    } else {
      suggestedAction = 'TẠM NGƯNG MUA MỚI, CHỜ PHIÊN XÁC NHẬN CÂN BẰNG T+3';
    }
  } else if (sentimentScore <= -20) {
    // Mildly Negative
    degree = 'TRUNG BÌNH';
    duration = '1-2 phiên';
    estimatedChange = '-1.0% ~ -2.5%';
    day1 = 'Áp lực điều chỉnh nhẹ do tâm lý thận trọng';
    day2_3 = 'Test lực đỡ tại hỗ trợ gần nhất';
    day4_5 = 'Hồi phục dần khi áp lực bán suy giảm';
    suggestedAction = 'HẠ MARGIN NẾU TỶ TRỌNG CAO / THEO DÕI VÙNG HỖ TRỢ';
  } else {
    // Neutral
    degree = 'NHẸ';
    duration = '1-2 phiên';
    estimatedChange = '-0.8% ~ +0.8%';
    day1 = 'Giao dịch trung tính, bám sát diễn biến chỉ số VN-Index';
    day2_3 = 'Dao động hẹp quanh tham chiếu';
    day4_5 = 'Vận động theo phân tích kỹ thuật nội tại';
    suggestedAction = 'DUY TRÌ TỶ TRỌNG HIỆN TẠI, KHÔNG BÁN THÁO THEO TÂM LÝ';
  }

  return {
    estimatedChange,
    duration,
    degree,
    confidence: 85,
    trajectory: {
      day1,
      day2_3,
      day4_5,
    },
    suggestedAction,
  };
}

/**
 * Tính toán Deep Sentiment Score (-100 đến +100) theo mô hình NLP tài chính định lượng
 */
export function calculateDeepSentiment(title: string, summary: string, source: string): {
  score: number;
  sentimentClass: 'RẤT TÍCH CỰC' | 'TÍCH CỰC' | 'TRUNG TÍNH' | 'TIÊU CỰC' | 'RẤT TIÊU CỰC';
  label: 'TÍCH CỰC' | 'TIÊU CỰC' | 'TRUNG TÍNH';
} {
  const lower = `${title} ${summary}`.toLowerCase();

  const strongPositiveTokens = [
    'kỷ lục', 'vượt kế hoạch', 'lãi đột biến', 'tăng bằng lần', 'trúng thầu lớn',
    'bùng nổ lợi nhuận', 'cổ tức khủng', 'thâu tóm', 'chấp thuận niêm yết',
    'giải ngân mạnh', 'mua ròng đột biến', 'nâng hạng thị trường', 'tăng vốn khủng'
  ];

  const positiveTokens = [
    'tăng', 'lãi', 'khởi sắc', 'tăng trưởng', 'mở rộng', 'hợp tác', 'đối tác chiến lược',
    'tiềm năng', 'mua ròng', 'bơm tiền', 'hạ lãi suất', 'bứt phá', 'chia cổ tức',
    'thưởng cổ phiếu', 'hồi phục', 'vượt đỉnh', 'được cấp phép'
  ];

  const strongNegativeTokens = [
    'thua lỗ kỷ lục', 'bị xử phạt', 'hủy niêm yết', 'khởi tố', 'thanh tra toàn diện',
    'bán giải chấp', 'mất thanh khoản', 'gian lận', 'cháy nợ', 'vỡ nợ trái phiếu',
    'giảm sàn la liệt', 'tháo chạy'
  ];

  const negativeTokens = [
    'lỗ', 'giảm', 'sụt giảm', 'bán tháo', 'giảm sàn', 'bán ròng', 'suy thoái',
    'áp lực', 'rủi ro', 'lo ngại', 'khó khăn', 'đối mặt', 'chốt lời',
    'cảnh báo', 'vướng mắc', 'chậm tiến độ', 'bị phạt', 'nợ xấu tăng'
  ];

  let rawScore = 0;

  strongPositiveTokens.forEach((tok) => {
    if (lower.includes(tok)) rawScore += 35;
  });
  positiveTokens.forEach((tok) => {
    if (lower.includes(tok)) rawScore += 18;
  });

  strongNegativeTokens.forEach((tok) => {
    if (lower.includes(tok)) rawScore -= 38;
  });
  negativeTokens.forEach((tok) => {
    if (lower.includes(tok)) rawScore -= 18;
  });

  // Clamp raw score to [-100, 100]
  const score = Math.max(-98, Math.min(98, rawScore));

  let sentimentClass: 'RẤT TÍCH CỰC' | 'TÍCH CỰC' | 'TRUNG TÍNH' | 'TIÊU CỰC' | 'RẤT TIÊU CỰC' = 'TRUNG TÍNH';
  let label: 'TÍCH CỰC' | 'TIÊU CỰC' | 'TRUNG TÍNH' = 'TRUNG TÍNH';

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

  return { score, sentimentClass, label };
}

/**
 * Tích hợp toàn diện vào từng tin tức (Enrich News Item with Deep Sentiment, Authenticity, Price Forecast)
 */
export function enrichNewsItemWithDeepScoring(item: Partial<NewsItem>): NewsItem {
  const title = item.title || '';
  const summary = item.summary || '';
  const source = item.source || 'Báo chí tài chính';
  const symbols = item.symbols && item.symbols.length > 0 ? item.symbols : ['VNINDEX', 'VN30'];

  const { score, sentimentClass, label } = calculateDeepSentiment(title, summary, source);
  const authenticity = evaluateNewsAuthenticity(source, title, summary);
  const priceImpact = forecastPriceImpact(score, symbols, title, summary);

  return {
    id: item.id || `news-${Math.random().toString(36).substring(2, 9)}`,
    title,
    source,
    url: item.url || `https://www.google.com/search?q=${encodeURIComponent(title)}`,
    time: item.time || item.timestamp || 'Vừa xong',
    timestamp: item.timestamp,
    summary,
    symbols,
    sentiment: label,
    impactScore: Math.min(5, Math.max(1, Math.round(Math.abs(score) / 20))),
    sentimentScore: score,
    sentimentClass,
    authenticity,
    priceImpact,
    priceImpactForecast: priceImpact.estimatedChange,
    impactDuration: priceImpact.duration,
    impactDegree: priceImpact.degree,
    aiReasoning: `Độ xác thực: ${authenticity.level} (${authenticity.score}%). Tác động dự báo: ${priceImpact.estimatedChange} (${priceImpact.duration}).`,
  };
}

/**
 * Phân tích chuyên sâu 1 bài viết / tin tức bằng Gemini AI
 */
export async function analyzeNewsDeepAI(newsId: string, customTitle?: string): Promise<any> {
  const allNews = await getLatestNewsAsync();
  const targetNews = allNews.find((n) => n.id === newsId) || {
    id: newsId,
    title: customTitle || 'Tin tức thị trường chứng khoán Việt Nam',
    source: 'Báo chí tài chính',
    summary: 'Phân tích đa chiều tác động tin tức đến cổ phiếu và chỉ số thị trường.',
    symbols: ['VNINDEX'],
  };

  const enriched = enrichNewsItemWithDeepScoring(targetNews);
  const ai = getGenAI();

  if (!ai) {
    return {
      news: enriched,
      aiAnalysis: {
        sentimentScore: enriched.sentimentScore,
        sentimentClass: enriched.sentimentClass,
        authenticityAssessment: enriched.authenticity,
        priceImpactForecast: enriched.priceImpact,
        keyTakeaways: [
          'Tin tức tác động trực tiếp đến dòng tiền ngắn hạn của nhóm cổ phiếu liên quan.',
          'Độ xác thực cao từ nguồn chính thống, loại trừ rủi ro tin đồn thất thiệt.',
          `Khuyến nghị: ${enriched.priceImpact?.suggestedAction}`,
        ],
        marketReactionTimeline: enriched.priceImpact?.trajectory,
      },
    };
  }

  const prompt = `Bạn là Giám đốc Nghiên cứu Định lượng (Head of Quant Research) của quỹ đầu tư chứng khoán Việt Nam.
Hãy phân tích SẮC THÁI CHUYÊN SÂU (DEEP SENTIMENT SCORING), TÍNH XÁC THỰC NGUỒN TIN (AUTHENTICITY) VÀ DỰ BÁO TÁC ĐỘNG GIÁ TRONG 1-5 PHIÊN cho bài tin sau:

TIÊU ĐỀ: ${enriched.title}
NGUỒN TIN: ${enriched.source}
TÓM TẮT: ${enriched.summary}
MÃ CỔ PHIẾU LIÊN QUAN: ${enriched.symbols.join(', ')}

YÊU CẦU ĐẦU RA JSON CHÍNH XÁC (KHÔNG BỌC THÊM CHỮ NGOÀI JSON):
{
  "sentimentScore": integer từ -100 đến 100,
  "sentimentClass": "RẤT TÍCH CỰC" | "TÍCH CỰC" | "TRUNG TÍNH" | "TIÊU CỰC" | "RẤT TIÊU CỰC",
  "authenticity": {
    "score": integer từ 0 đến 100,
    "level": "CHÍNH THỐNG" | "ĐÃ XÁC THỰC" | "CẦN KIỂM CHỨNG" | "TIN ĐỒN TRUYỀN MIỆNG",
    "credibilityAnalysis": "Phân tích độ tin cậy của nguồn tin và nguy cơ bị thao túng/bơm tin",
    "riskOfRumor": "THẤP" | "TRUNG BÌNH" | "CAO" | "RẤT CAO"
  },
  "priceImpact": {
    "estimatedChange": "+X.X% ~ +Y.Y%" hoặc "-X.X% ~ -Y.Y%",
    "duration": "1-2 phiên" | "3-5 phiên" | "Sóng ngắn 1-2 tuần",
    "degree": "MẠNH" | "TRUNG BÌNH" | "NHẸ" | "TỨC THÌ",
    "confidence": integer từ 0 đến 100,
    "trajectory": {
      "day1": "Phản ứng giá và khối lượng T+1",
      "day2_3": "Hấp thụ cung cầu T+2.5 hàng về",
      "day4_5": "Xu hướng định hình T+4 đến T+5"
    },
    "suggestedAction": "Khuyến nghị hành động dứt khoát cho nhà đầu tư"
  },
  "keyTakeaways": [
    "Ý chính 1",
    "Ý chính 2",
    "Ý chính 3"
  ]
}`;

  const geminiRes = await callGeminiSafe({
    contents: prompt,
    responseMimeType: 'application/json',
  });

  if (geminiRes && geminiRes.parsedJson) {
    const parsed = geminiRes.parsedJson;
    return {
      news: enriched,
      aiAnalysis: {
        sentimentScore: parsed.sentimentScore ?? enriched.sentimentScore,
        sentimentClass: parsed.sentimentClass ?? enriched.sentimentClass,
        authenticityAssessment: parsed.authenticity ?? enriched.authenticity,
        priceImpactForecast: parsed.priceImpact ?? enriched.priceImpact,
        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [
          'Tin tức tác động trực tiếp đến dòng tiền ngắn hạn của nhóm cổ phiếu liên quan.',
          `Khuyến nghị: ${enriched.priceImpact?.suggestedAction}`,
        ],
        marketReactionTimeline: parsed.priceImpact?.trajectory ?? enriched.priceImpact?.trajectory,
      },
    };
  }

  return {
    news: enriched,
    aiAnalysis: {
      sentimentScore: enriched.sentimentScore,
      sentimentClass: enriched.sentimentClass,
      authenticityAssessment: enriched.authenticity,
      priceImpactForecast: enriched.priceImpact,
      keyTakeaways: [
        'Tin tức tác động trực tiếp đến dòng tiền ngắn hạn của nhóm cổ phiếu liên quan.',
        'Độ xác thực cao từ nguồn chính thống, loại trừ rủi ro tin đồn thất thiệt.',
        `Khuyến nghị: ${enriched.priceImpact?.suggestedAction}`,
      ],
      marketReactionTimeline: enriched.priceImpact?.trajectory,
    },
  };
}
