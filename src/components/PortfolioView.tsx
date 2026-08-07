import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, CheckCircle, DollarSign, History, MinusCircle, Plus, RefreshCw, ShieldAlert, Sparkles, Trash2, TrendingUp, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { PortfolioPosition, StockData } from '../types';
import { calculatePortfolioMetrics } from '../utils/riskEngine';

interface PortfolioViewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export interface RealizedTrade {
  id: string;
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  sellDate: string;
  grossProceeds: number;
  taxAndFee: number;
  realizedPnL: number;
  realizedPnLPercent: number;
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

  const [realizedTrades, setRealizedTrades] = useState<RealizedTrade[]>([]);
  const [capital, setCapital] = useState<number>(1000000000); // 1 Billion VND
  const [cashBalance, setCashBalance] = useState<number>(250000000); // Tiền mặt khả dụng

  // Left Form Mode & States
  const [tradeMode, setTradeMode] = useState<'BUY' | 'SELL'>('BUY');
  const [symbol, setSymbol] = useState('VNM');
  const [buyPrice, setBuyPrice] = useState('65.0');
  const [quantity, setQuantity] = useState('5000');
  const [tradeDate, setTradeDate] = useState('2026-08-01');

  // Sell Modal States
  const [sellingPosition, setSellingPosition] = useState<PortfolioPosition | null>(null);
  const [sellPriceInput, setSellPriceInput] = useState<string>('');
  const [sellQuantityInput, setSellQuantityInput] = useState<string>('');
  const [sellDateInput, setSellDateInput] = useState<string>('2026-08-06');

  // Delete Modal States
  const [deletingPosition, setDeletingPosition] = useState<PortfolioPosition | null>(null);

  // Edit Capital & Cash Modal State
  const [isEditCapitalModalOpen, setIsEditCapitalModalOpen] = useState<boolean>(false);
  const [capitalInput, setCapitalInput] = useState<string>('1000000000');
  const [cashInput, setCashInput] = useState<string>('250000000');

  // Settlement Filter State (T+2.5 Cycle)
  const [settlementFilter, setSettlementFilter] = useState<'ALL' | 'SETTLED' | 'PENDING'>('ALL');

  // Interactive Kelly Criterion Position Sizer States
  const [kellyWinRate, setKellyWinRate] = useState<number>(58); // %
  const [kellyPayoff, setKellyPayoff] = useState<number>(1.8); // Win/Loss Ratio
  const [kellySymbol, setKellySymbol] = useState<string>('HPG');
  const [kellyPrice, setKellyPrice] = useState<string>('25.0');

  // Handle Reset All Sample Data
  const handleResetSampleData = () => {
    if (confirm('XÁC NHẬN TẢI LẠI TÀI KHOẢN TRỐNG?\n\n• Tất cả vị thế mẫu sẽ bị xóa hoàn toàn.\n• Số dư Tiền mặt & Tổng tài sản (NAV) sẽ đặt về đúng 1.000.000.000 VNĐ (1 Tỷ).\n• Lịch sử chốt lời/cắt lỗ sẽ về 0.')) {
      setPositions([]);
      setRealizedTrades([]);
      setCapital(1000000000);
      setCashBalance(1000000000);
    }
  };

  // Total Realized PnL Sum
  const totalRealizedPnL = realizedTrades.reduce((sum, t) => sum + t.realizedPnL, 0);

  const portfolioSummary = calculatePortfolioMetrics(positions, stockMap, capital, cashBalance, totalRealizedPnL);

  // Handle Buy Position
  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const price = parseFloat(buyPrice);
    const qty = parseInt(quantity, 10);

    if (!sym || isNaN(price) || isNaN(qty) || qty <= 0) {
      alert('Vui lòng nhập đầy đủ thông tin vị thế mua!');
      return;
    }

    const costBasis = price * 1000 * qty * 1.0015;

    const newPos: PortfolioPosition = {
      id: `pos-${Date.now()}`,
      symbol: sym,
      buyDate: tradeDate,
      buyPrice: price,
      quantity: qty,
      feePercent: 0.15,
      taxPercent: 0.1,
    };

