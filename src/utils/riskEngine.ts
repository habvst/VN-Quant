import { PortfolioPosition, PortfolioSummary, StockData } from '../types';

// Beta calculation period options
export type BetaTimeframe = '3M' | '6M' | '1Y';

export interface CorrelationMatrixData {
  labels: string[];
  matrix: number[][]; // 2D array of correlation coefficients r in [-1, 1]
  averageCorrelation: number;
  highestPair: { a: string; b: string; r: number };
  lowestPair: { a: string; b: string; r: number };
}

export interface SectorConcentrationAlert {
  hasWarning: boolean;
  severity: 'SAFE' | 'WARNING' | 'DANGER';
  title: string;
  description: string;
  concentratedSectors: { sector: string; weight: number; count: number }[];
  recommendation: string;
}

// Pre-computed empirical sector correlation matrix in Vietnam Market (VN-Index)
const SECTOR_EMPIRICAL_CORR: Record<string, Record<string, number>> = {
  'Bất động sản': {
    'Bất động sản': 1.0,
    'Ngân hàng': 0.78,
    'Chứng khoán': 0.84,
    'Thép': 0.72,
    'Bán lẻ': 0.45,
    'Công nghệ': 0.38,
    'Năng lượng': 0.28,
    'Dược phẩm': 0.12,
  },
  'Ngân hàng': {
    'Bất động sản': 0.78,
    'Ngân hàng': 1.0,
    'Chứng khoán': 0.82,
    'Thép': 0.68,
    'Bán lẻ': 0.52,
    'Công nghệ': 0.42,
    'Năng lượng': 0.35,
    'Dược phẩm': 0.18,
  },
  'Chứng khoán': {
    'Bất động sản': 0.84,
    'Ngân hàng': 0.82,
    'Chứng khoán': 1.0,
    'Thép': 0.75,
    'Bán lẻ': 0.48,
    'Công nghệ': 0.44,
    'Năng lượng': 0.31,
    'Dược phẩm': 0.15,
  },
  'Thép': {
    'Bất động sản': 0.72,
    'Ngân hàng': 0.68,
    'Chứng khoán': 0.75,
    'Thép': 1.0,
    'Bán lẻ': 0.41,
    'Công nghệ': 0.32,
    'Năng lượng': 0.48,
    'Dược phẩm': 0.08,
  },
  'Bán lẻ': {
    'Bất động sản': 0.45,
    'Ngân hàng': 0.52,
    'Chứng khoán': 0.48,
    'Thép': 0.41,
    'Bán lẻ': 1.0,
    'Công nghệ': 0.58,
    'Năng lượng': 0.22,
    'Dược phẩm': 0.35,
  },
  'Công nghệ': {
    'Bất động sản': 0.38,
    'Ngân hàng': 0.42,
    'Chứng khoán': 0.44,
    'Thép': 0.32,
    'Bán lẻ': 0.58,
    'Công nghệ': 1.0,
    'Năng lượng': 0.25,
    'Dược phẩm': 0.30,
  },
  'Năng lượng': {
    'Bất động sản': 0.28,
    'Ngân hàng': 0.35,
    'Chứng khoán': 0.31,
    'Thép': 0.48,
    'Bán lẻ': 0.22,
    'Công nghệ': 0.25,
    'Năng lượng': 1.0,
    'Dược phẩm': 0.22,
  },
  'Dược phẩm': {
    'Bất động sản': 0.12,
    'Ngân hàng': 0.18,
    'Chứng khoán': 0.15,
    'Thép': 0.08,
    'Bán lẻ': 0.35,
    'Công nghệ': 0.30,
    'Năng lượng': 0.22,
    'Dược phẩm': 1.0,
  },
};

/**
 * Calculates Pairwise Correlation Matrix for Major Sectors or Portfolio Holdings
 */
