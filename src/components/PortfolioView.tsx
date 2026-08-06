import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, CheckCircle, Plus, ShieldAlert, Sparkles, Trash2, TrendingUp, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { PortfolioPosition, StockData } from '../types';
import { calculatePortfolioMetrics } from '../utils/riskEngine';

interface PortfolioViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ stocks, onSelectStock }) => {
  const stockMap = stocks.reduce((acc, item) => {
    acc[item.symbol] = item;
    return acc;
  }, {} as Record<string, StockData>);

  const [positions, setPositions] = useState<PortfolioPosition[]>([
    { id: 'pos-1', symbol: 'HPG', buyDate: '2026-07-10', buyPrice: 27.2, quantity: 15000, feePercent: 0.15, taxPercent: 0.1, note: 'Giai đoạn tích lũy' },
    { id: 'pos-2', symbol: 'FPT', buyDate: '2026-06-15', buyPrice: 120.5, quantity: 3000, feePercent: 0.15, taxPercent: 0.1, note: 'Tăng trưởng công nghệ' },
    { id: 'pos-3', symbol: 'MBB', buyDate: '2026-07-20', buyPrice: 23.0, quantity: 20000, feePercent: 0.15, taxPercent: 0.1, note: 'Định giá P/B siêu rẻ' },
    { id: 'pos-4', symbol: 'STB', buyDate: '2026-07-28', buyPrice: 30.2, quantity: 10000, feePercent: 0.15, taxPercent: 0.1, note: 'Dòng tiền VAMC' },
  ]);

  const [capital, setCapital] = useState<number>(1000000000); // 1 Billion VND

  // Form states
  const [symbol, setSymbol] = useState('VNM');
  const [buyPrice, setBuyPrice] = useState('65.0');
  const [quantity, setQuantity] = useState('5000');
  const [buyDate, setBuyDate] = useState('2026-08-01');

  const portfolioSummary = calculatePortfolioMetrics(positions, stockMap, capital);

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const price = parseFloat(buyPrice);
    const qty = parseInt(quantity, 10);

    if (!sym || isNaN(price) || isNaN(qty) || qty <= 0) {
      alert('Vui lòng nhập đầy đủ thông tin vị thế!');
      return;
    }

    const newPos: PortfolioPosition = {
      id: `pos-${Date.now()}`,
      symbol: sym,
      buyDate,
      buyPrice: price,
      quantity: qty,
      feePercent: 0.15,
      taxPercent: 0.1,
    };

