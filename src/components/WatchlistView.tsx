import { ArrowDown, ArrowUp, ChevronRight, Eye, Plus, Search, Trash2, Zap } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { StockData, WatchlistItem } from '../types';

interface WatchlistViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ stocks, onSelectStock }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    { symbol: 'HPG', addedAt: '2026-08-01', targetPrice: 34.5, stopLoss: 26.2, note: 'Tăng trưởng công suất Dung Quất 2' },
    { symbol: 'FPT', addedAt: '2026-08-01', targetPrice: 160.0, stopLoss: 124.0, note: 'Hợp đồng AI chip bán dẫn Nhật Bản' },
    { symbol: 'STB', addedAt: '2026-08-02', targetPrice: 38.5, stopLoss: 29.0, note: 'Đấu giá cổ phần VAMC' },
    { symbol: 'MBB', addedAt: '2026-08-02', targetPrice: 30.0, stopLoss: 22.5, note: 'ROE 21.5% P/B 1.15x' },
    { symbol: 'DGC', addedAt: '2026-08-03', targetPrice: 135.0, stopLoss: 102.0, note: 'Giá P4 hóa chất bùng nổ' },
    { symbol: 'FRT', addedAt: '2026-08-03', targetPrice: 210.0, stopLoss: 162.0, note: 'Chuỗi Long Châu bá chủ' },
  ]);

  const [newSymbol, setNewSymbol] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const tableParentRef = useRef<HTMLDivElement>(null);

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
    estimateSize: () => 52,
    overscan: 5,
  });

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white">DANH MỤC CỔ PHIẾU THEO DÕI (WATCHLIST)</h2>
            <p className="text-xs text-gray-400 font-mono">Theo dõi biến động giá real-time, chỉ báo kỹ thuật RSI/MACD và tín hiệu AI</p>
          </div>
        </div>

        {/* Add Stock Bar */}
        <div className="flex items-center space-x-2 bg-[#050505] p-1.5 rounded-sm border border-gray-800">
          <input
            type="text"
            placeholder="Nhập mã CP (e.g. VNM, SSI)..."
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStock()}
            className="bg-transparent text-gray-100 text-xs font-mono outline-none px-2 w-48 placeholder-gray-500 uppercase"
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

      {/* Watchlist Table with Virtual Scroll Engine (@tanstack/react-virtual) */}
      <div ref={tableParentRef} className="bg-[#0a0a0a] rounded-sm border border-gray-800 overflow-x-auto shadow-xl max-h-[650px] overflow-y-auto">
        <table className="w-full text-xs font-mono text-left min-w-[950px]">
          <thead className="bg-[#050505] text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-md whitespace-nowrap">
            <tr>
              <th className="p-3 bg-[#050505]">Mã CP</th>
              <th className="p-3 bg-[#050505]">Sàn / Ngành</th>
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

              return (
                <tr key={stk.symbol} className="hover:bg-gray-900/50 transition whitespace-nowrap">
                  <td className="p-3 font-bold text-white">
                    <button onClick={() => onSelectStock(stk.symbol)} className="hover:text-blue-400 flex items-center space-x-1 transition">
                      <span>{stk.symbol}</span>
                    </button>
                    <span className="block text-[10px] text-gray-400 font-normal truncate max-w-[120px]">{stk.name}</span>
                  </td>
                  <td className="p-3">
                    <span className="bg-[#050505] text-gray-300 px-1.5 py-0.5 rounded-sm text-[10px] border border-gray-800 mr-1 inline-block whitespace-nowrap">{stk.exchange}</span>
                    <span className="text-gray-400 text-[11px] inline-block whitespace-nowrap">{stk.sector}</span>
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
    </div>
  );
};
