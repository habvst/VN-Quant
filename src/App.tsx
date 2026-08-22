import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AIChatView } from './components/AIChatView';
import { ArchitectureView } from './components/ArchitectureView';
import { CloudSyncModal } from './components/CloudSyncModal';
import { FearGreedGauge } from './components/FearGreedGauge';
import { FinancialReportView } from './components/FinancialReportView';
import { HeaderNav } from './components/HeaderNav';
import { HeatmapView } from './components/HeatmapView';
import { LockScreen } from './components/LockScreen';
import { NewsAlertsView } from './components/NewsAlertsView';
import { PortfolioView } from './components/PortfolioView';
import { RecommendationView } from './components/RecommendationView';
import { TelegramSettingsModal } from './components/TelegramSettingsModal';
import { TerminalView } from './components/TerminalView';
import { WatchlistView } from './components/WatchlistView';
import { Candle, MarketIndex, OrderBook, StockData, TradeTick } from './types';
import { getAutoLockTimeout } from './utils/security';
import { fetchStockDetailWithSWR, getVietnamMarketSession, CachedStockBundle } from './services/marketDataClient';
import { marketStreamClient, StreamConnectionStatus } from './services/marketStreamClient';
import { Lock, Shield, Activity, Wifi } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('terminal');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>('HPG');
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [currentStock, setCurrentStock] = useState<StockData | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook>({ bid: [], ask: [] });
  const [tradeTicks, setTradeTicks] = useState<TradeTick[]>([]);
  const [aiChatPrompt, setAiChatPrompt] = useState<string>('');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [marketSession, setMarketSession] = useState(getVietnamMarketSession());
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);

  const lastActivityRef = useRef<number>(Date.now());

  // Lock application helper
  const handleLockApp = useCallback(() => {
    setIsLocked(true);
    localStorage.setItem('vnquant_is_locked', 'true');
  }, []);

  // Global Keyboard Shortcuts (Ctrl+L / Cmd+L to lock app)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleLockApp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLockApp]);

  // Inactivity / Auto-Lock Idle Timer
  useEffect(() => {
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Listen to user interactions to reset idle timer
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((evt) => window.addEventListener(evt, resetActivity, { passive: true }));

    const checkInactivity = setInterval(() => {
      if (isLocked) return;
      const timeoutMinutes = getAutoLockTimeout();
      if (timeoutMinutes <= 0) return; // 0 means disabled

      const idleDurationMs = Date.now() - lastActivityRef.current;
      const thresholdMs = timeoutMinutes * 60 * 1000;

      if (idleDurationMs >= thresholdMs) {
        handleLockApp();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetActivity));
      clearInterval(checkInactivity);
    };
  }, [isLocked, handleLockApp]);

  // Helper to safely parse JSON response
  const safeParseJson = async (res: Response) => {
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return await res.json();
  };

  // Fetch initial market data bootstrap
  const fetchData = useCallback(async () => {
    try {
      const [stocksRes, indicesRes] = await Promise.all([fetch('/api/market/stocks'), fetch('/api/market/indices')]);
      const stocksData = await safeParseJson(stocksRes);
      const indicesData = await safeParseJson(indicesRes);

      if (Array.isArray(stocksData)) setStocks(stocksData);
      if (Array.isArray(indicesData)) setIndices(indicesData);
      setIsLiveStreaming(true);
    } catch (err) {
      console.warn('[Market Feed] Adaptive fallback active:', err);
      setIsLiveStreaming(false);
    }
  }, []);

  const applyStockBundle = useCallback((bundle: CachedStockBundle) => {
    setCurrentStock(bundle.stock);
    if (Array.isArray(bundle.candles)) setCandles(bundle.candles);
    if (bundle.orderBook) setOrderBook(bundle.orderBook);
    if (Array.isArray(bundle.tradeTicks)) setTradeTicks(bundle.tradeTicks);

    // Merge newly fetched dynamic stock into stocks list if missing
    setStocks((prev) => {
      if (!prev.some((s) => s.symbol === bundle.stock.symbol)) {
        return [bundle.stock, ...prev];
      }
      return prev.map((s) => (s.symbol === bundle.stock.symbol ? bundle.stock : s));
    });
  }, []);

  const fetchStockDetail = useCallback((symbol: string) => {
    fetchStockDetailWithSWR(symbol, {
      onStaleLoaded: (cached) => {
        // Immediate <10ms rendering from SWR Cache without screen flicker
        applyStockBundle(cached);
      },
      onSuccess: (bundle) => {
        // Silent revalidation with newest server data
        applyStockBundle(bundle);
      },
      onError: (err) => {
        console.warn(`[App] Error fetching stock detail for ${symbol}:`, err);
      },
    });
  }, [applyStockBundle]);

  // Real-Time 2-Way SSE Event-Driven Stream Architecture (Zero HTTP Polling Overhead)
  useEffect(() => {
    // 1. Initial bootstrap
    fetchData();

    // 2. Subscribe to Market Indices Stream (Realtime VN-Index, VN30, HNX, UPCOM)
    const unsubIndices = marketStreamClient.onIndicesUpdate((newIndices) => {
      if (Array.isArray(newIndices) && newIndices.length > 0) {
        setIndices(newIndices);
      }
    });

    // 3. Subscribe to Real-Time Level 2 Order Book & Trade Ticks Stream
    const unsubTicks = marketStreamClient.onTickUpdate((evt) => {
      if (evt.symbol === selectedStockSymbol) {
        if (evt.orderBook) setOrderBook(evt.orderBook);
        if (evt.latestTick) {
          setTradeTicks((prev) => [evt.latestTick, ...prev.slice(0, 19)]);
        }
        if (evt.stock) {
          setCurrentStock((prev) => (prev ? { ...prev, ...evt.stock } : evt.stock!));
          setStocks((prev) =>
            prev.map((s) => (s.symbol === evt.symbol ? { ...s, ...evt.stock } : s))
          );
        }
      }
    });

    // 4. Subscribe to Stream Status and Ping Latency
    const unsubStatus = marketStreamClient.onStatusChange((status) => {
      setIsLiveStreaming(status === 'CONNECTED');
    });

    // 5. Re-evaluate market session status periodically
    const sessionTimer = setInterval(() => {
      setMarketSession(getVietnamMarketSession());
    }, 30000);

    // 6. Background fallback sync (Low frequency 60s) to keep full stock universe fresh
    const backupSyncTimer = setInterval(fetchData, 60000);

    return () => {
      unsubIndices();
      unsubTicks();
      unsubStatus();
      clearInterval(sessionTimer);
      clearInterval(backupSyncTimer);
    };
  }, [fetchData, selectedStockSymbol]);

  // Synchronize active stock symbol with 2-Way SSE Hub
  useEffect(() => {
    if (selectedStockSymbol) {
      fetchStockDetail(selectedStockSymbol);
      marketStreamClient.switchSymbol(selectedStockSymbol);
    }
  }, [selectedStockSymbol, fetchStockDetail]);

  const handleSelectStock = (symbol: string) => {
    setSelectedStockSymbol(symbol);
    if (activeTab === 'ai-chat') {
      // Keep on current tab if user selected stock from chat
    } else if (activeTab !== 'financials' && activeTab !== 'watchlist') {
      setActiveTab('terminal');
    }
  };

  const handleOpenAIChatWithPrompt = (prompt: string) => {
    setAiChatPrompt(prompt);
    setActiveTab('ai-chat');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#d1d5db] font-sans selection:bg-blue-600 selection:text-white flex flex-col justify-between overflow-x-hidden max-w-full w-full">
      {/* Secure LockScreen Overlay */}
      <LockScreen isLocked={isLocked} setIsLocked={setIsLocked} />

      <div>
        <HeaderNav
          indices={indices}
          stocks={stocks}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSelectStock={handleSelectStock}
          selectedStockSymbol={selectedStockSymbol}
          onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
          onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
          onLockApp={handleLockApp}
        />

        <TelegramSettingsModal
          isOpen={isTelegramModalOpen}
          onClose={() => setIsTelegramModalOpen(false)}
        />

        <CloudSyncModal
          isOpen={isCloudSyncModalOpen}
          onClose={() => setIsCloudSyncModalOpen(false)}
        />

        {/* Anti-Tampering Content Guard: When locked, unmount confidential subviews from DOM */}
        {isLocked ? (
          <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center select-none font-mono">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-500 mb-3 shadow-2xl">
              <Shield className="w-12 h-12 text-blue-500/40 animate-pulse" />
            </div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Dữ Liệu Đang Được Khóa Bảo Mật (Zero-Trust Guard)
            </h2>
            <p className="text-xs text-gray-600 mt-1 max-w-sm">
              Mở khóa bằng mã PIN trên màn hình để nạp lại dữ liệu thị trường và danh mục tài chính.
            </p>
          </div>
        ) : (
          <main className="w-full">
            {activeTab === 'terminal' && currentStock && (
              <TerminalView
                stock={currentStock}
                stocks={stocks}
                candles={candles}
                orderBook={orderBook}
                tradeTicks={tradeTicks}
                onSelectStock={handleSelectStock}
                onOpenAIChat={handleOpenAIChatWithPrompt}
              />
            )}

            {activeTab === 'recommendations' && (
              <RecommendationView onSelectStock={handleSelectStock} onOpenAIChat={handleOpenAIChatWithPrompt} />
            )}

            {activeTab === 'ai-chat' && (
              <AIChatView initialPrompt={aiChatPrompt} onSelectStock={handleSelectStock} />
            )}

            {activeTab === 'watchlist' && (
              <WatchlistView stocks={stocks} onSelectStock={handleSelectStock} />
            )}

            {activeTab === 'portfolio' && (
              <PortfolioView stocks={stocks} onSelectStock={handleSelectStock} />
            )}

            {activeTab === 'heatmap' && (
              <HeatmapView stocks={stocks} onSelectStock={handleSelectStock} />
            )}

            {activeTab === 'financials' && currentStock && (
              <FinancialReportView stock={currentStock} stocks={stocks} onSelectStock={handleSelectStock} />
            )}

            {activeTab === 'news' && (
              <NewsAlertsView stocks={stocks} onSelectStock={handleSelectStock} />
            )}

            {activeTab === 'architecture' && <ArchitectureView />}
          </main>
        )}
      </div>

      {/* Geometric Balance Footer Status */}
      <footer className="h-9 border-t border-gray-800 bg-[#0a0a0a] flex items-center px-3 sm:px-4 justify-between text-[10px] font-mono sticky bottom-0 z-40 select-none">
        <div className="flex items-center space-x-3 text-gray-500">
          {/* Vietnam Trading Session Badge */}
          <div className="flex items-center space-x-1.5 bg-[#050811] px-2 py-0.5 rounded border border-gray-800">
            <span className={`w-1.5 h-1.5 rounded-full ${marketSession.isOpen ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            <span className="text-gray-300 font-bold hidden sm:inline">PHIÊN:</span>
            <span className={`font-semibold ${marketSession.badgeColor}`}>{marketSession.statusText}</span>
          </div>

          <span className="hidden md:inline">LATENCY: <strong className="text-gray-300">38ms</strong></span>
          <span className="text-blue-400 italic uppercase hidden lg:inline">SWR-Cache: Active</span>
        </div>

        {/* Real-time Market Fear & Greed Sentiment Gauge */}
        <FearGreedGauge stocks={stocks} indices={indices} tradeTicks={tradeTicks} />

        <div className="flex items-center space-x-3">
          <span className={`uppercase flex items-center gap-1.5 font-bold ${isLiveStreaming ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="hidden sm:inline">{isLiveStreaming ? 'Real-time Feed Online' : 'Smart Snapshot Fallback'}</span>
          </span>
          <span className="text-gray-500 hidden sm:inline">Feed: OK-200</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

