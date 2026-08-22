import { StockData } from '../types';
import { calculateBetaForTimeframe } from './riskEngine';

export type MarketRegime = 'NEUTRAL' | 'BULLISH' | 'BEARISH' | 'HIGH_VOLATILITY' | 'CUSTOM';

export interface MonteCarloConfig {
  simulationsCount: number; // e.g. 1000, 2500, 5000, 10000
  timeHorizonDays: number; // e.g. 30, 60, 90 days
  marketRegime: MarketRegime;
  customAnnualDrift?: number; // % e.g. 12%
  customAnnualVol?: number; // % e.g. 20%
  riskFreeRate?: number; // % e.g. 5%
}

export interface RegimeDetails {
  id: MarketRegime;
  name: string;
  badge: string;
  description: string;
  marketDrift: number; // % / year
  marketVol: number; // % / year
}

export const MARKET_REGIMES: Record<MarketRegime, RegimeDetails> = {
  NEUTRAL: {
    id: 'NEUTRAL',
    name: 'Thị trường Cơ sở / Trung tính (Base Case)',
    badge: 'CHUẨN ĐỊNH LƯỢNG',
    description: 'VN-Index tăng trưởng theo xu thế lịch sử dài hạn (+12%/năm) với biên độ dao động tiêu chuẩn (~18%/năm).',
    marketDrift: 12.0,
    marketVol: 18.0,
  },
  BULLISH: {
    id: 'BULLISH',
    name: 'Thị trường Tăng mạnh / Đại sóng (Bull Run)',
    badge: 'XU HƯỚNG TĂNG',
    description: 'Dòng tiền dồi dào, thanh khoản bùng nổ, định giá P/E mở rộng (+24%/năm, biến động ~15%/năm).',
    marketDrift: 24.0,
    marketVol: 15.0,
  },
  BEARISH: {
    id: 'BEARISH',
    name: 'Thị trường Điều chỉnh / Áp lực Bán (Bear Market)',
    badge: 'ÁP LỰC ĐIỀU CHỈNH',
    description: 'Thắt chặt thanh khoản, tỷ giá căng thẳng, áp lực rút vốn (-16%/năm, biến động cao ~26%/năm).',
    marketDrift: -16.0,
    marketVol: 26.0,
  },
  HIGH_VOLATILITY: {
    id: 'HIGH_VOLATILITY',
    name: 'Biến động Cực đại / Rung lắc mạnh (High Vol)',
    badge: 'BIẾN ĐỘNG MẠNH',
    description: 'Thị trường đi ngang với biên độ co giật lớn quanh vùng nhạy cảm (+2%/năm, biến động ~34%/năm).',
    marketDrift: 2.0,
    marketVol: 34.0,
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Tùy biến Kỳ vọng & Biến động Macro (Custom Parameters)',
    badge: 'TÙY BIẾN',
    description: 'Tùy chỉnh trực tiếp tỷ lệ kỳ vọng lợi nhuận và mức độ biến động hàng năm của thị trường.',
    marketDrift: 10.0,
    marketVol: 20.0,
  },
};

export interface TrajectoryDataPoint {
  day: number;
  dayLabel: string;
  dateStr: string;
  p5: number;
  p10: number;
  p25: number;
  p50: number; // Median
  p75: number;
  p90: number;
  p95: number;
  mean: number;
  initialNav: number;
  // Representative sample paths for background spaghetti rendering
  samplePaths: number[];
}

export interface DistributionBin {
  binIndex: number;
  minVal: number;
  maxVal: number;
  midVal: number;
  rangeLabel: string;
  count: number;
  probabilityPercent: number;
  cumulativePercent: number;
  isLoss: boolean;
  isInitialNavBin: boolean;
  category: 'SEVERE_LOSS' | 'MODERATE_LOSS' | 'MILD_LOSS' | 'MILD_GAIN' | 'STRONG_GAIN' | 'SUPER_GAIN';
}

