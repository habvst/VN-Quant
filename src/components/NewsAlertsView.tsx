import { AlertCircle, Bell, Clock, ExternalLink, Globe, Newspaper, Radio, ShieldAlert, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { NewsItem, StockData } from '../types';

interface NewsAlertsViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export const NewsAlertsView: React.FC<NewsAlertsViewProps> = ({ stocks, onSelectStock }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filterSentiment, setFilterSentiment] = useState<string>('ALL');

  useEffect(() => {
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
      .catch((err) => console.error('Failed to fetch news:', err));
  }, []);

  const getNormalizedSentiment = (sentiment: string) => {
    if (sentiment === 'POSITIVE' || sentiment === 'TÍCH CỰC') return 'TÍCH CỰC';
    if (sentiment === 'NEGATIVE' || sentiment === 'TIÊU CỰC') return 'TIÊU CỰC';
    return 'TRUNG TÍNH';
  };

  const filteredNews = news.filter((n) => {
    if (filterSentiment === 'ALL') return true;
    return getNormalizedSentiment(n.sentiment) === filterSentiment;
  });

  // Generate dynamic technical alerts from stocks
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
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white">RADAR TÍN HIỆU & TIN TỨC THỜI GIAN THỰC</h2>
            <p className="text-xs text-gray-400 font-mono">Tổng hợp tin tức CafeF, Vietstock & Cảnh báo bứt phá kỹ thuật tự động</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 cols: Real-Time News Feed */}
        <div className="lg:col-span-7 bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 font-mono text-xs shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 flex-wrap gap-2">
            <h3 className="font-bold text-gray-200 flex items-center space-x-2 uppercase tracking-wider">
              <Newspaper className="w-4 h-4 text-emerald-400" />
              <span>DÒNG TIN TỨC CHỨNG KHOÁN (AI SENTIMENT TAGGED)</span>
            </h3>

            {/* Sentiment Filter */}
            <div className="flex items-center space-x-1">
              {(['ALL', 'TÍCH CỰC', 'TIÊU CỰC', 'TRUNG TÍNH'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSentiment(s)}
                  className={`px-2 py-0.5 rounded-sm text-[10px] transition font-mono ${
                    filterSentiment === s ? 'bg-blue-600 text-white font-bold' : 'bg-[#050505] text-gray-400 border border-gray-800 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-[650px] overflow-y-auto scrollbar-none">
            {filteredNews.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-mono">Không tìm thấy tin tức theo phân loại này</div>
            ) : (
              filteredNews.map((n, idx) => {
                const normSentiment = getNormalizedSentiment(n.sentiment);
                return (
                  <div key={`${n.id}-${idx}`} className="bg-[#050505] p-3.5 rounded-sm border border-gray-800 hover:border-gray-700 transition space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      {/* Title opens article link or live search in new tab */}
                      <a
                        href={
                          n.url && n.url !== '#' && n.url.startsWith('http')
                            ? n.url
                            : `https://www.google.com/search?q=${encodeURIComponent(n.title + ' ' + (n.source || ''))}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-bold text-sm leading-snug hover:underline flex items-start space-x-1 group"
                        title="Bấm để đọc bài viết / tra cứu tin tức gốc trên tab mới"
                      >
                        <span>{n.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400 opacity-70 group-hover:opacity-100 shrink-0 inline mt-0.5 ml-1" />
                      </a>

                      {/* Sentiment Badge */}
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-sm font-bold border shrink-0 ${
                          normSentiment === 'TÍCH CỰC'
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                            : normSentiment === 'TIÊU CỰC'
                            ? 'bg-red-950/80 text-red-400 border-red-800/80'
                            : 'bg-[#0a0a0a] text-gray-400 border-gray-800'
                        }`}
                      >
                        {normSentiment}
                      </span>
                    </div>

                    <p className="text-gray-300 text-[11px] leading-relaxed font-mono">{n.summary}</p>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-800/60 flex-wrap gap-2">
                      {/* Left: Source & Publication Time */}
                      <div className="flex items-center space-x-3">
                        <span>Nguồn: <strong className="text-gray-200">{n.source}</strong></span>
                        <span className="flex items-center space-x-1 text-gray-400">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span>Thời gian đăng: <strong className="text-gray-200">{n.time || n.timestamp || 'Vừa xong'}</strong></span>
                        </span>
                      </div>

                      {/* Right: Impacted Stock Tickers (Phía dưới bên phải bài viết) */}
                      <div className="flex items-center space-x-1.5 ml-auto">
                        <span className="text-gray-400 font-semibold text-[10px]">Mã ảnh hưởng:</span>
                        {(n.symbols && n.symbols.length > 0 ? n.symbols : ['VNINDEX', 'VN30']).map((sym) => (
                          <button
                            key={sym}
                            onClick={(e) => {
                              e.preventDefault();
                              onSelectStock(sym);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-950/90 text-blue-300 border border-blue-700/80 hover:bg-blue-600 hover:text-white transition shadow-sm"
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

        {/* Right 5 cols: Technical Radar Alerts Stream */}
        <div className="lg:col-span-5 bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 font-mono text-xs shadow-xl">
          <h3 className="font-bold text-blue-400 flex items-center space-x-2 border-b border-gray-800 pb-2 uppercase tracking-wider">
            <Bell className="w-4 h-4" />
            <span>CẢNH BÁO TÍN HIỆU KỸ THUẬT SÓNG CP</span>
          </h3>

          <div className="space-y-2.5 max-h-[650px] overflow-y-auto scrollbar-none">
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
  );
};

