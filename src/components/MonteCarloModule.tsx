import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Dices,
  DollarSign,
  HelpCircle,
  Info,
  Layers,
  Percent,
  Play,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StockData } from '../types';
import {
  MARKET_REGIMES,
  MarketRegime,
  MonteCarloConfig,
  runMonteCarloSimulation,
} from '../utils/monteCarloEngine';

interface MonteCarloModuleProps {
  positions: {
    id: string;
    symbol: string;
    quantity: number;
    buyPrice: number;
    currentPrice: number;
    currentValue: number;
  }[];
  stocks: StockData[];
  freeCash: number;
  pendingCash: number;
  onSelectStock?: (symbol: string) => void;
}

export const MonteCarloModule: React.FC<MonteCarloModuleProps> = ({
  positions,
  stocks,
  freeCash,
  pendingCash,
  onSelectStock,
}) => {
  // Config state
  const [simCount, setSimCount] = useState<number>(2500);
  const [timeHorizon, setTimeHorizon] = useState<number>(60);
  const [isCustomDays, setIsCustomDays] = useState<boolean>(false);
  const [customDays, setCustomDays] = useState<number>(60);

  const [marketRegime, setMarketRegime] = useState<MarketRegime>('NEUTRAL');
  const [customDrift, setCustomDrift] = useState<number>(12.0);
  const [customVol, setCustomVol] = useState<number>(18.0);

  // Active chart tab (Fan chart vs Histogram distribution)
  const [activeChartTab, setActiveChartTab] = useState<'FAN' | 'HISTOGRAM' | 'BOTH'>('BOTH');
  const [simulationSeed, setSimulationSeed] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Active days count
  const effectiveDays = isCustomDays ? customDays : timeHorizon;

  const handleReSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setSimulationSeed((prev) => prev + 1);
      setIsSimulating(false);
    }, 150);
  };

  // Run the Monte Carlo Simulation Engine
  const simulationResult = useMemo(() => {
    const config: MonteCarloConfig = {
      simulationsCount: simCount,
      timeHorizonDays: effectiveDays,
      marketRegime,
      customAnnualDrift: customDrift,
      customAnnualVol: customVol,
      riskFreeRate: 5.0,
    };

    // simulationSeed triggers re-run
    if (simulationSeed < 0) return null;

    return runMonteCarloSimulation(positions, stocks, freeCash, pendingCash, config);
  }, [
    positions,
    stocks,
    freeCash,
    pendingCash,
    simCount,
    effectiveDays,
    marketRegime,
    customDrift,
    customVol,
    simulationSeed,
  ]);

  const {
    initialNav,
    cashValue,
    cashWeightPercent,
    stockWeightPercent,
    portfolioAnnualDrift,
    portfolioAnnualVol,
    diversificationBenefitPercent,
    trajectories,
    terminalStats,
    distributionBins,
    aiInsights,
  } = simulationResult;

  // Format currency helpers
  const fmtVND = (n: number) => n.toLocaleString('vi-VN') + ' đ';
  const fmtM = (n: number) => (n / 1_000_000).toFixed(2) + ' M';

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Top Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400 font-bold shrink-0">
            <Dices className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                MÔ PHỎNG MONTE CARLO & PHÂN PHỐI XÁC SUẤT NAV (STOCHASTIC FORECAST)
              </h2>
              <span className="bg-indigo-950 text-indigo-400 px-1.5 py-0.2 rounded text-[9px] border border-indigo-800 font-bold">
                1.000 - 10.000 RUNS
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Dự báo xác suất giá trị tài sản trong 30 - 90 ngày tới qua mô hình Chuyển động Brown Hình học (GBM) & Tương quan Ngành
            </p>
          </div>
        </div>

        {/* Re-simulate Button */}
        <button
          type="button"
          onClick={handleReSimulate}
          disabled={isSimulating}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-sm flex items-center justify-center space-x-2 shadow-lg transition active:scale-95 border border-indigo-400 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'Đang chạy mô phỏng...' : 'CHẠY LẠI MÔ PHỎNG 🎲'}</span>
        </button>
      </div>

      {/* Control Panel: Simulation Count, Time Horizon, Market Regime */}
      <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Parameter 1: Number of Simulations */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 uppercase font-bold flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>SỐ LƯỢNG KỊCH BẢN (RUNS)</span>
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[1000, 2500, 5000, 10000].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSimCount(count)}
                  className={`py-1.5 rounded-sm font-bold text-center transition ${
                    simCount === count
                      ? 'bg-indigo-600 text-white shadow ring-1 ring-indigo-400'
                      : 'bg-[#050505] text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  {count >= 1000 ? `${count / 1000}k` : count}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter 2: Time Horizon */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 uppercase font-bold flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>KHUNG THỜI GIAN DỰ BÁO</span>
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '30N (1T)', days: 30 },
                { label: '60N (2T)', days: 60 },
                { label: '90N (1Q)', days: 90 },
                { label: 'Tùy biến', days: -1 },
              ].map((item) => {
                const isActive = item.days === -1 ? isCustomDays : !isCustomDays && timeHorizon === item.days;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.days === -1) {
                        setIsCustomDays(true);
                      } else {
                        setIsCustomDays(false);
                        setTimeHorizon(item.days);
                      }
                    }}
                    className={`py-1.5 rounded-sm font-bold text-center transition ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow ring-1 ring-emerald-400'
                        : 'bg-[#050505] text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parameter 3: Market Regime / Macro Drift */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 uppercase font-bold flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>KỊCH BẢN VĨ MÔ THỊ TRƯỜNG</span>
            </label>
            <select
              value={marketRegime}
              onChange={(e) => setMarketRegime(e.target.value as MarketRegime)}
              className="w-full bg-[#050505] text-white border border-gray-800 rounded-sm px-2.5 py-1.5 font-bold focus:outline-none focus:border-indigo-500"
            >
              {Object.values(MARKET_REGIMES).map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional Custom Sliders for Days and Regime */}
        {isCustomDays && (
          <div className="p-2.5 bg-[#050505] rounded border border-gray-800 flex items-center space-x-4">
            <span className="text-gray-400 shrink-0 font-bold">Số ngày dự báo: {customDays} ngày</span>
            <input
              type="range"
              min="15"
              max="180"
              step="5"
              value={customDays}
              onChange={(e) => setCustomDays(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-gray-500 text-[10px] shrink-0">(15 đến 180 ngày)</span>
          </div>
        )}

        {marketRegime === 'CUSTOM' && (
          <div className="p-3 bg-[#050505] rounded border border-amber-800/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between text-gray-400">
                <span>Kỳ vọng Tăng trưởng VN-Index (Drift):</span>
                <span className="text-amber-400 font-bold">{customDrift > 0 ? `+${customDrift}` : customDrift}% / năm</span>
              </div>
              <input
                type="range"
                min="-30"
                max="50"
                step="1"
                value={customDrift}
                onChange={(e) => setCustomDrift(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-gray-400">
                <span>Biến động Thị trường (Annual Volatility):</span>
                <span className="text-amber-400 font-bold">{customVol}% / năm</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={customVol}
                onChange={(e) => setCustomVol(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Bento Grid: Key Probabilities and Risk Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Probability of Profit */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>XÁC SUẤT SINH LỜI DƯƠNG</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                terminalStats.probProfit >= 60
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900'
                  : 'bg-amber-950/60 text-amber-400 border border-amber-900'
              }`}
            >
              P(NAV &gt; NAV₀)
            </span>
          </div>

          <div className="text-2xl font-black text-emerald-400 flex items-baseline space-x-2">
            <span>{terminalStats.probProfit}%</span>
            <span className="text-[11px] text-gray-500 font-normal">
              (Thua lỗ: {terminalStats.probLoss}%)
            </span>
          </div>

          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span>Khả năng tăng &gt; 10%:</span>
            <span className="text-emerald-300 font-bold">{terminalStats.probGain10Pct}%</span>
          </div>
        </div>

        {/* Card 2: Median Expected NAV */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>NAV KỲ VỌNG TRUNG VỊ (P50)</span>
            </span>
            <span className="text-[10px] text-blue-400 bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-900 font-bold">
              T+{effectiveDays} NGÀY
            </span>
          </div>

          <div className="text-lg font-black text-white">
            {fmtVND(terminalStats.medianNav)}
          </div>

          <div className="text-[11px] flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span className="text-gray-400">Lợi nhuận kỳ vọng:</span>
            <span
              className={`font-bold ${
                terminalStats.medianReturnPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {terminalStats.medianReturnPercent >= 0 ? '+' : ''}
              {terminalStats.medianReturnPercent}% ({fmtM(terminalStats.medianReturnAmount)})
            </span>
          </div>
        </div>

        {/* Card 3: Monte Carlo VaR 95% */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>MONTE CARLO VAR 95%</span>
            </span>
            <span className="text-[10px] text-red-400 bg-red-950/60 px-1.5 py-0.2 rounded border border-red-900 font-bold">
              RỦI RO ĐÁY 5%
            </span>
          </div>

          <div className="text-lg font-black text-red-400">
            -{fmtVND(terminalStats.var95Amount)}
          </div>

          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span>Sụt giảm tối đa 95%:</span>
            <span className="text-red-300 font-bold">-{terminalStats.var95Percent}% NAV</span>
          </div>
        </div>

        {/* Card 4: Expected Shortfall (CVaR) & Cash Shield */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>CVAR 95% & ĐỆM TIỀN</span>
            </span>
            <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-900 font-bold">
              ĐỆM {cashWeightPercent}%
            </span>
          </div>

          <div className="text-lg font-black text-cyan-300">
            CVaR: -{terminalStats.cvar95Percent}%
          </div>

          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span>Giảm biến động:</span>
            <span className="text-emerald-400 font-bold">
              -{diversificationBenefitPercent}% (Đa dạng hóa)
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="space-y-3">
        {/* Chart View Mode Switcher */}
        <div className="flex items-center justify-between bg-[#0a0a0a] p-2 rounded-sm border border-gray-800">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 uppercase font-bold text-[10px]">CHẾ ĐỘ XEM ĐỒ THỊ:</span>
            <div className="flex space-x-1">
              <button
                type="button"
                onClick={() => setActiveChartTab('BOTH')}
                className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition ${
                  activeChartTab === 'BOTH'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#050505] text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                Cả 2 Biểu đồ
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('FAN')}
                className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition ${
                  activeChartTab === 'FAN'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#050505] text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                Đường Quạt NAV (Fan Chart)
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('HISTOGRAM')}
                className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition ${
                  activeChartTab === 'HISTOGRAM'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#050505] text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                Mật độ Tần suất (Histogram)
              </button>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 hidden sm:block">
            Mô phỏng GBM • Bước nhảy vi phân dt = 1/252 • Box-Muller Normalizer
          </div>
        </div>

        {/* 1. Trajectory Fan Chart (Confidence Cones) */}
        {(activeChartTab === 'FAN' || activeChartTab === 'BOTH') && (
          <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-white text-xs uppercase">
                  BIỂU ĐỒ QUẠT ĐƯỜNG ĐI NAV THEO THỜI GIAN (MONTE CARLO TRAJECTORY CONE)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500/30 border border-indigo-400 inline-block"></span>
                  <span>Khoảng tin cậy 90% (P5 - P95)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-500/60 border border-blue-400 inline-block"></span>
                  <span>Khoảng 50% (P25 - P75)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block"></span>
                  <span className="text-emerald-400 font-bold">Trung vị (P50)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-0.5 bg-gray-400 border-b border-dashed border-gray-400 inline-block"></span>
                  <span>NAV Ban đầu</span>
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trajectories}
                  margin={{ top: 10, right: 15, left: 15, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="cone90" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="cone50" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis
                    dataKey="dayLabel"
                    stroke="#666"
                    tick={{ fill: '#888', fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#888', fontSize: 10 }}
                    tickFormatter={(val) => `${(val / 1_000_000).toFixed(0)}M`}
                    domain={['dataMin - 10000000', 'dataMax + 10000000']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#050505',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(value: any, name: any) => {
                      const num = Number(value);
                      if (name === 'p95') return [`${fmtVND(num)} (Top 5% Tích cực)`, 'P95'];
                      if (name === 'p75') return [`${fmtVND(num)} (Kịch bản Tốt)`, 'P75'];
                      if (name === 'p50') return [`${fmtVND(num)} (Kỳ vọng Trung vị)`, 'P50 (Median)'];
                      if (name === 'p25') return [`${fmtVND(num)} (Kịch bản Thận trọng)`, 'P25'];
                      if (name === 'p5') return [`${fmtVND(num)} (Đáy 5% - VaR 95%)`, 'P5'];
                      if (name === 'initialNav') return [`${fmtVND(num)}`, 'NAV Ban đầu'];
                      return [fmtVND(num), name];
                    }}
                  />

                  {/* Sample background stochastic paths */}
                  {trajectories[0]?.samplePaths?.slice(0, 8).map((_, pIdx) => (
                    <Line
                      key={`sample-${pIdx}`}
                      type="monotone"
                      dataKey={`samplePaths[${pIdx}]`}
                      stroke="#4f46e5"
                      strokeOpacity={0.12}
                      strokeWidth={1}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}

                  {/* 90% Confidence Area (P5 to P95) */}
                  <Area
                    type="monotone"
                    dataKey="p95"
                    stroke="#818cf8"
                    strokeWidth={1}
                    fill="url(#cone90)"
                    name="p95"
                  />
                  <Area
                    type="monotone"
                    dataKey="p75"
                    stroke="#60a5fa"
                    strokeWidth={1}
                    fill="url(#cone50)"
                    name="p75"
                  />
                  <Area
                    type="monotone"
                    dataKey="p25"
                    stroke="#60a5fa"
                    strokeWidth={1}
                    fill="#050505"
                    fillOpacity={0.6}
                    name="p25"
                  />
                  <Area
                    type="monotone"
                    dataKey="p5"
                    stroke="#f87171"
                    strokeWidth={1}
                    fill="#0a0a0a"
                    fillOpacity={0.9}
                    name="p5"
                  />

                  {/* Median Line (P50) */}
                  <Line
                    type="monotone"
                    dataKey="p50"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                    name="p50"
                  />

                  {/* Baseline Initial NAV Line */}
                  <Line
                    type="monotone"
                    dataKey="initialNav"
                    stroke="#9ca3af"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    name="initialNav"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 2. Terminal Probability Distribution Histogram */}
        {(activeChartTab === 'HISTOGRAM' || activeChartTab === 'BOTH') && (
          <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-xs uppercase">
                  PHÂN PHỐI XÁC SUẤT GIÁ TRỊ NAV TẠI NGÀY T+{effectiveDays} (PROBABILITY DENSITY)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-red-600 inline-block rounded-xs"></span>
                  <span>Thua lỗ nặng (&gt;15%)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-amber-500 inline-block rounded-xs"></span>
                  <span>Thua lỗ nhẹ</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-emerald-500 inline-block rounded-xs"></span>
                  <span>Sinh lời</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-cyan-400 inline-block rounded-xs"></span>
                  <span>Lợi nhuận cao (&gt;18%)</span>
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distributionBins}
                  margin={{ top: 10, right: 15, left: 15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis
                    dataKey="rangeLabel"
                    stroke="#666"
                    tick={{ fill: '#888', fontSize: 9 }}
                    interval={3}
                  />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#888', fontSize: 10 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#050505',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(value: any, name: any, item: any) => {
                      const bin = item.payload as (typeof distributionBins)[0];
                      return [
                        `${value}% (${bin.count} kịch bản) • Xác suất tích lũy: ${bin.cumulativePercent}%`,
                        `Khoảng NAV: ${bin.rangeLabel}`,
                      ];
                    }}
                  />
                  <ReferenceLine
                    x={distributionBins.find((b) => b.isInitialNavBin)?.rangeLabel}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: 'NAV Gốc',
                      fill: '#f59e0b',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <Bar dataKey="probabilityPercent" name="Xác suất (%)">
                    {distributionBins.map((entry, index) => {
                      let color = '#10b981'; // default emerald
                      if (entry.category === 'SEVERE_LOSS') color = '#ef4444';
                      else if (entry.category === 'MODERATE_LOSS') color = '#f97316';
                      else if (entry.category === 'MILD_LOSS') color = '#eab308';
                      else if (entry.category === 'MILD_GAIN') color = '#10b981';
                      else if (entry.category === 'STRONG_GAIN') color = '#06b6d4';
                      else if (entry.category === 'SUPER_GAIN') color = '#8b5cf6';

                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={color}
                          stroke={entry.isInitialNavBin ? '#f59e0b' : 'none'}
                          strokeWidth={entry.isInitialNavBin ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Quant Statistical Milestone Table */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Scale className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-white text-xs uppercase">
              BẢNG THỐNG KÊ CÁC PHÂN VỊ LỢI NHUẬN & RỦI RO (PERCENTILE MILESTONES)
            </span>
          </div>
          <span className="text-[10px] text-gray-400">
            Tổng cộng: {simCount.toLocaleString('vi-VN')} lần lặp ngẫu nhiên
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-[10px] text-gray-400 uppercase bg-[#050505]">
                <th className="py-2 px-3">Phân vị (Percentile)</th>
                <th className="py-2 px-3">Ý nghĩa kịch bản</th>
                <th className="py-2 px-3 text-right">NAV Dự kiến (VNĐ)</th>
                <th className="py-2 px-3 text-right">Biến động (VNĐ)</th>
                <th className="py-2 px-3 text-right">Tỷ suất (%)</th>
                <th className="py-2 px-3 text-center">Đánh giá rủi ro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-[11px]">
              {/* P99 */}
              <tr className="hover:bg-gray-900/40">
                <td className="py-2 px-3 font-bold text-purple-400">P99 (Top 1%)</td>
                <td className="py-2 px-3 text-gray-400">Đại sóng thăng hoa cực đại</td>
                <td className="py-2 px-3 text-right font-bold text-purple-300">{fmtVND(terminalStats.p99Nav)}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-bold">+{fmtM(terminalStats.p99Nav - initialNav)}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-bold">+{(((terminalStats.p99Nav - initialNav) / initialNav) * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-center"><span className="text-[9px] bg-purple-950 text-purple-300 px-1.5 py-0.2 rounded border border-purple-800">Cực đại</span></td>
              </tr>
              {/* P95 */}
              <tr className="hover:bg-gray-900/40">
                <td className="py-2 px-3 font-bold text-cyan-400">P95 (Top 5%)</td>
                <td className="py-2 px-3 text-gray-400">Kịch bản bùng nổ lạc quan</td>
                <td className="py-2 px-3 text-right font-bold text-cyan-300">{fmtVND(terminalStats.p95Nav)}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-bold">+{fmtM(terminalStats.p95Nav - initialNav)}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-bold">+{(((terminalStats.p95Nav - initialNav) / initialNav) * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-center"><span className="text-[9px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800">Tích cực</span></td>
              </tr>
              {/* P75 */}
              <tr className="hover:bg-gray-900/40">
                <td className="py-2 px-3 font-bold text-emerald-400">P75 (Tứ phân vị trên)</td>
                <td className="py-2 px-3 text-gray-400">Thị trường thuận lợi</td>
                <td className="py-2 px-3 text-right font-bold text-emerald-300">{fmtVND(terminalStats.p75Nav)}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-bold">+{fmtM(terminalStats.p75Nav - initialNav)}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-bold">+{(((terminalStats.p75Nav - initialNav) / initialNav) * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-center"><span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800">Thuận lợi</span></td>
              </tr>
              {/* P50 Median */}
              <tr className="bg-indigo-950/20 font-bold">
                <td className="py-2.5 px-3 text-indigo-400 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>P50 (Kỳ vọng Trung vị)</span>
                </td>
                <td className="py-2.5 px-3 text-white">Xác suất 50% đạt hoặc vượt mức này</td>
                <td className="py-2.5 px-3 text-right text-white font-black">{fmtVND(terminalStats.p50Nav)}</td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                  {terminalStats.medianReturnPercent >= 0 ? '+' : ''}{fmtM(terminalStats.medianReturnAmount)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                  {terminalStats.medianReturnPercent >= 0 ? '+' : ''}{terminalStats.medianReturnPercent}%
                </td>
                <td className="py-2.5 px-3 text-center"><span className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold shadow">KỲ VỌNG CHUẨN</span></td>
              </tr>
              {/* P25 */}
              <tr className="hover:bg-gray-900/40">
                <td className="py-2 px-3 font-bold text-amber-400">P25 (Tứ phân vị dưới)</td>
                <td className="py-2 px-3 text-gray-400">Thị trường rung lắc, điều chỉnh nhẹ</td>
                <td className="py-2 px-3 text-right font-bold text-amber-300">{fmtVND(terminalStats.p25Nav)}</td>
                <td className="py-2 px-3 text-right text-amber-400 font-bold">{fmtM(terminalStats.p25Nav - initialNav)}</td>
                <td className="py-2 px-3 text-right text-amber-400 font-bold">{(((terminalStats.p25Nav - initialNav) / initialNav) * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-center"><span className="text-[9px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-800">Thận trọng</span></td>
              </tr>
              {/* P5 VaR */}
              <tr className="bg-red-950/20">
                <td className="py-2 px-3 font-bold text-red-400 flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>P5 (Ngưỡng VaR 95%)</span>
                </td>
                <td className="py-2 px-3 text-red-300">Đáy rủi ro (Chỉ 5% kịch bản xấu hơn)</td>
                <td className="py-2 px-3 text-right font-bold text-red-400">{fmtVND(terminalStats.p5Nav)}</td>
                <td className="py-2 px-3 text-right text-red-400 font-bold">-{fmtM(terminalStats.var95Amount)}</td>
                <td className="py-2 px-3 text-right text-red-400 font-bold">-{terminalStats.var95Percent}%</td>
                <td className="py-2 px-3 text-center"><span className="text-[9px] bg-red-950 text-red-400 px-1.5 py-0.2 rounded border border-red-800 font-bold">RỦI RO CAO</span></td>
              </tr>
              {/* P1 */}
              <tr className="hover:bg-gray-900/40">
                <td className="py-2 px-3 font-bold text-rose-500">P1 (Đáy 1% - VaR 99%)</td>
                <td className="py-2 px-3 text-gray-400">Biến cố sụp đổ cực đoan</td>
                <td className="py-2 px-3 text-right font-bold text-rose-400">{fmtVND(terminalStats.p1Nav)}</td>
                <td className="py-2 px-3 text-right text-rose-400 font-bold">-{fmtM(terminalStats.var99Amount)}</td>
                <td className="py-2 px-3 text-right text-rose-400 font-bold">-{terminalStats.var99Percent}%</td>
                <td className="py-2 px-3 text-center"><span className="text-[9px] bg-rose-950 text-rose-300 px-1.5 py-0.2 rounded border border-rose-900 font-bold">CỰC ĐOAN</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Quant Assessment & Strategic Hedging Advisory */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-indigo-900/60 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-white text-xs uppercase">
              ĐÁNH GIÁ ĐỊNH LƯỢNG & KHUYẾN NGHỊ PHÒNG VỆ (QUANT AI ADVISORY)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-[10px]">Mức độ rủi ro đuôi:</span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                aiInsights.riskRating === 'THẤP' || aiInsights.riskRating === 'RẤT THẤP'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : aiInsights.riskRating === 'TRUNG BÌNH'
                  ? 'bg-blue-950 text-blue-400 border-blue-800'
                  : 'bg-red-950 text-red-400 border-red-800'
              }`}
            >
              {aiInsights.riskRating}
            </span>
          </div>
        </div>

        <p className="text-gray-300 text-xs leading-relaxed bg-[#050505] p-3 rounded border border-gray-800">
          {aiInsights.summaryComment}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Key Observations */}
          <div className="space-y-2 bg-[#050505] p-3 rounded border border-gray-800">
            <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Quan sát Định lượng Cốt lõi:</span>
            </span>
            <ul className="space-y-1.5 text-[11px] text-gray-300">
              {aiInsights.keyObservations.map((obs, idx) => (
                <li key={idx} className="flex items-start space-x-1.5">
                  <span className="text-blue-400 font-bold shrink-0">•</span>
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Plan */}
          <div className="space-y-2 bg-[#050505] p-3 rounded border border-gray-800">
            <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Kế hoạch Hành động Tối ưu hóa:</span>
            </span>
            <ul className="space-y-1.5 text-[11px] text-gray-300">
              {aiInsights.actionPlan.map((act, idx) => (
                <li key={idx} className="flex items-start space-x-1.5">
                  <span className="text-amber-400 font-bold shrink-0">✓</span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Đề xuất điều chỉnh tiền mặt:</span>
              <span className="text-cyan-300 font-bold">{aiInsights.suggestedCashBufferAdjust}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
