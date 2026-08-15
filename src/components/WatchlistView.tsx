import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  Info,
  Newspaper,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { StockData, StockNewsSentiment, WatchlistItem } from '../types';

interface WatchlistViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

interface SentinelConfig {
  enabled: boolean;
  autoScanIntervalSeconds: number;
  monitorRsi: boolean;
  monitorMa: boolean;
  monitorMacd: boolean;
  monitorVolumeSurge: boolean;
  monitorBreakout: boolean;
  rsiOversoldThreshold: number;
  rsiOverboughtThreshold: number;
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

  // Watchlist Sentinel Automated Alert States
  const [sentinelConfig, setSentinelConfig] = useState<SentinelConfig>({
    enabled: true,
    autoScanIntervalSeconds: 60,
    monitorRsi: true,
    monitorMa: true,
    monitorMacd: true,
    monitorVolumeSurge: true,
    monitorBreakout: true,
    rsiOversoldThreshold: 30,
    rsiOverboughtThreshold: 70,
  });
  const [isSentinelModalOpen, setIsSentinelModalOpen] = useState(false);
  const [scanningSentinel, setScanningSentinel] = useState(false);
  const [sentinelScanReport, setSentinelScanReport] = useState<any | null>(null);
  const [testSendingSymbol, setTestSendingSymbol] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const tableParentRef = useRef<HTMLDivElement>(null);

