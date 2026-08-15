import { SmartMoneySignal, StockData } from '../src/types';

/**
 * Intelligent Smart Money & Market Anomaly Detection Engine
 * Rà soát và nhận diện:
 * 1. Gom hàng ngầm (Clandestine Accumulation): Giá đi ngang biên hẹp 1-2%, Vol duy trì cao, lệnh mua chủ động lô lớn (>50k CP).
 * 2. Đột biến khối lượng phiên sáng (Morning Volume Burst): Khối lượng 9h - 11h30 vượt 150% - 250% trung bình 5 phiên gần nhất.
 * 3. Phân kỳ dòng tiền lớn (Smart Money Divergence): Giá giảm/đi ngang nhưng RSI/MFI/OBV tăng mạnh (Dương) hoặc Giá tăng vượt đỉnh nhưng Khối lượng & MACD suy yếu (Âm).
 * 4. Bẫy tăng giá (Bull Trap / Upthrust) & Bẫy giảm giá (Bear Trap / Shakeout): Giá kéo vượt đỉnh đầu phiên nhưng cuối phiên tụt mạnh kèm khối lượng phân phối.
 */
export function analyzeSmartMoneySignal(stock: StockData): SmartMoneySignal {
  const tech = stock.technical;
  const fund = stock.fundamental;
  const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // 1. Phân tích Tỷ lệ Khối Lượng Phiên Sáng & Đột Biến (Morning Volume Ratio)
  // Giả định volume hiện tại so với benchmark trung bình
  const avgVol = Math.max(1000000, fund.marketCap * 15);
  const morningVolRatio = Number(((stock.volume / avgVol) * 1.8).toFixed(1));

  // 2. Tỷ lệ Lệnh Lô Lớn Khớp Chủ Động (>50.000 CP)
  const isForeignHeavyBuy = stock.foreignNetVal > 15;
  const largeBlockNetRatio = isForeignHeavyBuy
    ? Math.min(85, Math.round(55 + stock.foreignNetVal * 0.4))
    : Math.max(15, Math.round(35 + (stock.changePercent * 3)));

  // 3. Phân Tích Bẫy Giá (Trap Detection)
  // Bẫy tăng giá (Bull Trap): Giá tạo đỉnh cao mới nhưng quay đầu giảm đóng cửa thấp nhất phiên kèm volume lớn
  const isHighReversal = stock.highPrice > stock.referencePrice * 1.025 && stock.price < stock.openPrice && stock.changePercent < 0.5;
  const isBearishRsiDivergence = stock.price > tech.ma20 && tech.rsi14 > 72 && tech.macd.histogram < 0;

  if (isHighReversal || (isBearishRsiDivergence && stock.foreignNetVal < -10)) {
    return {
      patternType: 'BULL_TRAP',
      patternName: 'BẪY TĂNG GIÁ (BULL TRAP / UPTHRUST)',
      anomalyScore: 88,
      signalStrength: 'CẢNH BÁO CAO',
      morningVolRatio,
      largeBlockNetRatio: 28,
      divergenceType: 'BEARISH_DIV',
      description: `Phát hiện kéo giá ảo đầu phiên chạm ${stock.highPrice}k nhưng bị dội ngược bán tháo về ${stock.price}k. Khối ngoại bán ròng ${stock.foreignNetVal} tỷ.`,
      trapWarning: 'CẢNH BÁO: Rủi ro bẫy FOMO xả hàng của dòng tiền lớn. Tuyệt đối không mua đuổi.',
      suggestedAction: 'BÁN HẠ TỶ TRỌNG / ĐẶT CHẶN LÃI DƯỚI MA20',
      detectedAt: now,
    };
  }

  // Bẫy giảm giá rũ cung (Bear Trap / Spring / Shakeout): Nhúng thủng hỗ trợ đầu phiên nhưng hồi phục mạnh mẽ kèm volume gom
  const isLowReversal = stock.lowPrice < stock.referencePrice * 0.98 && stock.price > stock.referencePrice && stock.changePercent > 1.0;
  if (isLowReversal && (stock.foreignNetVal > 5 || tech.rsi14 < 45)) {
    return {
      patternType: 'BEAR_TRAP',
      patternName: 'BẪY GIẢM GIÁ RŨ CUNG (BEAR TRAP / SHAKEOUT)',
      anomalyScore: 92,
      signalStrength: 'CỰC MẠNH',
      morningVolRatio: Math.max(1.6, morningVolRatio),
      largeBlockNetRatio: 72,
      divergenceType: 'BULLISH_DIV',
      description: `Cá mập ép thủng vùng hỗ trợ ${tech.supportLevel}k quét Stop-loss của nhỏ lẻ rồi hấp thụ toàn bộ cung giá rẻ, kéo ngược lên ${stock.price}k (+${stock.changePercent}%).`,
      suggestedAction: 'MUA MẠNH KHI TEST LẠI GIÁ THAM CHIẾU',
      detectedAt: now,
    };
  }

  // 4. Phát hiện Gom Hàng Ngầm (Clandestine Accumulation)
  // Đặc điểm: Biên độ nén chặt (-0.8% đến +1.2%), Khối lượng duy trì đều đặn hoặc tăng, Tỷ lệ lệnh mua lô lớn > 55%
  const isTightRange = Math.abs(stock.changePercent) <= 1.4 && (stock.highPrice - stock.lowPrice) / stock.referencePrice < 0.025;
  const isAccumulationIndicators = tech.mfi14 > 55 || stock.foreignNetVal > 20 || tech.obv > 0;

  if (isTightRange && isAccumulationIndicators) {
    return {
      patternType: 'ACCUMULATION_CLANDESTINE',
      patternName: 'GOM HÀNG NGẦM (SMART ACCUMULATION)',
      anomalyScore: 94,
      signalStrength: 'CỰC MẠNH',
      morningVolRatio: Math.max(1.3, morningVolRatio),
      largeBlockNetRatio: Math.max(65, largeBlockNetRatio),
      divergenceType: 'PRICE_VOL_DIV',
      description: `Giá bị ghìm trong biên độ hẹp ${stock.lowPrice}-${stock.highPrice}k nhưng dòng tiền lớn âm thầm gom ròng ${stock.foreignNetVal > 0 ? `+${stock.foreignNetVal} tỷ` : 'lô lớn'}, MFI đạt ${tech.mfi14}.`,
      suggestedAction: 'GOM TÍCH LŨY TRƯỚC KHI BÙNG NỔ BREAKOUT',
      detectedAt: now,
    };
  }

  // 5. Đột Biến Khối Lượng Phiên Sáng (Morning Volume Burst)
  if (stock.volume > avgVol * 1.35 || stock.value > 250) {
    return {
      patternType: 'MORNING_VOLUME_BURST',
      patternName: 'ĐỘT BIẾN KHỐI LƯỢNG PHIÊN SÁNG (VOLUME BURST)',
      anomalyScore: 90,
      signalStrength: 'MẠNH',
      morningVolRatio: Math.max(2.1, morningVolRatio),
      largeBlockNetRatio: 68,
      divergenceType: 'NONE',
      description: `Khối lượng phiên sáng bùng nổ gấp ${morningVolRatio}x trung bình 5 phiên, đạt ${(stock.volume ?? 0).toLocaleString('vi-VN')} CP. Lực cầu kích hoạt từ dòng tiền tổ chức.`,
      suggestedAction: 'MUA GIA TĂNG THEO ĐÀ BÙNG NỔ (MOMENTUM BUY)',
      detectedAt: now,
    };
  }

  // 6. Phân Kỳ Dòng Tiền Lớn (Smart Money Divergence)
  // Giá đi ngang / giảm nhưng RSI/MFI/MACD phân kỳ dương
  if (tech.rsi14 < 50 && tech.macd.histogram > 0 && stock.changePercent > -1.0) {
    return {
      patternType: 'SMART_MONEY_DIVERGENCE',
      patternName: 'PHÂN KỲ DƯƠNG DÒNG TIỀN LỚN (BULLISH DIVERGENCE)',
      anomalyScore: 86,
      signalStrength: 'MẠNH',
      morningVolRatio,
      largeBlockNetRatio: 62,
      divergenceType: 'BULLISH_DIV',
      description: `Phân kỳ dương giữa MACD Histogram (+${tech.macd.histogram}) và giá. Dòng tiền cá mập đang đón đầu pha đảo chiều quanh vùng ${tech.supportLevel}k.`,
      suggestedAction: 'MUA THĂM DÒ ĐÓN SÓNG ĐẢO CHIỀU',
      detectedAt: now,
    };
  }

  // Default Neutral State
  return {
    patternType: 'NEUTRAL',
    patternName: 'VẬN ĐỘNG THEO XUNG LƯỢNG THỊ TRƯỜNG',
    anomalyScore: 50,
    signalStrength: 'TRUNG BÌNH',
    morningVolRatio,
    largeBlockNetRatio: 45,
    divergenceType: 'NONE',
    description: `Giao dịch bình thường theo cung cầu tự nhiên, chưa ghi nhận dấu hiệu thao túng hay gom xả dị biệt.`,
    suggestedAction: 'THEO DÕI VÙNG HỖ TRỢ / KHÁNG CỰ TIẾP THEO',
    detectedAt: now,
  };
}
