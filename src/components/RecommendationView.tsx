import { AlertCircle, ArrowUpRight, Award, CheckCircle2, ChevronRight, Filter, Flame, RefreshCw, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AIRecommendation, MarketType } from '../types';

interface RecommendationViewProps {
  onSelectStock: (symbol: string) => void;
  onOpenAIChat: (prompt: string) => void;
}

export const RecommendationView: React.FC<RecommendationViewProps> = ({ onSelectStock, onOpenAIChat }) => {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedExchange, setSelectedExchange] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recommendations');
      const data = await res.json();
      setRecommendations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const categories = [
    { id: 'ALL', label: 'Tất Cả Khuyến Nghị' },
    { id: 'TOP_MUA_MẠNH', label: 'Top Mua Mạnh (Strong Buy)' },
    { id: 'BREAKOUT', label: 'Top Bứt Phá (Breakout)' },
    { id: 'GOLDEN_CROSS', label: 'Golden Cross (MA20/50)' },
    { id: 'KHỐI_NGOẠI_MUA', label: 'Khối Ngoại Mua Ròng' },
  ];

  const filtered = recommendations.filter((r) => {
    if (activeCategory !== 'ALL' && r.category !== activeCategory) return false;
    if (selectedExchange !== 'ALL' && r.exchange !== selectedExchange) return false;
    if (selectedSector !== 'ALL' && r.sector !== selectedSector) return false;
    return true;
  });

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white flex items-center space-x-2">
              <span>HỆ THỐNG KHUYẾN NGHỊ AI QUANT SCREENER</span>
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm font-mono">REALTIME 5-MIN</span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">Rà soát tự động 100% cổ phiếu sàn HOSE, HNX, UPCOM dựa trên thuật toán Quant & Gemini AI</p>
          </div>
        </div>

        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="bg-[#050505] hover:bg-gray-800 text-gray-200 px-3.5 py-1.5 rounded-sm border border-gray-700 text-xs font-mono font-semibold flex items-center space-x-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
          <span>LÀM MỚI SCREENER</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 text-xs font-mono">
        {/* Category Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-sm transition whitespace-nowrap border ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white border-blue-500 font-bold shadow'
                  : 'bg-[#050505] text-gray-400 hover:text-gray-200 border-gray-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Exchange Dropdown */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-gray-400">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Sàn:</span>
          </div>
          <select
            value={selectedExchange}
            onChange={(e) => setSelectedExchange(e.target.value)}
            className="bg-[#050505] text-gray-200 px-2.5 py-1 rounded-sm border border-gray-800 outline-none font-mono text-xs"
          >
            <option value="ALL">Tất cả sàn</option>
            <option value="HOSE">HOSE</option>
            <option value="HNX">HNX</option>
            <option value="UPCOM">UPCOM</option>
          </select>
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 space-y-3 font-mono">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
          <span>Đang chạy AI Quant Engine rà soát thị trường...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-[#0a0a0a] rounded-sm border border-gray-800 font-mono">
          Không có khuyến nghị nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 hover:border-gray-700 transition shadow-xl flex flex-col justify-between space-y-4 group"
            >
              <div>
                {/* Card Top Header */}
                <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-3">
                  <div className="flex items-center space-x-2">
                    <span
                      onClick={() => onSelectStock(item.symbol)}
                      className="font-mono font-black text-xl text-white cursor-pointer hover:text-blue-400 transition"
                    >
                      {item.symbol}
                    </span>
                    <span className="text-[10px] bg-[#050505] text-gray-400 px-1.5 py-0.5 rounded-sm font-mono border border-gray-800">
                      {item.exchange}
                    </span>
                    <span className="text-[10px] bg-blue-950/60 text-blue-400 px-1.5 py-0.5 rounded-sm font-mono border border-blue-900">
                      {item.sector}
                    </span>
                  </div>

                  {/* AI Score Badge */}
                  <div className="flex items-center space-x-1 bg-blue-950/60 border border-blue-800 px-2 py-0.5 rounded-sm">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-mono font-bold text-blue-400">Score: {item.score}</span>
                  </div>
                </div>

                {/* Price & Target Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#050505] p-2.5 rounded-sm border border-gray-800 mb-3">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">GIÁ HIỆN TẠI</span>
                    <span className="text-gray-100 font-bold">{item.price}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">MỤC TIÊU</span>
                    <span className="text-emerald-400 font-bold">{item.targetPrice}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">CẮT LỖ</span>
                    <span className="text-red-400 font-bold">{item.stopLoss}</span>
                  </div>
                </div>

                {/* Profit Potential */}
                <div className="flex items-center justify-between text-xs font-mono mb-3 px-1">
                  <div className="flex items-center space-x-1 text-emerald-400 font-bold">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Kỳ vọng LN: +{item.potentialProfitPercent}%</span>
                  </div>
                  <span className="text-gray-500 text-[11px]">Khung: {item.timeframe}</span>
                </div>

                {/* Reasons List */}
                <div className="space-y-1.5 text-xs text-gray-300 font-mono">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CĂN CỨ TÍN HIỆU QUANT & AI:</span>
                  </span>
                  <ul className="space-y-1 pl-4 list-disc text-[11px] text-gray-400">
                    {item.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-800 flex items-center space-x-2 font-mono">
                <button
                  onClick={() => onSelectStock(item.symbol)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded-sm text-xs transition flex items-center justify-center space-x-1"
                >
                  <span>MỞ TRADINGVIEW {item.symbol}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onOpenAIChat(`Giải thích lý do tại sao AI khuyến nghị cổ phiếu ${item.symbol} với mục tiêu ${item.targetPrice}`)}
                  className="bg-[#050505] hover:bg-gray-800 text-gray-300 p-1.5 rounded-sm text-xs border border-gray-700 transition"
                  title="Hỏi AI"
                >
                  <Sparkles className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
