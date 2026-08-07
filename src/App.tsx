import React, { useEffect, useState } from 'react';
import { AIChatView } from './components/AIChatView';
import { ArchitectureView } from './components/ArchitectureView';
import { FearGreedGauge } from './components/FearGreedGauge';
import { FinancialReportView } from './components/FinancialReportView';
import { HeaderNav } from './components/HeaderNav';
import { HeatmapView } from './components/HeatmapView';
import { NewsAlertsView } from './components/NewsAlertsView';
import { PortfolioView } from './components/PortfolioView';
import { RecommendationView } from './components/RecommendationView';
import { TelegramSettingsModal } from './components/TelegramSettingsModal';
import { TerminalView } from './components/TerminalView';
import { WatchlistView } from './components/WatchlistView';
import { Candle, MarketIndex, OrderBook, StockData, TradeTick } from './types';

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

  // Helper to safely parse JSON response
  const safeParseJson = async (res: Response) => {
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return await res.json();
  };

  // Fetch initial market data & setup real-time polling interval
  const fetchData = async () => {
    try {
      const [stocksRes, indicesRes] = await Promise.all([fetch('/api/market/stocks'), fetch('/api/market/indices')]);
      const stocksData = await safeParseJson(stocksRes);
      const indicesData = await safeParseJson(indicesRes);

      if (Array.isArray(stocksData)) setStocks(stocksData);
      if (Array.isArray(indicesData)) setIndices(indicesData);
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  };

  const fetchStockDetail = async (symbol: string) => {
    try {
      const [stockRes, candleRes, obRes, ticksRes] = await Promise.all([
        fetch(`/api/market/stock/${symbol}`),
        fetch(`/api/market/candles/${symbol}`),
        fetch(`/api/market/orderbook/${symbol}`),
        fetch(`/api/market/ticks/${symbol}`),
      ]);

      const stockData = await safeParseJson(stockRes);
      const candleData = await safeParseJson(candleRes);
      const obData = await safeParseJson(obRes);
      const ticksData = await safeParseJson(ticksRes);

      if (stockData) {
        setCurrentStock(stockData);
        if (Array.isArray(candleData)) setCandles(candleData);
        if (obData) setOrderBook(obData);
        if (Array.isArray(ticksData)) setTradeTicks(ticksData);

        // Merge newly fetched dynamic stock into stocks list if missing
        setStocks((prev) => {
          if (!prev.some((s) => s.symbol === stockData.symbol)) {
            return [stockData, ...prev];
          }
          return prev.map((s) => (s.symbol === stockData.symbol ? stockData : s));
        });
      }
    } catch (err) {
      console.error('Stock detail fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000); // Poll market tick updates every 8s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedStockSymbol) {
      fetchStockDetail(selectedStockSymbol);
    }
  }, [selectedStockSymbol]);

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
    <div className="min-h-screen bg-[#050505] text-[#d1d5db] font-sans selection:bg-blue-600 selection:text-white flex flex-col justify-between">
      <div>
        <HeaderNav
          indices={indices}
          stocks={stocks}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSelectStock={handleSelectStock}
          selectedStockSymbol={selectedStockSymbol}
          onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
        />

        <TelegramSettingsModal
          isOpen={isTelegramModalOpen}
          onClose={() => setIsTelegramModalOpen(false)}
        />

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
      </div>

      {/* Geometric Balance Footer Status */}
      <footer className="h-9 border-t border-gray-800 bg-[#0a0a0a] flex items-center px-4 justify-between text-[10px] font-mono sticky bottom-0 z-40">
        <div className="flex items-center space-x-4 text-gray-500">
          <span>CPU: <strong className="text-gray-300">24%</strong></span>
          <span>LATENCY: <strong className="text-gray-300">42ms</strong></span>
          <span className="text-blue-400 italic uppercase hidden md:inline">Agent: Active</span>
        </div>

        {/* Real-time Market Fear & Greed Sentiment Gauge */}
        <FearGreedGauge stocks={stocks} indices={indices} tradeTicks={tradeTicks} />

        <div className="flex items-center space-x-4">
          <span className="text-emerald-400 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="hidden sm:inline">Real-time Feed Active</span>
          </span>
          <span className="text-gray-500 hidden sm:inline">System: OK-200</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
