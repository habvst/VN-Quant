import { Activity, Bot, ChevronDown, Cpu, Eye, FileText, LayoutDashboard, LineChart, Newspaper, PieChart, RefreshCw, Search, Send, ShieldAlert, Zap } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { MarketIndex, StockData } from '../types';

interface HeaderNavProps {
  indices: MarketIndex[];
  stocks: StockData[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSelectStock: (symbol: string) => void;
  selectedStockSymbol: string;
  onOpenTelegramModal?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  indices,
  stocks,
  activeTab,
  setActiveTab,
  onSelectStock,
  selectedStockSymbol,
  onOpenTelegramModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes countdown (300 seconds)
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [lastUpdated, setLastUpdated] = useState<string>(() =>
    new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setLastUpdated(
            new Date().toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          );
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredStocks = searchQuery.trim()
    ? stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.sector.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : stocks;

  const currentStock = stocks.find((s) => s.symbol === selectedStockSymbol);

  const topPillSymbols = ['HPG', 'FPT', 'VNM', 'MBB', 'SSI', 'TCB', 'MWG', 'VHM', 'VIC', 'STB'];

  const navItems = [
    { id: 'terminal', label: 'Terminal TradingView', icon: LineChart, badge: null },
    { id: 'recommendations', label: 'Khuyến Nghị AI', icon: Zap, badge: 'HOT' },
    { id: 'ai-chat', label: 'Chuyên Gia AI', icon: Bot, badge: 'AI' },
    { id: 'watchlist', label: 'Danh Mục Theo Dõi', icon: Eye, badge: null },
    { id: 'portfolio', label: 'Danh Mục & Rủi Ro', icon: PieChart, badge: null },
    { id: 'heatmap', label: 'Heatmap & Ngành', icon: LayoutDashboard, badge: null },
    { id: 'financials', label: 'Báo Cáo Tài Chính', icon: FileText, badge: null },
    { id: 'news', label: 'Tin Tức & Radar', icon: Newspaper, badge: null },
    { id: 'architecture', label: 'Kiến Trúc System', icon: Cpu, badge: 'ENTERPRISE' },
  ];

  return (
    <header className="bg-[#0a0a0a] border-b border-gray-800 text-[#d1d5db] sticky top-0 z-50 shadow-2xl">
      {/* Top Real-time Ticker Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] text-xs border-b border-gray-800 overflow-x-auto whitespace-nowrap scrollbar-none">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-1.5 bg-blue-950/60 text-blue-400 px-2 py-0.5 rounded-sm border border-blue-800/60 text-[10px] font-mono font-bold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>LIVE MARKET FEED</span>
          </div>

          <div className="flex items-center space-x-6 font-mono text-[11px]">
            {indices.map((idx) => {
              const isPositive = idx.change >= 0;
              return (
                <div key={idx.symbol} className="flex items-center space-x-1.5">
                  <span className="font-bold text-gray-400 text-[10px] uppercase">{idx.name}:</span>
                  <span className={isPositive ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {(idx.price ?? 0).toLocaleString('vi-VN')}
                  </span>
                  <span className={`text-[10px] ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? '▲' : '▼'} {Math.abs(idx.changePercent)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden lg:flex items-center space-x-1.5 text-gray-400 text-[10px] font-mono bg-[#0a0a0a] px-2 py-0.5 rounded-sm border border-gray-800">
            <span className="text-gray-500">Cập nhật lúc:</span>
            <span className="text-emerald-400 font-bold">{lastUpdated}</span>
          </div>

          <div className="flex items-center space-x-1.5 text-gray-500 text-[10px] font-mono">
            <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
            <span>AI Refresh:</span>
            <span className="font-mono text-blue-400 font-bold">{formatTime(countdown)}</span>
          </div>

          {/* Telegram Settings Modal Opener */}
          {onOpenTelegramModal && (
            <button
              onClick={onOpenTelegramModal}
              className="flex items-center space-x-1 bg-gradient-to-r from-blue-950 to-indigo-950 hover:from-blue-900 hover:to-indigo-900 text-blue-300 hover:text-white px-2 py-0.5 rounded border border-blue-700/80 text-[10px] font-mono font-bold transition shadow-sm cursor-pointer group"
              title="Cấu hình Telegram Bot tự động gửi cảnh báo"
            >
              <Send className="w-3 h-3 text-blue-400 group-hover:text-emerald-400 transition" />
              <span>CẤU HÌNH TELEGRAM BOT ✈️</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Row */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 gap-2">
        <div className="flex items-center space-x-3">
          {/* Logo */}
          <div className="flex items-center space-x-2 cursor-pointer shrink-0" onClick={() => setActiveTab('terminal')}>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-bold text-blue-400 tracking-tighter font-mono">VIETCAP AI</span>
              <span className="text-[13px] font-mono font-bold text-white uppercase tracking-tight">TERMINAL v5.5</span>
            </div>
          </div>

          <div className="h-7 w-px bg-gray-800 hidden sm:block"></div>

          {/* HIGH VISIBILITY PROMINENT STOCK SEARCH BAR */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="flex items-center space-x-3 bg-gradient-to-r from-[#0f172a] to-[#1e293b] hover:from-[#1e293b] hover:to-[#334155] text-white px-3 py-1.5 rounded-md border-2 border-blue-500/80 shadow-lg shadow-blue-950/50 transition cursor-pointer group"
            >
              <div className="p-1 rounded bg-blue-600 text-white shadow-sm group-hover:scale-105 transition">
                <Search className="w-4 h-4" />
              </div>

              <div className="flex flex-col text-left">
                <span className="text-[9px] text-blue-300 font-mono font-semibold uppercase tracking-wider">CỔ PHIẾU ĐANG CHỌN</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-base text-amber-400">{selectedStockSymbol}</span>
                  {currentStock && (
                    <span className={`text-xs font-mono font-bold ${currentStock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {currentStock.price} ({currentStock.changePercent >= 0 ? '+' : ''}{currentStock.changePercent}%)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1.5 bg-gray-900/90 text-gray-300 px-2 py-1 rounded border border-gray-700 text-xs font-mono ml-2">
                <span className="hidden md:inline font-semibold text-blue-400">Đổi mã</span>
                <kbd className="bg-gray-800 text-blue-300 font-bold px-1 rounded text-[10px]">Ctrl+K</kbd>
                <ChevronDown className={`w-3.5 h-3.5 text-blue-400 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Quick Search Dropdown Modal */}
            {isSearchOpen && (
              <div className="absolute left-0 top-12 w-88 bg-[#0a0f1d] border-2 border-blue-500/70 rounded-lg shadow-2xl p-3 z-50 backdrop-blur-xl animate-in fade-in duration-150">
                {/* Search Input Box */}
                <div className="flex items-center space-x-2 bg-[#050811] px-3 py-2 rounded-md border border-blue-500/50 mb-2 focus-within:ring-2 focus-within:ring-blue-500">
                  <Search className="w-4 h-4 text-blue-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Nhập mã CP (CEO, DIG, HPG, FPT...)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        const targetSym = searchQuery.trim().toUpperCase();
                        onSelectStock(targetSym);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }
                    }}
                    className="bg-transparent text-gray-100 placeholder-gray-500 text-xs outline-none w-full font-mono font-bold uppercase"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white text-xs font-mono">
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick Dynamic Fetch Card for custom queried symbol */}
                {searchQuery.trim() && (
                  <div
                    onClick={() => {
                      const targetSym = searchQuery.trim().toUpperCase();
                      onSelectStock(targetSym);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="p-2.5 mb-2 rounded-md bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 hover:from-blue-900 hover:to-indigo-900 border-2 border-amber-500/80 text-white cursor-pointer transition text-xs flex items-center justify-between font-mono shadow-xl group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded bg-amber-500 text-black font-black shadow-md">
                        <Search className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">TẢI MÃ THỰC TẾ TỪ SÀN</div>
                        <div className="text-xs font-bold text-white">
                          Tra cứu mã: <span className="text-amber-400 font-black text-sm">{searchQuery.trim().toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    <span className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded font-black text-[10px] uppercase tracking-wider group-hover:scale-105 transition shadow-sm">
                      Bấm hoặc Enter ↵
                    </span>
                  </div>
                )}

                {/* Popular Stock Quick Pills */}
                <div className="mb-2.5">
                  <div className="text-[10px] font-mono text-gray-400 mb-1 font-semibold uppercase">Mã phổ biến:</div>
                  <div className="flex flex-wrap gap-1">
                    {topPillSymbols.map((sym) => {
                      const st = stocks.find((s) => s.symbol === sym);
                      const isSel = sym === selectedStockSymbol;
                      return (
                        <button
                          key={sym}
                          onClick={() => {
                            onSelectStock(sym);
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                              : 'bg-gray-900 text-gray-300 hover:text-white hover:bg-blue-900/50 border-gray-800'
                          }`}
                        >
                          {sym}
                          {st && (
                            <span className={`ml-1 text-[9px] ${st.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {st.changePercent >= 0 ? '▲' : '▼'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stock List Items */}
                <div className="text-[10px] font-mono text-gray-400 mb-1 font-semibold uppercase flex justify-between border-t border-gray-800 pt-2">
                  <span>Tất cả mã ({filteredStocks.length})</span>
                  <span>Giá / Thay đổi</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredStocks.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-xs font-mono">Không tìm thấy mã cổ phiếu phù hợp</div>
                  ) : (
                    filteredStocks.map((stk) => {
                      const isSel = stk.symbol === selectedStockSymbol;
                      return (
                        <div
                          key={stk.symbol}
                          onClick={() => {
                            onSelectStock(stk.symbol);
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition text-xs border ${
                            isSel
                              ? 'bg-blue-950/80 border-blue-500 text-white font-semibold'
                              : 'hover:bg-gray-800/80 border-transparent hover:border-gray-700 text-gray-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-black text-amber-400 text-sm">{stk.symbol}</span>
                              <span className="text-gray-400 text-[10px] bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 font-mono">
                                {stk.exchange || 'HOSE'} • {stk.sector}
                              </span>
                            </div>
                            <div className="text-gray-400 text-[10px] truncate max-w-[200px] mt-0.5">{stk.name}</div>
                          </div>
                          <div className="text-right font-mono shrink-0 ml-2">
                            <div className="text-white font-bold">{stk.price}</div>
                            <div
                              className={`text-[10px] font-semibold ${stk.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                            >
                              {stk.changePercent >= 0 ? '+' : ''}
                              {stk.changePercent}%
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav Tabs */}
        <nav className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm text-xs font-mono transition whitespace-nowrap border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white bg-[#050505] border-gray-800 hover:border-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded-sm font-bold uppercase font-mono ${
                      item.badge === 'HOT'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : item.badge === 'AI'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