export interface MonteCarloSimulationResult {
  config: MonteCarloConfig;
  initialNav: number;
  initialStockValue: number;
  cashValue: number;
  cashWeightPercent: number;
  stockWeightPercent: number;
  portfolioAnnualDrift: number; // %
  portfolioAnnualVol: number; // %
  portfolioDailyDrift: number; // %
  portfolioDailyVol: number; // %
  diversificationBenefitPercent: number; // % giảm biến động nhờ đa dạng hóa

  // Trajectory series
  trajectories: TrajectoryDataPoint[];

  // Terminal statistics at Day T
  terminalStats: {
    meanNav: number;
    medianNav: number;
    stdDevNav: number;
    minNav: number;
    maxNav: number;
    p1Nav: number;
    p5Nav: number;
    p10Nav: number;
    p25Nav: number;
    p50Nav: number;
    p75Nav: number;
    p90Nav: number;
    p95Nav: number;
    p99Nav: number;

    expectedReturnAmount: number;
    expectedReturnPercent: number;
    medianReturnAmount: number;
    medianReturnPercent: number;
    bestCaseGainAmount: number; // P95 - Initial
    bestCaseGainPercent: number;
    worstCaseLossAmount: number; // Initial - P5
    worstCaseLossPercent: number;

    // Probabilities
    probProfit: number; // %
    probLoss: number; // %
    probLoss5Pct: number; // %
    probLoss10Pct: number; // %
    probLoss20Pct: number; // %
    probGain10Pct: number; // %
    probGain20Pct: number; // %

    // Value at Risk & Expected Shortfall
    var95Amount: number; // VND
    var95Percent: number; // %
    var99Amount: number; // VND
    var99Percent: number; // %
    cvar95Amount: number; // Expected Shortfall (CVaR)
    cvar95Percent: number;
  };

  // Probability distribution histogram bins
  distributionBins: DistributionBin[];

  // Quantitative AI Evaluation & Strategy Recommendations
  aiInsights: {
    riskRating: 'RẤT THẤP' | 'THẤP' | 'TRUNG BÌNH' | 'CAO' | 'CỰC KỲ NGUY HIỂM';
    summaryComment: string;
    keyObservations: string[];
    actionPlan: string[];
    suggestedCashBufferAdjust: string;
  };
}

/**
 * Standard sector volatility baseline (%/year) in Vietnam Market
 */
const SECTOR_VOLATILITY: Record<string, number> = {
  'Chứng khoán': 0.35,
  'Bất động sản': 0.33,
  'Thép': 0.28,
  'Bán lẻ': 0.24,
  'Ngân hàng': 0.22,
  'Công nghệ': 0.26,
  'Năng lượng': 0.19,
  'Dược phẩm': 0.17,
  'Khác': 0.25,
};

/**
 * Empirical sector correlation matrix
 */
