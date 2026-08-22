import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Bell, BookmarkCheck, BookmarkPlus, Bot, Check, CheckCircle, ChevronLeft, ChevronRight, Eye, Flame, Layers, Plus, Radar, RefreshCw, ShieldCheck, Sparkles, TrendingUp, Wifi, X, Zap } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Candle, OrderBook, StockData, TradeTick } from '../types';
import { StockAlert, MockNotification } from '../types/alert';
import { getStoredAlerts, saveAlertsToStorage, getStoredNotifications, saveNotificationsToStorage, playAlertSound } from '../services/alertService';
import { useWatchlist } from '../services/watchlistService';
import { marketStreamClient } from '../services/marketStreamClient';
import { StockChart } from './StockChart';
import { SetAlertModal } from './SetAlertModal';
import { AlertsDrawer } from './AlertsDrawer';
import { AlertToast } from './AlertToast';
import { getMarketSessionInfo, getVietnamTimeString } from '../utils/timeUtils';

interface TerminalViewProps {
  stock: StockData;
  stocks: StockData[];
  candles: Candle[];
  orderBook: OrderBook;
  tradeTicks: TradeTick[];
  onSelectStock: (symbol: string) => void;
  onOpenAIChat: (prompt: string) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  stock,
  stocks,
  candles,
  orderBook,
  tradeTicks,
  onSelectStock,
  onOpenAIChat,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TECHNICAL' | 'FUNDAMENTAL' | 'PATTERNS'>('OVERVIEW');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // SSE FastConnect Live Stream State
  const [streamConnected, setStreamConnected] = useState(false);
  const [liveLatency, setLiveLatency] = useState(12);
  const [liveTickCount, setLiveTickCount] = useState(0);

  // Set Alert & Mock Notification Service States
  const [alerts, setAlerts] = useState<StockAlert[]>(() => getStoredAlerts());
  const [notifications, setNotifications] = useState<MockNotification[]>(() => getStoredNotifications());
  const [isSetAlertModalOpen, setIsSetAlertModalOpen] = useState(false);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [activeToastNotif, setActiveToastNotif] = useState<MockNotification | null>(null);

  // Watchlist State & Sentinel Integration
  const { isWatching, toggle: toggleWatch } = useWatchlist();
  const isWatched = isWatching(stock.symbol);

  const handleToggleWatchlist = () => {
    const res = toggleWatch(stock.symbol, {
      targetPrice: stock.aiTargetPrice,
      stopLoss: stock.aiStopLoss,
      note: stock.aiReasoning ? stock.aiReasoning.slice(0, 50) + '...' : `Theo dõi ${stock.symbol}`,
    });

    if (res.inWatchlist) {
      const confirmNotif: MockNotification = {
        id: `notif-${Date.now()}`,
        symbol: stock.symbol,
        triggerType: 'PRICE_THRESHOLD',
        title: `⭐ ĐÃ THÊM VÀO WATCHLIST: ${stock.symbol}`,
        message: `Mã ${stock.symbol} đã được thêm vào Danh mục theo dõi và kích hoạt Sentinel giám sát tự động 24/7!`,
        timestamp: getVietnamTimeString(),
        channel: 'IN_APP',
        severity: 'SUCCESS',
        read: false,
      };
      setNotifications((prev) => [confirmNotif, ...prev]);
      setActiveToastNotif(confirmNotif);
      playAlertSound();
    } else {
      const infoNotif: MockNotification = {
        id: `notif-${Date.now()}`,
        symbol: stock.symbol,
        triggerType: 'PRICE_THRESHOLD',
        title: `🗑️ ĐÃ XÓA KHỎI WATCHLIST: ${stock.symbol}`,
        message: `Đã hủy theo dõi mã ${stock.symbol} khỏi danh mục.`,
        timestamp: getVietnamTimeString(),
        channel: 'IN_APP',
        severity: 'INFO',
        read: false,
      };
      setNotifications((prev) => [infoNotif, ...prev]);
      setActiveToastNotif(infoNotif);
    }
  };

  const isPositive = stock.change >= 0;
  const tech = stock.technical;
  const fund = stock.fundamental;

  // High-Throughput SSE Market Stream & Latency Subscription
  useEffect(() => {
    const unsubStatus = marketStreamClient.onStatusChange((status, latency) => {
      setStreamConnected(status === 'CONNECTED');
      setLiveLatency(latency);
    });

    const unsubTick = marketStreamClient.onTickUpdate((evt) => {
      if (evt.symbol === stock.symbol) {
        setLiveTickCount((c) => c + 1);
      }
    });

    return () => {
      unsubStatus();
      unsubTick();
    };
  }, [stock.symbol]);

  const [isPinging, setIsPinging] = useState(false);
  const handleTestPing = async () => {
    setIsPinging(true);
    try {
      const lat = await marketStreamClient.measureLatency();
      setLiveLatency(lat);
    } finally {
      setTimeout(() => setIsPinging(false), 300);
    }
  };

  // Market Microstructure Logic (Ceiling, Floor, Reference)
  const bandPercent = stock.exchange === 'UPCOM' ? '±15%' : stock.exchange === 'HNX' ? '±10%' : '±7%';
  const isCeiling = stock.price >= stock.ceilingPrice;
  const isFloor = stock.price <= stock.floorPrice;
  const isRef = stock.price === stock.referencePrice;
  
  let priceColorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
  let priceBadgeText = isPositive ? 'TĂNG' : 'GIẢM';
  let priceBadgeBg = isPositive ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-red-950/80 text-red-400 border-red-800';

  if (isCeiling) {
    priceColorClass = 'text-purple-400 font-black';
    priceBadgeText = '🟣 TRẦN (CEILING)';
    priceBadgeBg = 'bg-purple-950 text-purple-300 border-purple-700 animate-pulse font-bold';
  } else if (isFloor) {
    priceColorClass = 'text-cyan-400 font-black';
    priceBadgeText = '🔵 SÀN (FLOOR)';
    priceBadgeBg = 'bg-cyan-950 text-cyan-300 border-cyan-700 animate-pulse font-bold';
  } else if (isRef) {
    priceColorClass = 'text-amber-400';
    priceBadgeText = '🟡 THAM CHIẾU';
    priceBadgeBg = 'bg-amber-950/80 text-amber-400 border-amber-800';
  }

