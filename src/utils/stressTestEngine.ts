import { StockData } from '../types';
import { calculateBetaForTimeframe } from './riskEngine';

export interface MacroFactors {
  usdChangePercent: number; // e.g. +3.5%
  interestRateChangeBps: number; // e.g. +150 bps
  liquidityShock: 'MILD' | 'MODERATE' | 'SEVERE' | 'EXTREME';
}

export interface StressScenario {
  id: string;
  name: string;
  badge: string;
  historicalDate: string;
  marketShockPercent: number; // e.g. -4.5%
  marketPointChange: number; // e.g. -55.49 điểm
  description: string;
  macroFactors: MacroFactors;
  sectorMultipliers: Record<string, number>;
  historicalRecoveryDays: number;
  historicalBouncePercent: number;
}

export const HISTORICAL_SCENARIOS: StressScenario[] = [
  {
    id: 'FLASH_CRASH_55PTS',
    name: 'Sự Kiện "Thiên Nga Đen" Giảm -55.49 Điểm (-4.50%)',
    badge: '18/08/2023',
    historicalDate: '18 Tháng 08, 2023',
    marketShockPercent: -4.5,
    marketPointChange: -55.49,
    description:
      'Phiên bán tháo lịch sử thanh khoản kỷ lục 36.000 tỷ VNĐ do đòn bẩy Margin căng cứng, tin đồn hạ tỷ lệ vay và bán giải chấp chéo diện rộng.',
    macroFactors: {
      usdChangePercent: 0.8,
      interestRateChangeBps: 0,
      liquidityShock: 'SEVERE',
    },
    sectorMultipliers: {
      'Bất động sản': 1.55,
      'Chứng khoán': 1.62,
      'Thép': 1.42,
      'Ngân hàng': 1.15,
      'Bán lẻ': 0.95,
      'Công nghệ': 0.85,
      'Năng lượng': 0.75,
      'Dược phẩm': 0.4,
      'Tiện ích': 0.35,
    },
    historicalRecoveryDays: 32,
    historicalBouncePercent: 6.8,
  },
  {
    id: 'SBV_BILLS_RATE_HIKE',
    name: 'SBV Phát Hành Tín Phiếu & Áp Lực Tỷ Giá (-7.20%)',
    badge: 'T9-T10/2023',
    historicalDate: 'Tháng 09 - 10, 2023',
    marketShockPercent: -7.2,
    marketPointChange: -88.0,
    description:
      'Ngân hàng Nhà nước hút ròng hơn 250.000 tỷ qua tín phiếu để kìm hãm tỷ giá DXY tăng vọt, gây áp lực thanh khoản ngắn hạn lên thị trường chứng khoán.',
    macroFactors: {
      usdChangePercent: 3.8,
      interestRateChangeBps: 125,
      liquidityShock: 'SEVERE',
    },
    sectorMultipliers: {
      'Chứng khoán': 1.58,
      'Bất động sản': 1.48,
      'Ngân hàng': 1.28,
      'Thép': 1.35,
      'Bán lẻ': 1.05,
      'Công nghệ': 0.75,
      'Năng lượng': 0.65,
      'Dược phẩm': 0.38,
      'Tiện ích': 0.42,
    },
    historicalRecoveryDays: 54,
    historicalBouncePercent: 12.4,
  },
  {
    id: 'BOND_LIQUIDITY_FREEZE',
    name: 'Khủng Hoảng Trái Phiếu Doanh Nghiệp & Tắc Thanh Khoản (-11.5%)',
    badge: 'Q4/2022',
    historicalDate: 'Tháng 10 - 11, 2022',
    marketShockPercent: -11.5,
    marketPointChange: -135.0,
    description:
      'Biến cố thị trường trái phiếu doanh nghiệp dẫn tới làn sóng Force-Sell toàn hệ thống từ các công ty chứng khoán, cổ phiếu rớt sàn liên hoàn.',
    macroFactors: {
      usdChangePercent: 4.5,
      interestRateChangeBps: 200,
      liquidityShock: 'EXTREME',
    },
    sectorMultipliers: {
      'Bất động sản': 1.85,
      'Chứng khoán': 1.75,
      'Thép': 1.6,
      'Ngân hàng': 1.35,
      'Bán lẻ': 1.1,
      'Công nghệ': 0.9,
      'Năng lượng': 0.8,
      'Dược phẩm': 0.45,
      'Tiện ích': 0.5,
    },
    historicalRecoveryDays: 88,
    historicalBouncePercent: 24.5,
  },
  {
    id: 'COVID_CRASH_2020',
    name: 'Đại Dịch COVID-19 Toàn Cầu Flash Crash (-24.8%)',
    badge: 'T3/2020',
    historicalDate: 'Tháng 03, 2020',
    marketShockPercent: -24.8,
    marketPointChange: -220.0,
    description:
      'Cú sốc phong tỏa kinh tế toàn cầu khiến chuỗi cung ứng đứt gãy, kích hoạt đợt bán tháo tháo chạy dòng tiền trên toàn thế giới.',
    macroFactors: {
      usdChangePercent: 2.5,
      interestRateChangeBps: -100,
      liquidityShock: 'EXTREME',
    },
    sectorMultipliers: {
      'Bán lẻ': 1.4,
      'Bất động sản': 1.35,
      'Chứng khoán': 1.45,
      'Thép': 1.3,
      'Ngân hàng': 1.25,
      'Công nghệ': 0.65,
      'Dược phẩm': 0.3,
      'Năng lượng': 1.2,
      'Tiện ích': 0.6,
    },
    historicalRecoveryDays: 140,
    historicalBouncePercent: 45.2,
  },
];

