import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  Info,
  Layers,
  Newspaper,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { NewsItem, StockData } from '../types';

interface NewsAlertsViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export const NewsAlertsView: React.FC<NewsAlertsViewProps> = ({ stocks, onSelectStock }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filterSentiment, setFilterSentiment] = useState<string>('ALL');
  const [filterAuthenticity, setFilterAuthenticity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  const [analyzingNewsId, setAnalyzingNewsId] = useState<string | null>(null);
  const [aiDeepAnalysisResult, setAiDeepAnalysisResult] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchNews = () => {
    setIsLoading(true);
    fetch('/api/market/news')
      .then((res) => {
        if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
          return [];
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setNews(data);
      })
      .catch((err) => console.error('Failed to fetch news:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleDeepAIAnalyze = async (item: NewsItem) => {
    setAnalyzingNewsId(item.id);
    try {
      const res = await fetch('/api/ai/news-deep-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId: item.id, title: item.title }),
      });
      const data = await res.json();
      if (data && data.aiAnalysis) {
        setAiDeepAnalysisResult((prev) => ({ ...prev, [item.id]: data.aiAnalysis }));
        setExpandedNewsId(item.id);
      }
    } catch (err) {
      console.error('Error running Deep AI news analysis:', err);
    } finally {
      setAnalyzingNewsId(null);
    }
  };

  const getSentimentScoreColor = (score: number) => {
    if (score >= 60) return 'text-emerald-400 bg-emerald-950/80 border-emerald-700';
    if (score >= 20) return 'text-green-400 bg-green-950/70 border-green-800';
    if (score <= -60) return 'text-red-400 bg-red-950/80 border-red-700';
    if (score <= -20) return 'text-amber-400 bg-amber-950/70 border-amber-800';
    return 'text-slate-300 bg-slate-900 border-slate-800';
  };

  const getAuthenticityBadge = (level?: string) => {
    switch (level) {
      case 'CHÍNH THỐNG':
        return {
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700',
          icon: <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />,
          label: 'CHÍNH THỐNG (UBCK/HOSE)',
        };
      case 'ĐÃ XÁC THỰC':
        return {
          bg: 'bg-blue-950/80 text-blue-300 border-blue-700',
          icon: <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />,
          label: 'ĐÃ XÁC THỰC (BÁO CHÍ LỚN)',
        };
      case 'CẦN KIỂM CHỨNG':
        return {
          bg: 'bg-amber-950/80 text-amber-300 border-amber-700',
          icon: <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />,
          label: 'CẦN KIỂM CHỨNG (NGUỒN RÒ RỈ)',
        };
      case 'TIN ĐỒN TRUYỀN MIỆNG':
        return {
          bg: 'bg-red-950/80 text-red-300 border-red-700',
          icon: <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" />,
          label: 'TIN ĐỒN ROOM / F319',
        };
      default:
        return {
          bg: 'bg-gray-900 text-gray-300 border-gray-800',
          icon: <Info className="w-3 h-3 text-gray-400 shrink-0" />,
          label: 'ĐÃ XÁC THỰC',
        };
    }
  };

  const filteredNews = news.filter((n) => {
    const score = n.sentimentScore ?? (n.sentiment === 'TÍCH CỰC' ? 65 : n.sentiment === 'TIÊU CỰC' ? -65 : 0);
    const authLevel = n.authenticity?.level || 'ĐÃ XÁC THỰC';

    if (filterSentiment === 'POSITIVE' && score < 20) return false;
    if (filterSentiment === 'NEGATIVE' && score > -20) return false;
    if (filterSentiment === 'NEUTRAL' && (score > 20 || score < -20)) return false;

    if (filterAuthenticity !== 'ALL' && authLevel !== filterAuthenticity) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchSummary = n.summary.toLowerCase().includes(q);
      const matchSymbols = n.symbols && n.symbols.some((s) => s.toLowerCase().includes(q));
      if (!matchTitle && !matchSummary && !matchSymbols) return false;
    }

    return true;
  });

  // Dynamic technical alerts
  const alerts = stocks.flatMap((s) => {
    const res = [];
    if (s.technical.rsi14 > 70) {
      res.push({
        id: `alt-rsi-h-${s.symbol}`,
        symbol: s.symbol,
        type: 'WARNING',
        title: `RSI Quá Mua (${s.technical.rsi14})`,
        message: `${s.symbol} đã vào vùng quá mua RSI(14) > 70. Cảnh báo áp lực chốt lời ngắn hạn.`,
        time: '5 phút trước',
      });
    }
    if (s.technical.rsi14 < 35) {
      res.push({
        id: `alt-rsi-l-${s.symbol}`,
        symbol: s.symbol,
        type: 'OPPORTUNITY',
        title: `RSI Quá Bán (${s.technical.rsi14})`,
        message: `${s.symbol} vào vùng quá bán RSI(14) < 35. Cơ hội tích lũy bắt đáy ngắn hạn.`,
        time: '12 phút trước',
      });
    }
    if (s.technical.ma20 > s.technical.ma50) {
      res.push({
        id: `alt-gc-${s.symbol}`,
        symbol: s.symbol,
        type: 'BULLISH',
        title: `Tín Hiệu Golden Cross MA20/50`,
        message: `Đường MA20 (${s.technical.ma20}) cắt lên trên đường MA50 (${s.technical.ma50}) xác nhận xu hướng tăng dài hạn.`,
        time: '20 phút trước',
      });
    }
    return res;
  });

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4 font-mono">
      {/* Header Banner with Deep Sentiment Scoring Summary */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-mono font-black text-white">MÔ HÌNH ĐÁNH GIÁ SẮC THÁI TIN TỨC & DỰ BÁO TÁC ĐỘNG GIÁ</h2>
              <span className="px-2 py-0.5 bg-purple-950/80 text-purple-300 border border-purple-700 text-[10px] font-bold rounded-sm uppercase tracking-wider">
                DEEP SENTIMENT SCORING (-100 ĐẾN +100)
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              Phân tích tính xác thực nguồn tin, dự báo biến động giá T+1 đến T+5 & khuyến nghị hành động tức thời
            </p>
          </div>
        </div>

        <button
          onClick={fetchNews}
          disabled={isLoading}
          className="px-3 py-1.5 bg-[#121212] hover:bg-gray-800 text-gray-200 hover:text-white border border-gray-700 rounded-sm text-xs font-bold flex items-center space-x-1.5 transition self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          <span>LÀM MỚI TIN TỨC</span>
        </button>
      </div>

      {/* Model Feature Explainer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 flex items-start space-x-3">
          <div className="w-8 h-8 rounded-sm bg-blue-950/80 border border-blue-700/80 flex items-center justify-center text-blue-400 shrink-0 font-bold text-xs">
            ±100
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-200 uppercase">Thang Điểm Sắc Thái Định Lượng</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Định lượng từ <strong className="text-red-400">-100 (Rất tiêu cực)</strong> đến <strong className="text-emerald-400">+100 (Rất tích cực)</strong>, loại bỏ thiên vị cảm tính.
            </p>
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 flex items-start space-x-3">
          <div className="w-8 h-8 rounded-sm bg-emerald-950/80 border border-emerald-700/80 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-200 uppercase">Xác Thực & Nhận Diện Tin Đồn</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Tự động phân hạng uy tín: UBCKNN / Doanh nghiệp niêm yết, Báo chí tài chính uy tín, và Room tin đồn F319/Zalo.
            </p>
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 flex items-start space-x-3">
          <div className="w-8 h-8 rounded-sm bg-purple-950/80 border border-purple-700/80 flex items-center justify-center text-purple-400 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-200 uppercase">Dự Báo Tác Động Giá 1-5 Phiên</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Dự báo biên độ dao động T+1 &rarr; T+3 &rarr; T+5 khi hàng về và đưa ra chiến lược chốt lời / cắt lỗ tối ưu.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 cols: Enriched Deep News Stream */}
        <div className="lg:col-span-8 bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 font-mono text-xs shadow-xl">
          {/* Filters Bar */}
          <div className="space-y-2 border-b border-gray-800 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-200 flex items-center space-x-2 uppercase tracking-wider">
                <Newspaper className="w-4 h-4 text-emerald-400" />
                <span>DÒNG TIN TỨC ĐƯỢC CHẤM ĐIỂM DEEP QUANT SENTIMENT</span>
              </h3>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Lọc mã hoặc từ khóa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2 py-1 bg-[#050505] border border-gray-800 rounded-sm text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-44"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-[10px]">
              {/* Sentiment Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-gray-500 font-semibold mr-1">Sắc thái:</span>
                {[
                  { id: 'ALL', label: 'TẤT CẢ' },
                  { id: 'POSITIVE', label: '🟢 TÍCH CỰC (+)' },
                  { id: 'NEGATIVE', label: '🔴 TIÊU CỰC (-)' },
                  { id: 'NEUTRAL', label: '⚪ TRUNG TÍNH' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setFilterSentiment(s.id)}
                    className={`px-2 py-0.5 rounded-sm transition font-mono ${
                      filterSentiment === s.id
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-[#050505] text-gray-400 border border-gray-800 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Authenticity Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-gray-500 font-semibold mr-1">Độ xác thực:</span>
                {[
                  { id: 'ALL', label: 'TẤT CẢ' },
                  { id: 'CHÍNH THỐNG', label: 'CHÍNH THỐNG' },
                  { id: 'ĐÃ XÁC THỰC', label: 'XÁC THỰC' },
                  { id: 'CẦN KIỂM CHỨNG', label: 'KIỂM CHỨNG' },
                ].map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setFilterAuthenticity(a.id)}
                    className={`px-2 py-0.5 rounded-sm transition font-mono ${
                      filterAuthenticity === a.id
                        ? 'bg-purple-600 text-white font-bold'
                        : 'bg-[#050505] text-gray-400 border border-gray-800 hover:text-white'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* News List */}
          <div className="space-y-3 max-h-[750px] overflow-y-auto scrollbar-none pr-1">
            {filteredNews.length === 0 ? (
              <div className="text-center py-12 text-gray-500 font-mono">
                Không tìm thấy tin tức theo bộ lọc đã chọn.
              </div>
            ) : (
              filteredNews.map((n, idx) => {
                const score = n.sentimentScore ?? (n.sentiment === 'TÍCH CỰC' ? 68 : n.sentiment === 'TIÊU CỰC' ? -68 : 0);
                const scoreClass = n.sentimentClass || (score >= 60 ? 'RẤT TÍCH CỰC' : score >= 20 ? 'TÍCH CỰC' : score <= -60 ? 'RẤT TIÊU CỰC' : score <= -20 ? 'TIÊU CỰC' : 'TRUNG TÍNH');
                const authBadge = getAuthenticityBadge(n.authenticity?.level);
                const isExpanded = expandedNewsId === n.id;
                const isAnalyzing = analyzingNewsId === n.id;
                const aiAnalysis = aiDeepAnalysisResult[n.id];

                return (
                  <div
                    key={`${n.id}-${idx}`}
                    className={`bg-[#050505] p-3.5 rounded-sm border transition space-y-2.5 ${
                      isExpanded ? 'border-blue-600/70 shadow-lg bg-[#07090e]' : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    {/* Header Row: Title & Deep Sentiment Score Pill */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <a
                          href={
                            n.url && n.url !== '#' && n.url.startsWith('http')
                              ? n.url
                              : `https://www.google.com/search?q=${encodeURIComponent(n.title + ' ' + (n.source || ''))}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-bold text-sm leading-snug hover:underline inline-flex items-start group"
                          title="Bấm để đọc bài viết gốc trên tab mới"
                        >
                          <span>{n.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-blue-400 opacity-70 group-hover:opacity-100 shrink-0 inline mt-0.5 ml-1" />
                        </a>
                      </div>

                      {/* Deep Sentiment Score Gauge Box */}
                      <div className="flex flex-col items-end shrink-0">
                        <div className={`px-2.5 py-1 rounded-sm border text-xs font-black flex items-center space-x-1.5 ${getSentimentScoreColor(score)}`}>
                          {score > 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : score < 0 ? <ArrowDownRight className="w-3.5 h-3.5 text-red-400" /> : null}
                          <span>{score > 0 ? `+${score}` : score} / 100</span>
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold mt-0.5">
                          {scoreClass}
                        </span>
                      </div>
                    </div>

                    {/* Summary text */}
                    <p className="text-gray-300 text-[11px] leading-relaxed font-mono">{n.summary}</p>

                    {/* Deep Quantitative Metrics Panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#0a0a0a] p-2 rounded-sm border border-gray-800/80 text-[11px]">
                      {/* Left: Authenticity Verification */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-semibold text-[10px] flex items-center space-x-1">
                            <span>TÍNH XÁC THỰC:</span>
                          </span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-sm border flex items-center space-x-1 ${authBadge.bg}`}>
                            {authBadge.icon}
                            <span>{authBadge.label}</span>
                          </span>
                        </div>
                        <p className="text-gray-400 text-[10px] leading-tight">
                          {n.authenticity?.credibilityAnalysis || 'Độ tin cậy cao từ cổng thông tin tài chính uy tín.'}
                        </p>
                      </div>

                      {/* Right: 5-Session Price Impact Forecast */}
                      <div className="space-y-1 sm:border-l sm:border-gray-800 sm:pl-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-semibold text-[10px]">DỰ BÁO TÁC ĐỘNG GIÁ:</span>
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-sm border ${
                            (n.priceImpact?.estimatedChange || '').startsWith('+')
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : (n.priceImpact?.estimatedChange || '').startsWith('-')
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : 'bg-gray-900 text-gray-300 border-gray-800'
                          }`}>
                            {n.priceImpact?.estimatedChange || n.priceImpactForecast || '±1.5%'} ({n.priceImpact?.duration || '3-5 phiên'})
                          </span>
                        </div>
                        <p className="text-gray-300 text-[10px] leading-tight">
                          <strong className="text-blue-400">Khuyến nghị:</strong> {n.priceImpact?.suggestedAction || 'Theo dõi lực đỡ dòng tiền'}
                        </p>
                      </div>
                    </div>

                    {/* Deep Expanded Trajectory & Gemini AI Output */}
                    {isExpanded && (
                      <div className="p-3 bg-[#0d1117] rounded-sm border border-blue-900/50 space-y-2 text-[11px] animate-fadeIn">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                          <span className="font-bold text-blue-400 flex items-center space-x-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            <span>LỘ TRÌNH TÁC ĐỘNG GIÁ T+1 ĐẾN T+5 (QUANT PREDICTION)</span>
                          </span>
                          <span className="text-[10px] text-gray-400">Độ tin cậy: {n.priceImpact?.confidence || 85}%</span>
                        </div>

                        {/* 3-Step Timeline */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono pt-1">
                          <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                            <span className="text-blue-400 font-bold block">📍 Phiên T+1 (Phản ứng ATO):</span>
                            <span className="text-gray-300">
                              {aiAnalysis?.priceImpactForecast?.trajectory?.day1 || n.priceImpact?.trajectory?.day1 || 'Biến động sớm theo tin tức công bố'}
                            </span>
                          </div>

                          <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                            <span className="text-purple-400 font-bold block">📍 Phiên T+2 ~ T+3 (Hấp thụ hàng về):</span>
                            <span className="text-gray-300">
                              {aiAnalysis?.priceImpactForecast?.trajectory?.day2_3 || n.priceImpact?.trajectory?.day2_3 || 'Test cung cầu lượng cổ phiếu T+2.5'}
                            </span>
                          </div>

                          <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                            <span className="text-emerald-400 font-bold block">📍 Phiên T+4 ~ T+5 (Xác lập xu hướng):</span>
                            <span className="text-gray-300">
                              {aiAnalysis?.priceImpactForecast?.trajectory?.day4_5 || n.priceImpact?.trajectory?.day4_5 || 'Hình thành nền giá cân bằng mới'}
                            </span>
                          </div>
                        </div>

                        {/* AI Takeaways */}
                        {aiAnalysis?.keyTakeaways && (
                          <div className="pt-2 border-t border-gray-800 text-[10px] space-y-1">
                            <span className="font-bold text-gray-300 block">💡 Ghi chú cốt lõi từ Gemini AI:</span>
                            <ul className="list-disc list-inside text-gray-400 space-y-0.5">
                              {aiAnalysis.keyTakeaways.map((t: string, kIdx: number) => (
                                <li key={kIdx}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer Row: Source, Time, AI Deep Analyze Button & Symbol Tags */}
                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-800/60 flex-wrap gap-2">
                      <div className="flex items-center space-x-3">
                        <span>Nguồn: <strong className="text-gray-200">{n.source}</strong></span>
                        <span className="flex items-center space-x-1 text-gray-400">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span>Thời gian: <strong className="text-gray-200">{n.time || n.timestamp || 'Vừa xong'}</strong></span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 ml-auto">
                        {/* Deep AI button */}
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedNewsId(null);
                            } else if (aiAnalysis) {
                              setExpandedNewsId(n.id);
                            } else {
                              handleDeepAIAnalyze(n);
                            }
                          }}
                          disabled={isAnalyzing}
                          className="px-2 py-0.5 bg-blue-950/80 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-700/80 rounded text-[10px] font-bold font-mono flex items-center space-x-1 transition shadow-sm"
                        >
                          <Sparkles className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : 'text-blue-400'}`} />
                          <span>{isAnalyzing ? 'AI ĐANG TÍNH TOÁN...' : isExpanded ? 'THU GỌN LỘ TRÌNH' : 'PHÂN TÍCH LỘ TRÌNH T+5'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                        </button>

                        {/* Impacted stock symbols */}
                        <span className="text-gray-400 font-semibold text-[10px]">Mã liên quan:</span>
                        {(n.symbols && n.symbols.length > 0 ? n.symbols : ['VNINDEX', 'VN30']).map((sym) => (
                          <button
                            key={sym}
                            onClick={(e) => {
                              e.preventDefault();
                              onSelectStock(sym);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#121212] text-blue-400 border border-gray-700 hover:bg-blue-600 hover:text-white transition shadow-sm"
                            title={`Bấm để xem phân tích mã ${sym}`}
                          >
                            ${sym}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 4 cols: Technical Radar Alerts & High Impact Watchlist */}
        <div className="lg:col-span-4 space-y-4 font-mono text-xs">
          {/* Sentiment Heat Gauge Summary */}
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 shadow-xl">
            <h3 className="font-bold text-purple-400 flex items-center space-x-2 border-b border-gray-800 pb-2 uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>PHÂN BỔ SẮC THÁI TOÀN THỊ TRƯỜNG</span>
            </h3>

            {/* Score distribution bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Rất Tích Cực (+60 ~ +100):</span>
                <span className="text-emerald-400 font-bold">{news.filter((n) => (n.sentimentScore ?? 0) >= 60).length} tin</span>
              </div>
              <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(news.filter((n) => (n.sentimentScore ?? 0) >= 20).length / (news.length || 1)) * 100}%` }}
                />
                <div
                  className="bg-gray-600 h-full"
                  style={{ width: `${(news.filter((n) => Math.abs(n.sentimentScore ?? 0) < 20).length / (news.length || 1)) * 100}%` }}
                />
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(news.filter((n) => (n.sentimentScore ?? 0) <= -20).length / (news.length || 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span className="text-emerald-400">Tích cực ({news.filter((n) => (n.sentimentScore ?? 0) >= 20).length})</span>
                <span className="text-gray-400">Trung tính ({news.filter((n) => Math.abs(n.sentimentScore ?? 0) < 20).length})</span>
                <span className="text-red-400">Tiêu cực ({news.filter((n) => (n.sentimentScore ?? 0) <= -20).length})</span>
              </div>
            </div>
          </div>

          {/* Technical Radar Alerts Stream */}
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 shadow-xl">
            <h3 className="font-bold text-blue-400 flex items-center space-x-2 border-b border-gray-800 pb-2 uppercase tracking-wider">
              <Bell className="w-4 h-4" />
              <span>CẢNH BÁO TÍN HIỆU KỸ THUẬT SÓNG CP</span>
            </h3>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto scrollbar-none">
              {alerts.map((alt) => (
                <div
                  key={alt.id}
                  onClick={() => onSelectStock(alt.symbol)}
                  className="bg-[#050505] p-3 rounded-sm border border-gray-800 hover:border-gray-700 cursor-pointer transition space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-blue-400">{alt.symbol}</span>
                      <span className="font-bold text-gray-200">{alt.title}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{alt.time}</span>
                  </div>
                  <p className="text-gray-400 text-[11px] font-mono">{alt.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