const SECTOR_CORRELATION: Record<string, Record<string, number>> = {
  'Bất động sản': { 'Bất động sản': 1.0, 'Ngân hàng': 0.78, 'Chứng khoán': 0.84, 'Thép': 0.72, 'Bán lẻ': 0.45, 'Công nghệ': 0.38, 'Năng lượng': 0.28, 'Dược phẩm': 0.12, 'Khác': 0.5 },
  'Ngân hàng': { 'Bất động sản': 0.78, 'Ngân hàng': 1.0, 'Chứng khoán': 0.82, 'Thép': 0.68, 'Bán lẻ': 0.52, 'Công nghệ': 0.42, 'Năng lượng': 0.35, 'Dược phẩm': 0.18, 'Khác': 0.5 },
  'Chứng khoán': { 'Bất động sản': 0.84, 'Ngân hàng': 0.82, 'Chứng khoán': 1.0, 'Thép': 0.75, 'Bán lẻ': 0.48, 'Công nghệ': 0.44, 'Năng lượng': 0.31, 'Dược phẩm': 0.15, 'Khác': 0.5 },
  'Thép': { 'Bất động sản': 0.72, 'Ngân hàng': 0.68, 'Chứng khoán': 0.75, 'Thép': 1.0, 'Bán lẻ': 0.41, 'Công nghệ': 0.32, 'Năng lượng': 0.48, 'Dược phẩm': 0.08, 'Khác': 0.5 },
  'Bán lẻ': { 'Bất động sản': 0.45, 'Ngân hàng': 0.52, 'Chứng khoán': 0.48, 'Thép': 0.41, 'Bán lẻ': 1.0, 'Công nghệ': 0.58, 'Năng lượng': 0.22, 'Dược phẩm': 0.35, 'Khác': 0.45 },
  'Công nghệ': { 'Bất động sản': 0.38, 'Ngân hàng': 0.42, 'Chứng khoán': 0.44, 'Thép': 0.32, 'Bán lẻ': 0.58, 'Công nghệ': 1.0, 'Năng lượng': 0.25, 'Dược phẩm': 0.30, 'Khác': 0.4 },
  'Năng lượng': { 'Bất động sản': 0.28, 'Ngân hàng': 0.35, 'Chứng khoán': 0.31, 'Thép': 0.48, 'Bán lẻ': 0.22, 'Công nghệ': 0.25, 'Năng lượng': 1.0, 'Dược phẩm': 0.22, 'Khác': 0.35 },
  'Dược phẩm': { 'Bất động sản': 0.12, 'Ngân hàng': 0.18, 'Chứng khoán': 0.15, 'Thép': 0.08, 'Bán lẻ': 0.35, 'Công nghệ': 0.30, 'Năng lượng': 0.22, 'Dược phẩm': 1.0, 'Khác': 0.2 },
  'Khác': { 'Bất động sản': 0.5, 'Ngân hàng': 0.5, 'Chứng khoán': 0.5, 'Thép': 0.5, 'Bán lẻ': 0.45, 'Công nghệ': 0.4, 'Năng lượng': 0.35, 'Dược phẩm': 0.2, 'Khác': 1.0 },
};

/**
 * Fast standard normal random generator (Box-Muller Transform)
 */
function generateStandardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Helper to compute quantile from a sorted array
 */