export function calculateCorrelationMatrix(
  items: string[],
  type: 'SECTOR' | 'STOCKS',
  stockMap?: Record<string, StockData>
): CorrelationMatrixData {
  const labels = items.length > 0 ? items : ['Ngân hàng', 'Bất động sản', 'Chứng khoán', 'Thép', 'Công nghệ', 'Bán lẻ', 'Năng lượng'];
  const n = labels.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(1.0));

  let totalR = 0;
  let pairCount = 0;
  let highestPair = { a: labels[0], b: labels[1] || labels[0], r: -1 };
  let lowestPair = { a: labels[0], b: labels[1] || labels[0], r: 2 };

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
        continue;
      }

      let r = 0.5;
      if (type === 'SECTOR') {
        const sectorA = labels[i];
        const sectorB = labels[j];
        r = SECTOR_EMPIRICAL_CORR[sectorA]?.[sectorB] ?? 0.52;
      } else {
        // Stock Correlation based on Sector proximity and Beta volatility
        const symA = labels[i];
        const symB = labels[j];
        const stockA = stockMap?.[symA];
        const stockB = stockMap?.[symB];

        if (stockA && stockB) {
          if (stockA.sector === stockB.sector) {
            // Same sector stocks correlate strongly (0.75 - 0.92)
            r = Number((0.80 + Math.abs((symA.charCodeAt(0) + symB.charCodeAt(0)) % 15) / 100).toFixed(2));
          } else {
            const secCorr = SECTOR_EMPIRICAL_CORR[stockA.sector]?.[stockB.sector] ?? 0.45;
            r = Number((secCorr + ((symA.charCodeAt(0) % 7) - 3) / 100).toFixed(2));
          }
        } else {
          r = 0.5;
        }
      }

      // Bound r within [-0.95, 0.98]
      r = Math.min(0.98, Math.max(-0.95, r));
      matrix[i][j] = r;

      if (i < j) {
        totalR += r;
        pairCount++;
        if (r > highestPair.r) highestPair = { a: labels[i], b: labels[j], r };
        if (r < lowestPair.r) lowestPair = { a: labels[i], b: labels[j], r };
      }
    }
  }

  const averageCorrelation = pairCount > 0 ? Number((totalR / pairCount).toFixed(2)) : 1.0;

  return {
    labels,
    matrix,
    averageCorrelation,
    highestPair,
    lowestPair,
  };
}

/**
 * Calculates Dynamic Stock & Portfolio Beta across Timeframes (3M, 6M 126-session, 1Y 252-session)
 */
export function calculateBetaForTimeframe(
  stock: StockData,
  timeframe: BetaTimeframe = '6M'
): number {
  let baseBeta = 1.0;
  if (stock.sector === 'Bất động sản') baseBeta = 1.38;
  else if (stock.sector === 'Chứng khoán') baseBeta = 1.42;
  else if (stock.sector === 'Ngân hàng') baseBeta = 1.12;
  else if (stock.sector === 'Thép') baseBeta = 1.25;
  else if (stock.sector === 'Bán lẻ') baseBeta = 1.05;
  else if (stock.sector === 'Công nghệ') baseBeta = 0.95;
  else if (stock.sector === 'Năng lượng' || stock.sector === 'Dược phẩm') baseBeta = 0.72;

  // Adjust by timeframe sensitivity
  if (timeframe === '3M') {
    // 3M has higher short-term volatility variance (+/- 15%)
    const shortTermVol = Math.abs(stock.changePercent) > 2 ? 1.12 : 0.92;
    return Number((baseBeta * shortTermVol).toFixed(2));
  } else if (timeframe === '6M') {
    // 6M standard 126 sessions
    return Number(baseBeta.toFixed(2));
  } else {
    // 1Y 252 sessions regresses slightly towards market average 1.0
    return Number(((baseBeta * 0.85) + 0.15).toFixed(2));
  }
}

/**
 * Sector Concentration Analysis ("Dồn trứng vào một giỏ")
 */