  // Load Sentinel Config on Mount
  useEffect(() => {
    fetch('/api/watchlist/sentinel/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.enabled === 'boolean') {
          setSentinelConfig(data);
        }
      })
      .catch((err) => console.error('Failed to load sentinel config:', err));
  }, []);

  // Sync Watchlist with localStorage and backend server
  useEffect(() => {
    localStorage.setItem('vnquant_watchlist', JSON.stringify(watchlist));
    const symbols = watchlist.map((w) => w.symbol);

    // Sync to backend store
    if (symbols.length > 0) {
      fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      }).catch((err) => console.warn('Failed to sync watchlist to server:', err));

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
      setToastMessage({ type: 'info', text: `Mã ${sym} đã có sẵn trong danh mục theo dõi!` });
      return;
    }

    const stock = stocks.find((s) => s.symbol === sym);
    if (!stock) {
      setToastMessage({ type: 'error', text: `Không tìm thấy mã chứng khoán ${sym}` });
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
    setToastMessage({ type: 'success', text: `Đã thêm ${sym} vào Watchlist và kích hoạt Sentinel giám sát!` });
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

  // Run immediate Watchlist Sentinel scan and push Telegram alerts
  const handleScanWatchlistNow = async () => {
    if (watchlist.length === 0) {
      setToastMessage({ type: 'info', text: 'Danh mục Watchlist đang trống. Hãy thêm mã để quét tín hiệu!' });
      return;
    }

    setScanningSentinel(true);
    try {
      const res = await fetch('/api/watchlist/sentinel/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSendAll: true }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSentinelScanReport(data.report);
        setToastMessage({
          type: 'success',
          text: `⚡ Đã quét xong ${data.report.totalWatched} mã: Phát hiện ${data.report.activeSignalsFound} tín hiệu kỹ thuật, đã gửi ${data.report.telegramMessagesSent} tin Telegram!`,
        });
      } else {
        setToastMessage({ type: 'error', text: `Lỗi quét Sentinel: ${data.message}` });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: `Lỗi kết nối quét Sentinel: ${err.message}` });
    } finally {
      setScanningSentinel(false);
    }
  };

  // Dispatch a 1-click test Telegram notification for a specific stock
  const handleSendStockTelegramAlert = async (sym: string) => {
    setTestSendingSymbol(sym);
    try {
      const res = await fetch('/api/watchlist/sentinel/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setToastMessage({
          type: 'success',
          text: `🎉 Đã bắn cảnh báo kỹ thuật 4 tầng của #${sym} tới Telegram thành công!`,
        });
      } else {
        setToastMessage({ type: 'error', text: `Lỗi gửi Telegram cho ${sym}: ${data.message}` });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: `Lỗi kết nối gửi Telegram: ${err.message}` });
    } finally {
      setTestSendingSymbol(null);
    }
  };

  // Save Sentinel Config
  const handleSaveSentinelConfig = async (newCfg: Partial<SentinelConfig>) => {
    try {
      const res = await fetch('/api/watchlist/sentinel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCfg),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSentinelConfig(data.config);
        setToastMessage({ type: 'success', text: '✅ Đã lưu cấu hình Watchlist Sentinel thành công!' });
        setIsSentinelModalOpen(false);
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: `Lỗi lưu cấu hình: ${err.message}` });
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
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4 font-mono">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-16 right-4 z-50 p-3 rounded-md border shadow-2xl flex items-center space-x-3 text-xs max-w-md transition animate-fadeIn ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-red-950/95 border-red-500/80 text-red-200'
              : 'bg-blue-950/95 border-blue-500/80 text-blue-200'
          }`}
        >
          {toastMessage.type === 'success' && <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
          <span className="flex-1 leading-relaxed">{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white p-1">
            ✕
          </button>
        </div>
      )}

      {/* Sentinel Automated Watchlist Monitor Bar */}
      <div className="bg-gradient-to-r from-[#0a1128] via-[#0f172a] to-[#0a1128] p-3.5 rounded border border-blue-600/40 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded bg-blue-600/30 border border-blue-400/60 flex items-center justify-center text-blue-400 shadow-md">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                AUTOMATED WATCHLIST SENTINEL & TELEGRAM ALERT
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 ${
                  sentinelConfig.enabled
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600'
                    : 'bg-gray-900 text-gray-400 border-gray-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${sentinelConfig.enabled ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
                <span>{sentinelConfig.enabled ? 'ACTIVE 24/7 (RSI/MA/VOL)' : 'TẠM TẮT'}</span>
              </span>
            </div>
            <p className="text-[11px] text-blue-300">
              Tự động phát hiện điểm vào lệnh RSI Crossover, Golden Cross MA20/50, Đột biến Volume và bắn Telegram tức thì
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSentinelModalOpen(true)}
            className="bg-[#050811] hover:bg-slate-800 text-blue-300 hover:text-white border border-blue-800/60 px-3 py-1.5 rounded text-xs font-bold flex items-center space-x-1.5 transition"
            title="Cài đặt ngưỡng RSI, MA, MACD, Volume"
          >
            <Settings className="w-3.5 h-3.5 text-blue-400" />
            <span>Cấu Hình Sentinel</span>
          </button>

          <button
            onClick={handleScanWatchlistNow}
            disabled={scanningSentinel || watchlist.length === 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black px-3.5 py-1.5 rounded text-xs flex items-center space-x-1.5 transition shadow-lg disabled:opacity-50"
            title="Quét toàn bộ cổ phiếu theo dõi và gửi thông báo Telegram cho các tín hiệu mới"
          >
            <Send className={`w-3.5 h-3.5 ${scanningSentinel ? 'animate-spin text-blue-200' : ''}`} />
            <span>{scanningSentinel ? 'Đang Quét & Bắn...' : 'Quét & Bắn Telegram Ngay'}</span>
          </button>
        </div>
      </div>

      {/* Main Header Banner */}
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
          <table className="w-full text-xs font-mono text-left min-w-[1320px]">
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
                <th className="p-3 bg-[#050505] text-center">Bắn Telegram & Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const stk = watchlistStocks[virtualRow.index];
                const pos = stk.changePercent >= 0;
                const tech = stk.technical;
                const sent = sentiments[stk.symbol];

                // Indicator Trigger Logic for Visual Highlighting
                const isRsiOversold = tech.rsi14 <= (sentinelConfig.rsiOversoldThreshold || 30);
                const isRsiOverbought = tech.rsi14 >= (sentinelConfig.rsiOverboughtThreshold || 70);
                const isRsiCrossover = tech.rsi14 > 30 && tech.rsi14 <= 35 && stk.changePercent > 0;
                const isPriceAboveMa20 = stk.price >= tech.ma20;
                const isGoldenCross = tech.ma20 >= tech.ma50;

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

                    {/* NEWS SENTIMENT COLUMN */}
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
                            <span className="font-bold">{sent.score > 0 ? `+${sent.score}` : sent.score}</span>
                            <span className="text-[10px] opacity-80">({sent.label})</span>
                          </div>

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

                    {/* RSI COLUMN WITH SENTINEL TRIGGER HIGHLIGHTS */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center justify-center space-y-0.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-bold whitespace-nowrap ${
                            isRsiOverbought
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : isRsiOversold
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse'
                              : isRsiCrossover
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                              : 'bg-[#050505] text-blue-400'
                          }`}
                        >
                          {tech.rsi14.toFixed(1)}
                        </span>
                        {isRsiOversold && <span className="text-[9px] text-emerald-400 font-bold">Quá Bán</span>}
                        {isRsiOverbought && <span className="text-[9px] text-red-400 font-bold">Quá Mua</span>}
                        {isRsiCrossover && <span className="text-[9px] text-indigo-300 font-bold">RSI Cross</span>}
                      </div>
                    </td>

                    {/* MA20 / MA50 COLUMN WITH CROSSOVER BADGES */}
                    <td className="p-3 text-center text-gray-300 whitespace-nowrap">
                      <div className="flex flex-col items-center justify-center space-y-0.5">
                        <div>
                          <span className={isPriceAboveMa20 ? 'text-emerald-400 font-bold' : 'text-blue-400'}>
                            {tech.ma20.toFixed(1)}
                          </span>
                          {' '}/{' '}
                          <span className="text-sky-400">{tech.ma50.toFixed(1)}</span>
                        </div>
                        {isGoldenCross ? (
                          <span className="text-[9px] bg-amber-950/80 text-amber-300 px-1 rounded border border-amber-800">
                            Golden Cross
                          </span>
                        ) : isPriceAboveMa20 ? (
                          <span className="text-[9px] text-emerald-400">Trên MA20</span>
                        ) : null}
                      </div>
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

                    {/* ACTION COLUMN: TELEGRAM ALERT + CHART */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleSendStockTelegramAlert(stk.symbol)}
                          disabled={testSendingSymbol === stk.symbol}
                          className="bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-700/80 font-bold px-2 py-1 rounded-sm text-[10px] flex items-center space-x-1 transition shadow-sm disabled:opacity-50"
                          title="Bắn cảnh báo định lượng tức thì của cổ phiếu này vào Telegram"
                        >
                          <Send className={`w-3 h-3 ${testSendingSymbol === stk.symbol ? 'animate-spin text-blue-300' : ''}`} />
                          <span>{testSendingSymbol === stk.symbol ? 'Đang gửi...' : 'Telegram'}</span>
                        </button>
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

      {/* SENTINEL CONFIGURATION MODAL */}
      {isSentinelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-blue-500/50 rounded-md w-full max-w-lg shadow-2xl overflow-hidden font-mono text-xs">
            <div className="bg-[#0f172a] p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-blue-600/30 border border-blue-400 text-blue-300">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">CẤU HÌNH WATCHLIST SENTINEL TELEGRAM</h3>
                  <p className="text-[11px] text-blue-300">Tự động phát hiện chỉ báo kỹ thuật và bắn thông báo Telegram</p>
                </div>
              </div>
              <button onClick={() => setIsSentinelModalOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Master Sentinel Toggle */}
              <div className="bg-[#050811] p-3.5 rounded border border-blue-900/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">Tự động giám sát Watchlist 24/7</span>
                  <span className="text-[11px] text-gray-400">Quét liên tục chu kỳ {sentinelConfig.autoScanIntervalSeconds} giây</span>
                </div>
                <input
                  type="checkbox"
                  checked={sentinelConfig.enabled}
                  onChange={(e) => setSentinelConfig({ ...sentinelConfig, enabled: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Indicator Trigger Checkboxes */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                  Chọn Các Chỉ Báo Kỹ Thuật Cần Giám Sát & Bắn Telegram:
                </span>

                <label className="bg-[#050505] p-3 rounded border border-gray-800 flex items-center justify-between cursor-pointer hover:border-gray-700">
                  <div>
                    <span className="font-bold text-blue-400 block">✨ Chỉ báo RSI (14) Crossover & Quá Mua/Quá Bán</span>
                    <span className="text-[11px] text-gray-400">Cảnh báo khi RSI cắt lên mốc 30 (Đảo chiều tăng) hoặc quá mua &gt; 70</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sentinelConfig.monitorRsi}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, monitorRsi: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </label>

                <label className="bg-[#050505] p-3 rounded border border-gray-800 flex items-center justify-between cursor-pointer hover:border-gray-700">
                  <div>
                    <span className="font-bold text-emerald-400 block">🌟 Đường Trung Bình Động MA20/MA50 (Golden Cross)</span>
                    <span className="text-[11px] text-gray-400">Cảnh báo giá bứt phá vượt MA20 và giao cắt vàng Golden Cross</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sentinelConfig.monitorMa}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, monitorMa: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </label>

                <label className="bg-[#050505] p-3 rounded border border-gray-800 flex items-center justify-between cursor-pointer hover:border-gray-700">
                  <div>
                    <span className="font-bold text-purple-400 block">💹 Động Lượng MACD Bullish Crossover</span>
                    <span className="text-[11px] text-gray-400">Cảnh báo khi MACD Histogram đảo chiều dương</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sentinelConfig.monitorMacd}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, monitorMacd: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </label>

                <label className="bg-[#050505] p-3 rounded border border-gray-800 flex items-center justify-between cursor-pointer hover:border-gray-700">
                  <div>
                    <span className="font-bold text-amber-400 block">🔥 Đột Biến Thanh Khoản & Cá Mập Gom Hàng</span>
                    <span className="text-[11px] text-gray-400">Cảnh báo khối lượng giao dịch tăng &gt; 180-200% TB 20 phiên</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sentinelConfig.monitorVolumeSurge}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, monitorVolumeSurge: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </label>

                <label className="bg-[#050505] p-3 rounded border border-gray-800 flex items-center justify-between cursor-pointer hover:border-gray-700">
                  <div>
                    <span className="font-bold text-cyan-400 block">⚡ Bứt Phá Kháng Cự (Breakout) / Thủng Hỗ Trợ</span>
                    <span className="text-[11px] text-gray-400">Cảnh báo vượt đỉnh then chốt hoặc vi phạm mốc hỗ trợ</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sentinelConfig.monitorBreakout}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, monitorBreakout: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </label>
              </div>

              {/* Threshold Numbers */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Ngưỡng RSI Quá Bán (Oversold):</label>
                  <input
                    type="number"
                    value={sentinelConfig.rsiOversoldThreshold}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, rsiOversoldThreshold: Number(e.target.value) || 30 })}
                    className="bg-[#050505] border border-gray-800 rounded p-2 text-white w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Ngưỡng RSI Quá Mua (Overbought):</label>
                  <input
                    type="number"
                    value={sentinelConfig.rsiOverboughtThreshold}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, rsiOverboughtThreshold: Number(e.target.value) || 70 })}
                    className="bg-[#050505] border border-gray-800 rounded p-2 text-white font-bold w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#050505] p-3 border-t border-gray-800 flex justify-end space-x-2">
              <button
                onClick={() => setIsSentinelModalOpen(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-1.5 rounded-sm text-xs transition"
              >
                HỦY
              </button>
              <button
                onClick={() => handleSaveSentinelConfig(sentinelConfig)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-1.5 rounded-sm text-xs transition flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>LƯU CẤU HÌNH</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SENTINEL SCAN REPORT MODAL */}
      {sentinelScanReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-blue-500/50 rounded-md w-full max-w-xl shadow-2xl overflow-hidden font-mono text-xs">
            <div className="bg-[#0f172a] p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-emerald-600/30 border border-emerald-400 text-emerald-300">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">KẾT QUẢ QUÉT TÍN HIỆU WATCHLIST SENTINEL</h3>
                  <p className="text-[11px] text-emerald-300">
                    Phát hiện {sentinelScanReport.activeSignalsFound} tín hiệu | Đã gửi {sentinelScanReport.telegramMessagesSent} tin Telegram
                  </p>
                </div>
              </div>
              <button onClick={() => setSentinelScanReport(null)} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {sentinelScanReport.results.filter((r: any) => r.signals && r.signals.length > 0).length === 0 ? (
                <div className="p-6 text-center text-gray-400 space-y-2">
                  <Info className="w-8 h-8 text-blue-400 mx-auto" />
                  <p>Không có tín hiệu kỹ thuật đột biến mới tại thời điểm này.</p>
                  <p className="text-[11px] text-gray-500">Hệ thống daemon sẽ tiếp tục giám sát tự động 24/7 và bắn Telegram ngay khi có tín hiệu.</p>
                </div>
              ) : (
                sentinelScanReport.results
                  .filter((r: any) => r.signals && r.signals.length > 0)
                  .map((item: any) => (
                    <div key={item.symbol} className="bg-[#050505] p-3 rounded border border-gray-800 space-y-2">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-white text-sm">#{item.symbol}</span>
                          <span className="text-emerald-400 font-bold">{item.price}k</span>
                          <span className={item.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            ({item.changePercent >= 0 ? '+' : ''}{item.changePercent}%)
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            item.telegramSent
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'bg-blue-950 text-blue-300 border border-blue-700'
                          }`}
                        >
                          {item.telegramSent ? '✅ Đã Bắn Telegram' : 'Đã Ghi Nhận'}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {item.signals.map((sig: any, idx: number) => (
                          <div key={idx} className="bg-[#0a0f1d] p-2 rounded border border-blue-900/40 text-[11px]">
                            <div className="text-blue-300 font-bold">{sig.indicatorName}</div>
                            <div className="text-gray-300 text-[10px] mt-0.5">{sig.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="bg-[#050505] p-3 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSentinelScanReport(null)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-1.5 rounded-sm text-xs transition"
              >
                ĐÓNG
              </button>
            </div>
          </div>
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