    setCashBalance((prev) => Math.max(0, prev - costBasis));
    setPositions((prev) => [...prev, newPos]);
    alert(`Đã thêm vị thế MUA ${qty.toLocaleString('vi-VN')} CP ${sym} thành công!`);
  };

  // Handle Sell Position from Left Panel Form
  const handleSellFromForm = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const sellPrice = parseFloat(buyPrice);
    const sellQty = parseInt(quantity, 10);

    const posToSell = positions.find((p) => p.symbol === sym);
    if (!posToSell) {
      alert(`Mã chứng khoán ${sym} không có trong danh mục đang sở hữu!`);
      return;
    }

    if (isNaN(sellPrice) || sellPrice <= 0 || isNaN(sellQty) || sellQty <= 0) {
      alert('Vui lòng nhập giá bán và số lượng bán hợp lệ!');
      return;
    }

    if (sellQty > posToSell.quantity) {
      alert(`Số lượng bán (${sellQty.toLocaleString()}) vượt quá số lượng đang sở hữu (${posToSell.quantity.toLocaleString()})!`);
      return;
    }

    executeSell(posToSell, sellPrice, sellQty, tradeDate);
  };

  // Open Sell Modal for specific position row
  const openSellModal = (pos: PortfolioPosition) => {
    const stock = stockMap[pos.symbol];
    const defaultSellPrice = stock ? stock.price.toString() : pos.buyPrice.toString();
    setSellingPosition(pos);
    setSellPriceInput(defaultSellPrice);
    setSellQuantityInput(pos.quantity.toString());
    setSellDateInput(new Date().toISOString().split('T')[0]);
  };

  // Execute Selling Logic (partial or full position)
  const executeSell = (targetPos: PortfolioPosition, sellPrice: number, sellQty: number, date: string) => {
    const buyPrice = targetPos.buyPrice;
    const grossProceeds = sellPrice * 1000 * sellQty;
    const taxAndFee = grossProceeds * 0.0025; // 0.15% fee + 0.1% tax
    const netProceeds = grossProceeds - taxAndFee;
    const totalCost = buyPrice * 1000 * sellQty * 1.0015; // buy cost with fee
    const realizedPnL = grossProceeds - taxAndFee - totalCost;
    const realizedPnLPercent = totalCost > 0 ? (realizedPnL / totalCost) * 100 : 0;

    // Credit Cash Balance from sale proceeds
    setCashBalance((prev) => prev + netProceeds);

    // Record Realized Trade
    const newTrade: RealizedTrade = {
      id: `realized-${Date.now()}`,
      symbol: targetPos.symbol,
      buyPrice,
      sellPrice,
      quantity: sellQty,
      sellDate: date,
      grossProceeds: Math.round(grossProceeds),
      taxAndFee: Math.round(taxAndFee),
      realizedPnL: Math.round(realizedPnL),
      realizedPnLPercent: Number(realizedPnLPercent.toFixed(2)),
    };

    setRealizedTrades((prev) => [newTrade, ...prev]);

    // Update positions
    if (sellQty >= targetPos.quantity) {
      // Full position sell
      setPositions((prev) => prev.filter((p) => p.id !== targetPos.id));
    } else {
      // Partial position sell
      setPositions((prev) =>
        prev.map((p) => (p.id === targetPos.id ? { ...p, quantity: p.quantity - sellQty } : p))
      );
    }

    // Reset selling modal
    setSellingPosition(null);
  };

  const handleRemovePosition = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    setDeletingPosition(pos);
  };

  const confirmDeletePosition = () => {
    if (deletingPosition) {
      const costBasis = Math.round(deletingPosition.buyPrice * 1000 * deletingPosition.quantity * (1 + (deletingPosition.feePercent || 0.15) / 100));
      // Hoàn trả số tiền vốn mua vị thế này lại vào Số dư tiền mặt khả dụng
      setCashBalance((prev) => prev + costBasis);
      setPositions((prev) => prev.filter((p) => p.id !== deletingPosition.id));
      setDeletingPosition(null);
    }
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
            <p className="text-xs text-gray-400 font-mono">Tính toán NAV, PnL, Value at Risk (VaR 95%), Sharpe Ratio & Chốt Lời/Cắt Lỗ Real-time</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex items-center space-x-2 bg-[#050505] px-3 py-1.5 rounded-sm border border-gray-800">
            <span className="text-gray-400">Vốn đầu tư ban đầu:</span>
            <span className="text-blue-400 font-bold">{(capital ?? 0).toLocaleString('vi-VN')} VNĐ</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setCapitalInput(capital.toString());
              setCashInput(cashBalance.toString());
              setIsEditCapitalModalOpen(true);
            }}
            className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-200 font-bold rounded-sm transition flex items-center space-x-1"
            title="Sửa vốn đầu tư hoặc số dư tiền mặt"
          >
            <span>⚙️ ĐỔI VỐN / TIỀN</span>
          </button>

          <button
            type="button"
            onClick={handleResetSampleData}
            className="px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 font-bold rounded-sm transition flex items-center space-x-1"
            title="Xóa tất cả vị thế mẫu và đặt lại tài khoản 1 Tỷ tiền mặt"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>ĐẶT LẠI TÀI KHOẢN TRỐNG</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 font-mono text-xs">
        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">TỔNG GIÁ TRỊ NAV</span>
          <span className="text-white font-black text-base">{(portfolioSummary.nav ?? 0).toLocaleString('vi-VN')}</span>
          <span className="text-gray-400 text-[10px] block truncate" title={`Tiền mặt: ${(portfolioSummary.cashBalance ?? cashBalance).toLocaleString('vi-VN')} VNĐ | Cổ phiếu: ${(portfolioSummary.currentValue ?? 0).toLocaleString('vi-VN')} VNĐ`}>
            Tiền: {(portfolioSummary.cashBalance ?? cashBalance).toLocaleString('vi-VN')}
          </span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">TỔNG LÃI / LỖ (PNL)</span>
          <span className={`font-black text-base ${portfolioSummary.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioSummary.totalPnL >= 0 ? '+' : ''}
            {(portfolioSummary.totalPnL ?? 0).toLocaleString('vi-VN')}
          </span>
          <span className={`text-[10px] font-bold ${portfolioSummary.totalPnLPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioSummary.totalPnLPercent >= 0 ? '+' : ''}
            {portfolioSummary.totalPnLPercent}%
          </span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">SHARPE RATIO</span>
          <span className="text-blue-400 font-black text-base">{portfolioSummary.sharpeRatio}</span>
          <span className="text-emerald-400 text-[10px] block font-semibold">Tối ưu rủi ro tổng</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">SORTINO RATIO</span>
          <span className="text-indigo-400 font-black text-base">{portfolioSummary.sortinoRatio}</span>
          <span className="text-indigo-300 text-[10px] block font-semibold">Rủi ro Downside</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">MAX DRAWDOWN (MDD)</span>
          <span className="text-red-400 font-black text-base">-{portfolioSummary.maxDrawdown}%</span>
          <span className="text-red-300 text-[10px] block font-semibold">Sụt giảm tối đa</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">VALUE AT RISK (VaR 95%)</span>
          <span className="text-amber-400 font-bold text-sm">-{(portfolioSummary.var95 ?? 0).toLocaleString('vi-VN')}</span>
          <span className="text-gray-500 text-[10px] block">Thua lỗ ngày tối đa</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">PORTFOLIO BETA</span>
          <span className="text-blue-400 font-black text-base">{portfolioSummary.beta}</span>
          <span className="text-gray-500 text-[10px] block">vs VN-Index</span>
        </div>

        <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 shadow">
          <span className="text-gray-500 text-[10px] uppercase block">ĐIỂM RỦI RO QUANT</span>
          <span className="text-amber-400 font-black text-base">{portfolioSummary.riskScore} / 100</span>
          <span className="text-emerald-400 text-[10px] block">Đa dạng hóa: {portfolioSummary.diversificationScore}</span>
        </div>
      </div>

      {/* Grid: Position Form & Risk Gauge vs Position Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Form & Risk Score */}
        <div className="lg:col-span-4 space-y-4">
          {/* Add / Sell Position Form */}
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 font-mono text-xs shadow-lg">
            {/* Mode Switcher Tabs */}
            <div className="flex border border-gray-800 rounded-sm overflow-hidden p-0.5 bg-[#050505]">
              <button
                type="button"
                onClick={() => {
                  setTradeMode('BUY');
                  setSymbol('VNM');
                  setBuyPrice('65.0');
                  setQuantity('5000');
                }}
                className={`flex-1 py-1.5 font-bold uppercase text-[11px] flex items-center justify-center space-x-1 transition ${
                  tradeMode === 'BUY'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>MUA MỚI CP</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTradeMode('SELL');
                  if (positions.length > 0) {
                    const firstPos = positions[0];
                    setSymbol(firstPos.symbol);
                    const stock = stockMap[firstPos.symbol];
                    setBuyPrice(stock ? stock.price.toString() : firstPos.buyPrice.toString());
                    setQuantity(firstPos.quantity.toString());
                  }
                }}
                className={`flex-1 py-1.5 font-bold uppercase text-[11px] flex items-center justify-center space-x-1 transition ${
                  tradeMode === 'SELL'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>BÁN / CHỐT LỜI CP</span>
              </button>
            </div>

            <form onSubmit={tradeMode === 'BUY' ? handleAddPosition : handleSellFromForm} className="space-y-3">
              <h3 className="font-bold text-xs text-gray-200 flex items-center space-x-1.5 border-b border-gray-800 pb-2 uppercase tracking-wider">
                {tradeMode === 'BUY' ? (
                  <>
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-400">THÊM VỊ THẾ MUA VÀO DANH MỤC</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400">BÁN CỔ PHIẾU ĐANG SỞ HỮU</span>
                  </>
                )}
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-400 text-[10px] block mb-1 uppercase">Mã Chứng Khoán</label>
                  {tradeMode === 'SELL' ? (
                    <select
                      value={symbol}
                      onChange={(e) => {
                        const selectedSym = e.target.value;
                        setSymbol(selectedSym);
                        const pos = positions.find((p) => p.symbol === selectedSym);
                        if (pos) {
                          const stock = stockMap[pos.symbol];
                          setBuyPrice(stock ? stock.price.toString() : pos.buyPrice.toString());
                          setQuantity(pos.quantity.toString());
                        }
                      }}
                      className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 font-bold outline-none"
                    >
                      {positions.map((p) => (
                        <option key={p.id} value={p.symbol}>
                          {p.symbol} ({p.quantity.toLocaleString()} CP - Vốn {p.buyPrice})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      placeholder="HPG, FPT..."
                      className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 uppercase outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-[10px] block mb-1 uppercase">
                    {tradeMode === 'BUY' ? 'Ngày Mua' : 'Ngày Bán'}
                  </label>
                  <input
                    type="date"
                    value={tradeDate}
                    onChange={(e) => setTradeDate(e.target.value)}
                    className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-400 text-[10px] block mb-1 uppercase">
                    {tradeMode === 'BUY' ? 'Giá Vốn (Nghìn VNĐ)' : 'Giá Bán (Nghìn VNĐ)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-[10px] block mb-1 uppercase">
                    {tradeMode === 'BUY' ? 'Số Lượng Mua' : 'Số Lượng Bán'}
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-[#050505] text-gray-100 p-2 rounded-sm border border-gray-800 outline-none"
                  />
                </div>
              </div>

              {/* Real-time Sell Calculation Preview if SELL mode */}
              {tradeMode === 'SELL' && (() => {
                const pos = positions.find((p) => p.symbol === symbol);
                if (!pos) return null;
                const pPrice = parseFloat(buyPrice) || 0;
                const pQty = parseInt(quantity, 10) || 0;
                const gross = pPrice * 1000 * pQty;
                const taxFee = gross * 0.0025;
                const cost = pos.buyPrice * 1000 * pQty * 1.0015;
                const estPnL = gross - taxFee - cost;
                const estPnLPercent = cost > 0 ? (estPnL / cost) * 100 : 0;

                return (
                  <div className="bg-[#050505] border border-amber-800/40 p-2.5 rounded-sm space-y-1 text-[11px]">
                    <div className="flex justify-between text-gray-400">
                      <span>Doanh thu bán dự kiến:</span>
                      <span className="text-white font-bold">{Math.round(gross).toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Thuế & Phí (0.25%):</span>
                      <span className="text-amber-400 font-bold">-{Math.round(taxFee).toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-800 pt-1">
                      <span className="text-gray-300 font-bold">Lãi/Lỗ Thực Hiện:</span>
                      <span className={`font-black ${estPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {estPnL >= 0 ? '+' : ''}{Math.round(estPnL).toLocaleString('vi-VN')} VNĐ ({estPnLPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                type="submit"
                className={`w-full font-bold py-2 rounded-sm text-xs font-mono transition shadow flex items-center justify-center space-x-1 ${
                  tradeMode === 'BUY'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {tradeMode === 'BUY' ? (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>XÁC NHẬN MUA CP</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    <span>XÁC NHẬN BÁN / CHỐT LỜI CP</span>
                  </>
                )}
              </button>
            </form>
          </div>

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
              <div className="flex justify-between text-gray-300">
                <span>Sortino Downside Risk:</span>
                <span className="font-bold text-indigo-400">{portfolioSummary.sortinoRatio}</span>
              </div>
            </div>
          </div>

          {/* Interactive Kelly Position Sizer Engine */}
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 font-mono text-xs shadow-lg">
            <h3 className="font-bold text-xs text-amber-400 flex items-center space-x-1.5 border-b border-gray-800 pb-2 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>TỐI ƯU ĐI VỐN (KELLY CRITERION)</span>
            </h3>

            <p className="text-[10px] text-gray-400 leading-relaxed">
              Công thức Kelly: <code className="text-amber-300 font-bold">f* = (p × b - q) / b</code> giúp tính toán % NAV tối ưu cho mỗi lệnh mua để hạn chế nguy cơ sụt giảm tài sản (Drawdown).
            </p>

            {/* Inputs */}
            <div className="space-y-2.5 pt-1">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-300">Xác suất thắng (Win Rate p):</span>
                  <span className="font-bold text-emerald-400">{kellyWinRate}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={85}
                  value={kellyWinRate}
                  onChange={(e) => setKellyWinRate(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-gray-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-300">Tỷ lệ Lời/Lỗ (Payoff Ratio b):</span>
                  <span className="font-bold text-blue-400">{kellyPayoff}x</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={4.0}
                  step={0.1}
                  value={kellyPayoff}
                  onChange={(e) => setKellyPayoff(Number(e.target.value))}
                  className="w-full accent-blue-500 bg-gray-900 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase block mb-1">Mã CP mua:</label>
                  <input
                    type="text"
                    value={kellySymbol}
                    onChange={(e) => setKellySymbol(e.target.value.toUpperCase())}
                    className="w-full bg-[#050505] border border-gray-800 rounded px-2 py-1 text-white font-bold uppercase outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase block mb-1">Giá dự kiến (k):</label>
                  <input
                    type="number"
                    value={kellyPrice}
                    onChange={(e) => setKellyPrice(e.target.value)}
                    className="w-full bg-[#050505] border border-gray-800 rounded px-2 py-1 text-white font-bold outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Kelly Results Card */}
              {(() => {
                const p = kellyWinRate / 100;
                const b = kellyPayoff;
                const q = 1 - p;
                const fStar = Math.max(0, (p * b - q) / b);
                const optWeightPct = Number((fStar * 100).toFixed(1));
                const optVnd = Math.round((portfolioSummary.nav * fStar) / 1000) * 1000;
                const targetP = parseFloat(kellyPrice) || 25.0;
                const optShares = Math.max(100, Math.floor(optVnd / (targetP * 1000) / 100) * 100);

                return (
                  <div className="bg-[#050505] border border-amber-500/50 p-2.5 rounded-sm space-y-1.5 mt-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">% NAV Tối Ưu (Kelly):</span>
                      <span className="font-bold text-amber-400 text-sm">{optWeightPct}% NAV</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Số Tiền Khuyên Dùng:</span>
                      <span className="font-bold text-white">{optVnd.toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400">Khối Lượng Đặt Lệnh:</span>
                      <span className="font-bold text-emerald-400">{optShares.toLocaleString('vi-VN')} CP</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right Column: Positions Table & Realized History */}
        <div className="lg:col-span-8 space-y-4">
          {/* T+2.5 Trapped Stock Risk Warning Banner */}
          {(() => {
            const trappedLosing = portfolioSummary.positions.filter(
              (p) => (p.availableQuantity === 0 || p.settlementStatus !== 'SETTLED') && p.pnlPercent < -2
            );
            if (trappedLosing.length === 0) return null;

            return (
              <div className="bg-amber-950/90 border-2 border-amber-600/80 rounded-sm p-3.5 text-xs text-amber-200 font-mono shadow-2xl space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-400">
                  <ShieldAlert className="w-5 h-5 animate-pulse text-amber-300" />
                  <span className="text-sm font-black uppercase">⚠️ CẢNH BÁO MÔ HÌNH RỦI RO HÀNG KẸP T+2.5: CHƯA THỂ BÁN CẮT LỖ</span>
                </div>
                <p className="text-[11px] text-amber-100/90 leading-relaxed">
                  Phát hiện <strong>{trappedLosing.length} vị thế cổ phiếu</strong> đang ghi nhận mức âm PnL nhưng đang ở chu kỳ thanh toán T+1 / T+2 (chờ đến 11:30 AM T+2 mới về tài khoản). Trong thời gian chưa có hàng khả dụng, nhà đầu tư không thể đặt lệnh bán cắt lỗ ngay trong phiên!
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {trappedLosing.map((p) => (
                    <div key={p.id} className="bg-black/80 border border-amber-700/80 px-2.5 py-1 rounded text-[11px] font-mono flex items-center space-x-2 shadow">
                      <span className="font-bold text-white">${p.symbol}</span>
                      <span className="text-red-400 font-bold">{p.pnlPercent}%</span>
                      <span className="text-amber-300 text-[10px]">• {p.expectedSettlementDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="bg-[#0a0a0a] rounded-sm border border-gray-800 overflow-x-auto shadow-xl">
            <div className="p-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>DANH MỤC VỊ THẾ ĐANG SỞ HỮU ({portfolioSummary.positions.length})</span>
              </h3>

              {/* T+2.5 Settlement Filter Tabs */}
              <div className="flex items-center space-x-1 bg-[#050505] p-1 rounded border border-gray-800 text-[11px]">
                <span className="text-gray-500 font-bold px-1 uppercase text-[10px]">LỌC T+2.5:</span>
                <button
                  type="button"
                  onClick={() => setSettlementFilter('ALL')}
                  className={`px-2 py-0.5 rounded transition ${
                    settlementFilter === 'ALL' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Tất cả ({portfolioSummary.positions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSettlementFilter('SETTLED')}
                  className={`px-2 py-0.5 rounded transition ${
                    settlementFilter === 'SETTLED' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Khả Dụng Bán (T+0) ({portfolioSummary.positions.filter((p) => p.settlementStatus === 'SETTLED' || (p.availableQuantity && p.availableQuantity > 0)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSettlementFilter('PENDING')}
                  className={`px-2 py-0.5 rounded transition ${
                    settlementFilter === 'PENDING' ? 'bg-amber-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Hàng Kẹp T+2.5 ({portfolioSummary.positions.filter((p) => p.settlementStatus !== 'SETTLED' || p.availableQuantity === 0).length})
                </button>
              </div>
            </div>

            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-[#050505] text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Mã CP</th>
                  <th className="p-3 text-center">Trạng Thái T+2.5</th>
                  <th className="p-3 text-right">Giá Vốn</th>
                  <th className="p-3 text-right">Giá Hiện Tại</th>
                  <th className="p-3 text-right">Cắt Lỗ ATR (Dynamic)</th>
                  <th className="p-3 text-right">Khả Dụng / Tổng CP</th>
                  <th className="p-3 text-right">Giá Trị NAV (%)</th>
                  <th className="p-3 text-center">Kelly Tối Ưu</th>
                  <th className="p-3 text-right">Lãi / Lỗ (PnL)</th>
                  <th className="p-3 text-center">Đề Xuất AI</th>
                  <th className="p-3 text-center">Hành Động</th>
                  <th className="p-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {portfolioSummary.positions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-gray-500 italic">
                      Chưa có cổ phiếu nào trong danh mục. Hãy thêm vị thế mới ở bên trái!
                    </td>
                  </tr>
                ) : (
                  portfolioSummary.positions
                    .filter((pos) => {
                      if (settlementFilter === 'SETTLED') return pos.settlementStatus === 'SETTLED' || (pos.availableQuantity && pos.availableQuantity > 0);
                      if (settlementFilter === 'PENDING') return pos.settlementStatus !== 'SETTLED' || pos.availableQuantity === 0;
                      return true;
                    })
                    .map((pos) => {
                      const isPos = pos.pnl >= 0;
                      const isSettled = pos.settlementStatus === 'SETTLED' || (pos.availableQuantity !== undefined && pos.availableQuantity > 0);
                      const isAtrBreached = pos.atrStopLossPrice && pos.currentPrice <= pos.atrStopLossPrice;

                      return (
                        <tr key={pos.id} className="hover:bg-gray-900/50 transition">
                          <td className="p-3 font-bold text-white">
                            <button onClick={() => onSelectStock(pos.symbol)} className="hover:text-blue-400 transition">
                              {pos.symbol}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            {isSettled ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800" title="Đã qua T+2.5 - Có thể bán 100%">
                                🟢 Khả dụng (T+0)
                              </span>
                            ) : pos.settlementStatus === 'PENDING_T1' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 animate-pulse" title="Mới mua hôm nay - Chờ 11:30 T+2">
                                🟨 Hàng kẹp T+0
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-300 border border-orange-700 animate-pulse" title="Sẽ về tài khoản lúc 11:30 Sáng Mai">
                                🟧 Hàng kẹp T+1
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right text-gray-300">{pos.buyPrice}</td>
                          <td className="p-3 text-right font-bold text-gray-100">{pos.currentPrice}</td>
                          <td className="p-3 text-right">
                            {pos.atrStopLossPrice ? (
                              <div className="flex flex-col items-end">
                                <span className={`font-bold ${isAtrBreached ? 'text-red-400 underline animate-pulse' : 'text-gray-300'}`}>
                                  {pos.atrStopLossPrice}
                                </span>
                                <span className="text-[9px] text-gray-500">ATR: {pos.atr}</span>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono">
                            <span className={isSettled ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {(pos.availableQuantity ?? 0).toLocaleString('vi-VN')}
                            </span>
                            <span className="text-gray-500"> / {(pos.quantity ?? 0).toLocaleString('vi-VN')}</span>
                          </td>
                          <td className="p-3 text-right text-gray-200">
                            <div>{(pos.currentValue ?? 0).toLocaleString('vi-VN')}</div>
                            <div className="text-[10px] text-blue-400 font-bold">{pos.weight}% NAV</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/80" title={`Số tiền Kelly khuyên dùng: ${(pos.kellyOptimalVnd ?? 0).toLocaleString('vi-VN')} VNĐ`}>
                              {pos.kellyOptimalWeight}% NAV
                            </span>
                          </td>
                          <td className={`p-3 text-right font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPos ? '+' : ''}
                            {(pos.pnl ?? 0).toLocaleString('vi-VN')} ({isPos ? '+' : ''}
                            {pos.pnlPercent}%)
                          </td>
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
                            <button
                              onClick={() => openSellModal(pos)}
                              className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/50 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 mx-auto transition"
                              title="Bán chốt lời hoặc cắt lỗ vị thế này"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>BÁN CP</span>
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <button onClick={() => handleRemovePosition(pos.id)} className="text-red-400 hover:text-red-300 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Realized Sales Log Table */}
          {realizedTrades.length > 0 && (
            <div className="bg-[#0a0a0a] rounded-sm border border-gray-800 overflow-x-auto shadow-xl">
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <span>LỊCH SỬ GIAO DỊCH ĐÃ BÁN / CHỐT LỜI ({realizedTrades.length})</span>
                </h3>
                <span className={`text-xs font-bold ${totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Tổng Lãi/Lỗ Đã Thực Hiện: {totalRealizedPnL >= 0 ? '+' : ''}{totalRealizedPnL.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>

              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-[#050505] text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Ngày Bán</th>
                    <th className="p-3">Mã CP</th>
                    <th className="p-3 text-right">Giá Vốn</th>
                    <th className="p-3 text-right">Giá Bán</th>
                    <th className="p-3 text-right">Số Lượng</th>
                    <th className="p-3 text-right">Thuế & Phí</th>
                    <th className="p-3 text-right">Lãi / Lỗ Thực Hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {realizedTrades.map((t) => {
                    const isWin = t.realizedPnL >= 0;
                    return (
                      <tr key={t.id} className="hover:bg-gray-900/40">
                        <td className="p-3 text-gray-400">{t.sellDate}</td>
                        <td className="p-3 font-bold text-white">{t.symbol}</td>
                        <td className="p-3 text-right text-gray-300">{t.buyPrice}</td>
                        <td className="p-3 text-right font-bold text-amber-300">{t.sellPrice}</td>
                        <td className="p-3 text-right text-gray-300">{t.quantity.toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-right text-gray-400">-{t.taxAndFee.toLocaleString('vi-VN')}</td>
                        <td className={`p-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isWin ? '+' : ''}{t.realizedPnL.toLocaleString('vi-VN')} ({isWin ? '+' : ''}{t.realizedPnLPercent}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Selling Modal */}
      {sellingPosition && (() => {
        const stock = stockMap[sellingPosition.symbol];
        const pPrice = parseFloat(sellPriceInput) || 0;
        const pQty = parseInt(sellQuantityInput, 10) || 0;
        const gross = pPrice * 1000 * pQty;
        const taxFee = gross * 0.0025;
        const cost = sellingPosition.buyPrice * 1000 * pQty * 1.0015;
        const estPnL = gross - taxFee - cost;
        const estPnLPercent = cost > 0 ? (estPnL / cost) * 100 : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0a0a0a] border-2 border-amber-600/60 rounded-xl p-5 max-w-md w-full font-mono space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-amber-950 border border-amber-700/60 rounded-lg text-amber-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      LẬP LỆNH BÁN: {sellingPosition.symbol}
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      Đang sở hữu: <strong className="text-white">{sellingPosition.quantity.toLocaleString()} CP</strong> • Giá vốn: <strong className="text-amber-300">{sellingPosition.buyPrice}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSellingPosition(null)}
                  className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded bg-gray-900 border border-gray-800"
                >
                  ✕
                </button>
              </div>

              {/* Preset Selling Percentage Buttons */}
              <div>
                <label className="text-gray-400 text-[10px] block mb-1.5 uppercase font-bold">
                  Chọn Nhanh Tỷ Lệ Bán:
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs font-bold">
                  {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                    const targetQty = Math.round(sellingPosition.quantity * ratio);
                    const isSelected = pQty === targetQty;
                    return (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setSellQuantityInput(targetQty.toString())}
                        className={`py-1.5 rounded border transition text-center ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-400 shadow'
                            : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'
                        }`}
                      >
                        {ratio * 100}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-gray-400 text-[10px] block mb-1 uppercase font-bold">Giá Bán (Nghìn VNĐ)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sellPriceInput}
                    onChange={(e) => setSellPriceInput(e.target.value)}
                    className="w-full bg-[#050505] text-amber-300 font-bold p-2 rounded border border-gray-800 outline-none focus:border-amber-500"
                  />
                  {stock && (
                    <span className="text-[9px] text-gray-500 block mt-1">
                      Giá thị trường: {stock.price} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent}%)
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-gray-400 text-[10px] block mb-1 uppercase font-bold">Số Lượng Bán (CP)</label>
                  <input
                    type="number"
                    value={sellQuantityInput}
                    onChange={(e) => setSellQuantityInput(e.target.value)}
                    className="w-full bg-[#050505] text-white font-bold p-2 rounded border border-gray-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-[10px] block mb-1 uppercase font-bold">Ngày Thực Hiện Bán</label>
                <input
                  type="date"
                  value={sellDateInput}
                  onChange={(e) => setSellDateInput(e.target.value)}
                  className="w-full bg-[#050505] text-gray-200 p-2 rounded border border-gray-800 outline-none"
                />
              </div>

              {/* Financial Outcome Calculation Box */}
              <div className="bg-[#050505] border border-gray-800 p-3 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Tổng Doanh Thu Bán:</span>
                  <span className="text-white font-bold">{Math.round(gross).toLocaleString('vi-VN')} VNĐ</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Thuế & Phí Bán (0.25%):</span>
                  <span className="text-amber-400 font-bold">-{Math.round(taxFee).toLocaleString('vi-VN')} VNĐ</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-800 pt-2 mt-1">
                  <span className="text-gray-200 font-bold uppercase text-[11px]">Lãi / Lỗ Thực Nhận (PnL):</span>
                  <span className={`text-sm font-black ${estPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {estPnL >= 0 ? '+' : ''}{Math.round(estPnL).toLocaleString('vi-VN')} VNĐ ({estPnLPercent >= 0 ? '+' : ''}{estPnLPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSellingPosition(null)}
                  className="flex-1 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-800 transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pQty <= 0 || pQty > sellingPosition.quantity) {
                      alert('Số lượng bán không hợp lệ!');
                      return;
                    }
                    if (pPrice <= 0) {
                      alert('Giá bán không hợp lệ!');
                      return;
                    }
                    executeSell(sellingPosition, pPrice, pQty, sellDateInput);
                  }}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs transition shadow flex items-center justify-center space-x-1"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>XÁC NHẬN BÁN CP</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Delete Modal */}
      {deletingPosition && (() => {
        const stock = stockMap[deletingPosition.symbol];
        const currentPrice = stock ? stock.price : deletingPosition.buyPrice;
        const stockVal = Math.round(currentPrice * 1000 * deletingPosition.quantity);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-red-800/80 rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl font-mono text-xs animate-in fade-in zoom-in duration-150">
              <div className="flex items-center space-x-3 text-red-400 border-b border-gray-800 pb-3">
                <div className="w-9 h-9 rounded-full bg-red-950 border border-red-800 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white uppercase tracking-wider">XÁC NHẬN XÓA VỊ THẾ</h3>
                  <p className="text-[11px] text-gray-400">Loại bỏ mã cổ phiếu khỏi danh mục hiện tại</p>
                </div>
              </div>

              <div className="bg-[#050505] p-3 rounded border border-gray-800 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-white text-base">{deletingPosition.symbol}</span>
                  <span className="text-gray-300 font-bold">{deletingPosition.quantity.toLocaleString('vi-VN')} CP</span>
                </div>
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>Giá trị thị trường:</span>
                  <span className="text-amber-400 font-bold">{stockVal.toLocaleString('vi-VN')} VNĐ</span>
                </div>
              </div>

              <div className="bg-red-950/40 border border-red-900/60 p-3 rounded text-[11px] text-red-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Cập nhật NAV & Tiền mặt:</span>
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 pl-1">
                  <li>Tiền vốn đã mua cổ phiếu <strong>({Math.round(deletingPosition.buyPrice * 1000 * deletingPosition.quantity * 1.0015).toLocaleString('vi-VN')} VNĐ)</strong> sẽ được <strong>hoàn trả về Tiền Mặt khả dụng</strong>.</li>
                  <li>Tổng giá trị tài khoản (NAV) sẽ tự động cập nhật đúng chuẩn giá trị thực tế còn lại.</li>
                </ul>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingPosition(null)}
                  className="flex-1 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-800 transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePosition}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition shadow flex items-center justify-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>XÓA VỊ THẾ NÀY</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Capital & Cash Balance Modal */}
      {isEditCapitalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-blue-800/80 rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl font-mono text-xs animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2 text-blue-400">
                <DollarSign className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">ĐIỀU CHỈNH VỐN & TIỀN MẶT</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCapitalModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-[11px] mb-1">VỐN ĐẦU TƯ BAN ĐẦU (VNĐ):</label>
                <input
                  type="number"
                  value={capitalInput}
                  onChange={(e) => setCapitalInput(e.target.value)}
                  className="w-full bg-[#050505] border border-gray-800 rounded p-2 text-white font-bold focus:border-blue-500 outline-none"
                  placeholder="Ví dụ: 1000000000"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] mb-1">SỐ DƯ TIỀN MẶT KHẢ DỤNG HIỆN TẠI (VNĐ):</label>
                <input
                  type="number"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full bg-[#050505] border border-gray-800 rounded p-2 text-emerald-400 font-bold focus:border-emerald-500 outline-none"
                  placeholder="Ví dụ: 250000000"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditCapitalModalOpen(false)}
                className="flex-1 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-800 transition"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                onClick={() => {
                  const cap = parseFloat(capitalInput);
                  const cash = parseFloat(cashInput);
                  if (!isNaN(cap) && cap >= 0) setCapital(cap);
                  if (!isNaN(cash) && cash >= 0) setCashBalance(cash);
                  setIsEditCapitalModalOpen(false);
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs transition shadow"
              >
                LƯU THAY ĐỔI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