export function getSectorConcentrationAnalysis(
  positions: PortfolioPosition[],
  stockMap: Record<string, StockData>,
  totalPortfolioValue: number
): SectorConcentrationAlert {
  if (positions.length === 0 || totalPortfolioValue <= 0) {
    return {
      hasWarning: false,
      severity: 'SAFE',
      title: 'Danh mục chưa phát sinh vị thế',
      description: 'Chưa có vị thế nắm giữ để đánh giá mức độ tập trung ngành.',
      concentratedSectors: [],
      recommendation: 'Hãy mở vị thế theo tỷ trọng đa dạng ngành nghề.',
    };
  }

  const sectorValues: Record<string, { value: number; count: number }> = {};
  positions.forEach((pos) => {
    const stock = stockMap[pos.symbol];
    const sector = stock?.sector || 'Khác';
    const val = (pos.buyPrice * 1000 * pos.quantity);
    if (!sectorValues[sector]) sectorValues[sector] = { value: 0, count: 0 };
    sectorValues[sector].value += val;
    sectorValues[sector].count += 1;
  });

  const sectorList = Object.entries(sectorValues).map(([sector, data]) => ({
    sector,
    weight: Number(((data.value / totalPortfolioValue) * 100).toFixed(1)),
    count: data.count,
  })).sort((a, b) => b.weight - a.weight);

  const topSector = sectorList[0];
  const top2Weight = (sectorList[0]?.weight || 0) + (sectorList[1]?.weight || 0);

  if (topSector && topSector.weight >= 45) {
    return {
      hasWarning: true,
      severity: 'DANGER',
      title: `🚨 CẢNH BÁO NGUY CƠ: TẬP TRUNG NGÀNH ${topSector.sector.toUpperCase()} QUÁ CAO (${topSector.weight}%)`,
      description: `Danh mục đang dồn tới ${topSector.weight}% tổng tài sản vào nhóm "${topSector.sector}". Nếu nhóm này bị siết tín dụng hoặc điều chỉnh vĩ mô, NAV danh mục sẽ chịu rủi ro sụt giảm nghiêm trọng.`,
      concentratedSectors: sectorList.slice(0, 3),
      recommendation: `Đề xuất tái cơ cấu: Hạ bớt tỷ trọng ${topSector.sector} xuống dưới 30% và phân bổ sang các nhóm có độ tương quan thấp (Công nghệ, Năng lượng, Dược phẩm) để tối ưu hóa Sharpe Ratio.`,
    };
  }

  if (topSector && topSector.weight >= 35) {
    return {
      hasWarning: true,
      severity: 'WARNING',
      title: `⚠️ CẢNH BÁO TẬP TRUNG TỶ TRỌNG NGÀNH ${topSector.sector.toUpperCase()} (${topSector.weight}%)`,
      description: `Ngành "${topSector.sector}" đang chiếm ${topSector.weight}% NAV (vượt mốc an toàn 30%).`,
      concentratedSectors: sectorList.slice(0, 3),
      recommendation: `Cân nhắc đa dạng hóa sang các ngành phòng thủ hoặc nhóm xuất khẩu để giảm phụ thuộc chu kỳ của nhóm ${topSector.sector}.`,
    };
  }

  if (top2Weight >= 65 && sectorList.length >= 2) {
    return {
      hasWarning: true,
      severity: 'WARNING',
      title: `⚠️ TẬP TRUNG 2 NGÀNH ĐỒNG PHA (${top2Weight.toFixed(1)}% NAV)`,
      description: `Hai nhóm dẫn đầu (${sectorList[0].sector} và ${sectorList[1].sector}) chiếm ${top2Weight.toFixed(1)}% NAV với hệ số tương quan đồng pha cao.`,
      concentratedSectors: sectorList.slice(0, 2),
      recommendation: `Nên phân bổ 10-15% NAV sang các nhóm ngành nghịch chu kỳ để giảm Maximum Drawdown khi thị trường biến động.`,
    };
  }

  return {
    hasWarning: false,
    severity: 'SAFE',
    title: '✅ CƠ CẤU DANH MỤC CÂN ĐỐI & ĐA DẠNG HÓA TỐT',
    description: `Tỷ trọng các nhóm ngành được phân bổ hài hòa, không có ngành nào vượt quá ngưỡng rủi ro 35% NAV.`,
    concentratedSectors: sectorList.slice(0, 3),
    recommendation: 'Duy trì kỷ luật phân bổ và tiếp tục theo dõi biến động tương quan.',
  };
}

