import { ArrowDown, ArrowUp, BarChart3, DollarSign, Globe, Layers, TrendingUp, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MacroData, SectorData, StockData } from '../types';

interface HeatmapViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export const HeatmapView: React.FC<HeatmapViewProps> = ({ stocks, onSelectStock }) => {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [macro, setMacro] = useState<MacroData | null>(null);

  useEffect(() => {
    fetch('/api/market/sectors')
      .then((res) => res.json())
      .then((data) => setSectors(data));

    fetch('/api/market/macro')
      .then((res) => res.json())
      .then((data) => setMacro(data));
  }, []);

  const sortedByChange = [...stocks].sort((a, b) => b.changePercent - a.changePercent);
  const topGainers = sortedByChange.slice(0, 5);
  const topLosers = [...sortedByChange].reverse().slice(0, 5);
  const topVolume = [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const topForeign = [...stocks].sort((a, b) => b.foreignNetVal - a.foreignNetVal).slice(0, 5);

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4 font-mono">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white">MARKET HEATMAP & TỔNG QUAN VĨ MÔ</h2>
            <p className="text-xs text-gray-400 font-mono">Bản đồ nhiệt vốn hóa, đà tăng giảm theo ngành, tỷ giá USD/VND & chỉ số vĩ mô NHNN</p>
          </div>
        </div>
      </div>

      {/* Macro Indicators Bar */}
      {macro && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
            <span className="text-gray-500 text-[10px] uppercase block">TỶ GIÁ USD/VND</span>
            <span className="text-blue-400 font-black text-base">{(macro.usdVnd ?? 0).toLocaleString('vi-VN')}</span>
            <span className="text-emerald-400 text-[10px] block">{macro.usdVndChange} VNĐ</span>
          </div>

          <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
            <span className="text-gray-500 text-[10px] uppercase block">DXY INDEX</span>
            <span className="text-blue-400 font-black text-base">{macro.dxy}</span>
            <span className="text-emerald-400 text-[10px] block">{macro.dxyChange}%</span>
          </div>

          <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
            <span className="text-gray-500 text-[10px] uppercase block">LÃI SUẤT ĐIỀU HÀNH NHNN</span>
            <span className="text-emerald-400 font-black text-base">{macro.sbvInterestRate}%</span>
            <span className="text-gray-500 text-[10px] block">Hỗ trợ thanh khoản</span>
          </div>

          <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
            <span className="text-gray-500 text-[10px] uppercase block">GIÁ VÀNG SJC</span>
            <span className="text-blue-400 font-black text-base">{macro.goldPriceVnd} Triệu</span>
            <span className="text-emerald-400 text-[10px] block">+{macro.goldPriceChange} Triệu/lượng</span>
          </div>

          <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
            <span className="text-gray-500 text-[10px] uppercase block">DẦU BRENT</span>
            <span className="text-gray-100 font-black text-base">${macro.brentOilPrice}</span>
            <span className="text-emerald-400 text-[10px] block">+{macro.brentOilChange}%</span>
          </div>

          <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
            <span className="text-gray-500 text-[10px] uppercase block">TĂNG TRƯỞNG GDP</span>
            <span className="text-emerald-400 font-black text-base">{macro.gdpGrowth}%</span>
            <span className="text-gray-500 text-[10px] block">CPI Lạm phát {macro.inflation}%</span>
          </div>
        </div>
      )}

      {/* Main Stock Heatmap Bento Grid */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 space-y-3 shadow-xl">
        <h3 className="font-mono font-bold text-xs text-gray-300 flex items-center space-x-2 uppercase tracking-wider">
          <Zap className="w-4 h-4 text-blue-400" />
          <span>BẢN ĐỒ NHIỆT THEO VỐN HÓA & BIẾN ĐỘNG GIÁ</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 font-mono text-xs">
          {stocks.map((stk) => {
            const isPos = stk.changePercent >= 0;
            const sizeClass = stk.fundamental.marketCap > 100000 ? 'col-span-2 row-span-2 p-4' : 'col-span-1 p-2.5';

            return (
              <div
                key={stk.symbol}
                onClick={() => onSelectStock(stk.symbol)}
                className={`${sizeClass} rounded-sm border cursor-pointer transition shadow flex flex-col justify-between ${
                  isPos
                    ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-800/80 text-emerald-300'
                    : 'bg-red-950/80 hover:bg-red-900 border-red-800/80 text-red-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-white">{stk.symbol}</span>
                    <span className="text-[10px] opacity-75">{stk.exchange}</span>
                  </div>
                  <span className="text-[10px] block opacity-80 truncate">{stk.sector}</span>
                </div>

                <div className="mt-2 text-right">
                  <span className="font-bold block text-sm">{stk.price}</span>
                  <span className="text-[11px] font-bold">
                    {isPos ? '+' : ''}
                    {stk.changePercent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sector Performance Bar Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sector Table */}
        <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 space-y-3 shadow-xl">
          <h3 className="font-mono font-bold text-xs text-gray-300 flex items-center space-x-2 border-b border-gray-800 pb-2 uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>HIỆU SUẤT CÁC NGÀNH NGHỀ TRÊN THỊ TRƯỜNG</span>
          </h3>

          <div className="space-y-2 text-xs font-mono">
            {sectors.map((sec, idx) => (
              <div key={idx} className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-200">{sec.name}</span>
                  <span className="text-gray-500 text-[10px] block">Top Gainer: {sec.topGainer}</span>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm ${sec.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {sec.changePercent >= 0 ? '+' : ''}
                    {sec.changePercent}%
                  </span>
                  <span className="text-gray-400 text-[10px] block">GTGD: {sec.totalValue} Tỷ</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboards */}
        <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 space-y-3 shadow-xl font-mono text-xs">
          <h3 className="font-bold text-xs text-blue-400 flex items-center space-x-2 border-b border-gray-800 pb-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>TOP CỔ PHIẾU BỨT PHÁ TRONG PHIÊN</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 space-y-1.5">
              <span className="text-emerald-400 font-bold block text-[11px] uppercase">TOP TĂNG GIÁ</span>
              {topGainers.map((s) => (
                <div key={s.symbol} onClick={() => onSelectStock(s.symbol)} className="flex justify-between items-center cursor-pointer hover:bg-gray-900 p-1 rounded-sm transition">
                  <span className="font-bold text-white">{s.symbol}</span>
                  <span className="text-emerald-400 font-bold">+{s.changePercent}%</span>
                </div>
              ))}
            </div>

            <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 space-y-1.5">
              <span className="text-blue-400 font-bold block text-[11px] uppercase">TOP KHỐI NGOẠI MUA</span>
              {topForeign.map((s) => (
                <div key={s.symbol} onClick={() => onSelectStock(s.symbol)} className="flex justify-between items-center cursor-pointer hover:bg-gray-900 p-1 rounded-sm transition">
                  <span className="font-bold text-white">{s.symbol}</span>
                  <span className="text-blue-400 font-bold">+{s.foreignNetVal} Tỷ</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
