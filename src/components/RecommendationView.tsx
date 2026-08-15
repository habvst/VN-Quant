import { AlertCircle, AlertTriangle, ArrowUpRight, Award, CheckCircle2, ChevronRight, Eye, Filter, Flame, Radar, RefreshCw, ShieldAlert, Sparkles, TrendingUp, Zap } from 'lucide-react';
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
      if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) setRecommendations(data);
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
    { id: 'ALL', label: 'Tất Cả Tín Hiệu', icon: Sparkles },
    { id: 'GOM_HÀNG_NGẦM', label: '🕵️ Gom Hàng Ngầm (Smart Money)', icon: Eye, badge: 'CÁ MẬP' },
    { id: 'ĐỘT_BIẾN_PHIÊN_SÁNG', label: '⚡ Đột Biến Khối Lượng Phiên Sáng', icon: Zap, badge: 'VOL BURST' },
    { id: 'PHÂN_KỲ_DÒNG_TIỀN', label: '🌊 Phân Kỳ Dòng Tiền Lớn', icon: TrendingUp, badge: 'EARLY' },
    { id: 'CẢNH_BÁO_BẪY_GIÁ', label: '🚨 Bẫy Tăng / Bẫy Giá (Bull Trap)', icon: AlertTriangle, badge: 'CẢNH BÁO' },
    { id: 'TOP_MUA_MẠNH', label: 'Top Mua Mạnh (Strong Buy)', icon: Award },
    { id: 'BREAKOUT', label: 'Top Bứt Phá (Breakout)', icon: Flame },
    { id: 'GOLDEN_CROSS', label: 'Golden Cross (MA20/50)', icon: CheckCircle2 },
    { id: 'KHỐI_NGOẠI_MUA', label: 'Khối Ngoại Mua Ròng', icon: ShieldAlert },
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
            <Radar className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-mono font-black text-white">
                BỘ NHẬN DIỆN BẪY & TÍN HIỆU SỚM (SMART MONEY & ANOMALY SCREENER)
              </h2>
              <span className="bg-cyan-950/90 text-cyan-400 border border-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-sm font-mono">
                QUANT RADAR
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Phát hiện gom hàng ngầm, đột biến khối lượng phiên sáng, phân kỳ dòng tiền lớn và cảnh báo bẫy tăng giá (Bull Trap)
            </p>
          </div>
        </div>

        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="bg-[#050505] hover:bg-gray-800 text-gray-200 px-3.5 py-1.5 rounded-sm border border-gray-700 text-xs font-mono font-semibold flex items-center space-x-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>QUÉT TÍN HIỆU CÁ MẬP</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 text-xs font-mono">
        {/* Category Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-sm transition whitespace-nowrap border flex items-center space-x-1.5 ${
                activeCategory === cat.id
                  ? cat.id === 'CẢNH_BÁO_BẪY_GIÁ'
                    ? 'bg-red-600 text-white border-red-500 font-bold shadow'
                    : 'bg-blue-600 text-white border-blue-500 font-bold shadow'
                  : 'bg-[#050505] text-gray-400 hover:text-gray-200 border-gray-800'
              }`}
            >
              <span>{cat.label}</span>
              {cat.badge && (
                <span className={`text-[9px] px-1 py-0.2 rounded font-black ${
                  cat.id === 'CẢNH_BÁO_BẪY_GIÁ' ? 'bg-red-950 text-red-300 border border-red-700' : 'bg-blue-950 text-cyan-300 border border-cyan-700'
                }`}>
                  {cat.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Exchange Dropdown */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-gray-400">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
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
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <span>Đang chạy Smart Money & Anomaly Quant Engine rà soát thị trường...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-[#0a0a0a] rounded-sm border border-gray-800 font-mono">
          Không có tín hiệu dị biệt nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, idx) => {
            const isTrap = item.category === 'CẢNH_BÁO_BẪY_GIÁ';
            const isAccum = item.category === 'GOM_HÀNG_NGẦM';
            const isBurst = item.category === 'ĐỘT_BIẾN_PHIÊN_SÁNG';
            const isDiv = item.category === 'PHÂN_KỲ_DÒNG_TIỀN';

            return (
              <div
                key={`${item.id}-${idx}`}
                className={`rounded-sm p-4 border transition shadow-xl flex flex-col justify-between space-y-4 group ${
                  isTrap
                    ? 'bg-[#0e0707] border-red-900/60 hover:border-red-600'
                    : isAccum
                    ? 'bg-[#060c14] border-cyan-900/60 hover:border-cyan-500'
                    : isBurst
                    ? 'bg-[#0b0c16] border-purple-900/60 hover:border-purple-500'
                    : 'bg-[#0a0a0a] border-gray-800 hover:border-gray-700'
                }`}
              >
                <div>
                  {/* Card Top Header */}
                  <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5 mb-3">
                    <div className="flex items-center space-x-2">
                      <span
                        onClick={() => onSelectStock(item.symbol)}
                        className="font-mono font-black text-xl text-white cursor-pointer hover:text-cyan-400 transition"
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

                    {/* Badge Category */}
                    <div className="flex items-center space-x-1">
                      {isTrap ? (
                        <span className="bg-red-950 text-red-400 border border-red-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          <span>BẪY GIÁ</span>
                        </span>
                      ) : isAccum ? (
                        <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm flex items-center space-x-1">
                          <Eye className="w-3 h-3 text-cyan-300" />
                          <span>GOM NGẦM</span>
                        </span>
                      ) : isBurst ? (
                        <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-purple-300" />
                          <span>VOL BURST</span>
                        </span>
                      ) : isDiv ? (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm flex items-center space-x-1">
                          <TrendingUp className="w-3 h-3 text-emerald-300" />
                          <span>PHÂN KỲ DƯƠNG</span>
                        </span>
                      ) : (
                        <div className="flex items-center space-x-1 bg-blue-950/60 border border-blue-800 px-2 py-0.5 rounded-sm">
                          <Sparkles className="w-3 h-3 text-blue-400" />
                          <span className="text-xs font-mono font-bold text-blue-400">Score: {item.score}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price & Target Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#050505] p-2.5 rounded-sm border border-gray-800 mb-3">
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase block">GIÁ HIỆN TẠI</span>
                      <span className={`font-bold ${isTrap ? 'text-red-400' : 'text-gray-100'}`}>
                        {item.price}k ({item.changePercent > 0 ? `+${item.changePercent}` : item.changePercent}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase block">
                        {isTrap ? 'VÙNG DỘI VỀ' : 'MỤC TIÊU (TP)'}
                      </span>
                      <span className={`font-bold ${isTrap ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {item.targetPrice}k
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase block">
                        {isTrap ? 'CẢN TRÊN' : 'CẮT LỖ (SL)'}
                      </span>
                      <span className="text-red-400 font-bold">{item.stopLoss}k</span>
                    </div>
                  </div>

                  {/* Profit / Risk Potential */}
                  <div className="flex items-center justify-between text-xs font-mono mb-3 px-1">
                    <div className={`flex items-center space-x-1 font-bold ${isTrap ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isTrap ? <AlertTriangle className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      <span>{isTrap ? `Rủi ro lỗ ngắn hạn: ${item.potentialProfitPercent}%` : `Kỳ vọng LN: +${item.potentialProfitPercent}%`}</span>
                    </div>
                    <span className="text-gray-500 text-[11px]">{item.timeframe}</span>
                  </div>

                  {/* Reasons List */}
                  <div className="space-y-1.5 text-xs text-gray-300 font-mono">
                    <span className={`text-[10px] uppercase tracking-wider font-semibold flex items-center space-x-1 ${
                      isTrap ? 'text-red-400' : 'text-cyan-400'
                    }`}>
                      {isTrap ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                      <span>{isTrap ? 'DẤU HIỆU BẪY & RỦI RO THAO TÚNG:' : 'CĂN CỨ TÍN HIỆU CÁ MẬP & QUANT:'}</span>
                    </span>
                    <ul className="space-y-1 pl-4 list-disc text-[11px] text-gray-300">
                      {item.reasons.map((r, rIdx) => (
                        <li key={rIdx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-gray-800 flex items-center space-x-2 font-mono">
                  <button
                    onClick={() => onSelectStock(item.symbol)}
                    className={`flex-1 font-bold py-1.5 rounded-sm text-xs transition flex items-center justify-center space-x-1 text-white ${
                      isTrap ? 'bg-red-800 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    <span>MỞ TRADINGVIEW {item.symbol}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() =>
                      onOpenAIChat(
                        `Phân tích chuyên sâu cổ phiếu ${item.symbol} theo dấu chân cá mập (Smart Money) và kiểm tra bẫy giá Bull/Bear Trap.`
                      )
                    }
                    className="bg-[#050505] hover:bg-gray-800 text-gray-300 px-2.5 py-1.5 rounded-sm text-xs border border-gray-700 hover:border-cyan-500 transition flex items-center space-x-1"
                    title="Phân tích cá mập AI"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-400">SMART MONEY AI</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

