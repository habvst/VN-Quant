import { PortfolioPosition, PortfolioSummary, StockData } from '../types';

export function calculatePortfolioMetrics(
  positions: PortfolioPosition[],
  stockMap: Record<string, StockData>,
  totalCapital: number = 1000000000 // Default 1 Billion VND
): PortfolioSummary {
  if (positions.length === 0) {
    return {
      totalCapital,
      currentValue: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      nav: totalCapital,
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
    const costBasis = pos.buyPrice * pos.quantity * (1 + pos.feePercent / 100);
    const currentValue = currentPrice * pos.quantity * (1 - pos.feePercent / 100 - pos.taxPercent / 100);
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

    let aiRecommendation: 'GIỮ' | 'MUA THÊM' | 'CHỐT LỜI' | 'CẮT LỖ' = 'GIỮ';
    if (pnlPercent <= -7.5) {
      aiRecommendation = 'CẮT LỖ';
    } else if (pnlPercent >= 20.0 && stock.technical.rsi14 > 72) {
      aiRecommendation = 'CHỐT LỜI';
    } else if (stock.aiVerdict === 'MUA MẠNH' && pnlPercent > -3 && pnlPercent < 10) {
      aiRecommendation = 'MUA THÊM';
    }

    return {
      ...pos,
      currentPrice,
      currentValue: Number(currentValue.toFixed(0)),
      costBasis: Number(costBasis.toFixed(0)),
      pnl: Number(pnl.toFixed(0)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
      weight: 0, // Will compute next
      riskContribution: 0,
      aiRecommendation,
      kellyOptimalWeight,
    };
  });

  // Calculate Weights and Portfolio Level Metrics
  const portfolioValue = totalCurrentValue;
  const totalPnL = portfolioValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const dailyPnLPercent = portfolioValue > 0 ? (totalDailyPnL / portfolioValue) * 100 : 0;

  const portfolioBeta = portfolioValue > 0 ? Number((weightedBeta / portfolioValue).toFixed(2)) : 1.0;

  // Sector diversification calculation
  const sectorWeights: Record<string, number> = {};
  processedPositions.forEach((pos) => {
    pos.weight = portfolioValue > 0 ? Number(((pos.currentValue / portfolioValue) * 100).toFixed(1)) : 0;
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

  // Max drawdown estimate
  const maxDrawdown = Number(Math.min(18.5, Math.max(3.5, 12 * portfolioBeta - totalPnLPercent * 0.2)).toFixed(2));

  // Portfolio Risk Score (0-100)
  const riskScore = Math.min(100, Math.max(5, Math.round(portfolioBeta * 40 + (100 - diversificationScore) * 0.3 + maxDrawdown * 1.5)));

  return {
    totalCapital,
    currentValue: Number(portfolioValue.toFixed(0)),
    totalPnL: Number(totalPnL.toFixed(0)),
    totalPnLPercent: Number(totalPnLPercent.toFixed(2)),
    realizedPnL: 0,
    unrealizedPnL: Number(totalPnL.toFixed(0)),
    dailyPnL: Number(totalDailyPnL.toFixed(0)),
    dailyPnLPercent: Number(dailyPnLPercent.toFixed(2)),
    nav: Number((totalCapital + totalPnL).toFixed(0)),
    maxDrawdown,
    sharpeRatio: isNaN(sharpeRatio) ? 1.2 : sharpeRatio,
    beta: portfolioBeta,
    var95,
    expectedShortfall,
    riskScore,
    diversificationScore,
    positions: processedPositions,
  };
}