export interface AssetStressDetail {
  symbol: string;
  sector: string;
  beta: number;
  quantity: number;
  originalPrice: number;
  stressedPrice: number;
  priceDropPercent: number;
  originalValue: number;
  stressedValue: number;
  lossAmount: number;
  lossPercent: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedAction: string;
}

export interface StressTestResult {
  scenarioName: string;
  marketDropPercent: number;
  marketPointChange: number;
  originalNav: number;
  stressedNav: number;
  navDropAmount: number;
  navDropPercent: number;
  originalStockValue: number;
  stressedStockValue: number;
  stockDropAmount: number;
  stockDropPercent: number;
  freeCashAmount: number;
  pendingCashAmount: number;
  totalCashBuffer: number;
  originalCashRatio: number;
  stressedCashRatio: number;
  cashBufferAbsorptionPercent: number; // Bao nhiêu % cú sốc đã được đệm tiền mặt che chắn
  assetDetails: AssetStressDetail[];
  marginRisk: {
    estimatedRtt: number;
    isMarginCall: boolean;
    isForceSell: boolean;
    requiredCashInjection: number;
  };
  recoveryEstimate: {
    estimatedDays: number;
    historicalReboundPotential: number;
    reboundStrategy: string;
  };
  quantRecommendations: string[];
}

/**
 * Quant Stress-Testing & Historical Scenario Simulation Engine
 */
