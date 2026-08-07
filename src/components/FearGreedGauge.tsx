import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Flame, Gauge, Info, TrendingUp, TrendingDown, RefreshCw, Activity, ArrowUpRight, ArrowDownRight, Zap, Eye, ChevronUp } from 'lucide-react';
import { MarketIndex, StockData, TradeTick } from '../types';

interface FearGreedGaugeProps {
  stocks: StockData[];
  indices: MarketIndex[];
  tradeTicks?: TradeTick[];
}

export interface SentimentBreakdown {
  score: number; // 0 - 100
  status: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';
  label: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  advancesDeclinesRatio: number; // %
  tickBuyRatio: number; // %
  avgRsi: number;
  foreignNetValSum: number; // Tỷ VNĐ
  stockGainerRatio: number; // %
  summaryNote: string;
}

export const FearGreedGauge: React.FC<FearGreedGaugeProps> = ({ stocks, indices, tradeTicks = [] }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute Fear & Greed sentiment index mathematically from tick & market data
  const sentiment: SentimentBreakdown = useMemo(() => {
    if (!stocks || stocks.length === 0) {
      return {
        score: 50,
        status: 'NEUTRAL',
        label: 'TRUNG LẬP',
        color: '#eab308',
        bgGradient: 'from-amber-500/20 to-yellow-500/10',
        borderColor: 'border-yellow-500/40',
        advancesDeclinesRatio: 50,
        tickBuyRatio: 50,
        avgRsi: 50,
        foreignNetValSum: 0,
        stockGainerRatio: 50,
        summaryNote: 'Thị trường đang ở trạng thái cân bằng.',
      };
    }

    // 1. Stock Gainer Ratio
    const gainers = stocks.filter((s) => s.changePercent > 0).length;
    const stockGainerRatio = Math.round((gainers / stocks.length) * 100);

    // 2. Index Breadth (Advances vs Declines)
    let totalAdvances = 0;
    let totalDeclines = 0;
    indices.forEach((idx) => {
      totalAdvances += idx.advances || 0;
      totalDeclines += idx.declines || 0;
    });
    const totalBreadth = totalAdvances + totalDeclines;
    const advancesDeclinesRatio = totalBreadth > 0 ? Math.round((totalAdvances / totalBreadth) * 100) : 50;

    // 3. Tick Buy vs Sell Ratio
    let buyVol = 0;
    let sellVol = 0;
    tradeTicks.forEach((tick) => {
      if (tick.type === 'BUY') buyVol += tick.volume;
      else if (tick.type === 'SELL') sellVol += tick.volume;
    });
    const totalTickVol = buyVol + sellVol;
    const tickBuyRatio = totalTickVol > 0 ? Math.round((buyVol / totalTickVol) * 100) : 50;

    // 4. Average RSI
    const validRsiStocks = stocks.filter((s) => s.technical && typeof s.technical.rsi14 === 'number');
    const avgRsi = validRsiStocks.length > 0
      ? Math.round(validRsiStocks.reduce((sum, s) => sum + s.technical.rsi14, 0) / validRsiStocks.length)
      : 50;

    // 5. Foreign Net Flow Sum
    const foreignNetValSum = stocks.reduce((sum, s) => sum + (s.foreignNetVal || 0), 0);
    // Normalize foreign flow to a score 0-100 (assuming range -500 tỷ to +500 tỷ)
    const normalizedForeignScore = Math.min(100, Math.max(0, 50 + (foreignNetValSum / 500) * 50));

    // Composite Score Weighted Calculation
    // Stock Gainers: 25%, Breadth: 25%, Tick Buy/Sell: 25%, RSI: 15%, Foreign Flow: 10%
    const rawScore =
      stockGainerRatio * 0.25 +
      advancesDeclinesRatio * 0.25 +
      tickBuyRatio * 0.25 +
      avgRsi * 0.15 +
      normalizedForeignScore * 0.10;

    const score = Math.min(99, Math.max(1, Math.round(rawScore)));

    // Categorize
    if (score < 25) {
      return {
        score,
        status: 'EXTREME_FEAR',
        label: 'SỢ HÃI TỘI ĐỘ',
        color: '#ef4444', // red-500
        bgGradient: 'from-red-950/80 via-rose-950/40 to-slate-900',
        borderColor: 'border-red-500/60',
        advancesDeclinesRatio,
        tickBuyRatio,
        avgRsi,
        foreignNetValSum,
        stockGainerRatio,
        summaryNote: 'Tâm lý hoảng loạn bao trùm toàn thị trường. Cơ hội săn hàng giá rẻ!',
      };
    } else if (score < 45) {
      return {
        score,
        status: 'FEAR',
        label: 'SỢ HÃI',
        color: '#f97316', // orange-500
        bgGradient: 'from-orange-950/80 via-amber-950/40 to-slate-900',
        borderColor: 'border-orange-500/60',
        advancesDeclinesRatio,
        tickBuyRatio,
        avgRsi,
        foreignNetValSum,
        stockGainerRatio,
        summaryNote: 'Bên bán đang áp đảo, tâm lý thận trọng quan sát.',
      };
    } else if (score <= 55) {
      return {
        score,
        status: 'NEUTRAL',
        label: 'TRUNG LẬP',
        color: '#eab308', // yellow-500
        bgGradient: 'from-amber-950/80 via-yellow-950/40 to-slate-900',
        borderColor: 'border-yellow-500/60',
        advancesDeclinesRatio,
        tickBuyRatio,
        avgRsi,
        foreignNetValSum,
        stockGainerRatio,
        summaryNote: 'Thị trường giằng co đi ngang, dòng tiền phân hóa mạnh.',
      };
    } else if (score <= 75) {
      return {
        score,
        status: 'GREED',
        label: 'THAM LAM',
        color: '#10b981', // emerald-500
        bgGradient: 'from-emerald-950/80 via-teal-950/40 to-slate-900',
        borderColor: 'border-emerald-500/60',
        advancesDeclinesRatio,
        tickBuyRatio,
        avgRsi,
        foreignNetValSum,
        stockGainerRatio,
        summaryNote: 'Dòng tiền mua chủ động tích cực, xu hướng tăng vững chắc.',
      };
    } else {
      return {
        score,
        status: 'EXTREME_GREED',
        label: 'THAM LAM TỘI ĐỘ',
        color: '#22c55e', // green-500
        bgGradient: 'from-green-950/80 via-emerald-950/40 to-slate-900',
        borderColor: 'border-green-500/60',
        advancesDeclinesRatio,
        tickBuyRatio,
        avgRsi,
        foreignNetValSum,
        stockGainerRatio,
        summaryNote: 'Thị trường đang rất hưng phấn (Overbought). Cảnh giác rủi ro chốt lời!',
      };
    }
  }, [stocks, indices, tradeTicks]);

  // Compute angle for speedometer needle (0 to 180 deg)
  const needleAngle = (sentiment.score / 100) * 180 - 90;

  return (
    <div className="relative font-mono" ref={popoverRef}>
      {/* Footer Interactive Badge Trigger */}
      <button
        onClick={() => setIsPopoverOpen((prev) => !prev)}
        className={`flex items-center space-x-2 px-2.5 py-1 rounded border ${sentiment.borderColor} bg-gray-900/90 hover:bg-gray-800 transition cursor-pointer group shadow-sm`}
        title="Nhấp để xem chi tiết chỉ số Tâm Lý Thị Trường Fear & Greed"
      >
        <div className="relative flex items-center justify-center">
          <Gauge className="w-3.5 h-3.5" style={{ color: sentiment.color }} />
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-ping"
            style={{ backgroundColor: sentiment.color }}
          ></span>
        </div>

        <div className="flex items-center space-x-1.5 text-[10px]">
          <span className="text-gray-400 uppercase font-bold hidden sm:inline">Chỉ số Tâm Lý:</span>
          <span
            className="font-black px-1.5 py-0.2 rounded text-[10px] tracking-tight"
            style={{
              backgroundColor: `${sentiment.color}20`,
              color: sentiment.color,
            }}
          >
            {sentiment.score}/100
          </span>
          <span className="font-bold uppercase tracking-wide" style={{ color: sentiment.color }}>
            {sentiment.label}
          </span>
        </div>

        <ChevronUp
          className={`w-3 h-3 text-gray-400 group-hover:text-white transition-transform duration-200 ${
            isPopoverOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Card */}
      {isPopoverOpen && (
        <div className={`absolute bottom-9 right-0 sm:right-auto sm:left-0 w-84 sm:w-96 bg-gradient-to-b ${sentiment.bgGradient} border-2 ${sentiment.borderColor} rounded-xl shadow-2xl p-4 z-50 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-150`}>
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5 mb-3">
            <div className="flex items-center space-x-2">
              <div
                className="p-1.5 rounded-lg border shadow-inner"
                style={{
                  backgroundColor: `${sentiment.color}20`,
                  borderColor: sentiment.color,
                }}
              >
                <Flame className="w-4 h-4" style={{ color: sentiment.color }} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  Chỉ Số Tâm Lý Thị Trường
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-300 border border-blue-700/60 font-mono">
                    REAL-TIME
                  </span>
                </h4>
                <p className="text-[10px] text-gray-400">Fear & Greed Index • Dựa trên Tick Data & Market Depth</p>
              </div>
            </div>

            <button
              onClick={() => setIsPopoverOpen(false)}
              className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-800 transition"
            >
              ✕
            </button>
          </div>

          {/* SVG Arc Gauge Speedometer Visual */}
          <div className="flex flex-col items-center justify-center my-2 relative">
            <svg className="w-48 h-26 overflow-visible" viewBox="0 0 100 55">
              {/* Arc background segments */}
              {/* 0-25: Extreme Fear */}
              <path d="M 10,50 A 40,40 0 0,1 21.7,21.7" fill="none" stroke="#ef4444" strokeWidth="9" strokeLinecap="round" opacity="0.85" />
              {/* 25-45: Fear */}
              <path d="M 23,20.3 A 40,40 0 0,1 42.4,10.8" fill="none" stroke="#f97316" strokeWidth="9" opacity="0.85" />
              {/* 45-55: Neutral */}
              <path d="M 43.8,10.4 A 40,40 0 0,1 56.2,10.4" fill="none" stroke="#eab308" strokeWidth="9" opacity="0.85" />
              {/* 55-75: Greed */}
              <path d="M 57.6,10.8 A 40,40 0 0,1 77,20.3" fill="none" stroke="#10b981" strokeWidth="9" opacity="0.85" />
              {/* 75-100: Extreme Greed */}
              <path d="M 78.3,21.7 A 40,40 0 0,1 90,50" fill="none" stroke="#22c55e" strokeWidth="9" strokeLinecap="round" opacity="0.85" />

              {/* Needle pointer */}
              <g transform={`rotate(${needleAngle}, 50, 50)`} className="transition-transform duration-700 ease-out">
                <line x1="50" y1="50" x2="50" y2="16" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="50" cy="50" r="4.5" fill="#ffffff" stroke={sentiment.color} strokeWidth="2" />
              </g>
            </svg>

            {/* Score Overlay Text */}
            <div className="text-center -mt-4">
              <div className="text-2xl font-black tracking-tight" style={{ color: sentiment.color }}>
                {sentiment.score}
                <span className="text-xs text-gray-500 font-normal"> / 100</span>
              </div>
              <div
                className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-0.5 border"
                style={{
                  backgroundColor: `${sentiment.color}25`,
                  color: sentiment.color,
                  borderColor: sentiment.color,
                }}
              >
                {sentiment.label}
              </div>
            </div>
          </div>

          {/* AI Sentiment Summary Note */}
          <div className="bg-gray-950/80 border border-gray-800 rounded-lg p-2.5 my-3 text-[11px] text-gray-300 leading-relaxed flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-blue-400 font-bold uppercase block text-[10px] tracking-wide mb-0.5">Nhận định AI:</span>
              {sentiment.summaryNote}
            </div>
          </div>

          {/* Data Factor Breakdown Bars */}
          <div className="space-y-2 border-t border-gray-800/80 pt-2.5 text-[11px]">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Yếu tố cấu thành (Real-time Ticks):</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Activity className="w-3 h-3 animate-pulse" /> Live
              </span>
            </div>

            {/* Factor 1: Tick Buy Flow */}
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
              <div className="flex justify-between items-center mb-1 text-[10px]">
                <span className="text-gray-300 font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Khớp Lệnh Chủ Động (Tick Buy/Sell):
                </span>
                <span className={sentiment.tickBuyRatio >= 50 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {sentiment.tickBuyRatio}% Mua
                </span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${sentiment.tickBuyRatio}%` }}></div>
                <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${100 - sentiment.tickBuyRatio}%` }}></div>
              </div>
            </div>

            {/* Factor 2: Market Breadth */}
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
              <div className="flex justify-between items-center mb-1 text-[10px]">
                <span className="text-gray-300 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-blue-400" />
                  Độ Rộng Thị Trường (Số mã tăng):
                </span>
                <span className={sentiment.stockGainerRatio >= 50 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {sentiment.stockGainerRatio}% Tăng ({stocks.filter((s) => s.changePercent > 0).length}/{stocks.length})
                </span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    sentiment.stockGainerRatio >= 50 ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${sentiment.stockGainerRatio}%` }}
                ></div>
              </div>
            </div>

            {/* Factor 3: Average RSI */}
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
              <div className="flex justify-between items-center mb-1 text-[10px]">
                <span className="text-gray-300 font-semibold flex items-center gap-1">
                  <Activity className="w-3 h-3 text-purple-400" />
                  RSI Trung Bình Thị Trường:
                </span>
                <span className="text-purple-300 font-bold">{sentiment.avgRsi} / 100</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, sentiment.avgRsi))}%` }}
                ></div>
              </div>
            </div>

            {/* Factor 4: Foreign Net Flow */}
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800 flex justify-between items-center">
              <span className="text-gray-300 font-semibold text-[10px] flex items-center gap-1">
                <Eye className="w-3 h-3 text-cyan-400" />
                Khối Ngoại Mua/Bán Ròng:
              </span>
              <span
                className={`font-bold text-[11px] ${
                  sentiment.foreignNetValSum >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {sentiment.foreignNetValSum >= 0 ? '+' : ''}
                {sentiment.foreignNetValSum.toFixed(1)} Tỷ VNĐ
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
