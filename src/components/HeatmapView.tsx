import { ArrowDown, ArrowUp, BarChart3, DollarSign, Globe, Layers, Compass, RefreshCw, ShieldAlert, TrendingUp, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MacroData, SectorData, StockData } from '../types';

interface HeatmapViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export interface SectorRotationItem {
  id: string;
  name: string;
  code: string;
  rsRatio: number; // Relative Strength Index vs VNIndex (Base = 100)
  rsMomentum: number; // Momentum Rate of Change (Base = 100)
  netFlow5D: number; // Tỷ VNĐ
  changePercent: number;
  leadingStocks: string[];
  recommendation: 'TĂNG TỶ TRỌNG (OVERWEIGHT)' | 'THEO DÕI (WATCHLIST)' | 'GIẢM TỶ TRỌNG (UNDERWEIGHT)' | 'BÁN CHỐT LỜI';
  quadrant: 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING';
}

export const HeatmapView: React.FC<HeatmapViewProps> = ({ stocks, onSelectStock }) => {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [activeTab, setActiveTab] = useState<'HEATMAP' | 'ROTATION_MATRIX'>('HEATMAP');

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

  // VNSector Rotation Matrix Data Engine
  const sectorRotations: SectorRotationItem[] = [
    {
      id: 'sec-1',
      name: 'Chứng khoán & Ngân hàng',
      code: 'FINANCE',
      rsRatio: 106.8,
      rsMomentum: 104.2,
      netFlow5D: 2450,
      changePercent: 2.15,
      leadingStocks: ['SSI', 'MBB', 'TCB', 'VIX'],
      recommendation: 'TĂNG TỶ TRỌNG (OVERWEIGHT)',
      quadrant: 'LEADING',
    },
    {
      id: 'sec-2',
      name: 'Thép & Vật liệu Xây dựng',
      code: 'STEEL',
      rsRatio: 103.5,
      rsMomentum: 102.8,
      netFlow5D: 1280,
      changePercent: 1.85,
      leadingStocks: ['HPG', 'NKG', 'HSG'],
      recommendation: 'TĂNG TỶ TRỌNG (OVERWEIGHT)',
      quadrant: 'LEADING',
    },
    {
      id: 'sec-3',
      name: 'Công nghệ & Viễn thông',
      code: 'TECH',
      rsRatio: 102.1,
      rsMomentum: 98.5,
      netFlow5D: 820,
      changePercent: 0.95,
      leadingStocks: ['FPT', 'CMG', 'FOX'],
      recommendation: 'THEO DÕI (WATCHLIST)',
      quadrant: 'IMPROVING',
    },
    {
      id: 'sec-4',
      name: 'Bán lẻ & Tiêu dùng',
      code: 'RETAIL',
      rsRatio: 99.2,
      rsMomentum: 103.1,
      netFlow5D: 640,
      changePercent: 0.45,
      leadingStocks: ['MWG', 'FRT', 'MSN'],
      recommendation: 'THEO DÕI (WATCHLIST)',
      quadrant: 'IMPROVING',
    },
    {
      id: 'sec-5',
      name: 'Bất động sản Dân dụng',
      code: 'REALESTATE',
      rsRatio: 96.5,
      rsMomentum: 101.4,
      netFlow5D: -420,
      changePercent: -0.65,
      leadingStocks: ['KDH', 'NLG', 'DXG'],
      recommendation: 'GIẢM TỶ TRỌNG (UNDERWEIGHT)',
      quadrant: 'WEAKENING',
    },
    {
      id: 'sec-6',
      name: 'Hóa chất & Phân bón',
      code: 'CHEMICAL',
      rsRatio: 97.8,
      rsMomentum: 97.2,
      netFlow5D: -180,
      changePercent: -0.85,
      leadingStocks: ['DGC', 'DCM', 'DPM'],
      recommendation: 'GIẢM TỶ TRỌNG (UNDERWEIGHT)',
      quadrant: 'WEAKENING',
    },
    {
      id: 'sec-7',
      name: 'Dầu khí & Năng lượng',
      code: 'OILGAS',
      rsRatio: 94.2,
      rsMomentum: 95.1,
      netFlow5D: -850,
      changePercent: -1.45,
      leadingStocks: ['PVD', 'PVS', 'GAS'],
      recommendation: 'GIẢM TỶ TRỌNG (UNDERWEIGHT)',
      quadrant: 'LAGGING',
    },
    {
      id: 'sec-8',
      name: 'Điện nước & Hạ tầng',
      code: 'UTILITIES',
      rsRatio: 92.8,
      rsMomentum: 94.0,
      netFlow5D: -310,
      changePercent: -1.10,
      leadingStocks: ['POW', 'REE', 'NT2'],
      recommendation: 'GIẢM TỶ TRỌNG (UNDERWEIGHT)',
      quadrant: 'LAGGING',
    },
  ];

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4 font-mono">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white">BẢN ĐỒ NHIỆT & MA TRẬN DÒNG TIỀN LUÂN CHUYỂN NGÀNH</h2>
            <p className="text-xs text-gray-400 font-mono">Xác định Ngành Dẫn Dắt (Leading Sector), Ma trận RRG dòng tiền ròng & Tỷ giá/Vĩ mô</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-[#050505] border border-gray-800 rounded p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('HEATMAP')}
            className={`px-3 py-1.5 rounded transition flex items-center space-x-1.5 ${
              activeTab === 'HEATMAP' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>BẢN ĐỒ NHIỆT VỐN HÓA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ROTATION_MATRIX')}
            className={`px-3 py-1.5 rounded transition flex items-center space-x-1.5 ${
              activeTab === 'ROTATION_MATRIX' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>MA TRẬN DÒNG TIỀN NGÀNH (RRG)</span>
          </button>
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

      {/* VIEW 1: HEATMAP */}
      {activeTab === 'HEATMAP' && (
        <>
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
        </>
      )}

      {/* VIEW 2: VNSECTOR ROTATION MATRIX (RRG) */}
      {activeTab === 'ROTATION_MATRIX' && (
        <div className="space-y-4 font-mono text-xs">
          {/* Top Explanation Banner */}
          <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-sm p-3.5 text-xs text-emerald-200 shadow-xl space-y-1">
            <div className="flex items-center space-x-2 font-bold text-emerald-400">
              <Compass className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wider font-black">MA TRẬN VNSECTOR ROTATION (RRG MATRIX) - DÒNG TIỀN LUÂN CHUYỂN</span>
            </div>
            <p className="text-[11px] text-emerald-100/90 leading-relaxed">
              Mô hình RRG đo lường Sức mạnh tương đối (RS-Ratio) & Tốc độ gia tăng dòng tiền (RS-Momentum) so với VN-Index. Ngành nằm ở góc <strong>DẪN DẮT (Leading)</strong> thu hút dòng tiền lớn nhất và dẫn dắt xu hướng thị trường.
            </p>
          </div>

          {/* 4 Quadrants Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* QUADRANT 1: LEADING (DẪN DẮT) */}
            <div className="bg-[#0a0a0a] border-2 border-emerald-600/80 rounded-sm p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h4 className="font-black text-sm text-emerald-400 uppercase">1. DẪN DẮT (LEADING SECTOR)</h4>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded font-bold">
                  RS & Momentum &gt; 100
                </span>
              </div>
              <p className="text-[11px] text-gray-400 italic">Dòng tiền tập trung mạnh nhất. Khuyến nghị tăng tỷ trọng đầu tư tối đa (Overweight).</p>

              <div className="space-y-2.5 pt-1">
                {sectorRotations
                  .filter((s) => s.quadrant === 'LEADING')
                  .map((sec) => (
                    <div key={sec.id} className="bg-[#050505] p-3 rounded-sm border border-emerald-900/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{sec.name}</span>
                        <span className="text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 text-[10px]">
                          +{sec.changePercent}% (Dòng tiền ròng: +{sec.netFlow5D} Tỷ)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-gray-400 text-[10px]">Cổ phiếu dẫn dắt:</span>
                        {sec.leadingStocks.map((stk) => (
                          <button
                            key={stk}
                            onClick={() => onSelectStock(stk)}
                            className="bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold"
                          >
                            ${stk}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* QUADRANT 2: IMPROVING (CẢI THIỆN / TĂNG TỐC) */}
            <div className="bg-[#0a0a0a] border-2 border-blue-600/80 rounded-sm p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-blue-800/60 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <h4 className="font-black text-sm text-blue-400 uppercase">2. CẢI THIỆN (IMPROVING SECTOR)</h4>
                </div>
                <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-700 px-2 py-0.5 rounded font-bold">
                  Momentum bứt phá
                </span>
              </div>
              <p className="text-[11px] text-gray-400 italic">Dòng tiền bắt đầu xoay trục tạo đáy đi lên. Khuyến nghị thăm dò tích lũy (Watchlist).</p>

              <div className="space-y-2.5 pt-1">
                {sectorRotations
                  .filter((s) => s.quadrant === 'IMPROVING')
                  .map((sec) => (
                    <div key={sec.id} className="bg-[#050505] p-3 rounded-sm border border-blue-900/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{sec.name}</span>
                        <span className="text-blue-400 font-bold bg-blue-950 px-2 py-0.5 rounded border border-blue-800 text-[10px]">
                          +{sec.changePercent}% (Dòng tiền ròng: +{sec.netFlow5D} Tỷ)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-gray-400 text-[10px]">Mã tiềm năng:</span>
                        {sec.leadingStocks.map((stk) => (
                          <button
                            key={stk}
                            onClick={() => onSelectStock(stk)}
                            className="bg-blue-950/80 hover:bg-blue-800 text-blue-300 border border-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold"
                          >
                            ${stk}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* QUADRANT 3: WEAKENING (SUY YẾU) */}
            <div className="bg-[#0a0a0a] border-2 border-amber-600/80 rounded-sm p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-amber-800/60 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <h4 className="font-black text-sm text-amber-400 uppercase">3. SUY YẾU (WEAKENING SECTOR)</h4>
                </div>
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700 px-2 py-0.5 rounded font-bold">
                  Momentum suy giảm
                </span>
              </div>
              <p className="text-[11px] text-gray-400 italic">Dòng tiền có dấu hiệu chốt lời rút bớt. Khuyến nghị giảm dần tỷ trọng (Underweight).</p>

              <div className="space-y-2.5 pt-1">
                {sectorRotations
                  .filter((s) => s.quadrant === 'WEAKENING')
                  .map((sec) => (
                    <div key={sec.id} className="bg-[#050505] p-3 rounded-sm border border-amber-900/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{sec.name}</span>
                        <span className="text-amber-400 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-800 text-[10px]">
                          {sec.changePercent}% (Dòng tiền ròng: {sec.netFlow5D} Tỷ)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-gray-400 text-[10px]">Các mã chú ý:</span>
                        {sec.leadingStocks.map((stk) => (
                          <button
                            key={stk}
                            onClick={() => onSelectStock(stk)}
                            className="bg-amber-950/80 hover:bg-amber-800 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold"
                          >
                            ${stk}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* QUADRANT 4: LAGGING (TỤT HẬU) */}
            <div className="bg-[#0a0a0a] border-2 border-red-600/80 rounded-sm p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-red-800/60 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <h4 className="font-black text-sm text-red-400 uppercase">4. TỤT HẬU (LAGGING SECTOR)</h4>
                </div>
                <span className="text-[10px] bg-red-950 text-red-300 border border-red-700 px-2 py-0.5 rounded font-bold">
                  RS & Momentum &lt; 100
                </span>
              </div>
              <p className="text-[11px] text-gray-400 italic">Yếu hơn thị trường chung. Không ưu tiên mở vị thế mua mới.</p>

              <div className="space-y-2.5 pt-1">
                {sectorRotations
                  .filter((s) => s.quadrant === 'LAGGING')
                  .map((sec) => (
                    <div key={sec.id} className="bg-[#050505] p-3 rounded-sm border border-red-900/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{sec.name}</span>
                        <span className="text-red-400 font-bold bg-red-950 px-2 py-0.5 rounded border border-red-800 text-[10px]">
                          {sec.changePercent}% (Dòng tiền ròng: {sec.netFlow5D} Tỷ)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-gray-400 text-[10px]">Các mã thuộc ngành:</span>
                        {sec.leadingStocks.map((stk) => (
                          <button
                            key={stk}
                            onClick={() => onSelectStock(stk)}
                            className="bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold"
                          >
                            ${stk}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
