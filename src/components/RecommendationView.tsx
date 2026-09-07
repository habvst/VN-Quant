import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  Filter,
  Flame,
  Layers,
  Plus,
  Radar,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AIRecommendation, MarketType, PortfolioPosition, RecommendationPerformance } from '../types';
import { useWatchlist } from '../services/watchlistService';
import { RecommendationPerformanceModal } from './RecommendationPerformanceModal';

interface RecommendationViewProps {
  onSelectStock: (symbol: string) => void;
  onOpenAIChat: (prompt: string) => void;
}

export const RecommendationView: React.FC<RecommendationViewProps> = ({ onSelectStock, onOpenAIChat }) => {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [performance, setPerformance] = useState<RecommendationPerformance | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedExchange, setSelectedExchange] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [liquidityFilter, setLiquidityFilter] = useState<'ALL' | 'SAFE_ONLY' | 'HIGH_ONLY' | 'VERY_HIGH'>('SAFE_ONLY');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'WATCHLIST' | 'PORTFOLIO'>('ALL');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const { watchlist, isWatching, toggle: toggleWatch } = useWatchlist();
  const [portfolioSymbols, setPortfolioSymbols] = useState<string[]>([]);

  // Load owned portfolio positions
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vnquant_portfolio_positions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPortfolioSymbols(parsed.map((p: PortfolioPosition) => p.symbol));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleToggleWatchlist = (item: AIRecommendation) => {
    const res = toggleWatch(item.symbol, {
      targetPrice: item.targetPrice,
      stopLoss: item.stopLoss,
      note: `${item.category}: ${item.reasons?.[0] || 'Khuyến nghị AI'}`,
    });

    if (res.inWatchlist) {
      setToastMessage({
        type: 'success',
        text: `⭐ Đã thêm ${item.symbol} vào Danh mục theo dõi & Kích hoạt Sentinel giám sát!`,
      });
    } else {
      setToastMessage({
        type: 'info',
        text: `Đã hủy theo dõi mã ${item.symbol}.`,
      });
    }

    setTimeout(() => {
      setToastMessage((prev) => (prev?.text.includes(item.symbol) ? null : prev));
    }, 3500);
  };

  const fetchRecommendationsAndPerformance = async () => {
    setLoading(true);
    try {
      const [recRes, perfRes] = await Promise.all([
        fetch('/api/recommendations'),
        fetch('/api/recommendations/performance'),
      ]);

      if (recRes.ok && (recRes.headers.get('content-type') || '').includes('application/json')) {
        const recData = await recRes.json();
        if (Array.isArray(recData)) setRecommendations(recData);
      }

      if (perfRes.ok && (perfRes.headers.get('content-type') || '').includes('application/json')) {
        const perfData = await perfRes.json();
        if (perfData && perfData.winRate !== undefined) setPerformance(perfData);
      }
    } catch (err) {
      console.error('Error fetching recommendations or performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendationsAndPerformance();
  }, []);

  const categories = [
    { id: 'ALL', label: 'Tất Cả Tín Hiệu', icon: Sparkles },
    { id: 'GOM_HÀNG_NGẦM', label: '🕵️ Gom Hàng Ngầm', icon: Eye, badge: 'CÁ MẬP' },
    { id: 'ĐỘT_BIẾN_PHIÊN_SÁNG', label: '⚡ Đột Biến Vol Sáng', icon: Zap, badge: 'VOL BURST' },
    { id: 'BREAKOUT', label: '🔥 Top Bứt Phá (Breakout)', icon: Flame, badge: 'BREAKOUT' },
    { id: 'PHÂN_KỲ_DÒNG_TIỀN', label: '🌊 Phân Kỳ Dòng Tiền', icon: TrendingUp, badge: 'EARLY' },
    { id: 'CẢNH_BÁO_BẪY_GIÁ', label: '🚨 Cảnh Báo Bẫy Giá (Bull Trap)', icon: AlertTriangle, badge: 'CẢNH BÁO' },
    { id: 'GOLDEN_CROSS', label: '📈 Golden Cross (MA20/50)', icon: CheckCircle2, badge: 'MA CROSS' },
    { id: 'KHỐI_NGOẠI_MUA', label: '🌐 Khối Ngoại Mua Ròng', icon: ShieldAlert, badge: 'TÂY GOM' },
    { id: 'TOP_MUA_MẠNH', label: '⭐ Top Mua Mạnh (Strong Buy)', icon: Award, badge: 'BUY' },
  ];

  const getCategoryCount = (catId: string) => {
    if (catId === 'ALL') return recommendations.length;
    return recommendations.filter(
      (r) => r.category === catId || (r.categories && r.categories.includes(catId as any))
    ).length;
  };

  // Filter recommendations based on all applied dimensions
  const filtered = recommendations.filter((r) => {
    // 1. Category Filter
    if (activeCategory !== 'ALL') {
      const hasCategory =
        r.category === activeCategory ||
        (r.categories && r.categories.includes(activeCategory as any));
      if (!hasCategory) return false;
    }

    // 2. Exchange Filter
    if (selectedExchange !== 'ALL' && r.exchange !== selectedExchange) return false;

    // 3. Sector Filter
    if (selectedSector !== 'ALL' && r.sector !== selectedSector) return false;

    // 4. Ownership Filter (Watchlist vs Portfolio)
    if (ownershipFilter === 'WATCHLIST' && !isWatching(r.symbol)) return false;
    if (ownershipFilter === 'PORTFOLIO' && !portfolioSymbols.includes(r.symbol)) return false;

    // 5. Liquidity Filter
    if (liquidityFilter === 'SAFE_ONLY' && r.isSafeLiquidity === false) return false;
    if (liquidityFilter === 'HIGH_ONLY' && (r.tradingValue || 0) < 15) return false;
    if (liquidityFilter === 'VERY_HIGH' && (r.tradingValue || 0) < 50) return false;

    return true;
  });

  const watchlistMatchCount = recommendations.filter((r) => isWatching(r.symbol)).length;
  const portfolioMatchCount = recommendations.filter((r) => portfolioSymbols.includes(r.symbol)).length;
  const safeLiquidityCount = recommendations.filter((r) => r.isSafeLiquidity !== false).length;

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
                1 MÃ = 1 CARD HỢP NHẤT
              </span>
              <span className="bg-emerald-950/90 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-sm font-mono hidden sm:inline">
                VŨ TRỤ HOSE • HNX • UPCOM
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Phát hiện gom hàng ngầm, đột biến khối lượng phiên sáng, phân kỳ dòng tiền lớn và cảnh báo bẫy tăng giá (Bull Trap)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {performance && (
            <button
              onClick={() => setIsAuditModalOpen(true)}
              className="bg-[#081510] hover:bg-emerald-950/80 text-emerald-300 px-3 py-1.5 rounded-sm border border-emerald-700/80 text-xs font-mono font-semibold flex items-center space-x-1.5 transition"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>NHẬT KÝ KIỂM ĐỊNH LỆNH</span>
            </button>
          )}

          <button
            onClick={fetchRecommendationsAndPerformance}
            disabled={loading}
            className="bg-[#050505] hover:bg-gray-800 text-gray-200 px-3.5 py-1.5 rounded-sm border border-gray-700 text-xs font-mono font-semibold flex items-center space-x-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>QUÉT TÍN HIỆU CÁ MẬP</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PERFORMANCE METRICS DASHBOARD (BỘ ĐO HIỆU SUẤT TRỰC QUAN)     */}
      {/* ------------------------------------------------------------- */}
      {performance && (
        <div className="bg-[#0a0a0a] rounded-sm border border-gray-800 p-4 shadow-xl font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-800/80 gap-2 mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-bold text-white uppercase tracking-wider text-xs flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>BỘ ĐO HIỆU SUẤT KHUYẾN NGHỊ AI (QUANT PERFORMANCE & WIN-RATE)</span>
              </span>
              <span className="text-gray-500 text-[11px]">| Chu kỳ: {performance.period}</span>
            </div>

            <button
              onClick={() => setIsAuditModalOpen(true)}
              className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 text-xs transition"
            >
              <span>Xem toàn bộ 21 lệnh đã đóng (Audit Trail)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4 Core Performance Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {/* 1. Win Rate */}
            <div className="bg-[#050505] p-3 rounded-sm border border-emerald-900/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
                <span>TỶ LỆ THẮNG (WIN-RATE)</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-emerald-400">{performance.winRate}%</span>
                <span className="text-[11px] text-gray-400">
                  ({performance.winningTrades}/{performance.totalTrades} Lệnh TP)
                </span>
              </div>
              <div className="text-[10px] text-emerald-500/80 mt-1 font-sans">
                Đạt mục tiêu chốt lời kỷ luật
              </div>
            </div>

            {/* 2. Average Profit */}
            <div className="bg-[#050505] p-3 rounded-sm border border-cyan-900/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
                <span>LỢI NHUẬN TB / LỆNH</span>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-cyan-400">+{performance.avgProfitPercent}%</span>
                <span className="text-[11px] text-gray-400">/ Vị thế</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Lãi TB: <span className="text-emerald-400 font-bold">+{performance.avgWinningProfitPercent}%</span> | Cắt lỗ: <span className="text-red-400 font-bold">{performance.avgLossPercent}%</span>
              </div>
            </div>

            {/* 3. Profit Factor */}
            <div className="bg-[#050505] p-3 rounded-sm border border-blue-900/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
                <span>PROFIT FACTOR (LÃI/LỖ)</span>
                <Award className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-blue-400">{performance.profitFactor}x</span>
                <span className="text-[11px] text-gray-400">Tỷ suất an toàn</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Max Drawdown: <span className="text-amber-400 font-bold">{performance.maxDrawdown}%</span>
              </div>
            </div>

            {/* 4. Average Holding Period */}
            <div className="bg-[#050505] p-3 rounded-sm border border-amber-900/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
                <span>THỜI GIAN NẮM GIỮ TB</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-amber-400">{performance.avgHoldingDays}</span>
                <span className="text-[11px] text-gray-400">Ngày / Lệnh</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Chiến lược: <span className="text-gray-300 font-semibold">Swing Trading (T+15~25)</span>
              </div>
            </div>
          </div>

          {/* Visual Progress Bar of Trade Outcomes */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Phân bổ kết quả vị thế khuyến nghị:</span>
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-emerald-400 font-bold">{performance.distribution.targetHitPercent}% Chạm Target Price</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  <span className="text-blue-400 font-bold">{performance.distribution.inProgressProfitablePercent}% Đang Chạy Có Lãi</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  <span className="text-red-400 font-bold">{performance.distribution.stoplossHitPercent}% Cắt Lỗ Kỷ Luật</span>
                </span>
              </div>
            </div>

            <div className="w-full h-2.5 bg-gray-900 rounded-sm overflow-hidden flex">
              <div
                style={{ width: `${performance.distribution.targetHitPercent}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Đạt TP: ${performance.distribution.targetHitPercent}%`}
              />
              <div
                style={{ width: `${performance.distribution.inProgressProfitablePercent}%` }}
                className="h-full bg-blue-500 transition-all duration-500"
                title={`Đang sinh lời: ${performance.distribution.inProgressProfitablePercent}%`}
              />
              <div
                style={{ width: `${performance.distribution.stoplossHitPercent}%` }}
                className="h-full bg-red-500 transition-all duration-500"
                title={`Cắt lỗ SL: ${performance.distribution.stoplossHitPercent}%`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* FILTER TOOLBAR (CATEGORY, EXCHANGE, LIQUIDITY, WATCHLIST)     */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-2 bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 text-xs font-mono">
        {/* Row 1: Category Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {categories.map((cat) => {
            const count = getCategoryCount(cat.id);
            return (
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
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                    activeCategory === cat.id
                      ? 'bg-white/20 text-white'
                      : cat.id === 'CẢNH_BÁO_BẪY_GIÁ'
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-gray-900 text-gray-400 border border-gray-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Secondary Filters (Ownership, Safe Liquidity, Exchanges) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-800/80">
          {/* Quick Ownership Buttons (Watchlist & Portfolio) */}
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 text-[11px] hidden sm:inline">Danh mục:</span>
            <button
              onClick={() => setOwnershipFilter('ALL')}
              className={`px-2.5 py-1 rounded-sm border transition flex items-center space-x-1 ${
                ownershipFilter === 'ALL'
                  ? 'bg-gray-800 text-white border-gray-600 font-bold'
                  : 'bg-[#050505] text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              <span>Tất Cả ({recommendations.length})</span>
            </button>

            <button
              onClick={() => setOwnershipFilter(ownershipFilter === 'WATCHLIST' ? 'ALL' : 'WATCHLIST')}
              className={`px-2.5 py-1 rounded-sm border transition flex items-center space-x-1 ${
                ownershipFilter === 'WATCHLIST'
                  ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                  : 'bg-[#050505] text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/40'
              }`}
              title="Lọc các mã khuyến nghị nằm trong Danh mục theo dõi của bạn"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Đang Theo Dõi ({watchlistMatchCount})</span>
            </button>

            <button
              onClick={() => setOwnershipFilter(ownershipFilter === 'PORTFOLIO' ? 'ALL' : 'PORTFOLIO')}
              className={`px-2.5 py-1 rounded-sm border transition flex items-center space-x-1 ${
                ownershipFilter === 'PORTFOLIO'
                  ? 'bg-blue-600 text-white border-blue-500 font-bold'
                  : 'bg-[#050505] text-blue-400 border-blue-900/60 hover:bg-blue-950/40'
              }`}
              title="Lọc các mã khuyến nghị mà bạn đang nắm giữ trong Danh mục đầu tư"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Đang Sở Hữu ({portfolioMatchCount})</span>
            </button>
          </div>

          {/* Safe Liquidity Filter & Exchange Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Liquidity Safe Gate Selector */}
            <div className="flex items-center space-x-1.5">
              <span className="text-gray-500 text-[11px] flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Thanh khoản:</span>
              </span>
              <select
                value={liquidityFilter}
                onChange={(e) => setLiquidityFilter(e.target.value as any)}
                className="bg-[#050505] text-emerald-300 px-2 py-1 rounded-sm border border-gray-800 outline-none font-mono text-xs focus:border-emerald-500"
              >
                <option value="SAFE_ONLY">🛡️ Thanh Khoản An Toàn (GTGD ≥ 4 Tỷ)</option>
                <option value="HIGH_ONLY">🔥 Thanh Khoản Cao (GTGD ≥ 15 Tỷ)</option>
                <option value="VERY_HIGH">💎 Top Thanh Khoản Khủng (GTGD ≥ 50 Tỷ)</option>
                <option value="ALL">Tất cả thanh khoản (Bao gồm vol thấp)</option>
              </select>
            </div>

            {/* Exchange Dropdown / Buttons */}
            <div className="flex items-center space-x-1.5">
              <span className="text-gray-500 text-[11px] flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sàn:</span>
              </span>
              <select
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="bg-[#050505] text-gray-200 px-2 py-1 rounded-sm border border-gray-800 outline-none font-mono text-xs focus:border-cyan-500"
              >
                <option value="ALL">Tất cả sàn (HOSE, HNX, UPCOM)</option>
                <option value="HOSE">HOSE (Vũ trụ Bluechips & Midcaps)</option>
                <option value="HNX">HNX (Midcaps Tiềm năng)</option>
                <option value="UPCOM">UPCOM (Cơ hội định giá rẻ)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RECOMMENDATIONS CARDS GRID                                    */}
      {/* ------------------------------------------------------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 space-y-3 font-mono">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <span>Đang chạy Smart Money & Anomaly Quant Engine rà soát toàn bộ thị trường...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-[#0a0a0a] rounded-sm border border-gray-800 font-mono space-y-2">
          <AlertCircle className="w-8 h-8 text-gray-600 mx-auto" />
          <div className="text-gray-300 font-bold">Không có mã nào khớp với bộ lọc hiện tại.</div>
          <div className="text-xs text-gray-500">
            Thử chuyển sang sàn khác, chọn "Tất Cả Tín Hiệu" hoặc nới lỏng màng lọc thanh khoản.
          </div>
          <button
            onClick={() => {
              setActiveCategory('ALL');
              setSelectedExchange('ALL');
              setOwnershipFilter('ALL');
              setLiquidityFilter('ALL');
            }}
            className="mt-2 bg-gray-800 hover:bg-gray-700 text-cyan-400 text-xs px-3 py-1.5 rounded-sm transition"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, idx) => {
            const isTrap =
              item.categories?.includes('CẢNH_BÁO_BẪY_GIÁ') || item.category === 'CẢNH_BÁO_BẪY_GIÁ';
            const isAccum =
              item.categories?.includes('GOM_HÀNG_NGẦM') || item.category === 'GOM_HÀNG_NGẦM';
            const isBurst =
              item.categories?.includes('ĐỘT_BIẾN_PHIÊN_SÁNG') || item.category === 'ĐỘT_BIẾN_PHIÊN_SÁNG';
            const isBreakout =
              item.categories?.includes('BREAKOUT') || item.category === 'BREAKOUT';
            const isWatched = isWatching(item.symbol);
            const isOwned = portfolioSymbols.includes(item.symbol);

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
                    : isBreakout
                    ? 'bg-[#0f0c08] border-amber-900/60 hover:border-amber-500'
                    : 'bg-[#0a0a0a] border-gray-800 hover:border-gray-700'
                }`}
              >
                <div>
                  {/* Card Top Header */}
                  <div className="flex items-start justify-between border-b border-gray-800/80 pb-2.5 mb-3 gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          onClick={() => onSelectStock(item.symbol)}
                          className="font-mono font-black text-xl text-white cursor-pointer hover:text-cyan-400 transition"
                        >
                          {item.symbol}
                        </span>

                        {/* Exchange Badge */}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono border ${
                            item.exchange === 'HOSE'
                              ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                              : item.exchange === 'HNX'
                              ? 'bg-purple-950/60 text-purple-300 border-purple-800'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800'
                          }`}
                        >
                          {item.exchange}
                        </span>

                        <span className="text-[10px] bg-[#050505] text-gray-400 px-1.5 py-0.5 rounded-sm font-mono border border-gray-800">
                          {item.sector}
                        </span>

                        {/* Ownership tags */}
                        {isOwned && (
                          <span className="text-[9px] bg-blue-900/60 text-blue-300 px-1 py-0.2 rounded-sm border border-blue-600 font-mono font-bold">
                            💼 ĐANG SỞ HỮU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-[200px] mt-0.5">
                        {item.name}
                      </div>
                    </div>

                    {/* Multi-Signal Badges & Watchlist Toggle */}
                    <div className="flex items-center space-x-1.5">
                      <div className="flex flex-wrap items-center justify-end gap-1 max-w-[210px]">
                        {item.signals && item.signals.length > 0 ? (
                          item.signals.map((sig, sIdx) => {
                            const colorClasses =
                              sig.color === 'red'
                                ? 'bg-red-950 text-red-300 border-red-800'
                                : sig.color === 'cyan'
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                : sig.color === 'purple'
                                ? 'bg-purple-950 text-purple-300 border-purple-800'
                                : sig.color === 'emerald'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : sig.color === 'amber'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : sig.color === 'blue'
                                ? 'bg-blue-950 text-blue-300 border-blue-800'
                                : sig.color === 'indigo'
                                ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                                : 'bg-teal-950 text-teal-300 border-teal-800';

                            return (
                              <span
                                key={sIdx}
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border whitespace-nowrap ${colorClasses}`}
                              >
                                {sig.badge}
                              </span>
                            );
                          })
                        ) : (
                          <span className="bg-blue-950 text-cyan-300 border border-cyan-800 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm">
                            {item.category}
                          </span>
                        )}
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-gray-900 border border-gray-700 text-cyan-300">
                          ⭐ {item.score}
                        </span>
                      </div>

                      {/* Quick Watchlist Toggle Icon */}
                      <button
                        onClick={() => handleToggleWatchlist(item)}
                        className={`p-1 rounded-sm border transition cursor-pointer flex-shrink-0 ${
                          isWatched
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-600 hover:bg-red-950/80 hover:text-red-300 hover:border-red-600'
                            : 'bg-[#050505] text-gray-400 border-gray-800 hover:text-emerald-300 hover:border-emerald-700'
                        }`}
                        title={isWatched ? `Hủy theo dõi ${item.symbol}` : `Thêm ${item.symbol} vào danh mục theo dõi`}
                      >
                        {isWatched ? <BookmarkCheck className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Price & Target Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#050505] p-2.5 rounded-sm border border-gray-800 mb-2.5">
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

                  {/* Liquidity Indicator Bar (Mới: Màng lọc thanh khoản) */}
                  <div className="flex items-center justify-between text-[11px] font-mono bg-[#070707] px-2 py-1.5 rounded-sm border border-gray-800/80 mb-2.5">
                    <div className="flex items-center space-x-1 text-gray-400">
                      <span>GTGD:</span>
                      <span className="font-bold text-gray-200">{item.tradingValue || 0} tỷ</span>
                      <span className="text-gray-600">•</span>
                      <span
                        className={
                          item.liquidityRating === 'RẤT_CAO'
                            ? 'text-emerald-400 font-semibold'
                            : item.liquidityRating === 'CAO'
                            ? 'text-cyan-400 font-semibold'
                            : item.liquidityRating === 'CHUẨN_MIDCAP'
                            ? 'text-blue-400 font-semibold'
                            : 'text-amber-400'
                        }
                      >
                        {item.liquidityRating === 'RẤT_CAO'
                          ? 'Rất cao'
                          : item.liquidityRating === 'CAO'
                          ? 'Dồi dào'
                          : item.liquidityRating === 'CHUẨN_MIDCAP'
                          ? 'Chuẩn Midcap'
                          : 'Vol thấp'}
                      </span>
                    </div>

                    <div>
                      {item.isSafeLiquidity !== false ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-1.5 py-0.2 rounded-sm flex items-center space-x-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
                          <span>An toàn</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.2 rounded-sm flex items-center space-x-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400 inline" />
                          <span>Lưu ý Vol</span>
                        </span>
                      )}
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
                <div className="pt-3 border-t border-gray-800 flex flex-wrap items-center gap-2 font-mono">
                  {/* Primary TradingView Button */}
                  <button
                    onClick={() => onSelectStock(item.symbol)}
                    className={`flex-1 min-w-[130px] font-bold py-1.5 px-2 rounded-sm text-xs transition flex items-center justify-center space-x-1 text-white ${
                      isTrap ? 'bg-red-800 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    <span>MỞ CHART {item.symbol}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Add / Remove from Watchlist Button */}
                  <button
                    onClick={() => handleToggleWatchlist(item)}
                    className={`py-1.5 px-2.5 rounded-sm text-xs font-bold font-mono border transition flex items-center space-x-1 whitespace-nowrap cursor-pointer ${
                      isWatched
                        ? 'bg-emerald-950/90 hover:bg-red-950/90 text-emerald-300 hover:text-red-300 border-emerald-600 hover:border-red-600 group/btn'
                        : 'bg-[#042017] hover:bg-emerald-700 text-emerald-300 hover:text-white border-emerald-600/80 shadow'
                    }`}
                    title={isWatched ? `Bấm để hủy theo dõi ${item.symbol}` : `Thêm ${item.symbol} vào Danh mục theo dõi & Kích hoạt Sentinel`}
                  >
                    {isWatched ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400 group-hover/btn:hidden" />
                        <span className="group-hover/btn:hidden">ĐÃ THEO DÕI</span>
                        <X className="w-3.5 h-3.5 text-red-400 hidden group-hover/btn:inline" />
                        <span className="hidden group-hover/btn:inline">BỎ THEO DÕI</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>+ THEO DÕI</span>
                      </>
                    )}
                  </button>

                  {/* AI Smart Money Analysis Button */}
                  <button
                    onClick={() =>
                      onOpenAIChat(
                        `Phân tích chuyên sâu cổ phiếu ${item.symbol} (${item.name} - ${item.exchange}) theo dấu chân cá mập (Smart Money), thanh khoản ${item.tradingValue} tỷ, và kiểm tra bẫy giá Bull/Bear Trap.`
                      )
                    }
                    className="bg-[#050505] hover:bg-gray-800 text-gray-300 px-2.5 py-1.5 rounded-sm text-xs border border-gray-700 hover:border-cyan-500 transition flex items-center space-x-1 whitespace-nowrap"
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

      {/* Audit Trail Modal */}
      {performance && (
        <RecommendationPerformanceModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          performance={performance}
          onSelectStock={onSelectStock}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-300">
          <div
            className={`px-4 py-2.5 rounded-sm border shadow-2xl font-mono text-xs flex items-center space-x-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-500 shadow-emerald-950/60'
                : 'bg-gray-900 text-gray-200 border-gray-700 shadow-black/80'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-gray-400" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-gray-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

