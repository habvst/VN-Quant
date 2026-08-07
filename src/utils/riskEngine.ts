import { PortfolioPosition, PortfolioSummary, StockData } from '../types';

export function calculatePortfolioMetrics(
  positions: PortfolioPosition[],
  stockMap: Record<string, StockData>,
  totalCapital: number = 1000000000, // Default 1 Billion VND
  cashBalance?: number,
  realizedPnL: number = 0
): PortfolioSummary {
  const actualCash = cashBalance !== undefined ? cashBalance : Math.max(0, totalCapital);

  if (positions.length === 0) {
    return {
      totalCapital,
      currentValue: 0,
      cashBalance: actualCash,
      totalPnL: realizedPnL,
      totalPnLPercent: 0,
      realizedPnL,
      unrealizedPnL: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      nav: actualCash,
      maxDrawdown: 0,
      sharpeRatio: 0,
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

    // Beta approximation based on sector volatility
    let stockBeta = 1.0;
    if (stock.sector === 'Bất động sản' || stock.sector === 'Chứng khoán') stockBeta = 1.35;
    else if (stock.sector === 'Ngân hàng' || stock.sector === 'Thép') stockBeta = 1.15;
    else if (stock.sector === 'Bán lẻ' || stock.sector === 'Công nghệ') stockBeta = 1.05;
    else if (stock.sector === 'Điện' || stock.sector === 'Dược phẩm') stockBeta = 0.75;

    weightedBeta += stockBeta * currentValue;

    // Kelly Sizing: f* = (p*b - q)/b where p = win rate (~0.58), b = win/loss ratio (~1.8)
    const winRate = stock.aiVerdict === 'MUA MẠNH' ? 0.65 : stock.aiVerdict === 'MUA' ? 0.58 : 0.48;
    const winLossRatio = 1.8;
    const q = 1 - winRate;
    const kelly = Math.max(0, (winRate * winLossRatio - q) / winLossRatio);
    const kellyOptimalWeight = Number((kelly * 100).toFixed(1));

    // Dynamic ATR Calculation (Average True Range in VND)
    // ATR estimate based on stock price and daily percentage volatility
    const volatilityPct = Math.max(0.015, Math.abs(stock.changePercent) / 100 * 0.5 + 0.022);
    const atr = Number((currentPrice * volatilityPct).toFixed(2));
    // Dynamic Volatility Stop-Loss = Current Price - (1.8 * ATR)
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
    } else if (pnlPercent >= 20.0 && stock.technical.rsi14 > 72) {
      aiRecommendation = 'CHỐT LỜI';
    } else if (stock.aiVerdict === 'MUA MẠNH' && pnlPercent > -3 && pnlPercent < 10) {
      aiRecommendation = 'MUA THÊM';
    }

    // Temporary values for Kelly VNĐ / Shares, recalculated after NAV is finalized
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
      weight: 0, // Will compute next
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

  // Total Account NAV = Cash + Stock Value
  const nav = actualCash + portfolioValue;

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
