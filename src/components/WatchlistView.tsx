import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, ExternalLink, Eye, Info, Newspaper, Plus, Radar, RefreshCw, Search, Sparkles, Trash2, TrendingUp, X, Zap } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { StockData, StockNewsSentiment, WatchlistItem } from '../types';

interface WatchlistViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ stocks, onSelectStock }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    const saved = localStorage.getItem('vnquant_watchlist');
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved watchlist:', e);
      }
    }
    return [];
  });

  const [newSymbol, setNewSymbol] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [sentiments, setSentiments] = useState<Record<string, StockNewsSentiment>>({});
  const [loadingSentiments, setLoadingSentiments] = useState<boolean>(false);
  const [selectedSentiment, setSelectedSentiment] = useState<StockNewsSentiment | null>(null);

  const tableParentRef = useRef<HTMLDivElement>(null);

  // Persist watchlist changes to localStorage
  useEffect(() => {
    localStorage.setItem('vnquant_watchlist', JSON.stringify(watchlist));
    const symbols = watchlist.map((w) => w.symbol);
    if (symbols.length > 0) {
      fetchSentiments(symbols);
    }
  }, [watchlist]);

  // Fetch sentiment scores for watchlist symbols
  const fetchSentiments = async (symbolsToFetch: string[]) => {
    if (symbolsToFetch.length === 0) return;
    setLoadingSentiments(true);
    try {
      const res = await fetch('/api/ai/news-sentiment/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: symbolsToFetch }),
      });
      if (res.ok) {
        const data = await res.json();
        setSentiments((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch news sentiments:', err);
    } finally {
      setLoadingSentiments(false);
    }
  };

  const handleAddStock = () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;

    if (watchlist.some((item) => item.symbol === sym)) {
      alert(`Mã ${sym} đã có trong danh mục theo dõi!`);
      return;
    }

    const stock = stocks.find((s) => s.symbol === sym);
    if (!stock) {
      alert(`Không tìm thấy mã chứng khoán ${sym}`);
      return;
    }

    setWatchlist((prev) => [
      ...prev,
      {
        symbol: sym,
        addedAt: new Date().toISOString().split('T')[0],
        targetPrice: stock.aiTargetPrice,
        stopLoss: stock.aiStopLoss,
        note: stock.aiReasoning.slice(0, 45) + '...',
      },
    ]);
    setNewSymbol('');
  };

  const handleRemoveStock = (sym: string) => {
    setWatchlist((prev) => prev.filter((item) => item.symbol !== sym));
  };

  const handleClearAllWatchlist = () => {
    if (confirm('XÁC NHẬN DỌN SẠCH WATCHLIST?\n\nTất cả mã trong danh mục theo dõi sẽ được xóa hoàn toàn.')) {
      setWatchlist([]);
      setSentiments({});
    }
  };

  const watchlistStocks = watchlist
    .map((item) => {
      const stock = stocks.find((s) => s.symbol === item.symbol);
      return stock ? { ...stock, watchItem: item } : null;
    })
    .filter((s): s is (StockData & { watchItem: WatchlistItem }) => s !== null)
    .filter((s) => s.symbol.toLowerCase().includes(filterQuery.toLowerCase()) || s.name.toLowerCase().includes(filterQuery.toLowerCase()));

  const rowVirtualizer = useVirtualizer({
    count: watchlistStocks.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: () => 58,
    overscan: 5,
  });

  const handleRefreshAllSentiments = () => {
    const symbols = watchlist.map((w) => w.symbol);
    fetchSentiments(symbols);
  };

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-mono font-black text-white">DANH MỤC CỔ PHIẾU THEO DÕI (WATCHLIST)</h2>
              <span className="bg-purple-950/80 text-purple-400 border border-purple-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-purple-300 animate-pulse" />
                <span>GEMINI AI SENTIMENT</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">Theo dõi giá real-time, chỉ báo kỹ thuật RSI/MACD & Phân tích sắc thái tin tức từ Gemini AI</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {watchlist.length > 0 && (
            <button
              onClick={handleClearAllWatchlist}
              className="bg-[#0f172a] hover:bg-red-950 text-red-400 hover:text-red-300 border border-red-900/60 font-mono text-xs px-3 py-1.5 rounded-sm flex items-center space-x-1.5 transition"
              title="Dọn dẹp toàn bộ mã khỏi danh mục theo dõi"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Dọn Sạch Watchlist</span>
            </button>
          )}

          <button
            onClick={handleRefreshAllSentiments}
            disabled={loadingSentiments || watchlist.length === 0}
            className="bg-[#0f172a] hover:bg-slate-800 text-blue-400 border border-blue-800/60 font-mono text-xs px-3 py-1.5 rounded-sm flex items-center space-x-1.5 transition disabled:opacity-50"
            title="Quét tin tức & Phân tích lại chỉ số Sắc Thái Gemini AI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSentiments ? 'animate-spin text-blue-300' : ''}`} />
            <span>{loadingSentiments ? 'Đang quét Gemini...' : 'Quét Sentiment AI'}</span>
          </button>

          {/* Add Stock Bar */}
          <div className="flex items-center space-x-2 bg-[#050505] p-1.5 rounded-sm border border-gray-800">
            <input
              type="text"
              placeholder="Nhập mã CP (e.g. VNM, SSI)..."
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStock()}
              className="bg-transparent text-gray-100 text-xs font-mono outline-none px-2 w-44 placeholder-gray-500 uppercase"
            />
            <button
              onClick={handleAddStock}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-sm text-xs font-mono flex items-center space-x-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>THÊM MÃ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter input */}
      <div className="flex items-center space-x-2 bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800 text-xs font-mono max-w-md">
        <Search className="w-4 h-4 text-blue-400" />
        <input
          type="text"
          placeholder="Lọc trong danh mục theo dõi..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="bg-transparent text-gray-200 outline-none w-full placeholder-gray-500 font-mono"
        />
      </div>

      {/* Watchlist Table / Empty State */}
      {watchlistStocks.length === 0 ? (
        <div className="bg-[#0a0a0a] rounded-sm border border-gray-800 p-12 text-center font-mono space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-blue-950/60 border border-blue-800/80 flex items-center justify-center mx-auto text-blue-400">
            <Eye className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white uppercase">Danh Mục Theo Dõi Đang Trống</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            Hệ thống đã dọn dẹp dữ liệu mẫu. Bạn có thể nhập mã chứng khoán bất kỳ (ví dụ: VNM, HPG, FPT...) ở thanh công cụ phía trên hoặc chọn nhanh từ danh sách gợi ý bên dưới để bắt đầu sử dụng thực tế.
          </p>
          <div className="pt-3 flex items-center justify-center space-x-2 flex-wrap gap-y-2">
            <span className="text-xs text-gray-500">Gợi ý thêm nhanh:</span>
            {['HPG', 'FPT', 'VNM', 'SSI', 'MBB', 'TCB', 'MWG'].map((quickSym) => (
              <button
                key={quickSym}
                onClick={() => {
                  const stock = stocks.find((s) => s.symbol === quickSym);
                  if (stock) {
                    setWatchlist([
                      {
                        symbol: quickSym,
                        addedAt: new Date().toISOString().split('T')[0],
                        targetPrice: stock.aiTargetPrice,
                        stopLoss: stock.aiStopLoss,
                        note: 'Thêm từ thanh gợi ý nhanh',
                      },
                    ]);
                  }
                }}
                className="bg-[#050505] hover:bg-blue-950 hover:text-blue-300 text-gray-300 border border-gray-800 hover:border-blue-700 px-3 py-1 rounded-sm text-xs font-mono font-bold transition flex items-center space-x-1"
              >
                <Plus className="w-3 h-3 text-blue-400" />
                <span>{quickSym}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={tableParentRef} className="bg-[#0a0a0a] rounded-sm border border-gray-800 overflow-x-auto shadow-xl max-h-[650px] overflow-y-auto">
          <table className="w-full text-xs font-mono text-left min-w-[1240px]">
          <thead className="bg-[#050505] text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-md whitespace-nowrap">
            <tr>
              <th className="p-3 bg-[#050505]">Mã CP</th>
              <th className="p-3 bg-[#050505]">Sàn / Ngành</th>
              <th className="p-3 bg-[#050505] text-center">
                <div className="flex items-center justify-center space-x-1 text-purple-400">
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>Sắc Thái Tin Tức (Gemini AI)</span>
                </div>
              </th>
              <th className="p-3 bg-[#050505] text-center">
                <div className="flex items-center justify-center space-x-1 text-cyan-400">
                  <Radar className="w-3.5 h-3.5" />
                  <span>Dòng Tiền Cá Mập & Bẫy</span>
                </div>
              </th>
              <th className="p-3 bg-[#050505] text-right">Giá Hiện Tại</th>
              <th className="p-3 bg-[#050505] text-right">Biến Động %</th>
              <th className="p-3 bg-[#050505] text-right">Khối Lượng</th>
              <th className="p-3 bg-[#050505] text-center">RSI (14)</th>
              <th className="p-3 bg-[#050505] text-center">MA20 / MA50</th>
              <th className="p-3 bg-[#050505] text-center">Hỗ Trợ / Kháng Cự</th>
              <th className="p-3 bg-[#050505] text-center">Đánh Giá AI</th>
              <th className="p-3 bg-[#050505] text-right">Mục Tiêu / Cắt Lỗ</th>
              <th className="p-3 bg-[#050505] text-center">Hành Động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const stk = watchlistStocks[virtualRow.index];
              const pos = stk.changePercent >= 0;
              const tech = stk.technical;
              const sent = sentiments[stk.symbol];

              // Color mapping for sentiment
              const sentScore = sent?.score ?? 0;
              const isPosSent = sentScore >= 15;
              const isNegSent = sentScore <= -15;

              return (
                <tr key={stk.symbol} className="hover:bg-gray-900/50 transition whitespace-nowrap">
                  <td className="p-3 font-bold text-white">
                    <div className="flex items-center space-x-1.5">
                      <button onClick={() => onSelectStock(stk.symbol)} className="hover:text-blue-400 font-black text-sm transition">
                        <span>{stk.symbol}</span>
                      </button>
                      {sent && (
                        <span
                          className={`w-2 h-2 rounded-full inline-block ${
                            isPosSent ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : isNegSent ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]' : 'bg-amber-400'
                          }`}
                          title={`Gemini News Sentiment: ${sent.score > 0 ? '+' : ''}${sent.score} (${sent.label})`}
                        />
                      )}
                    </div>
                    <span className="block text-[10px] text-gray-400 font-normal truncate max-w-[120px]">{stk.name}</span>
                  </td>
                  <td className="p-3">
                    <span className="bg-[#050505] text-gray-300 px-1.5 py-0.5 rounded-sm text-[10px] border border-gray-800 mr-1 inline-block whitespace-nowrap">{stk.exchange}</span>
                    <span className="text-gray-400 text-[11px] inline-block whitespace-nowrap">{stk.sector}</span>
                  </td>

                  {/* NEWS SENTIMENT COLUMN WITH GEMINI SCORE INDICATOR */}
                  <td className="p-3 text-center">
                    {sent ? (
                      <button
                        onClick={() => setSelectedSentiment(sent)}
                        className={`group px-2.5 py-1 rounded-sm border text-[11px] font-mono flex items-center justify-between space-x-2 cursor-pointer transition shadow-sm ${
                          isPosSent
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-900/50'
                            : isNegSent
                            ? 'bg-red-950/40 border-red-500/40 text-red-300 hover:border-red-400 hover:bg-red-900/50'
                            : 'bg-amber-950/30 border-amber-600/40 text-amber-300 hover:border-amber-400 hover:bg-amber-900/40'
                        }`}
                        title="Bấm để xem chi tiết tiêu đề tin tức & phân tích Gemini"
                      >
                        <div className="flex items-center space-x-1.5">
                          <Sparkles className="w-3 h-3 shrink-0 text-purple-300 group-hover:scale-110 transition-transform" />
                          <span className="font-bold">
                            {sent.score > 0 ? `+${sent.score}` : sent.score}
                          </span>
                          <span className="text-[10px] opacity-80">({sent.label})</span>
                        </div>

                        {/* Mini visual gauge / meter */}
                        <div className="w-12 h-1.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800 shrink-0 ml-1">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isPosSent ? 'bg-emerald-400' : isNegSent ? 'bg-red-400' : 'bg-amber-400'
                            }`}
                            style={{
                              width: `${Math.max(10, Math.min(100, (sent.score + 100) / 2))}%`,
                            }}
                          />
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center space-x-1 text-gray-500 text-[10px]">
                        <RefreshCw className="w-3 h-3 animate-spin text-purple-400/60" />
                        <span>Đang tính...</span>
                      </div>
                    )}
                  </td>

                  {/* SMART MONEY ANOMALY BADGE COLUMN */}
                  <td className="p-3 text-center">
                    {stk.smartMoney && stk.smartMoney.patternType !== 'NEUTRAL' ? (
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[10px] font-bold border whitespace-nowrap ${
                          stk.smartMoney.patternType === 'BULL_TRAP'
                            ? 'bg-red-950/80 text-red-300 border-red-700 animate-pulse'
                            : stk.smartMoney.patternType === 'ACCUMULATION_CLANDESTINE'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                            : stk.smartMoney.patternType === 'MORNING_VOLUME_BURST'
                            ? 'bg-purple-950/80 text-purple-300 border-purple-700'
                            : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        }`}
                        title={stk.smartMoney.description}
                      >
                        {stk.smartMoney.patternType === 'BULL_TRAP' && <AlertTriangle className="w-3 h-3 text-red-400" />}
                        {stk.smartMoney.patternType === 'ACCUMULATION_CLANDESTINE' && <Eye className="w-3 h-3 text-cyan-400" />}
                        {stk.smartMoney.patternType === 'MORNING_VOLUME_BURST' && <Zap className="w-3 h-3 text-purple-400" />}
                        {stk.smartMoney.patternType === 'BEAR_TRAP' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                        <span>{stk.smartMoney.patternName}</span>
                      </span>
                    ) : (
                      <span className="text-gray-600 text-[10px]">Trung tính</span>
                    )}
                  </td>

                  <td className={`p-3 text-right font-bold text-sm ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stk.price.toFixed(2)}
                  </td>
                  <td className={`p-3 text-right font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className="flex items-center justify-end space-x-0.5">
                      {pos ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      <span>
                        {pos ? '+' : ''}
                        {stk.changePercent}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-gray-300">{(stk.volume ?? 0).toLocaleString('vi-VN')}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-sm font-bold whitespace-nowrap ${tech.rsi14 > 70 ? 'bg-red-950 text-red-400' : tech.rsi14 < 30 ? 'bg-emerald-950 text-emerald-400' : 'bg-[#050505] text-blue-400'}`}>
                      {tech.rsi14}
                    </span>
                  </td>
                  <td className="p-3 text-center text-gray-300 whitespace-nowrap">
                    <span className="text-blue-400">{tech.ma20}</span> / <span className="text-sky-400">{tech.ma50}</span>
                  </td>
                  <td className="p-3 text-center text-gray-300 whitespace-nowrap">
                    <span className="text-emerald-400">{tech.supportLevel}</span> - <span className="text-red-400">{tech.resistanceLevel}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-block bg-blue-950/60 text-blue-400 border border-blue-800 px-2.5 py-1 rounded-sm text-[10px] font-bold whitespace-nowrap shadow-sm">
                      {stk.aiVerdict} ({stk.aiScore})
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span className="text-emerald-400 block">{stk.aiTargetPrice}</span>
                    <span className="text-red-400 text-[10px] block">{stk.aiStopLoss}</span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onSelectStock(stk.symbol)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-1 rounded-sm text-[10px]"
                      >
                        CHART
                      </button>
                      <button
                        onClick={() => handleRemoveStock(stk.symbol)}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Xóa mã"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* GEMINI NEWS SENTIMENT ANALYSIS MODAL */}
      {selectedSentiment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-sm w-full max-w-xl shadow-2xl overflow-hidden font-mono text-xs">
            {/* Modal Header */}
            <div className="bg-[#050505] p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-purple-950/80 border border-purple-800 text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black text-white">PHÂN TÍCH SENTIMENT GEMINI - {selectedSentiment.symbol}</h3>
                    <span className="text-[10px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800">
                      Độ tin cậy {selectedSentiment.confidence}%
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">Phân tích từ {selectedSentiment.headlineCount} tiêu đề tin tức mới nhất</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSentiment(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Score Display Card */}
              <div className="bg-[#050505] p-4 rounded border border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-gray-400 text-[10px] block uppercase tracking-wider">Chỉ Số Sắc Thái Tin Tức (Score)</span>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span
                      className={`text-2xl font-black ${
                        selectedSentiment.score >= 15
                          ? 'text-emerald-400'
                          : selectedSentiment.score <= -15
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {selectedSentiment.score > 0 ? `+${selectedSentiment.score}` : selectedSentiment.score} / 100
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        selectedSentiment.score >= 15
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : selectedSentiment.score <= -15
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {selectedSentiment.label}
                    </span>
                  </div>
                </div>

                {/* Meter gauge */}
                <div className="w-36 space-y-1">
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>-100 (Tiêu cực)</span>
                    <span>+100 (Tích cực)</span>
                  </div>
                  <div className="h-2 bg-gray-900 rounded-full border border-gray-800 relative overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selectedSentiment.score >= 15
                          ? 'bg-emerald-400'
                          : selectedSentiment.score <= -15
                          ? 'bg-red-400'
                          : 'bg-amber-400'
                      }`}
                      style={{
                        width: `${Math.max(5, Math.min(100, (selectedSentiment.score + 100) / 2))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Tóm Tắt Tổng Quan từ Gemini AI</span>
                </h4>
                <p className="bg-[#050505] p-3 rounded border border-gray-800 text-gray-200 leading-relaxed text-xs">
                  {selectedSentiment.summary}
                </p>
              </div>

              {/* Key Highlights */}
              {selectedSentiment.keyHighlights && selectedSentiment.keyHighlights.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Ý Chính Nổi Bật</h4>
                  <ul className="space-y-1.5">
                    {selectedSentiment.keyHighlights.map((hl, idx) => (
                      <li key={idx} className="bg-[#050505] p-2.5 rounded border border-gray-800 text-gray-300 flex items-start space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recent Headlines Analyzed */}
              {selectedSentiment.recentHeadlines && selectedSentiment.recentHeadlines.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center space-x-1">
                    <Newspaper className="w-3.5 h-3.5 text-purple-400" />
                    <span>Các Tiêu Đề Tin Tức Được Phân Tích</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedSentiment.recentHeadlines.map((news, idx) => (
                      <div key={idx} className="bg-[#050505] p-2.5 rounded border border-gray-800 flex items-center justify-between gap-3 hover:border-gray-700 transition">
                        <div className="space-y-1 min-w-0">
                          <p className="text-gray-200 font-semibold truncate">{news.title}</p>
                          <div className="flex items-center space-x-2 text-[10px] text-gray-400">
                            <span className="text-blue-400 font-bold">{news.source}</span>
                            <span>•</span>
                            <span>{news.time}</span>
                          </div>
                        </div>
                        <a
                          href={news.url}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-blue-950 hover:bg-blue-900 text-blue-400 p-1.5 rounded border border-blue-800 transition shrink-0"
                          title="Đọc bài gốc"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#050505] p-3 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedSentiment(null)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-1.5 rounded-sm text-xs transition"
              >
                ĐÓNG CỬA SỔ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