export function runPortfolioStressTest(
  positions: {
    id: string;
    symbol: string;
    quantity: number;
    buyPrice: number;
    currentPrice: number;
    currentValue: number;
  }[],
  stocks: StockData[],
  freeCash: number,
  pendingCash: number,
  scenario: StressScenario,
  customDropPercent?: number
): StressTestResult {
  const stockMap: Record<string, StockData> = {};
  stocks.forEach((s) => {
    stockMap[s.symbol] = s;
  });

  const effectiveMarketDrop = customDropPercent !== undefined ? customDropPercent : scenario.marketShockPercent;
  const effectivePointChange =
    customDropPercent !== undefined
      ? Number(((customDropPercent / -4.5) * -55.49).toFixed(1))
      : scenario.marketPointChange;

  let totalOriginalStockVal = 0;
  let totalStressedStockVal = 0;

  const assetDetails: AssetStressDetail[] = positions.map((pos) => {
    const stock = stockMap[pos.symbol];
    const sector = stock?.sector || 'Khác';
    const beta = stock ? calculateBetaForTimeframe(stock, '6M') : 1.1;
    const currentPrice = pos.currentPrice || stock?.price || pos.buyPrice;
    const originalVal = pos.quantity * currentPrice * 1000;
    totalOriginalStockVal += originalVal;

    // Multiplier based on sector sensitivity to this specific crisis
    const sectorMultiplier = scenario.sectorMultipliers[sector] || 1.1;

    // Projected Stock Price Drop = Market Drop * Beta * Sector Multiplier
    // Floor max drop at -50% for standard sanity check
    let projectedDropPercent = effectiveMarketDrop * beta * sectorMultiplier;
    if (projectedDropPercent < -50) projectedDropPercent = -50;
    if (projectedDropPercent > 0 && effectiveMarketDrop < 0) projectedDropPercent = 0;

    const stressedPrice = Math.max(0.1, Number((currentPrice * (1 + projectedDropPercent / 100)).toFixed(2)));
    const stressedVal = pos.quantity * stressedPrice * 1000;
    totalStressedStockVal += stressedVal;

    const lossAmount = stressedVal - originalVal;
    const lossPercent = originalVal > 0 ? (lossAmount / originalVal) * 100 : 0;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (lossPercent < -18) riskLevel = 'CRITICAL';
    else if (lossPercent < -10) riskLevel = 'HIGH';
    else if (lossPercent < -5) riskLevel = 'MEDIUM';

    let recommendedAction = 'Nắm giữ & Quan sát';
    if (riskLevel === 'CRITICAL') {
      recommendedAction = 'Hạ 50% vị thế bảo vệ NAV';
    } else if (riskLevel === 'HIGH') {
      recommendedAction = 'Cân nhắc đặt Stop-Loss chặt';
    } else if (riskLevel === 'MEDIUM') {
      recommendedAction = 'Theo dõi vùng hỗ trợ MA50';
    } else {
      recommendedAction = 'Hấp thụ tốt cú sốc thị trường';
    }

    return {
      symbol: pos.symbol,
      sector,
      beta,
      quantity: pos.quantity,
      originalPrice: currentPrice,
      stressedPrice,
      priceDropPercent: Number(projectedDropPercent.toFixed(2)),
      originalValue: Math.round(originalVal),
      stressedValue: Math.round(stressedVal),
      lossAmount: Math.round(lossAmount),
      lossPercent: Number(lossPercent.toFixed(2)),
      riskLevel,
      recommendedAction,
    };
  });

  const totalCash = freeCash + pendingCash;
  const originalNav = totalOriginalStockVal + totalCash;
  const stressedNav = totalStressedStockVal + totalCash;
  const navDropAmount = stressedNav - originalNav;
  const navDropPercent = originalNav > 0 ? (navDropAmount / originalNav) * 100 : 0;

  const stockDropAmount = totalStressedStockVal - totalOriginalStockVal;
  const stockDropPercent = totalOriginalStockVal > 0 ? (stockDropAmount / totalOriginalStockVal) * 100 : 0;

  const originalCashRatio = originalNav > 0 ? (totalCash / originalNav) * 100 : 100;
  const stressedCashRatio = stressedNav > 0 ? (totalCash / stressedNav) * 100 : 100;

  // Tiền mặt hấp thụ cú sốc: Khoảng chênh lệch giữa mức giảm của Cổ phiếu và mức giảm thực của NAV
  const cashBufferAbsorptionPercent = Math.max(0, Number((Math.abs(stockDropPercent) - Math.abs(navDropPercent)).toFixed(2)));

  // Giả lập Margin Risk (Assuming 1:1 margin if stock value exceeds total capital, otherwise safe)
  let estimatedRtt = 150; // Tỷ lệ an toàn tài khoản
  let isMarginCall = false;
  let isForceSell = false;
  let requiredCashInjection = 0;

  if (totalOriginalStockVal > originalNav * 0.75) {
    // High stock exposure, simulates margin pressure
    estimatedRtt = Math.max(70, Number((130 + navDropPercent * 2.5).toFixed(1)));
    if (estimatedRtt < 80) {
      isForceSell = true;
      requiredCashInjection = Math.round(Math.abs(navDropAmount) * 0.6);
    } else if (estimatedRtt < 85) {
      isMarginCall = true;
      requiredCashInjection = Math.round(Math.abs(navDropAmount) * 0.3);
    }
  }

  // Quant AI Defense Strategies
  const quantRecommendations: string[] = [];
  if (stressedCashRatio < 20) {
    quantRecommendations.push(
      `⚠️ Tỷ trọng tiền mặt sau biến cố chỉ còn ${stressedCashRatio.toFixed(1)}%. Khuyến nghị tái cơ cấu để nâng tỷ trọng tiền mặt tối thiểu lên 30% nhằm chủ động bắt đáy khi thị trường cân bằng.`
    );
  } else {
    quantRecommendations.push(
      `🛡️ Đệm tiền mặt ${stressedCashRatio.toFixed(1)}% rất vững chắc. Bạn hoàn toàn có sức mua dồi dào để thực hiện chiến lược Dollar-Cost Averaging (DCA) tại các vùng định giá P/E chiết khấu sâu.`
    );
  }

  const highBetaAssets = assetDetails.filter((a) => a.beta > 1.25);
  if (highBetaAssets.length > 0) {
    const names = highBetaAssets.map((a) => a.symbol).join(', ');
    quantRecommendations.push(
      `⚡ Các mã có hệ số biến động Beta cao (${names}) chịu mức sụt giảm nặng nhất (-${Math.abs(
        highBetaAssets[0].priceDropPercent
      )}%). Cân nhắc đặt lệnh dừng lỗ tự động ATR để bảo toàn vốn.`
    );
  }

  quantRecommendations.push(
    `📈 Thống kê lịch sử: Sau đợt giảm tương tự (${scenario.name}), VN-Index trung bình mất ${scenario.historicalRecoveryDays} ngày để hồi phục lại mức đáy và tăng trưởng trở lại +${scenario.historicalBouncePercent}%.`
  );

  return {
    scenarioName: scenario.name,
    marketDropPercent: Number(effectiveMarketDrop.toFixed(2)),
    marketPointChange: effectivePointChange,
    originalNav: Math.round(originalNav),
    stressedNav: Math.round(stressedNav),
    navDropAmount: Math.round(navDropAmount),
    navDropPercent: Number(navDropPercent.toFixed(2)),
    originalStockValue: Math.round(totalOriginalStockVal),
    stressedStockValue: Math.round(totalStressedStockVal),
    stockDropAmount: Math.round(stockDropAmount),
    stockDropPercent: Number(stockDropPercent.toFixed(2)),
    freeCashAmount: Math.round(freeCash),
    pendingCashAmount: Math.round(pendingCash),
    totalCashBuffer: Math.round(totalCash),
    originalCashRatio: Number(originalCashRatio.toFixed(2)),
    stressedCashRatio: Number(stressedCashRatio.toFixed(2)),
    cashBufferAbsorptionPercent,
    assetDetails,
    marginRisk: {
      estimatedRtt,
      isMarginCall,
      isForceSell,
      requiredCashInjection,
    },
    recoveryEstimate: {
      estimatedDays: scenario.historicalRecoveryDays,
      historicalReboundPotential: scenario.historicalBouncePercent,
      reboundStrategy:
        'Tập trung giải ngân vào các cổ phiếu đầu ngành có P/B dưới 1.2x và ROE trên 18% khi RSI 14 ngày của VN-Index chạm vùng quá bán (< 30).',
    },
    quantRecommendations,
  };
}