    setPositions((prev) => [...prev, newPos]);
  };

  const handleRemovePosition = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4 font-mono">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white">DANH MỤC SỞ HỮU & QUẢN TRỊ RỦI RO QUANT</h2>
            <p className="text-xs text-gray-400 font-mono">Tính toán NAV, PnL, Value at Risk (VaR 95%), Sharpe Ratio & Kelly Position Sizing</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-[#050505] p-2 rounded-sm border border-gray-800 font-mono text-xs">
          <span className="text-gray-400">Vốn đầu tư ban đầu:</span>
          <span className="text-blue-400 font-bold">{(capital ?? 0).toLocaleString('vi-VN')} VNĐ</span>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">TỔNG GIÁ TRỊ NAV</span>
          <span className="text-white font-black text-lg">{(portfolioSummary.nav ?? 0).toLocaleString('vi-VN')}</span>
          <span className="text-gray-400 text-[10px] block">VNĐ</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">TỔNG LÃI / LỖ (PNL)</span>
          <span className={`font-black text-lg ${portfolioSummary.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioSummary.totalPnL >= 0 ? '+' : ''}
            {(portfolioSummary.totalPnL ?? 0).toLocaleString('vi-VN')}
          </span>
          <span className={`text-[11px] font-bold ${portfolioSummary.totalPnLPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioSummary.totalPnLPercent >= 0 ? '+' : ''}
            {portfolioSummary.totalPnLPercent}%
          </span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">LÃI / LỖ PHIÊN HÔM NAY</span>
          <span className={`font-bold text-sm ${portfolioSummary.dailyPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioSummary.dailyPnL >= 0 ? '+' : ''}
            {(portfolioSummary.dailyPnL ?? 0).toLocaleString('vi-VN')}
          </span>
          <span className={`text-[10px] block ${portfolioSummary.dailyPnLPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioSummary.dailyPnLPercent >= 0 ? '+' : ''}
            {portfolioSummary.dailyPnLPercent}%
          </span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">PORTFOLIO BETA</span>
          <span className="text-blue-400 font-black text-lg">{portfolioSummary.beta}</span>
          <span className="text-gray-500 text-[10px] block">Biến động vs VNIndex</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">VALUE AT RISK (VaR 95%)</span>
          <span className="text-red-400 font-bold text-sm">-{(portfolioSummary.var95 ?? 0).toLocaleString('vi-VN')}</span>
          <span className="text-gray-500 text-[10px] block">Tổn thất ngày tối đa</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">SHARPE RATIO</span>
          <span className="text-blue-400 font-black text-lg">{portfolioSummary.sharpeRatio}</span>
          <span className="text-emerald-400 text-[10px] block">Tối ưu hiệu suất</span>
        </div>
      </div>

      {/* Grid: Position Form & Risk Gauge vs Position Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Form & Risk Score */}
        <div className="lg:col-span-4 space-y-4">
          {/* Add Position Form */}
          <form onSubmit={handleAddPosition} className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 font-mono text-xs shadow-lg">
            <h3 className="font-bold text-xs text-blue-400 flex items-center space-x-1.5 border-b border-gray-800 pb-2 uppercase tracking-wider">
              <Plus className="w-4 h-4" />
              <span>THÊM VỊ THẾ MỚI VÀO DANH MỤC</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-[10px] block mb-1 uppercase">Mã Chứng Khoán</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="HPG, FPT..."
                  className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 uppercase outline-none"
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] block mb-1 uppercase">Ngày Mua</label>
                <input
                  type="date"
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                  className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 text-[10px] block mb-1 uppercase">Giá Vốn (Nghìn VNĐ)</label>
                <input
                  type="number"
                  step="0.1"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 outline-none"
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] block mb-1 uppercase">Số Lượng (Cổ phiếu)</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-sm text-xs font-mono transition shadow flex items-center justify-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>XÁC NHẬN MUA CP</span>
            </button>
          </form>

          {/* Risk Dashboard */}
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 font-mono text-xs shadow-lg">
            <h3 className="font-bold text-xs text-gray-200 flex items-center space-x-1.5 border-b border-gray-800 pb-2 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>ĐÁNH GIÁ RỦI RO DANH MỤC QUANT</span>
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Risk Score Danh Mục:</span>
                <span className="font-bold text-blue-400">{portfolioSummary.riskScore} / 100</span>
              </div>
              <div className="w-full bg-[#050505] h-2 rounded-sm overflow-hidden border border-gray-800">
                <div className="bg-gradient-to-r from-emerald-500 via-blue-500 to-red-500 h-full" style={{ width: `${portfolioSummary.riskScore}%` }}></div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-800 text-[11px]">
              <div className="flex justify-between text-gray-300">
                <span>Điểm Đa Dạng Hóa Ngành:</span>
                <span className="font-bold text-emerald-400">{portfolioSummary.diversificationScore} / 100</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Max Drawdown Dự Phóng:</span>
                <span className="font-bold text-red-400">-{portfolioSummary.maxDrawdown}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Positions Table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-[#0a0a0a] rounded-sm border border-gray-800 overflow-x-auto shadow-xl">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-[#050505] text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Mã CP</th>
                  <th className="p-3 text-right">Giá Vốn</th>
                  <th className="p-3 text-right">Giá Hiện Tại</th>
                  <th className="p-3 text-right">Số Lượng</th>
                  <th className="p-3 text-right">Giá Trị Hiện Tại</th>
                  <th className="p-3 text-right">Lãi / Lỗ (PnL)</th>
                  <th className="p-3 text-center">Tỷ Trọng (%)</th>
                  <th className="p-3 text-center">Tỷ Trọng Kelly Optimal</th>
                  <th className="p-3 text-center">Đề Xuất AI</th>
                  <th className="p-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {portfolioSummary.positions.map((pos) => {
                  const isPos = pos.pnl >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-gray-900/50 transition">
                      <td className="p-3 font-bold text-white">
                        <button onClick={() => onSelectStock(pos.symbol)} className="hover:text-blue-400 transition">
                          {pos.symbol}
                        </button>
                      </td>
                      <td className="p-3 text-right text-gray-300">{pos.buyPrice}</td>
                      <td className="p-3 text-right font-bold text-gray-100">{pos.currentPrice}</td>
                      <td className="p-3 text-right text-gray-300">{(pos.quantity ?? 0).toLocaleString('vi-VN')}</td>
                      <td className="p-3 text-right text-gray-200">{(pos.currentValue ?? 0).toLocaleString('vi-VN')}</td>
                      <td className={`p-3 text-right font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPos ? '+' : ''}
                        {(pos.pnl ?? 0).toLocaleString('vi-VN')} ({isPos ? '+' : ''}
                        {pos.pnlPercent}%)
                      </td>
                      <td className="p-3 text-center font-bold text-gray-200">{pos.weight}%</td>
                      <td className="p-3 text-center font-bold text-blue-400">{pos.kellyOptimalWeight}%</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${
                            pos.aiRecommendation === 'CHỐT LỜI'
                              ? 'bg-blue-950/60 text-blue-400 border-blue-800'
                              : pos.aiRecommendation === 'CẮT LỖ'
                              ? 'bg-red-950 text-red-400 border-red-800'
                              : pos.aiRecommendation === 'MUA THÊM'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-[#050505] text-gray-300 border-gray-800'
                          }`}
                        >
                          {pos.aiRecommendation}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleRemovePosition(pos.id)} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