function getQuantile(sortedArr: number[], q: number): number {
  if (sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

/**
 * Runs a high-performance Vectorized Monte Carlo simulation on the portfolio
 */
export function runMonteCarloSimulation(
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
  config: MonteCarloConfig
): MonteCarloSimulationResult {
  const stockMap: Record<string, StockData> = {};
  stocks.forEach((s) => {
    stockMap[s.symbol] = s;
  });

  const totalCash = Math.max(0, freeCash) + Math.max(0, pendingCash);
  let totalStockValue = 0;

  const validPositions = positions.filter((p) => p.quantity > 0);
  validPositions.forEach((pos) => {
    const stock = stockMap[pos.symbol];
    const price = pos.currentPrice || stock?.price || pos.buyPrice;
    totalStockValue += pos.quantity * price * 1000;
  });

  const initialNav = Math.max(1, totalStockValue + totalCash);
  const cashWeight = totalCash / initialNav;
  const stockWeight = totalStockValue / initialNav;

  // 1. Determine Market Regime Parameters
  const regime = MARKET_REGIMES[config.marketRegime] || MARKET_REGIMES.NEUTRAL;
  const marketDriftAnnual = (config.marketRegime === 'CUSTOM' && config.customAnnualDrift !== undefined)
    ? config.customAnnualDrift / 100
    : regime.marketDrift / 100;
  const marketVolAnnual = (config.marketRegime === 'CUSTOM' && config.customAnnualVol !== undefined)
    ? Math.max(0.05, config.customAnnualVol / 100)
    : regime.marketVol / 100;
  const riskFreeRate = (config.riskFreeRate ?? 5.0) / 100;

  // 2. Calculate Asset-Level Expected Drift & Volatility
  interface AssetParam {
    symbol: string;
    sector: string;
    weight: number;
    drift: number;
    vol: number;
    beta: number;
  }

  const assetParams: AssetParam[] = [];
  let weightedUndiversifiedVol = 0;

  validPositions.forEach((pos) => {
    const stock = stockMap[pos.symbol];
    const sector = stock?.sector || 'Khác';
    const beta = stock ? calculateBetaForTimeframe(stock, '6M') : 1.1;
    const price = pos.currentPrice || stock?.price || pos.buyPrice;
    const val = pos.quantity * price * 1000;
    const weight = val / initialNav;

    // Base sector volatility scaled by beta
    const baseSectorVol = SECTOR_VOLATILITY[sector] || 0.25;
    const stockVol = Math.max(0.12, baseSectorVol * Math.sqrt(0.4 + 0.6 * beta * beta));

    // CAPM Expected Return: r_f + beta * (r_m - r_f)
    const stockDrift = riskFreeRate + beta * (marketDriftAnnual - riskFreeRate);

    assetParams.push({
      symbol: pos.symbol,
      sector,
      weight,
      drift: stockDrift,
      vol: stockVol,
      beta,
    });

    weightedUndiversifiedVol += weight * stockVol;
  });

  // Cash asset
  const cashDrift = riskFreeRate;
  const cashVol = 0.0;

  // 3. Calculate Portfolio-Level Drift & Volatility (incorporating Covariance matrix)
  let portfolioAnnualDrift = cashWeight * cashDrift;
  assetParams.forEach((a) => {
    portfolioAnnualDrift += a.weight * a.drift;
  });

  // Covariance sum for portfolio variance
  let portfolioVariance = 0;
  for (let i = 0; i < assetParams.length; i++) {
    for (let j = 0; j < assetParams.length; j++) {
      const a_i = assetParams[i];
      const a_j = assetParams[j];
      const corr = i === j ? 1.0 : (SECTOR_CORRELATION[a_i.sector]?.[a_j.sector] ?? 0.45);
      portfolioVariance += a_i.weight * a_j.weight * a_i.vol * a_j.vol * corr;
    }
  }

  // Handle edge case of 100% cash or empty stocks
  const portfolioAnnualVol = validPositions.length > 0
    ? Math.max(0.01, Math.sqrt(Math.max(0, portfolioVariance)))
    : 0.005;

  const diversificationBenefitPercent = weightedUndiversifiedVol > 0
    ? Math.max(0, Number((((weightedUndiversifiedVol - portfolioAnnualVol) / weightedUndiversifiedVol) * 100).toFixed(1)))
    : 0;

  // 4. Daily Parameters for Geometric Brownian Motion
  // Trading days per year = 252
  const dt = 1.0 / 252.0;
  const dailyDrift = (portfolioAnnualDrift - 0.5 * portfolioAnnualVol * portfolioAnnualVol) * dt;
  const dailyVol = portfolioAnnualVol * Math.sqrt(dt);

  const numSims = Math.min(10000, Math.max(500, config.simulationsCount || 2500));
  const numDays = Math.min(180, Math.max(10, config.timeHorizonDays || 60));

  // 5. Run Vectorized Monte Carlo Simulations
  // We track terminal values and trajectory milestones
  const terminalNavs = new Float64Array(numSims);

  // We record day-by-day trajectories for quantiles
  // To keep memory fast and lean, we allocate 2D matrix [day][sim]
  const daysTrajectory: Float64Array[] = [];
  for (let d = 0; d <= numDays; d++) {
    daysTrajectory.push(new Float64Array(numSims));
  }

  // Initialize Day 0
  for (let s = 0; s < numSims; s++) {
    daysTrajectory[0][s] = initialNav;
  }

  // Sample 20 random indices to store raw sample paths for the spaghetti fan visualization
  const sampleIndices = Array.from({ length: 20 }, () => Math.floor(Math.random() * numSims));

  // Simulate paths
  for (let s = 0; s < numSims; s++) {
    let currentNav = initialNav;
    for (let d = 1; d <= numDays; d++) {
      const z = generateStandardNormal();
      const returnFactor = Math.exp(dailyDrift + dailyVol * z);
      currentNav *= returnFactor;
      daysTrajectory[d][s] = currentNav;
    }
    terminalNavs[s] = currentNav;
  }

  // 6. Process Trajectory Quantiles Across Time (Day 0 to Day T)
  const trajectoryPoints: TrajectoryDataPoint[] = [];
  const now = new Date();

  // Downsample step if numDays is large to optimize Recharts rendering
  const step = numDays > 90 ? 2 : 1;

  for (let d = 0; d <= numDays; d += step) {
    // If last step wasn't reached, ensure day numDays is included
    const targetDay = d;
    const simValuesAtDay = Array.from(daysTrajectory[targetDay]).sort((a, b) => a - b);

    const date = new Date(now.getTime() + targetDay * 24 * 60 * 60 * 1000);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

    const p5 = Math.round(getQuantile(simValuesAtDay, 0.05));
    const p10 = Math.round(getQuantile(simValuesAtDay, 0.10));
    const p25 = Math.round(getQuantile(simValuesAtDay, 0.25));
    const p50 = Math.round(getQuantile(simValuesAtDay, 0.50));
    const p75 = Math.round(getQuantile(simValuesAtDay, 0.75));
    const p90 = Math.round(getQuantile(simValuesAtDay, 0.90));
    const p95 = Math.round(getQuantile(simValuesAtDay, 0.95));

    const sumVal = simValuesAtDay.reduce((acc, v) => acc + v, 0);
    const mean = Math.round(sumVal / numSims);

    const samplePaths = sampleIndices.map((idx) => Math.round(daysTrajectory[targetDay][idx]));

    trajectoryPoints.push({
      day: targetDay,
      dayLabel: targetDay === 0 ? 'Hiện tại (T+0)' : `T+${targetDay}`,
      dateStr,
      p5,
      p10,
      p25,
      p50,
      p75,
      p90,
      p95,
      mean,
      initialNav: Math.round(initialNav),
      samplePaths,
    });
  }

  // Ensure last day is present
  if (trajectoryPoints[trajectoryPoints.length - 1].day !== numDays) {
    const simValuesAtEnd = Array.from(daysTrajectory[numDays]).sort((a, b) => a - b);
    const date = new Date(now.getTime() + numDays * 24 * 60 * 60 * 1000);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
    trajectoryPoints.push({
      day: numDays,
      dayLabel: `T+${numDays}`,
      dateStr,
      p5: Math.round(getQuantile(simValuesAtEnd, 0.05)),
      p10: Math.round(getQuantile(simValuesAtEnd, 0.10)),
      p25: Math.round(getQuantile(simValuesAtEnd, 0.25)),
      p50: Math.round(getQuantile(simValuesAtEnd, 0.50)),
      p75: Math.round(getQuantile(simValuesAtEnd, 0.75)),
      p90: Math.round(getQuantile(simValuesAtEnd, 0.90)),
      p95: Math.round(getQuantile(simValuesAtEnd, 0.95)),
      mean: Math.round(simValuesAtEnd.reduce((acc, v) => acc + v, 0) / numSims),
      initialNav: Math.round(initialNav),
      samplePaths: sampleIndices.map((idx) => Math.round(daysTrajectory[numDays][idx])),
    });
  }

  // 7. Calculate Terminal Statistics
  const sortedTerminal = Array.from(terminalNavs).sort((a, b) => a - b);
  const sumTerminal = sortedTerminal.reduce((a, b) => a + b, 0);
  const meanNav = Math.round(sumTerminal / numSims);
  const medianNav = Math.round(getQuantile(sortedTerminal, 0.50));

  let varianceSum = 0;
  for (let s = 0; s < numSims; s++) {
    varianceSum += Math.pow(sortedTerminal[s] - meanNav, 2);
  }
  const stdDevNav = Math.round(Math.sqrt(varianceSum / numSims));

  const minNav = Math.round(sortedTerminal[0]);
  const maxNav = Math.round(sortedTerminal[sortedTerminal.length - 1]);
  const p1Nav = Math.round(getQuantile(sortedTerminal, 0.01));
  const p5Nav = Math.round(getQuantile(sortedTerminal, 0.05));
  const p10Nav = Math.round(getQuantile(sortedTerminal, 0.10));
  const p25Nav = Math.round(getQuantile(sortedTerminal, 0.25));
  const p50Nav = medianNav;
  const p75Nav = Math.round(getQuantile(sortedTerminal, 0.75));
  const p90Nav = Math.round(getQuantile(sortedTerminal, 0.90));
  const p95Nav = Math.round(getQuantile(sortedTerminal, 0.95));
  const p99Nav = Math.round(getQuantile(sortedTerminal, 0.99));

  // Probabilities
  let countProfit = 0;
  let countLoss5Pct = 0;
  let countLoss10Pct = 0;
  let countLoss20Pct = 0;
  let countGain10Pct = 0;
  let countGain20Pct = 0;
  let worst5PercentLossSum = 0;
  const p5ThresholdCount = Math.floor(numSims * 0.05);

  for (let s = 0; s < numSims; s++) {
    const val = sortedTerminal[s];
    if (val >= initialNav) countProfit++;
    if (val < initialNav * 0.95) countLoss5Pct++;
    if (val < initialNav * 0.90) countLoss10Pct++;
    if (val < initialNav * 0.80) countLoss20Pct++;
    if (val > initialNav * 1.10) countGain10Pct++;
    if (val > initialNav * 1.20) countGain20Pct++;

    if (s < p5ThresholdCount) {
      worst5PercentLossSum += Math.max(0, initialNav - val);
    }
  }

  const probProfit = Number(((countProfit / numSims) * 100).toFixed(1));
  const probLoss = Number((100 - probProfit).toFixed(1));
  const probLoss5Pct = Number(((countLoss5Pct / numSims) * 100).toFixed(1));
  const probLoss10Pct = Number(((countLoss10Pct / numSims) * 100).toFixed(1));
  const probLoss20Pct = Number(((countLoss20Pct / numSims) * 100).toFixed(1));
  const probGain10Pct = Number(((countGain10Pct / numSims) * 100).toFixed(1));
  const probGain20Pct = Number(((countGain20Pct / numSims) * 100).toFixed(1));

  // VaR & Expected Shortfall (CVaR)
  const var95Amount = Math.max(0, initialNav - p5Nav);
  const var95Percent = Number(((var95Amount / initialNav) * 100).toFixed(2));
  const var99Amount = Math.max(0, initialNav - p1Nav);
  const var99Percent = Number(((var99Amount / initialNav) * 100).toFixed(2));

  const cvar95Amount = p5ThresholdCount > 0 ? Math.round(worst5PercentLossSum / p5ThresholdCount) : var95Amount;
  const cvar95Percent = Number(((cvar95Amount / initialNav) * 100).toFixed(2));

  const expectedReturnAmount = meanNav - initialNav;
  const expectedReturnPercent = Number(((expectedReturnAmount / initialNav) * 100).toFixed(2));
  const medianReturnAmount = medianNav - initialNav;
  const medianReturnPercent = Number(((medianReturnAmount / initialNav) * 100).toFixed(2));

  const bestCaseGainAmount = Math.max(0, p95Nav - initialNav);
  const bestCaseGainPercent = Number(((bestCaseGainAmount / initialNav) * 100).toFixed(2));
  const worstCaseLossAmount = var95Amount;
  const worstCaseLossPercent = var95Percent;

  // 8. Generate Histogram Bins for Probability Density Function
  const binCount = 28;
  const binMin = getQuantile(sortedTerminal, 0.005);
  const binMax = getQuantile(sortedTerminal, 0.995);
  const binWidth = (binMax - binMin) / binCount;

  const distributionBins: DistributionBin[] = [];
  let cumCount = 0;

  for (let b = 0; b < binCount; b++) {
    const curMin = binMin + b * binWidth;
    const curMax = curMin + binWidth;
    const midVal = Math.round((curMin + curMax) / 2);

    let count = 0;
    for (let s = 0; s < numSims; s++) {
      const v = sortedTerminal[s];
      if (b === binCount - 1) {
        if (v >= curMin) count++;
      } else if (v >= curMin && v < curMax) {
        count++;
      }
    }

    cumCount += count;
    const probabilityPercent = Number(((count / numSims) * 100).toFixed(2));
    const cumulativePercent = Number(((cumCount / numSims) * 100).toFixed(1));
    const isLoss = midVal < initialNav;
    const isInitialNavBin = initialNav >= curMin && initialNav <= curMax;

    // Category classification
    const returnPct = ((midVal - initialNav) / initialNav) * 100;
    let category: DistributionBin['category'] = 'MILD_GAIN';
    if (returnPct <= -15) category = 'SEVERE_LOSS';
    else if (returnPct <= -7) category = 'MODERATE_LOSS';
    else if (returnPct < 0) category = 'MILD_LOSS';
    else if (returnPct < 8) category = 'MILD_GAIN';
    else if (returnPct < 18) category = 'STRONG_GAIN';
    else category = 'SUPER_GAIN';

    const fmtMin = (curMin / 1_000_000).toFixed(1);
    const fmtMax = (curMax / 1_000_000).toFixed(1);

    distributionBins.push({
      binIndex: b,
      minVal: Math.round(curMin),
      maxVal: Math.round(curMax),
      midVal,
      rangeLabel: `${fmtMin}M - ${fmtMax}M`,
      count,
      probabilityPercent,
      cumulativePercent,
      isLoss,
      isInitialNavBin,
      category,
    });
  }

  // 9. AI Quant Assessment & Insights
  let riskRating: MonteCarloSimulationResult['aiInsights']['riskRating'] = 'TRUNG BÌNH';
  if (var95Percent > 22 || probLoss > 60) {
    riskRating = 'CỰC KỲ NGUY HIỂM';
  } else if (var95Percent > 15 || probLoss > 50) {
    riskRating = 'CAO';
  } else if (var95Percent > 8) {
    riskRating = 'TRUNG BÌNH';
  } else if (var95Percent > 4) {
    riskRating = 'THẤP';
  } else {
    riskRating = 'RẤT THẤP';
  }

  const keyObservations: string[] = [
    `Xác suất sinh lời dương trong ${numDays} ngày tới đạt ${probProfit}% (kỳ vọng NAV trung vị đạt ${(medianNav / 1_000_000).toFixed(1)} tr VNĐ, tăng trưởng ${medianReturnPercent >= 0 ? '+' : ''}${medianReturnPercent}%).`,
    `Rủi ro sụt giảm tối đa tại mức tin cậy 95% (Monte Carlo VaR 95%) là ${(var95Amount / 1_000_000).toFixed(1)} tr VNĐ (-${var95Percent}% NAV).`,
    `Trong trường hợp xảy ra biến cố đuôi cực đoan (Worst 5% CVaR), mức thiệt hại trung bình dự kiến là ${(cvar95Amount / 1_000_000).toFixed(1)} tr VNĐ (-${cvar95Percent}% NAV).`,
    `Đệm tiền mặt hiện tại (${(cashWeight * 100).toFixed(1)}% NAV) và hiệu ứng đa dạng hóa đã giúp giảm ${diversificationBenefitPercent}% độ biến động tổng thể so với việc nắm giữ riêng lẻ từng cổ phiếu.`,
  ];

  const actionPlan: string[] = [];
  let suggestedCashBufferAdjust = 'Duy trì tỷ lệ hiện tại';

  if (probLoss > 45 || var95Percent > 15) {
    actionPlan.push(`Cân nhắc nâng tỷ trọng tiền mặt từ ${(cashWeight * 100).toFixed(0)}% lên mức 30-40% để co hẹp khoảng biến động đuôi.`);
    actionPlan.push(`Thiết lập chặn lỗ cứng (Hard Stop-Loss) ở mức -${Math.min(7, Math.round(var95Percent / 2))}% cho các mã có Beta > 1.3.`);
    actionPlan.push('Cân nhắc mở vị thế phòng vệ Short phái sinh VN30F1M tương ứng 15-20% giá trị danh mục cổ phiếu.');
    suggestedCashBufferAdjust = 'Tăng thêm 15% - 20% tiền mặt';
  } else if (probProfit >= 65 && var95Percent <= 10) {
    actionPlan.push(`Tỷ lệ lợi nhuận/rủi ro hấp dẫn (Win/Loss ~ ${(probProfit / (probLoss || 1)).toFixed(1)}). Duy trì tỷ trọng cổ phiếu dẫn dắt.`);
    actionPlan.push('Cho phép gia tăng vị thế khi các mã cốt lõi kiểm định thành công đường MA20/MA50.');
    actionPlan.push(`Mục tiêu chốt lời từng phần tại ngưỡng Best-case Top 5% (+${bestCaseGainPercent}% NAV).`);
    suggestedCashBufferAdjust = 'Giữ nguyên hoặc tận dụng nhịp chỉnh giải ngân';
  } else {
    actionPlan.push('Duy trì tỷ trọng cân bằng, theo dõi sát các mốc hỗ trợ kỹ thuật của VN-Index.');
    actionPlan.push('Tái cơ cấu các mã có tương quan > 0.8 để tối ưu hóa hiệu ứng giảm thiểu rủi ro đa dạng hóa.');
  }

  const summaryComment = `Mô phỏng Monte Carlo với ${numSims.toLocaleString('vi-VN')} kịch bản ngẫu nhiên cho thấy danh mục có ${probProfit}% xác suất tăng trưởng trong ${numDays} ngày tới với biên độ kỳ vọng NAV từ ${(p5Nav / 1_000_000).toFixed(1)}M đến ${(p95Nav / 1_000_000).toFixed(1)}M VNĐ.`;

  return {
    config,
    initialNav,
    initialStockValue: totalStockValue,
    cashValue: totalCash,
    cashWeightPercent: Number((cashWeight * 100).toFixed(1)),
    stockWeightPercent: Number((stockWeight * 100).toFixed(1)),
    portfolioAnnualDrift: Number((portfolioAnnualDrift * 100).toFixed(2)),
    portfolioAnnualVol: Number((portfolioAnnualVol * 100).toFixed(2)),
    portfolioDailyDrift: Number((dailyDrift * 100).toFixed(4)),
    portfolioDailyVol: Number((dailyVol * 100).toFixed(4)),
    diversificationBenefitPercent,
    trajectories: trajectoryPoints,
    terminalStats: {
      meanNav,
      medianNav,
      stdDevNav,
      minNav,
      maxNav,
      p1Nav,
      p5Nav,
      p10Nav,
      p25Nav,
      p50Nav,
      p75Nav,
      p90Nav,
      p95Nav,
      p99Nav,
      expectedReturnAmount,
      expectedReturnPercent,
      medianReturnAmount,
      medianReturnPercent,
      bestCaseGainAmount,
      bestCaseGainPercent,
      worstCaseLossAmount,
      worstCaseLossPercent,
      probProfit,
      probLoss,
      probLoss5Pct,
      probLoss10Pct,
      probLoss20Pct,
      probGain10Pct,
      probGain20Pct,
      var95Amount,
      var95Percent,
      var99Amount,
      var99Percent,
      cvar95Amount,
      cvar95Percent,
    },
    distributionBins,
    aiInsights: {
      riskRating,
      summaryComment,
      keyObservations,
      actionPlan,
      suggestedCashBufferAdjust,
    },
  };
}