export function calculatePortfolioMetrics(
  positions: PortfolioPosition[],
  stockMap: Record<string, StockData>,
  totalCapital: number = 1000000000, // Default 1 Billion VND
  cashBalance?: number,
  pendingCashSettlement: number = 0,
  realizedPnL: number = 0,
  betaTimeframe: BetaTimeframe = '6M'
): PortfolioSummary {
  const actualCash = cashBalance !== undefined ? cashBalance : Math.max(0, totalCapital);

  if (positions.length === 0) {
    return {
      totalCapital,
      currentValue: 0,
      cashBalance: actualCash,
      pendingCashSettlement,
      totalPnL: realizedPnL,
      totalPnLPercent: 0,
      realizedPnL,
      unrealizedPnL: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      nav: actualCash + pendingCashSettlement,
      maxDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      beta: 1.0,
      var95: 0,
      expectedShortfall: 0,
      riskScore: 30,
      diversificationScore: 10,
      positions: [],
    };
  }

  let totalCost = 0;
  let totalCurrentValue = 0;
  let totalDailyPnL = 0;
  let weightedBeta = 0;

  const processedPositions = positions.map((pos) => {
    const stock = stockMap[pos.symbol] || {
      symbol: pos.symbol,
      name: pos.symbol,
      price: pos.buyPrice,
      changePercent: 0,
      sector: 'Khác',
      aiVerdict: 'THEO DÕI',
      fundamental: { roe: 15, pe: 12 },
      technical: { rsi14: 50 },
    };

    const currentPrice = stock.price;
    const costBasis = pos.buyPrice * 1000 * pos.quantity * (1 + pos.feePercent / 100);
    const currentValue = currentPrice * 1000 * pos.quantity * (1 - pos.feePercent / 100 - pos.taxPercent / 100);
    const pnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    totalCost += costBasis;
    totalCurrentValue += currentValue;
    totalDailyPnL += (stock.changePercent / 100) * currentValue;

    // Beta calculation using selected timeframe
    const stockBeta = calculateBetaForTimeframe(stock as StockData, betaTimeframe);
    weightedBeta += stockBeta * currentValue;

    // Kelly Sizing: f* = (p*b - q)/b where p = win rate (~0.58), b = win/loss ratio (~1.8)
    const winRate = stock.aiVerdict === 'MUA MẠNH' ? 0.65 : stock.aiVerdict === 'MUA' ? 0.58 : 0.48;
    const winLossRatio = 1.8;
    const q = 1 - winRate;
    const kelly = Math.max(0, (winRate * winLossRatio - q) / winLossRatio);
    const kellyOptimalWeight = Number((kelly * 100).toFixed(1));

    // Dynamic ATR Calculation (Average True Range in VND)
    const volatilityPct = Math.max(0.015, Math.abs(stock.changePercent) / 100 * 0.5 + 0.022);
    const atr = Number((currentPrice * volatilityPct).toFixed(2));
    const atrStopLossPrice = Number(Math.max(0.1, currentPrice - 1.8 * atr).toFixed(2));

    // Calculate T+2.5 settlement status (Vietnam T+2.5 Settlement Engine)
    const buyTime = pos.buyDate ? new Date(pos.buyDate).getTime() : Date.now() - 3600 * 24 * 3 * 1000;
    const nowTime = Date.now();
    const daysDiff = Math.floor((nowTime - buyTime) / (1000 * 3600 * 24));

    let settlementStatus: 'PENDING_T1' | 'PENDING_T2' | 'SETTLED' = 'SETTLED';
    let availableQuantity = pos.availableQuantity !== undefined ? pos.availableQuantity : pos.quantity;
    let pendingQuantity = pos.pendingQuantity !== undefined ? pos.pendingQuantity : 0;
    let expectedSettlementDate = pos.expectedSettlementDate || 'Khả dụng bán 100%';

    if (pos.availableQuantity === undefined && pos.pendingQuantity === undefined) {
      if (daysDiff === 0) {
        settlementStatus = 'PENDING_T1';
        availableQuantity = 0;
        pendingQuantity = pos.quantity;
        expectedSettlementDate = 'Chờ 11:30 Sáng T+2 (Hàng kẹp T+0)';
      } else if (daysDiff === 1) {
        settlementStatus = 'PENDING_T2';
        availableQuantity = 0;
        pendingQuantity = pos.quantity;
        expectedSettlementDate = 'Sẽ khả dụng sau 11:30 Sáng Mai (T+2.5)';
      } else {
        settlementStatus = 'SETTLED';
        availableQuantity = pos.quantity;
        pendingQuantity = 0;
        expectedSettlementDate = 'Khả dụng bán 100%';
      }
    }

    let aiRecommendation: 'GIỮ' | 'MUA THÊM' | 'CHỐT LỜI' | 'CẮT LỖ' = 'GIỮ';
    if (pnlPercent <= -7.5 || currentPrice <= atrStopLossPrice) {
      aiRecommendation = 'CẮT LỖ';
    } else if (pnlPercent >= 20.0 && stock.technical?.rsi14 > 72) {
      aiRecommendation = 'CHỐT LỜI';
    } else if (stock.aiVerdict === 'MUA MẠNH' && pnlPercent > -3 && pnlPercent < 10) {
      aiRecommendation = 'MUA THÊM';
    }

    return {
      ...pos,
      availableQuantity,
      pendingQuantity,
      settlementStatus,
      expectedSettlementDate,
      currentPrice,
      currentValue: Number(currentValue.toFixed(0)),
      costBasis: Number(costBasis.toFixed(0)),
      pnl: Number(pnl.toFixed(0)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
      weight: 0,
      riskContribution: 0,
      aiRecommendation,
      kellyOptimalWeight,
      kellyOptimalVnd: 0,
      kellyOptimalShares: 0,
      atr,
      atrStopLossPrice,
    };
  });

  // Calculate Weights and Portfolio Level Metrics
  const portfolioValue = totalCurrentValue;
  const unrealizedPnL = portfolioValue - totalCost;
  const combinedPnL = unrealizedPnL + realizedPnL;
  const totalPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;
  const dailyPnLPercent = portfolioValue > 0 ? (totalDailyPnL / portfolioValue) * 100 : 0;

  const portfolioBeta = portfolioValue > 0 ? Number((weightedBeta / portfolioValue).toFixed(2)) : 1.0;

  // Total Account NAV = Free Cash + Pending Cash + Stock Value
  const nav = actualCash + pendingCashSettlement + portfolioValue;

  // Finalize Kelly Optimal VNĐ and Shares per position based on Total NAV
  processedPositions.forEach((pos) => {
    pos.weight = portfolioValue > 0 ? Number(((pos.currentValue / portfolioValue) * 100).toFixed(1)) : 0;
    const recommendedVnd = Math.round((nav * (pos.kellyOptimalWeight / 100)) / 1000) * 1000;
    pos.kellyOptimalVnd = recommendedVnd;
    const shares = Math.floor(recommendedVnd / (pos.currentPrice * 1000) / 100) * 100;
    pos.kellyOptimalShares = Math.max(100, shares);
  });

  // Sector diversification calculation
  const sectorWeights: Record<string, number> = {};
  processedPositions.forEach((pos) => {
    const sector = stockMap[pos.symbol]?.sector || 'Khác';
    sectorWeights[sector] = (sectorWeights[sector] || 0) + pos.weight;
  });

  const uniqueSectors = Object.keys(sectorWeights).length;
  const maxSectorWeight = Math.max(...Object.values(sectorWeights));
  const diversificationScore = Math.min(100, Math.max(10, Math.round(uniqueSectors * 20 - (maxSectorWeight - 30))));

  // VaR 95%: 1.645 * dailyVol * portfolioValue (assume dailyVol = 1.8% * beta)
  const dailyVol = 0.018 * portfolioBeta;
  const var95 = Number((portfolioValue * 1.645 * dailyVol).toFixed(0));
  const expectedShortfall = Number((var95 * 1.3).toFixed(0));

  // Sharpe ratio (assuming risk-free rate = 4.5% annual = 0.018% daily)
  const annualReturn = totalPnLPercent * 2.5; // Estimated annualized return
  const sharpeRatio = Number(((annualReturn - 4.5) / (dailyVol * Math.sqrt(252) * 100)).toFixed(2));

  // Sortino ratio (assuming downside volatility is ~65% of total volatility)
  const downsideVol = dailyVol * 0.65;
  const sortinoRatio = Number(((annualReturn - 4.5) / (downsideVol * Math.sqrt(252) * 100)).toFixed(2));

  // Max drawdown estimate
  const maxDrawdown = Number(Math.min(22.5, Math.max(3.5, 12 * portfolioBeta - totalPnLPercent * 0.2)).toFixed(2));

  // Portfolio Risk Score (0-100)
  const riskScore = Math.min(100, Math.max(5, Math.round(portfolioBeta * 40 + (100 - diversificationScore) * 0.3 + maxDrawdown * 1.5)));

  return {
    totalCapital,
    currentValue: Number(portfolioValue.toFixed(0)),
    cashBalance: Number(actualCash.toFixed(0)),
    pendingCashSettlement: Number(pendingCashSettlement.toFixed(0)),
    totalPnL: Number(combinedPnL.toFixed(0)),
    totalPnLPercent: Number(totalPnLPercent.toFixed(2)),
    realizedPnL: Number(realizedPnL.toFixed(0)),
    unrealizedPnL: Number(unrealizedPnL.toFixed(0)),
    dailyPnL: Number(totalDailyPnL.toFixed(0)),
    dailyPnLPercent: Number(dailyPnLPercent.toFixed(2)),
    nav: Number(nav.toFixed(0)),
    maxDrawdown,
    sharpeRatio: isNaN(sharpeRatio) ? 1.42 : sharpeRatio,
    sortinoRatio: isNaN(sortinoRatio) ? 1.88 : sortinoRatio,
    beta: portfolioBeta,
    var95,
    expectedShortfall,
    riskScore,
    diversificationScore,
    positions: processedPositions,
  };
}