  // Local Storage Sync
  useEffect(() => {
    saveAlertsToStorage(alerts);
  }, [alerts]);

  useEffect(() => {
    saveNotificationsToStorage(notifications);
  }, [notifications]);

  // Alert Actions
  const handleSaveAlert = (newAlertData: Omit<StockAlert, 'id' | 'createdAt' | 'triggerCount'>) => {
    const newAlert: StockAlert = {
      ...newAlertData,
      id: `alt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    };
    setAlerts((prev) => [newAlert, ...prev]);

    const confirmNotif: MockNotification = {
      id: `notif-${Date.now()}`,
      alertId: newAlert.id,
      symbol: newAlert.symbol,
      triggerType: newAlert.triggerType,
      title: `🔔 ĐÃ THIẾT LẬP CẢNH BÁO: ${newAlert.symbol}`,
      message: `Tín hiệu ${newAlert.triggerType} đã được khởi tạo thành công. Giám sát tự động qua [${newAlert.channel}].`,
      timestamp: getVietnamTimeString(),
      channel: newAlert.channel,
      severity: 'INFO',
      read: false,
    };

    setNotifications((prev) => [confirmNotif, ...prev]);
    setActiveToastNotif(confirmNotif);
    playAlertSound();
  };

  const handleToggleAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleTriggerMockNotif = (notifData: Omit<MockNotification, 'id' | 'timestamp' | 'read'>) => {
    const notif: MockNotification = {
      ...notifData,
      id: `notif-${Date.now()}`,
      timestamp: getVietnamTimeString(),
      read: false,
    };

    setNotifications((prev) => [notif, ...prev]);
    setActiveToastNotif(notif);
    playAlertSound();

    if (notifData.alertId) {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === notifData.alertId
            ? { ...a, triggerCount: a.triggerCount + 1, lastTriggeredAt: new Date().toISOString() }
            : a
        )
      );
    }
  };

  const runDeepAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: stock.symbol }),
      });
      const data = await res.json();
      setAiAnalysisResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    setAiAnalysisResult(null);
  }, [stock.symbol]);

  // Ticker scroll ref & navigation
  const tickerScrollRef = useRef<HTMLDivElement>(null);
  const scrollTickers = (direction: 'left' | 'right') => {
    if (tickerScrollRef.current) {
      const scrollAmount = direction === 'left' ? -250 : 250;
      tickerScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-3 bg-[#050505] text-[#d1d5db] min-h-screen">
      {/* Top Stock Selector Bar with Horizontal Scrollbar & Scroll Controls */}
      <div className="relative bg-[#0a0a0a] rounded-sm border border-gray-800 p-1.5 shadow-md">
        <div className="flex items-center">
          {/* Label + Left Scroll Arrow */}
          <div className="flex items-center space-x-1 shrink-0 pr-2 border-r border-gray-800/80 mr-2">
            <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider whitespace-nowrap">
              WATCHLIST TICKERS:
            </span>
            <button
              onClick={() => scrollTickers('left')}
              className="p-1 text-gray-400 hover:text-white bg-[#050505] hover:bg-gray-800 border border-gray-800 rounded-sm transition cursor-pointer"
              title="Cuộn sang trái"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scrollTickers('right')}
              className="p-1 text-gray-400 hover:text-white bg-[#050505] hover:bg-gray-800 border border-gray-800 rounded-sm transition cursor-pointer"
              title="Cuộn sang phải"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Horizontal Scrollable Tickers List with sleek scrollbar */}
          <div
            ref={tickerScrollRef}
            className="flex items-center space-x-2 custom-scrollbar-x overflow-x-auto pb-1.5 pt-0.5 w-full select-none"
          >
            {stocks.map((s) => {
              const isSelected = s.symbol === stock.symbol;
              const pos = s.changePercent >= 0;
              return (
                <button
                  key={s.symbol}
                  onClick={() => onSelectStock(s.symbol)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-xs font-mono transition whitespace-nowrap border shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-900/40 text-white border-blue-500 font-bold shadow-sm shadow-blue-500/20'
                      : 'bg-[#050505] text-gray-300 hover:bg-gray-800/60 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <span className={isSelected ? 'text-blue-400 font-bold' : 'text-gray-200'}>{s.symbol}</span>
                  <span className={pos ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {pos ? '+' : ''}
                    {s.changePercent}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Stock Header Card */}
      <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3.5 shadow-lg">
        {/* Top Header Row: Stock Identification (Left) & Real-time Price (Right) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black font-mono text-white tracking-tight">{stock.symbol}</h2>
              <span className="bg-[#050505] text-gray-300 border border-gray-700 px-2 py-0.5 rounded-sm text-xs font-mono font-semibold">
                {stock.exchange} ({bandPercent})
              </span>
              <span className="bg-blue-950/60 text-blue-400 border border-blue-800/80 px-2 py-0.5 rounded-sm text-xs font-mono">
                {stock.sector}
              </span>
              <span className={`px-2 py-0.5 rounded-sm text-xs font-mono border ${priceBadgeBg}`}>
                {priceBadgeText}
              </span>
              {stock.smartMoney && stock.smartMoney.patternType !== 'NEUTRAL' && (
                <span className={`px-2 py-0.5 rounded-sm text-xs font-mono font-bold border flex items-center space-x-1 ${
                  stock.smartMoney.patternType === 'BULL_TRAP'
                    ? 'bg-red-950/90 text-red-300 border-red-700 animate-pulse'
                    : stock.smartMoney.patternType === 'ACCUMULATION_CLANDESTINE'
                    ? 'bg-cyan-950/90 text-cyan-300 border-cyan-700'
                    : stock.smartMoney.patternType === 'MORNING_VOLUME_BURST'
                    ? 'bg-purple-950/90 text-purple-300 border-purple-700'
                    : 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                }`}>
                  {stock.smartMoney.patternType === 'BULL_TRAP' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                  {stock.smartMoney.patternType === 'ACCUMULATION_CLANDESTINE' && <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                  {stock.smartMoney.patternType === 'MORNING_VOLUME_BURST' && <Zap className="w-3.5 h-3.5 text-purple-400" />}
                  {stock.smartMoney.patternType === 'BEAR_TRAP' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{stock.smartMoney.patternName}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <p className="text-xs text-gray-400 font-medium">{stock.name}</p>
              <span className="text-[10px] text-gray-500 hidden sm:inline">•</span>
              <div className="flex items-center space-x-1.5 bg-[#050505] px-2 py-0.5 rounded border border-gray-800 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${streamConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-500'}`}></span>
                <span className="text-emerald-400 font-bold">SSE 2-WAY LIVE</span>
                <span className="text-gray-500">|</span>
                <button
                  onClick={handleTestPing}
                  disabled={isPinging}
                  title="Bấm để đo độ trễ thực tế qua kênh SSE / Ping"
                  className="flex items-center space-x-1 text-gray-300 hover:text-white transition cursor-pointer"
                >
                  <span>Độ trễ: <strong className={liveLatency < 25 ? 'text-emerald-400' : 'text-amber-400'}>{liveLatency}ms</strong></span>
                  <RefreshCw className={`w-2.5 h-2.5 text-gray-400 ${isPinging ? 'animate-spin text-blue-400' : ''}`} />
                </button>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">Ticks: <strong className="text-blue-400">{liveTickCount}</strong></span>
              </div>
            </div>
          </div>

          {/* Real-time Price Display */}
          <div className="flex items-baseline space-x-3 bg-[#050505] px-3.5 py-1.5 rounded-sm border border-gray-800/80 shadow-inner">
            <span className={`text-3xl font-black font-mono tracking-tight ${priceColorClass}`}>
              {stock.price.toFixed(2)}
            </span>
            <div className={`flex items-center space-x-1 font-mono font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              <span>
                {isPositive ? '+' : ''}
                {stock.change.toFixed(2)} ({isPositive ? '+' : ''}
                {stock.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Toolbar Row: Quick Reference Metrics (Left) & Action Buttons (Right) */}
        <div className="border-t border-gray-800/80 pt-3 flex flex-wrap items-center justify-between gap-3">
          {/* Quick Reference Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono flex-1 min-w-[280px]">
            <div className="bg-[#050505] p-2 rounded-sm border border-gray-800/80">
              <span className="text-gray-500 block text-[9px] uppercase font-bold tracking-wider">THAM CHIẾU</span>
              <span className="text-amber-400 font-semibold">{stock.referencePrice}</span>
            </div>
            <div className="bg-[#050505] p-2 rounded-sm border border-gray-800/80">
              <span className="text-gray-500 block text-[9px] uppercase font-bold tracking-wider">TRẦN / SÀN</span>
              <span className="text-purple-400 font-semibold">{stock.ceilingPrice}</span> / <span className="text-blue-400 font-semibold">{stock.floorPrice}</span>
            </div>
            <div className="bg-[#050505] p-2 rounded-sm border border-gray-800/80">
              <span className="text-gray-500 block text-[9px] uppercase font-bold tracking-wider">KHỐI LƯỢNG (CP)</span>
              <span className="text-gray-200 font-semibold">{(stock.volume ?? 0).toLocaleString('vi-VN')}</span>
            </div>
            <div className="bg-[#050505] p-2 rounded-sm border border-gray-800/80">
              <span className="text-gray-500 block text-[9px] uppercase font-bold tracking-wider">KHỐI NGOẠI RÒNG</span>
              <span className={stock.foreignNetVal >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                {stock.foreignNetVal >= 0 ? '+' : ''}
                {stock.foreignNetVal} Tỷ
              </span>
            </div>
          </div>

          {/* Unified Action Button Bar */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Add / Remove from Watchlist Button */}
            <button
              onClick={handleToggleWatchlist}
              className={`px-3 py-2 font-bold rounded-sm text-xs border flex items-center space-x-1.5 transition whitespace-nowrap shadow cursor-pointer ${
                isWatched
                  ? 'bg-emerald-950/90 hover:bg-red-950/90 text-emerald-300 hover:text-red-300 border-emerald-600 hover:border-red-600 group'
                  : 'bg-gradient-to-r from-emerald-950 via-[#062c22] to-emerald-950 hover:from-emerald-800 hover:to-teal-800 text-emerald-300 hover:text-white border-emerald-600/80 shadow-emerald-950/50'
              }`}
              title={
                isWatched
                  ? `Mã ${stock.symbol} đang trong Danh mục theo dõi. Bấm để hủy theo dõi.`
                  : `Thêm ${stock.symbol} vào Danh mục theo dõi & Kích hoạt Sentinel giám sát tự động`
              }
            >
              {isWatched ? (
                <>
                  <BookmarkCheck className="w-4 h-4 text-emerald-400 group-hover:hidden" />
                  <span className="group-hover:hidden">ĐÃ THEO DÕI ({stock.symbol})</span>
                  <X className="w-4 h-4 text-red-400 hidden group-hover:inline" />
                  <span className="hidden group-hover:inline">HỦY THEO DÕI</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4 text-emerald-400" />
                  <span>+ THEO DÕI ({stock.symbol})</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsSetAlertModalOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-sm text-xs flex items-center space-x-1.5 shadow transition whitespace-nowrap"
            >
              <Bell className="w-4 h-4 animate-pulse text-amber-300" />
              <span>TẠO CẢNH BÁO ({stock.symbol})</span>
            </button>

            <button
              onClick={() => setIsAlertsDrawerOpen(true)}
              className="relative px-3 py-2 bg-[#050505] hover:bg-gray-800 text-gray-200 font-bold rounded-sm text-xs border border-gray-800 flex items-center space-x-1.5 transition whitespace-nowrap"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>CẢNH BÁO ({alerts.filter((a) => a.isActive).length})</span>
              {notifications.filter((n) => !n.read).length > 0 && (
                <span className="bg-red-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black animate-pulse">
                  {notifications.filter((n) => !n.read).length}
                </span>
              )}
            </button>

            {/* Direct TradingView Link Button */}
            <a
              href={`https://www.tradingview.com/chart/?symbol=${stock.exchange || 'HOSE'}:${stock.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-[#131722] hover:bg-blue-600 text-slate-200 hover:text-white font-mono font-bold rounded-sm text-xs border border-slate-700/80 flex items-center space-x-1.5 transition shadow group cursor-pointer whitespace-nowrap"
              title={`Mở biểu đồ ${stock.symbol} trực tiếp trên TradingView.com`}
            >
              <svg className="w-4 h-3 fill-current text-blue-400 group-hover:text-white transition" viewBox="0 0 36 28">
                <path d="M14 22H7V11H14V22ZM28 6H21V22H28V6ZM21 0H14V22H21V0Z" />
              </svg>
              <span>TRADINGVIEW.COM ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Grid Layout: Left Chart (8 cols or 12 cols in Focus Mode) / Right Orderbook & AI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Interactive Chart + Indicator Tables */}
        <div className={`${isFocusMode ? 'lg:col-span-12' : 'lg:col-span-8'} flex flex-col space-y-3 transition-all duration-300`}>
          {/* TradingView Candlestick Chart */}
          <div className={`${isFocusMode ? 'h-[620px]' : 'h-[460px]'} bg-[#050505] rounded-sm border border-gray-800 overflow-hidden transition-all duration-300`}>
            <StockChart
              symbol={stock.symbol}
              candles={candles}
              exchange={stock.exchange}
              isFocusMode={isFocusMode}
              onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
            />
          </div>

          {/* Sub Panels: Technical & Fundamental Indicators */}
          <div className="bg-[#0a0a0a] rounded-sm p-3 border border-gray-800">
            <div className="flex items-center space-x-2 border-b border-gray-800 pb-2 mb-3">
              {(['OVERVIEW', 'TECHNICAL', 'FUNDAMENTAL', 'PATTERNS'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1 rounded-sm text-xs font-mono transition border ${
                    activeTab === t
                      ? 'bg-blue-600 text-white border-blue-500 font-bold'
                      : 'bg-[#050505] text-gray-400 hover:text-gray-200 border-gray-800'
                  }`}
                >
                  {t === 'OVERVIEW'
                    ? 'TỔNG QUAN CHỈ BÁO'
                    : t === 'TECHNICAL'
                    ? 'PHÂN TÍCH KỸ THUẬT'
                    : t === 'FUNDAMENTAL'
                    ? 'PHÂN TÍCH CƠ BẢN'
                    : 'MẪU HÌNH NẾN'}
                </button>
              ))}
            </div>

            {activeTab === 'OVERVIEW' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex justify-between items-start">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">RSI (14)</span>
                    <span className={`text-base font-bold ${tech.rsi14 > 70 ? 'text-red-400' : tech.rsi14 < 30 ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {tech.rsi14}
                    </span>
                    <span className="text-[10px] text-gray-500 block">{tech.rsi14 > 70 ? 'Quá mua' : tech.rsi14 < 30 ? 'Quá bán' : 'Trung tính'}</span>
                  </div>
                  <button
                    onClick={() => setIsSetAlertModalOpen(true)}
                    className="text-amber-400 hover:text-amber-300 px-1.5 py-0.5 bg-[#0a0a0a] hover:bg-gray-800 rounded-sm border border-gray-800 text-[10px] font-bold flex items-center space-x-1 transition"
                    title="Đặt cảnh báo RSI"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Alert</span>
                  </button>
                </div>

                <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800">
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">MACD HISTOGRAM</span>
                  <span className={`text-base font-bold ${tech.macd.histogram >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tech.macd.histogram}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Signal: {tech.macd.signalLine}</span>
                </div>

                <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex justify-between items-start">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">MA20 / MA50</span>
                    <span className="text-blue-400 font-bold text-sm">{tech.ma20}</span> / <span className="text-amber-400 font-bold text-sm">{tech.ma50}</span>
                    <span className="text-[10px] text-emerald-400 block">{tech.ma20 > tech.ma50 ? 'Golden Cross' : 'Tích lũy'}</span>
                  </div>
                  <button
                    onClick={() => setIsSetAlertModalOpen(true)}
                    className="text-blue-400 hover:text-blue-300 px-1.5 py-0.5 bg-[#0a0a0a] hover:bg-gray-800 rounded-sm border border-gray-800 text-[10px] font-bold flex items-center space-x-1 transition"
                    title="Đặt cảnh báo MA"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Alert</span>
                  </button>
                </div>

                <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex justify-between items-start">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">HỖ TRỢ / KHÁNG CỰ</span>
                    <span className="text-emerald-400 font-bold text-sm">{tech.supportLevel}</span> / <span className="text-red-400 font-bold text-sm">{tech.resistanceLevel}</span>
                    <span className="text-[10px] text-gray-500 block">Biên độ: {((tech.resistanceLevel - tech.supportLevel) / stock.price * 100).toFixed(1)}%</span>
                  </div>
                  <button
                    onClick={() => setIsSetAlertModalOpen(true)}
                    className="text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 bg-[#0a0a0a] hover:bg-gray-800 rounded-sm border border-gray-800 text-[10px] font-bold flex items-center space-x-1 transition"
                    title="Đặt cảnh báo Ngưỡng giá"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Alert</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'TECHNICAL' && (
              <div className="space-y-2.5 text-xs font-mono">
                {/* Top Row: Ichimoku & Fibonacci Retracement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Ichimoku Kinko Hyo Card */}
                  <div className="bg-[#050505] p-2.5 rounded-sm border border-cyan-900/40 bg-gradient-to-br from-cyan-950/20 to-transparent">
                    <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-cyan-900/30">
                      <span className="text-cyan-400 font-bold text-[11px] flex items-center space-x-1">
                        <span>☁️ HỆ THỐNG MÂY ICHIMOKU KINKO HYO</span>
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        stock.price >= (tech.ichimoku?.senkouA || 0)
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {stock.price >= (tech.ichimoku?.senkouA || 0) ? 'TRÊN MÂY KUMO (BULL)' : 'DƯỚI MÂY (BEAR)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                      <span className="text-gray-400">Tenkan (9): <strong className="text-cyan-300">{tech.ichimoku?.tenkan}</strong></span>
                      <span className="text-gray-400">Kijun (26): <strong className="text-orange-400">{tech.ichimoku?.kijun}</strong></span>
                      <span className="text-gray-400">Span A (Kumo): <strong className="text-emerald-400">{tech.ichimoku?.senkouA}</strong></span>
                      <span className="text-gray-400">Span B (52): <strong className="text-rose-400">{tech.ichimoku?.senkouB}</strong></span>
                      <span className="text-gray-400 col-span-2 text-[10px] text-slate-400">
                        {tech.ichimoku?.tenkan > tech.ichimoku?.kijun ? '✓ Tenkan cắt trên Kijun (Tín hiệu mua sớm)' : 'Tenkan dưới Kijun (Tích lũy điều chỉnh)'}
                      </span>
                    </div>
                  </div>

                  {/* Fibonacci Retracement Card */}
                  <div className="bg-[#050505] p-2.5 rounded-sm border border-amber-900/40 bg-gradient-to-br from-amber-950/20 to-transparent">
                    <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-amber-900/30">
                      <span className="text-amber-400 font-bold text-[11px] flex items-center space-x-1">
                        <span>📐 THOÁI LUI FIBONACCI RETRACEMENT</span>
                      </span>
                      <span className="text-[9px] bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800 font-bold">
                        PRICE ACTION
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <div className="bg-[#0a0a0a] p-1 rounded border border-gray-800">
                        <span className="text-gray-400 block text-[9px]">Fibo 23.6%</span>
                        <strong className="text-sky-400 text-xs">{tech.fibonacci.f236}</strong>
                      </div>
                      <div className="bg-[#0a0a0a] p-1 rounded border border-amber-900/50 bg-amber-950/20">
                        <span className="text-amber-400 block text-[9px] font-bold">★ Fibo 38.2%</span>
                        <strong className="text-amber-300 text-xs">{tech.fibonacci.f382}</strong>
                      </div>
                      <div className="bg-[#0a0a0a] p-1 rounded border border-gray-800">
                        <span className="text-orange-400 block text-[9px]">Fibo 50.0%</span>
                        <strong className="text-orange-300 text-xs">{tech.fibonacci.f500}</strong>
                      </div>
                      <div className="bg-[#0a0a0a] p-1 rounded border border-emerald-900/50 bg-emerald-950/20 col-span-2">
                        <span className="text-emerald-400 block text-[9px] font-bold">★ Fibo 61.8% (Golden Zone)</span>
                        <strong className="text-emerald-300 text-xs">{tech.fibonacci.f618}</strong>
                      </div>
                      <div className="bg-[#0a0a0a] p-1 rounded border border-gray-800">
                        <span className="text-purple-400 block text-[9px]">Fibo 78.6%</span>
                        <strong className="text-purple-300 text-xs">{tech.fibonacci.f786}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Multi-cycle SMA / EMA, Vol20, ATR & ADX */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                    <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1">ĐƯỜNG SMA ĐA KỲ</span>
                    <span className="text-gray-400 block text-[11px]">SMA 20: <strong className="text-sky-400">{tech.ma20}</strong></span>
                    <span className="text-gray-400 block text-[11px]">SMA 50: <strong className="text-amber-400">{tech.ma50}</strong></span>
                    <span className="text-gray-400 block text-[11px]">SMA 200: <strong className="text-purple-400">{tech.ma200}</strong></span>
                  </div>

                  <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                    <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1">ĐƯỜNG EMA ĐA KỲ</span>
                    <span className="text-gray-400 block text-[11px]">EMA 20: <strong className="text-emerald-400">{tech.ema20}</strong></span>
                    <span className="text-gray-400 block text-[11px]">EMA 50: <strong className="text-orange-400">{tech.ema50 || tech.ma50}</strong></span>
                    <span className="text-gray-400 block text-[11px]">EMA 200: <strong className="text-rose-400">{tech.ema200 || tech.ma200}</strong></span>
                  </div>

                  <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                    <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1">THANH KHOẢN & VWAP</span>
                    <span className="text-gray-400 block text-[11px]">VWAP: <strong className="text-blue-400">{tech.vwap}</strong></span>
                    <span className="text-gray-400 block text-[11px]">Vol MA20: <strong className="text-yellow-400">{(tech.vol20 || (stock.volume * 0.9)).toLocaleString('vi-VN')}</strong></span>
                    <span className="text-[10px] text-gray-500 block">OBV: {(tech.obv / 1e6).toFixed(1)}M cp</span>
                  </div>

                  <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                    <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1">XU HƯỚNG & BIẾN ĐỘNG</span>
                    <span className="text-gray-400 block text-[11px]">ADX (14): <strong className="text-amber-400">{tech.adx14}</strong></span>
                    <span className="text-gray-400 block text-[11px]">ATR (14): <strong className="text-gray-200">{tech.atr14} VNĐ</strong></span>
                    <span className="text-gray-400 block text-[11px]">Stoch (14): <strong className="text-emerald-400">{tech.stochastic.k}</strong></span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'FUNDAMENTAL' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">P/E RATIO</span>
                  <span className="text-amber-400 font-bold text-sm">{fund.pe}x</span>
                  <span className="text-[10px] text-gray-500 block">Ngành: {fund.industryAvgPE}x</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">P/B RATIO</span>
                  <span className="text-blue-400 font-bold text-sm">{fund.pb}x</span>
                  <span className="text-[10px] text-gray-500 block">Ngành: {fund.industryAvgPB}x</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">ROE / ROA</span>
                  <span className="text-emerald-400 font-bold text-sm">{fund.roe}%</span> / <span className="text-emerald-400 text-sm">{fund.roa}%</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">TĂNG TRƯỞNG LN YOY</span>
                  <span className="text-emerald-400 font-bold text-sm">+{fund.profitGrowthYoY}%</span>
                </div>
              </div>
            )}

            {activeTab === 'PATTERNS' && (
              <div className="space-y-2 text-xs font-mono">
                {tech.patterns.length > 0 ? (
                  tech.patterns.map((p, idx) => (
                    <div key={idx} className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.type === 'BULLISH' ? 'bg-emerald-400' : p.type === 'BEARISH' ? 'bg-red-400' : 'bg-amber-400'
                          }`}
                        ></span>
                        <span className="font-bold text-gray-200">{p.name}</span>
                        <span className="text-gray-400 text-[11px]">- {p.description}</span>
                      </div>
                      <span className="text-blue-400 font-bold">Độ tin cậy: {p.confidence}%</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-4">Mô hình giá tích lũy đi ngang.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Orderbook & AI Quantitative Verdict (Hidden in Focus Mode or collapsed) */}
        {!isFocusMode && (
          <div className="lg:col-span-4 flex flex-col space-y-3">
            {/* Order Book Level 2 Depth & Real-time Trade Ticks */}
            <div className="bg-[#0a0a0a] rounded-sm p-3 border border-gray-800 shadow">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>SỔ LỆNH ĐỘ SÂU LEVEL 2 (MARKET DEPTH)</span>
                </h3>
                <span className="text-[9px] font-mono text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                  SSE STREAM
                </span>
              </div>

              {/* Bid vs Ask Volume Pressure Bar */}
              {(() => {
                const totalBidVol = orderBook.bid.reduce((acc, b) => acc + (b.volume || 0), 0);
                const totalAskVol = orderBook.ask.reduce((acc, a) => acc + (a.volume || 0), 0);
                const maxLevelVol = Math.max(
                  ...orderBook.bid.map((b) => b.volume || 0),
                  ...orderBook.ask.map((a) => a.volume || 0),
                  1
                );
                const buyRatio = totalBidVol + totalAskVol > 0 ? Math.round((totalBidVol / (totalBidVol + totalAskVol)) * 100) : 50;
                const sellRatio = 100 - buyRatio;

                return (
                  <>
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800/90 mb-2.5 font-mono">
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="text-emerald-400 font-bold">
                          DƯ MUA: {totalBidVol.toLocaleString('vi-VN')} ({buyRatio}%)
                        </span>
                        <span className="text-red-400 font-bold">
                          ({sellRatio}%) {totalAskVol.toLocaleString('vi-VN')} :DƯ BÁN
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-900 rounded-full flex overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-300"
                          style={{ width: `${buyRatio}%` }}
                        />
                        <div
                          className="bg-gradient-to-r from-red-400 to-red-600 h-full transition-all duration-300"
                          style={{ width: `${sellRatio}%` }}
                        />
                      </div>
                    </div>

                    {/* Level 2 Depth 3-Tier Grid with Relative Volume Heatmaps */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                      {/* Bid Side */}
                      <div className="space-y-1 bg-[#050505] p-2 rounded-sm border border-gray-800 relative overflow-hidden">
                        <div className="flex justify-between items-center text-[10px] pb-1 border-b border-gray-800 text-gray-400 font-semibold">
                          <span>GIÁ MUA (3 BƯỚC)</span>
                          <span>KHỐI LƯỢNG</span>
                        </div>
                        {orderBook.bid.map((b, idx) => {
                          const depthPercent = Math.min(100, Math.round(((b.volume || 0) / maxLevelVol) * 100));
                          return (
                            <div key={idx} className="relative flex justify-between items-center text-[11px] py-0.5 px-1 rounded-xs">
                              {/* Visual Depth Bar Background */}
                              <div
                                className="absolute right-0 top-0 bottom-0 bg-emerald-950/60 border-l border-emerald-700/50 rounded-xs pointer-events-none transition-all duration-300"
                                style={{ width: `${depthPercent}%` }}
                              />
                              <span className="text-emerald-400 font-bold relative z-10">
                                {idx === 0 ? '① ' : idx === 1 ? '② ' : '③ '}{b.price.toFixed(2)}
                              </span>
                              <span className="text-gray-200 relative z-10 font-medium">
                                {(b.volume ?? 0).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Ask Side */}
                      <div className="space-y-1 bg-[#050505] p-2 rounded-sm border border-gray-800 relative overflow-hidden">
                        <div className="flex justify-between items-center text-[10px] pb-1 border-b border-gray-800 text-gray-400 font-semibold">
                          <span>GIÁ BÁN (3 BƯỚC)</span>
                          <span>KHỐI LƯỢNG</span>
                        </div>
                        {orderBook.ask.map((a, idx) => {
                          const depthPercent = Math.min(100, Math.round(((a.volume || 0) / maxLevelVol) * 100));
                          return (
                            <div key={idx} className="relative flex justify-between items-center text-[11px] py-0.5 px-1 rounded-xs">
                              {/* Visual Depth Bar Background */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-red-950/60 border-r border-red-700/50 rounded-xs pointer-events-none transition-all duration-300"
                                style={{ width: `${depthPercent}%` }}
                              />
                              <span className="text-red-400 font-bold relative z-10">
                                {idx === 0 ? '① ' : idx === 1 ? '② ' : '③ '}{a.price.toFixed(2)}
                              </span>
                              <span className="text-gray-200 relative z-10 font-medium">
                                {(a.volume ?? 0).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Trade Ticks Live Stream Table */}
              <div>
                {(() => {
                  const session = getMarketSessionInfo();
                  return (
                    <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 mb-1 px-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-gray-300">KHỚP LỆNH TỪNG GIÂY (LIVE TICKS)</span>
                      </div>
                      <div>
                        {session.canMatchOrders ? (
                          <span className="flex items-center space-x-1 text-emerald-400 text-[9px] font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            <span>LIVE</span>
                          </span>
                        ) : session.status === 'LUNCH_BREAK' ? (
                          <span className="text-amber-400 text-[9px] font-semibold bg-amber-950/70 px-1.5 py-0.2 rounded border border-amber-800/60">
                            NGHỈ TRƯA (Chốt 11:30)
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[9px] font-semibold bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-700">
                            ĐÃ ĐÓNG CỬA (Chốt 14:45)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <div className="bg-[#050505] rounded-sm border border-gray-800 p-2 max-h-44 overflow-y-auto space-y-1 text-[11px] font-mono scrollbar-none">
                  {tradeTicks.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className={`flex justify-between items-center py-0.5 px-1 rounded transition-colors ${
                        idx === 0 ? 'bg-blue-950/30' : 'hover:bg-gray-900/40'
                      }`}
                    >
                      <span className="text-gray-500 text-[10px]">{t.time}</span>
                      <span className={t.type === 'BUY' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {t.price.toFixed(2)}
                      </span>
                      <span className="text-gray-300 font-medium">{(t.volume ?? 0).toLocaleString('vi-VN')}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-xs ${
                          t.type === 'BUY'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                            : 'bg-red-950 text-red-300 border border-red-800/80'
                        }`}
                      >
                        {t.type === 'BUY' ? 'MUA' : 'BÁN'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          {/* AI Quantitative 4-Layer Verdict Card */}
          <div className="bg-[#0a0a0a] rounded-sm p-3.5 border border-gray-800 flex-1 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-blue-600 rounded-sm flex items-center justify-center text-[10px] text-white font-bold font-mono shadow">
                    4Q
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-[11px] text-white uppercase tracking-wider">
                      PHÂN TÍCH ĐỊNH LƯỢNG 4 TẦNG
                    </h3>
                    <span className="text-[9px] text-gray-500 font-mono">Gemini 3.7 Flash + Quant Engine</span>
                  </div>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-sm font-black font-mono border whitespace-nowrap ${
                    (aiAnalysisResult?.verdict || stock.aiVerdict) === 'MUA MẠNH'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : (aiAnalysisResult?.verdict || stock.aiVerdict) === 'MUA'
                      ? 'bg-blue-950/80 text-blue-400 border-blue-700'
                      : 'bg-amber-950/80 text-amber-400 border-amber-700'
                  }`}
                >
                  {aiAnalysisResult?.verdict || stock.aiVerdict}
                </span>
              </div>

              {/* Score & Plan Targets */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono mb-3">
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 block text-[9px] uppercase">ĐIỂM AI</span>
                  <span className="text-blue-400 font-black text-base">{aiAnalysisResult?.score || stock.aiScore}</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 block text-[9px] uppercase">VÙNG MUA</span>
                  <span className="text-blue-300 font-bold text-xs">{aiAnalysisResult?.buyZone || `${(stock.price * 0.99).toFixed(1)}-${(stock.price * 1.01).toFixed(1)}k`}</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 block text-[9px] uppercase">CHỐT LỜI (TP)</span>
                  <span className="text-emerald-400 font-bold text-xs">{aiAnalysisResult?.targetPrice || stock.aiTargetPrice}k</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 block text-[9px] uppercase">CẮT LỖ (SL)</span>
                  <span className="text-red-400 font-bold text-xs">{aiAnalysisResult?.stopLoss || stock.aiStopLoss}k</span>
                </div>
              </div>

              {/* 4-Layer Fast Accordion/Highlights */}
              <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 text-xs text-gray-300 leading-relaxed space-y-2 mb-3 font-mono">
                <div className="space-y-1.5 text-[11px]">
                  {/* T1 */}
                  <div className="border-b border-gray-800/80 pb-1.5">
                    <span className="text-blue-400 font-bold text-[10px] uppercase block">1️⃣ TẦNG 1: NỀN TẢNG CƠ BẢN</span>
                    <p className="text-gray-300 text-[10px] leading-relaxed break-words whitespace-normal">
                      {aiAnalysisResult?.layer1_fundamental?.summary ||
                        `P/E: ${fund.pe}x (Ngành ${fund.industryAvgPE}x), ROE: ${fund.roe}%, Tăng trưởng LN YoY: +${fund.profitGrowthYoY}%.`}
                    </p>
                  </div>

                  {/* T2 */}
                  <div className="border-b border-gray-800/80 pb-1.5">
                    <span className="text-purple-400 font-bold text-[10px] uppercase block">2️⃣ TẦNG 2: KỸ THUẬT & XU HƯỚNG</span>
                    <p className="text-gray-300 text-[10px] leading-relaxed break-words whitespace-normal">
                      {aiAnalysisResult?.layer2_technical?.summary ||
                        `RSI(14): ${tech.rsi14}. Hỗ trợ: ${tech.supportLevel}k, Kháng cự: ${tech.resistanceLevel}k.`}
                    </p>
                  </div>

                  {/* T3 */}
                  <div className="border-b border-gray-800/80 pb-1.5">
                    <span className="text-cyan-400 font-bold text-[10px] uppercase block flex items-center justify-between">
                      <span>3️⃣ TẦNG 3: DẤU CHÂN CÁ MẬP & BẪY GIÁ</span>
                      {stock.smartMoney && (
                        <span className="text-[9px] text-cyan-300 font-mono">
                          Vol Sáng: {stock.smartMoney.morningVolRatio}x | Lô lớn: {stock.smartMoney.largeBlockNetRatio}%
                        </span>
                      )}
                    </span>
                    <p className="text-gray-300 text-[10px] leading-relaxed break-words whitespace-normal">
                      {aiAnalysisResult?.layer3_smartMoney?.summary ||
                        stock.smartMoney?.description ||
                        `Khối ngoại: ${stock.foreignNetVal > 0 ? `+${stock.foreignNetVal}` : stock.foreignNetVal} tỷ VNĐ. Khối lượng: ${(stock.volume ?? 0).toLocaleString('vi-VN')} CP.`}
                    </p>
                    {stock.smartMoney?.trapWarning && (
                      <p className="text-red-400 text-[10px] font-bold mt-0.5 break-words whitespace-normal">
                        ⚠️ {stock.smartMoney.trapWarning}
                      </p>
                    )}
                  </div>

                  {/* T4 */}
                  <div className="bg-[#030a05] p-2 rounded-sm border border-emerald-900/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold text-[10px] uppercase flex items-center space-x-1">
                        <span>4️⃣ TẦNG 4: KẾ HOẠCH GIAO DỊCH & QUẢN TRỊ RỦI RO</span>
                      </span>
                      <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded-sm font-bold border border-emerald-800">
                        {aiAnalysisResult?.layer4_actionPlan?.action || stock.aiVerdict}
                      </span>
                    </div>

                    {/* Quick Trade Specs */}
                    <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono">
                      <div className="bg-[#050505] p-1 rounded-sm border border-gray-800">
                        <span className="text-gray-500 block">VÙNG MUA:</span>
                        <span className="text-cyan-300 font-bold">
                          {aiAnalysisResult?.layer4_actionPlan?.buyZone || `${(stock.price * 0.985).toFixed(2)} - ${(stock.price * 1.005).toFixed(2)}k`}
                        </span>
                      </div>
                      <div className="bg-[#050505] p-1 rounded-sm border border-gray-800">
                        <span className="text-gray-500 block">MỤC TIÊU (TP1/TP2):</span>
                        <span className="text-emerald-400 font-bold">
                          {aiAnalysisResult?.layer4_actionPlan?.target1 || stock.aiTargetPrice}k / {aiAnalysisResult?.layer4_actionPlan?.target2 || (Number(stock.aiTargetPrice) * 1.08).toFixed(2)}k
                        </span>
                      </div>
                      <div className="bg-[#050505] p-1 rounded-sm border border-gray-800">
                        <span className="text-gray-500 block">CẮT LỖ (SL):</span>
                        <span className="text-red-400 font-bold">
                          {aiAnalysisResult?.layer4_actionPlan?.stopLoss || stock.aiStopLoss}k ({aiAnalysisResult?.layer4_actionPlan?.stopLossDownside || '-6.0%'})
                        </span>
                      </div>
                      <div className="bg-[#050505] p-1 rounded-sm border border-gray-800">
                        <span className="text-gray-500 block">R:R & PHÂN BỔ:</span>
                        <span className="text-amber-300 font-bold">
                          {aiAnalysisResult?.layer4_actionPlan?.rrRatio || '1:2.8'} • {aiAnalysisResult?.layer4_actionPlan?.maxAllocation || '15-20% NAV'}
                        </span>
                      </div>
                    </div>

                    <p className="text-gray-300 text-[10px] leading-relaxed break-words whitespace-normal">
                      {aiAnalysisResult?.layer4_actionPlan?.strategyNote ||
                        `Tỷ lệ R:R dự kiến ${aiAnalysisResult?.riskRewardRatio || '1:2.8'}. Giải ngân khuyến nghị max 15-20% NAV (50% vùng gom, 50% khi bứt phá).`}
                    </p>

                    {aiAnalysisResult?.layer4_actionPlan?.entryRules && (
                      <div className="text-[9px] text-gray-300 space-y-1 pt-1.5 border-t border-emerald-950/80">
                        <span className="text-cyan-400 font-semibold block uppercase">Chiến lược đi lệnh:</span>
                        {aiAnalysisResult.layer4_actionPlan.entryRules.map((r: string, idx: number) => (
                          <div key={idx} className="flex items-start space-x-1 break-words whitespace-normal leading-normal">
                            <span className="text-cyan-400 font-bold shrink-0">•</span>
                            <span className="text-gray-300">{r}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {aiAnalysisResult?.catalysts && (
                  <div className="pt-2 border-t border-gray-800 text-[10px] space-y-1">
                    <div className="break-words whitespace-normal leading-relaxed">
                      <strong className="text-emerald-400">Động lực:</strong> {aiAnalysisResult.catalysts?.join('; ')}
                    </div>
                    <div className="break-words whitespace-normal leading-relaxed">
                      <strong className="text-red-400">Rủi ro:</strong> {aiAnalysisResult.risks?.join('; ')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 font-mono">
              <button
                onClick={runDeepAIAnalysis}
                disabled={isAnalyzing}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-sm text-xs flex items-center justify-center space-x-1.5 transition shadow"
              >
                <Zap className="w-4 h-4" />
                <span>{isAnalyzing ? 'ĐANG PHÂN TÍCH 4 TẦNG QUANT...' : `PHÂN TÍCH 4 TẦNG ${stock.symbol}`}</span>
              </button>

              <button
                onClick={() => onOpenAIChat(`Phân tích chi tiết cổ phiếu ${stock.symbol} theo cấu trúc 4 tầng định lượng`)}
                className="w-full bg-[#050505] hover:bg-gray-800 text-gray-300 font-semibold py-1.5 rounded-sm text-xs flex items-center justify-center space-x-1.5 transition border border-gray-700"
              >
                <Bot className="w-3.5 h-3.5 text-blue-400" />
                <span>HỎI CHUYÊN GIA AI 4 TẦNG VỀ {stock.symbol}</span>
              </button>
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Set Alert Modal Interface */}
      <SetAlertModal
        isOpen={isSetAlertModalOpen}
        onClose={() => setIsSetAlertModalOpen(false)}
        currentStock={stock}
        allStocks={stocks}
        onSaveAlert={handleSaveAlert}
        onTestTriggerInstant={(symbol, title, message, severity) => {
          handleTriggerMockNotif({
            symbol,
            triggerType: 'PRICE_THRESHOLD',
            title,
            message,
            channel: 'IN_APP',
            severity,
          });
        }}
      />

      {/* Active Alerts & Notifications Drawer */}
      <AlertsDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
        alerts={alerts}
        notifications={notifications}
        stocks={stocks}
        onToggleAlert={handleToggleAlert}
        onDeleteAlert={handleDeleteAlert}
        onOpenSetModal={() => {
          setIsAlertsDrawerOpen(false);
          setIsSetAlertModalOpen(true);
        }}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onClearNotifications={handleClearNotifications}
        onTriggerMockNotif={handleTriggerMockNotif}
        onSelectStock={onSelectStock}
      />

      {/* Realtime Toast Notification Banner */}
      <AlertToast
        notification={activeToastNotif}
        onDismiss={() => setActiveToastNotif(null)}
        onSelectStock={onSelectStock}
      />
    </div>
  );
};
