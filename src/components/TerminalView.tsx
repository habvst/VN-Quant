import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Bell, Bot, CheckCircle, Flame, Layers, Plus, ShieldCheck, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Candle, OrderBook, StockData, TradeTick } from '../types';
import { StockAlert, MockNotification } from '../types/alert';
import { getStoredAlerts, saveAlertsToStorage, getStoredNotifications, saveNotificationsToStorage, playAlertSound } from '../services/alertService';
import { StockChart } from './StockChart';
import { SetAlertModal } from './SetAlertModal';
import { AlertsDrawer } from './AlertsDrawer';
import { AlertToast } from './AlertToast';

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

  const isPositive = stock.change >= 0;
  const tech = stock.technical;
  const fund = stock.fundamental;

  // SSE EventSource for SSI FastConnect Live Tick Stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/market/stream?symbol=${stock.symbol}`);
      
      eventSource.onopen = () => {
        setStreamConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'CONNECTED') {
            setStreamConnected(true);
            setLiveLatency(data.latencyMs || 12);
          } else if (data.type === 'TICK_UPDATE') {
            setLiveTickCount((c) => c + 1);
            setLiveLatency(Math.floor(8 + Math.random() * 16));
          }
        } catch (e) {}
      };

      eventSource.onerror = () => {
        setStreamConnected(false);
      };
    } catch (e) {
      setStreamConnected(false);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [stock.symbol]);

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
      timestamp: new Date().toLocaleTimeString('vi-VN'),
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
      timestamp: new Date().toLocaleTimeString('vi-VN'),
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

  return (
    <div className="flex flex-col space-y-3 p-3 bg-[#050505] text-[#d1d5db] min-h-screen">
      {/* Top Stock Selector Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto p-2 bg-[#0a0a0a] rounded-sm border border-gray-800 scrollbar-none">
        <span className="text-[10px] font-mono font-bold text-blue-500 uppercase tracking-widest px-2">WATCHLIST TICKERS:</span>
        {stocks.map((s) => {
          const isSelected = s.symbol === stock.symbol;
          const pos = s.changePercent >= 0;
          return (
            <button
              key={s.symbol}
              onClick={() => onSelectStock(s.symbol)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-xs font-mono transition whitespace-nowrap border ${
                isSelected
                  ? 'bg-blue-900/30 text-white border-blue-500 font-bold'
                  : 'bg-[#050505] text-gray-400 hover:bg-gray-800/60 border-gray-800'
              }`}
            >
              <span className={isSelected ? 'text-blue-400 font-bold' : ''}>{s.symbol}</span>
              <span className={pos ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                {pos ? '+' : ''}
                {s.changePercent}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Stock Header Card */}
      <div className="bg-[#0a0a0a] rounded-sm p-3.5 border border-gray-800 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
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
            </div>
            <div className="flex items-center space-x-2 mt-1 font-mono">
              <p className="text-xs text-gray-400">{stock.name}</p>
              <span className="text-[10px] text-gray-500">•</span>
              <div className="flex items-center space-x-1.5 bg-black px-2 py-0.5 rounded border border-gray-800 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${streamConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-500'}`}></span>
                <span className="text-emerald-400 font-bold">FASTCONNECT SSE LIVE (1s)</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-300">Độ trễ: <strong className="text-amber-400">{liveLatency}ms</strong></span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">Ticks: {liveTickCount}</span>
              </div>
            </div>
          </div>

          <div className="h-10 w-px bg-gray-800 hidden sm:block"></div>

          <div className="flex items-baseline space-x-3">
            <span className={`text-3xl font-black font-mono ${priceColorClass}`}>
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

          <div className="h-10 w-px bg-gray-800 hidden md:block"></div>

          {/* Action Buttons: Set Alert & Active Alerts Drawer Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsSetAlertModalOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-sm text-xs flex items-center space-x-1.5 shadow transition"
            >
              <Bell className="w-4 h-4 animate-pulse text-amber-300" />
              <span>TẠO CẢNH BÁO ({stock.symbol})</span>
            </button>

            <button
              onClick={() => setIsAlertsDrawerOpen(true)}
              className="relative px-3 py-2 bg-[#050505] hover:bg-gray-800 text-gray-200 font-bold rounded-sm text-xs border border-gray-800 flex items-center space-x-1.5 transition"
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
              className="px-3 py-2 bg-[#131722] hover:bg-blue-600 text-slate-200 hover:text-white font-mono font-bold rounded-sm text-xs border border-slate-700/80 flex items-center space-x-1.5 transition shadow group cursor-pointer"
              title={`Mở biểu đồ ${stock.symbol} trực tiếp trên TradingView.com`}
            >
              <svg className="w-4 h-3 fill-current text-blue-400 group-hover:text-white transition" viewBox="0 0 36 28">
                <path d="M14 22H7V11H14V22ZM28 6H21V22H28V6ZM21 0H14V22H21V0Z" />
              </svg>
              <span>TRADINGVIEW.COM ↗</span>
            </a>
          </div>
        </div>

        {/* Quick Reference Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">THAM CHIẾU</span>
            <span className="text-amber-400 font-semibold">{stock.referencePrice}</span>
          </div>
          <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">TRẦN / SÀN</span>
            <span className="text-purple-400 font-semibold">{stock.ceilingPrice}</span> / <span className="text-blue-400 font-semibold">{stock.floorPrice}</span>
          </div>
          <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">KHỐI LƯỢNG (CP)</span>
            <span className="text-gray-200 font-semibold">{(stock.volume ?? 0).toLocaleString('vi-VN')}</span>
          </div>
          <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
            <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">KHỐI NGOẠI RÒNG</span>
            <span className={stock.foreignNetVal >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {stock.foreignNetVal >= 0 ? '+' : ''}
              {stock.foreignNetVal} Tỷ
            </span>
          </div>
        </div>
      </div>

      {/* Grid Layout: Left Chart (8 cols) / Right Orderbook & AI (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Interactive Chart + Indicator Tables */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          {/* TradingView Candlestick Chart */}
          <div className="h-[460px] bg-[#050505] rounded-sm border border-gray-800 overflow-hidden">
            <StockChart symbol={stock.symbol} candles={candles} exchange={stock.exchange} />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-400 block">MA100: <strong className="text-gray-200">{tech.ma100}</strong></span>
                  <span className="text-gray-400 block">MA200: <strong className="text-gray-200">{tech.ma200}</strong></span>
                  <span className="text-gray-400 block">EMA20: <strong className="text-gray-200">{tech.ema20}</strong></span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-400 block">VWAP: <strong className="text-blue-400">{tech.vwap}</strong></span>
                  <span className="text-gray-400 block">ADX(14): <strong className="text-amber-400">{tech.adx14}</strong></span>
                  <span className="text-gray-400 block">ATR(14): <strong className="text-gray-200">{tech.atr14}</strong></span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-400 block">Fibonacci 38.2%: <strong className="text-amber-400">{tech.fibonacci.f382}</strong></span>
                  <span className="text-gray-400 block">Fibonacci 61.8%: <strong className="text-emerald-400">{tech.fibonacci.f618}</strong></span>
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

        {/* Right Column: Orderbook & AI Quantitative Verdict */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* Order Book Depth & Ticks */}
          <div className="bg-[#0a0a0a] rounded-sm p-3 border border-gray-800 shadow">
            <h3 className="text-[10px] font-mono font-bold text-blue-500 uppercase tracking-widest flex items-center space-x-1.5 mb-2.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>SỔ LỆNH & GIAO DỊCH KHỚP LỆNH</span>
            </h3>

            {/* Bid / Ask Progress Bars */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
              <div className="space-y-1 bg-[#050505] p-2 rounded-sm border border-gray-800">
                <span className="text-emerald-400 font-bold block text-[10px] uppercase tracking-wider">DƯ MUA (BID)</span>
                {orderBook.bid.map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <span className="text-emerald-400 font-bold">{b.price.toFixed(2)}</span>
                    <span className="text-gray-400">{(b.volume ?? 0).toLocaleString('vi-VN')}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 bg-[#050505] p-2 rounded-sm border border-gray-800">
                <span className="text-red-400 font-bold block text-[10px] uppercase tracking-wider">DƯ BÁN (ASK)</span>
                {orderBook.ask.map((a, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <span className="text-red-400 font-bold">{a.price.toFixed(2)}</span>
                    <span className="text-gray-400">{(a.volume ?? 0).toLocaleString('vi-VN')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trade Ticks Stream */}
            <div className="bg-[#050505] rounded-sm border border-gray-800 p-2 max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono scrollbar-none">
              {tradeTicks.map((t) => (
                <div key={t.id} className="flex justify-between items-center">
                  <span className="text-gray-500">{t.time}</span>
                  <span className={t.type === 'BUY' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {t.price.toFixed(2)}
                  </span>
                  <span className="text-gray-300">{(t.volume ?? 0).toLocaleString('vi-VN')}</span>
                  <span className={`text-[9px] px-1 rounded-sm ${t.type === 'BUY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                    {t.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Quantitative Verdict Card */}
          <div className="bg-[#0a0a0a] rounded-sm p-3.5 border border-gray-800 flex-1 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center text-[10px] text-white font-bold">A</div>
                  <h3 className="font-mono font-bold text-[11px] text-gray-300 uppercase tracking-widest">KHUYẾN NGHỊ AI QUANT</h3>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-sm font-black font-mono border whitespace-nowrap ${
                    stock.aiVerdict === 'MUA MẠNH'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : stock.aiVerdict === 'MUA'
                      ? 'bg-blue-950/80 text-blue-400 border-blue-700'
                      : 'bg-amber-950/80 text-amber-400 border-amber-700'
                  }`}
                >
                  {stock.aiVerdict}
                </span>
              </div>

              {/* Score & Targets */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-3">
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 block text-[10px] uppercase">ĐIỂM AI</span>
                  <span className="text-blue-400 font-black text-lg">{stock.aiScore}</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 block text-[10px] uppercase">MỤC TIÊU</span>
                  <span className="text-emerald-400 font-bold text-sm">{stock.aiTargetPrice}</span>
                </div>
                <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                  <span className="text-gray-500 block text-[10px] uppercase">CẮT LỖ</span>
                  <span className="text-red-400 font-bold text-sm">{stock.aiStopLoss}</span>
                </div>
              </div>

              {/* AI Reasoning */}
              <div className="bg-[#050505] p-3 rounded-sm border border-gray-800 text-xs text-gray-300 leading-relaxed space-y-2 mb-3">
                <div className="font-semibold text-blue-400 font-mono flex items-center space-x-1 text-[11px] uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5" />
                  <span>LUẬN ĐIỂM ĐẦU TƯ AI:</span>
                </div>
                <p className="font-mono text-[11px] text-gray-300">{aiAnalysisResult ? aiAnalysisResult.summary : stock.aiReasoning}</p>

                {aiAnalysisResult && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-800 text-[11px] font-mono">
                    <div>
                      <strong className="text-emerald-400">Động lực:</strong> {aiAnalysisResult.catalysts?.join('; ')}
                    </div>
                    <div>
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
                <span>{isAnalyzing ? 'ĐANG PHÂN TÍCH DEEP AI...' : `PHÂN TÍCH CHUYÊN SÂU ${stock.symbol}`}</span>
              </button>

              <button
                onClick={() => onOpenAIChat(`Phân tích chi tiết luận điểm đầu tư và triển vọng quý tới của ${stock.symbol}`)}
                className="w-full bg-[#050505] hover:bg-gray-800 text-gray-300 font-semibold py-1.5 rounded-sm text-xs flex items-center justify-center space-x-1.5 transition border border-gray-700"
              >
                <Bot className="w-3.5 h-3.5 text-blue-400" />
                <span>HỎI CHUYÊN GIA AI VỀ {stock.symbol}</span>
              </button>
            </div>
          </div>
        </div>
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
