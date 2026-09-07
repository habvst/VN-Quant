import { AlertTriangle, ArrowDown, ArrowUp, Bell, Check, CheckCircle, Crosshair, DollarSign, Info, Play, Send, ShieldAlert, ShieldCheck, Sparkles, TrendingUp, X, Zap } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { PortfolioPosition, StockData } from '../types';
import { NotificationChannel } from '../types/alert';
import { numberToVietnameseWords } from '../utils/numberToVietnameseWords';
import { playAlertSound } from '../services/alertService';

interface PortfolioRiskAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PortfolioPosition | null;
  stock: StockData | null;
  totalNav: number;
  onSaveRiskSettings: (updatedPosition: PortfolioPosition) => void;
  onTriggerTestTelegram?: (symbol: string, tier: 'P1') => void;
}

export const PortfolioRiskAlertModal: React.FC<PortfolioRiskAlertModalProps> = ({
  isOpen,
  onClose,
  position,
  stock,
  totalNav,
  onSaveRiskSettings,
  onTriggerTestTelegram,
}) => {
  if (!isOpen || !position || !stock) return null;

  const currentPrice = stock.price;
  const buyPrice = position.buyPrice;
  const quantity = position.quantity;
  const positionValue = currentPrice * 1000 * quantity;
  const costBasis = buyPrice * 1000 * quantity * (1 + (position.feePercent || 0.15) / 100);
  const currentPnL = positionValue - costBasis;
  const currentPnLPercent = costBasis > 0 ? (currentPnL / costBasis) * 100 : 0;
  const weightInNav = totalNav > 0 ? (positionValue / totalNav) * 100 : 0;

  // Technical ATR & Resistance / Support
  const atr = stock.technical?.atr14 || Number((currentPrice * 0.025).toFixed(2));
  const resistance = stock.technical?.resistanceLevel || Number((currentPrice * 1.12).toFixed(2));
  const support = stock.technical?.supportLevel || Number((currentPrice * 0.94).toFixed(2));

  // State
  const [stopLossMode, setStopLossMode] = useState<'PRICE' | 'PERCENT'>('PRICE');
  const [stopLossPriceInput, setStopLossPriceInput] = useState<string>(
    position.stopLossPrice ? position.stopLossPrice.toString() : (buyPrice * 0.93).toFixed(2)
  );
  const [stopLossPercentInput, setStopLossPercentInput] = useState<number>(
    position.stopLossPercent || -7
  );

  const [targetMode, setTargetMode] = useState<'PRICE' | 'PERCENT'>('PRICE');
  const [targetPriceInput, setTargetPriceInput] = useState<string>(
    position.targetPrice ? position.targetPrice.toString() : (buyPrice * 1.15).toFixed(2)
  );
  const [targetPercentInput, setTargetPercentInput] = useState<number>(
    position.targetPercent || 15
  );

  const [targetPrice2Input, setTargetPrice2Input] = useState<string>(
    position.targetPrice2 ? position.targetPrice2.toString() : (buyPrice * 1.25).toFixed(2)
  );

  const [enableTrailingStop, setEnableTrailingStop] = useState<boolean>(
    position.trailingStopPercent !== undefined && position.trailingStopPercent > 0
  );
  const [trailingStopPercentInput, setTrailingStopPercentInput] = useState<number>(
    position.trailingStopPercent || 5.0
  );

  const [alertChannel, setAlertChannel] = useState<NotificationChannel>(
    position.alertChannel || 'TELEGRAM'
  );
  const [alertEnabled, setAlertEnabled] = useState<boolean>(
    position.alertEnabled !== false
  );

  const [testSent, setTestSent] = useState<boolean>(false);

  // Sync inputs on open
  useEffect(() => {
    if (position) {
      setStopLossPriceInput(
        position.stopLossPrice ? position.stopLossPrice.toString() : (buyPrice * 0.93).toFixed(2)
      );
      setTargetPriceInput(
        position.targetPrice ? position.targetPrice.toString() : (buyPrice * 1.15).toFixed(2)
      );
      setTargetPrice2Input(
        position.targetPrice2 ? position.targetPrice2.toString() : (buyPrice * 1.25).toFixed(2)
      );
      setEnableTrailingStop(
        position.trailingStopPercent !== undefined && position.trailingStopPercent > 0
      );
      setTrailingStopPercentInput(position.trailingStopPercent || 5.0);
      setAlertChannel(position.alertChannel || 'TELEGRAM');
      setAlertEnabled(position.alertEnabled !== false);
    }
  }, [position, buyPrice]);

  // Derived Calculations
  const calculatedStopLossPrice = parseFloat(stopLossPriceInput) || Number((buyPrice * 0.93).toFixed(2));
  const calculatedTargetPrice = parseFloat(targetPriceInput) || Number((buyPrice * 1.15).toFixed(2));
  const calculatedTargetPrice2 = parseFloat(targetPrice2Input) || Number((buyPrice * 1.25).toFixed(2));

  // Risk Math
  const stopLossPercent = buyPrice > 0 ? ((calculatedStopLossPrice - buyPrice) / buyPrice) * 100 : -7;
  const maxLossAmount = Math.max(0, (buyPrice - calculatedStopLossPrice) * 1000 * quantity);
  const maxLossNavPercent = totalNav > 0 ? (maxLossAmount / totalNav) * 100 : 0;

  const targetGainPercent = buyPrice > 0 ? ((calculatedTargetPrice - buyPrice) / buyPrice) * 100 : 15;
  const targetGainAmount = Math.max(0, (calculatedTargetPrice - buyPrice) * 1000 * quantity);
  const targetGainNavPercent = totalNav > 0 ? (targetGainAmount / totalNav) * 100 : 0;

  const riskRewardRatio = Math.abs(stopLossPercent) > 0 ? (targetGainPercent / Math.abs(stopLossPercent)).toFixed(2) : '2.00';

  // Distance from current market price
  const distToStopLossPct = currentPrice > 0 ? ((currentPrice - calculatedStopLossPrice) / currentPrice) * 100 : 0;
  const distToTargetPct = currentPrice > 0 ? ((calculatedTargetPrice - currentPrice) / currentPrice) * 100 : 0;

  // Trailing Stop Calculated Price
  const highestPrice = Math.max(position.highestPriceSinceBuy || buyPrice, currentPrice);
  const calculatedTrailingStopPrice = Number((highestPrice * (1 - trailingStopPercentInput / 100)).toFixed(2));

  // Preset Handlers
  const applyPreset = (type: 'CONSERVATIVE' | 'QUANT_SWING' | 'MOMENTUM' | 'ATR_DYNAMIC') => {
    if (type === 'CONSERVATIVE') {
      const sl = Number((buyPrice * 0.95).toFixed(2));
      const tp = Number((buyPrice * 1.10).toFixed(2));
      const tp2 = Number((buyPrice * 1.18).toFixed(2));
      setStopLossPriceInput(sl.toString());
      setStopLossPercentInput(-5);
      setTargetPriceInput(tp.toString());
      setTargetPercentInput(10);
      setTargetPrice2Input(tp2.toString());
      setEnableTrailingStop(false);
    } else if (type === 'QUANT_SWING') {
      const sl = Number((buyPrice * 0.93).toFixed(2));
      const tp = Number((buyPrice * 1.15).toFixed(2));
      const tp2 = Number((buyPrice * 1.25).toFixed(2));
      setStopLossPriceInput(sl.toString());
      setStopLossPercentInput(-7);
      setTargetPriceInput(tp.toString());
      setTargetPercentInput(15);
      setTargetPrice2Input(tp2.toString());
      setEnableTrailingStop(true);
      setTrailingStopPercentInput(5.0);
    } else if (type === 'MOMENTUM') {
      const sl = Number((buyPrice * 0.92).toFixed(2));
      const tp = Number((buyPrice * 1.18).toFixed(2));
      const tp2 = Number((buyPrice * 1.28).toFixed(2));
      setStopLossPriceInput(sl.toString());
      setStopLossPercentInput(-8);
      setTargetPriceInput(tp.toString());
      setTargetPercentInput(18);
      setTargetPrice2Input(tp2.toString());
      setEnableTrailingStop(true);
      setTrailingStopPercentInput(6.0);
    } else if (type === 'ATR_DYNAMIC') {
      const dynamicSl = Number(Math.max(0.1, buyPrice - 1.8 * atr).toFixed(2));
      const dynamicTp = Number(Math.max(buyPrice * 1.1, resistance).toFixed(2));
      const dynamicTp2 = Number((dynamicTp * 1.1).toFixed(2));
      setStopLossPriceInput(dynamicSl.toString());
      setTargetPriceInput(dynamicTp.toString());
      setTargetPrice2Input(dynamicTp2.toString());
      setEnableTrailingStop(true);
      setTrailingStopPercentInput(Number(((atr / currentPrice) * 100 * 1.8).toFixed(1)));
    }
  };

  const handleSave = () => {
    const updated: PortfolioPosition = {
      ...position,
      stopLossPrice: calculatedStopLossPrice,
      stopLossPercent: Number(stopLossPercent.toFixed(2)),
      targetPrice: calculatedTargetPrice,
      targetPercent: Number(targetGainPercent.toFixed(2)),
      targetPrice2: calculatedTargetPrice2,
      trailingStopPercent: enableTrailingStop ? trailingStopPercentInput : undefined,
      highestPriceSinceBuy: highestPrice,
      alertEnabled,
      alertChannel,
    };

    onSaveRiskSettings(updated);
    onClose();
  };

  const handleTestAlert = () => {
    playAlertSound();
    setTestSent(true);
    if (onTriggerTestTelegram) {
      onTriggerTestTelegram(position.symbol, 'P1');
    }
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
      <div className="bg-[#0a0a0a] border border-blue-600/80 rounded-lg max-w-2xl w-full p-4 sm:p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2.5 text-blue-400">
            <div className="p-2 rounded bg-blue-950/80 border border-blue-800">
              <ShieldAlert className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>QUẢN TRỊ CẮT LỖ & CHỐT LỜI:</span>
                <span className="text-blue-400 font-black">${position.symbol}</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-gray-400">
                Hệ thống Cảnh báo Rủi ro Đa Tầng Tier-P1 (Lead Quant Sentinel)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Position Context Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#050505] p-3 rounded-lg border border-gray-800 text-xs">
          <div>
            <span className="text-gray-400 text-[10px] block uppercase">Giá Vốn Mua</span>
            <span className="font-bold text-gray-200">{buyPrice.toFixed(2)}k VNĐ</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block uppercase">Thị Giá Hiện Tại</span>
            <span className="font-bold text-white flex items-center gap-1">
              {currentPrice.toFixed(2)}k
              {(() => {
                const isRef = Math.abs(stock.changePercent) < 0.001 || stock.changePercent === 0;
                const isGain = !isRef && stock.changePercent > 0;
                return (
                  <span className={`text-[10px] font-semibold ${isRef ? 'text-amber-400' : isGain ? 'text-emerald-400' : 'text-red-400'}`}>
                    ({isGain ? '+' : ''}{isRef ? '0%' : `${stock.changePercent.toFixed(2)}%`})
                  </span>
                );
              })()}
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block uppercase">Khối Lượng & NAV</span>
            <span className="font-bold text-blue-400">
              {quantity.toLocaleString('vi-VN')} CP <span className="text-gray-400 text-[10px]">({weightInNav.toFixed(1)}% NAV)</span>
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block uppercase">Hiệu Suất PnL</span>
            <span className={`font-black ${currentPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentPnL >= 0 ? '+' : ''}{currentPnLPercent.toFixed(2)}%
              <span className="text-[10px] block font-normal">
                ({currentPnL >= 0 ? '+' : ''}{(currentPnL / 1000000).toFixed(2)} tr)
              </span>
            </span>
          </div>
        </div>

        {/* Quant AI Presets Toolbar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>GỢI Ý CẤU HÌNH THEO TRƯỜNG PHÁI QUANT:</span>
            </span>
            <span className="text-[10px] text-gray-500">Bấm để áp dụng nhanh</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => applyPreset('CONSERVATIVE')}
              className="p-2 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-left transition hover:border-blue-500"
            >
              <div className="font-bold text-blue-300">🛡️ BẢO THỦ</div>
              <div className="text-[10px] text-gray-400">SL -5% | TP +10%</div>
              <div className="text-[9px] text-emerald-400 font-bold">R:R = 1:2.0</div>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('QUANT_SWING')}
              className="p-2 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-left transition hover:border-amber-500"
            >
              <div className="font-bold text-amber-300">🎯 CHUẨN QUANT</div>
              <div className="text-[10px] text-gray-400">SL -7% | TP +15%</div>
              <div className="text-[9px] text-emerald-400 font-bold">Trailing Stop 5%</div>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('MOMENTUM')}
              className="p-2 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-left transition hover:border-purple-500"
            >
              <div className="font-bold text-purple-300">🚀 TĂNG TRƯỞNG</div>
              <div className="text-[10px] text-gray-400">SL -8% | TP +18%</div>
              <div className="text-[9px] text-purple-400 font-bold">Trend Following</div>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('ATR_DYNAMIC')}
              className="p-2 rounded bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700 text-left transition hover:border-indigo-400"
            >
              <div className="font-bold text-indigo-300">🤖 AI ĐỘNG ATR</div>
              <div className="text-[10px] text-gray-400">Theo ATR {atr}k</div>
              <div className="text-[9px] text-indigo-300 font-bold">Bám sát biến động</div>
            </button>
          </div>
        </div>

        {/* Main Inputs Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* STOP LOSS SETTINGS BOX */}
          <div className="bg-[#050505] p-3.5 rounded-lg border border-red-900/60 space-y-3">
            <div className="flex items-center justify-between border-b border-red-900/40 pb-2">
              <div className="flex items-center space-x-1.5 text-red-400 font-bold text-xs uppercase">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>1. NGƯỠNG CẮT LỖ (STOP-LOSS)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                BẢO TOÀN VỐN
              </span>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1 uppercase">
                Mức Giá Cắt Lỗ (Nghìn VNĐ):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  value={stopLossPriceInput}
                  onChange={(e) => setStopLossPriceInput(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-red-800/80 rounded px-3 py-2 text-white font-black text-sm outline-none focus:border-red-500 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">k VNĐ</span>
              </div>
            </div>

            {/* Stop Loss Distance & Loss Math */}
            <div className="space-y-1 text-[11px] bg-red-950/20 border border-red-900/30 p-2.5 rounded">
              <div className="flex justify-between">
                <span className="text-gray-400">% Cắt lỗ so với Giá vốn:</span>
                <span className="font-bold text-red-400">{stopLossPercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Khoảng cách từ thị giá hiện tại:</span>
                <span className={`font-bold ${distToStopLossPct <= 1.5 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                  {distToStopLossPct <= 0 ? '🚨 ĐÃ VI PHẠM SL' : `Còn ${distToStopLossPct.toFixed(2)}%`}
                </span>
              </div>
              <div className="flex justify-between border-t border-red-900/40 pt-1">
                <span className="text-gray-400">Khoản Lỗ Tối Đa Khi Chạm SL:</span>
                <span className="font-bold text-red-300">
                  -{maxLossAmount.toLocaleString('vi-VN')} VNĐ (-{maxLossNavPercent.toFixed(2)}% NAV)
                </span>
              </div>
            </div>
          </div>

          {/* TAKE PROFIT SETTINGS BOX */}
          <div className="bg-[#050505] p-3.5 rounded-lg border border-emerald-900/60 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs uppercase">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>2. MỤC TIÊU CHỐT LỜI (TAKE-PROFIT)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                SINH LỜI
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1 uppercase">
                  Mục tiêu TP1 (k VNĐ):
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={targetPriceInput}
                  onChange={(e) => setTargetPriceInput(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-emerald-800/80 rounded px-2.5 py-2 text-white font-black text-sm outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1 uppercase">
                  Mục tiêu TP2 (k VNĐ):
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={targetPrice2Input}
                  onChange={(e) => setTargetPrice2Input(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-emerald-800/80 rounded px-2.5 py-2 text-white font-black text-sm outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Take Profit Gain Math */}
            <div className="space-y-1 text-[11px] bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded">
              <div className="flex justify-between">
                <span className="text-gray-400">% Lợi nhuận kỳ vọng (TP1):</span>
                <span className="font-bold text-emerald-400">+{targetGainPercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Khoảng cách tới TP1:</span>
                <span className="font-bold text-emerald-300">
                  {distToTargetPct <= 0 ? '🎯 ĐÃ ĐẠT TP1' : `Cần tăng +${distToTargetPct.toFixed(2)}%`}
                </span>
              </div>
              <div className="flex justify-between border-t border-emerald-900/40 pt-1">
                <span className="text-gray-400">Lợi Nhuận Kỳ Vọng Đạt Được:</span>
                <span className="font-bold text-emerald-300">
                  +{targetGainAmount.toLocaleString('vi-VN')} VNĐ (+{targetGainNavPercent.toFixed(2)}% NAV)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TRAILING STOP DYNAMIC ENGINE */}
        <div className="bg-[#050505] p-3.5 rounded-lg border border-amber-800/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableTrailingStop}
                onChange={(e) => setEnableTrailingStop(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
              />
              <span className="font-bold text-xs text-amber-300 uppercase">
                3. BẬT TRAILING STOP ĐỘNG (KÉO DỜI ĐIỂM DỪNG LÃI THEO ĐỈNH)
              </span>
            </label>
            <span className="text-[10px] text-amber-400 font-bold">
              {enableTrailingStop ? 'ĐANG KÍCH HOẠT' : 'CHƯA BẬT'}
            </span>
          </div>

          {enableTrailingStop && (
            <div className="pt-2 border-t border-gray-800 space-y-2 text-xs">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Trailing Stop tự động nâng mốc bảo vệ lợi nhuận khi giá cổ phiếu tăng lên đỉnh mới. Khi giá điều chỉnh lùi lại <strong className="text-amber-300">{trailingStopPercentInput}%</strong> từ đỉnh cao nhất ({highestPrice.toFixed(2)}k), hệ thống lập tức phát cảnh báo bán khóa lợi nhuận!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-gray-400">Độ lùi Trailing Stop:</span>
                    <span className="font-bold text-amber-400">{trailingStopPercentInput}% từ đỉnh</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    step={0.5}
                    value={trailingStopPercentInput}
                    onChange={(e) => setTrailingStopPercentInput(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="bg-black/80 border border-amber-800/80 p-2 rounded text-[11px] flex justify-between items-center">
                  <span className="text-gray-400">Mốc Trailing Stop hiện tại:</span>
                  <span className="font-black text-amber-300 text-sm">{calculatedTrailingStopPrice.toFixed(2)}k VNĐ</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quant Risk Matrix & R:R Summary */}
        <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-black p-3 rounded-lg border border-blue-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Crosshair className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-gray-400 text-[10px] uppercase block">TỶ LỆ RISK / REWARD (R:R)</span>
              <span className="text-base font-black text-blue-300">1 : {riskRewardRatio}</span>
            </div>
          </div>

          <div className="text-[11px] text-gray-300 flex items-center gap-4">
            <div>
              <span className="text-gray-500 text-[10px] block">RỦI RO TỐI ĐA</span>
              <span className="text-red-400 font-bold">-{maxLossNavPercent.toFixed(2)}% NAV</span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] block">KỲ VỌNG LỢI NHUẬN</span>
              <span className="text-emerald-400 font-bold">+{targetGainNavPercent.toFixed(2)}% NAV</span>
            </div>
          </div>
        </div>

        {/* Notification Channel & Toggle Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-gray-800 text-xs">
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alertEnabled}
                onChange={(e) => setAlertEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-500 accent-blue-500 cursor-pointer"
              />
              <span className="font-bold text-gray-200">Bật Giám Sát Tự Động</span>
            </label>

            <div className="flex items-center space-x-1.5 bg-[#050505] p-1 rounded border border-gray-800">
              <span className="text-gray-500 text-[10px] font-bold px-1 uppercase">KÊNH:</span>
              <button
                type="button"
                onClick={() => setAlertChannel('TELEGRAM')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  alertChannel === 'TELEGRAM' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Telegram Bot (Tier-P1)
              </button>
              <button
                type="button"
                onClick={() => setAlertChannel('IN_APP')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  alertChannel === 'IN_APP' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                In-App Chuông
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestAlert}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700 text-[11px] font-bold flex items-center space-x-1.5 transition"
          >
            <Send className="w-3 h-3 text-blue-400" />
            <span>{testSent ? '✅ Đã Bắn Báo Động' : 'Bắn Thử Chuông & Telegram'}</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-800 transition"
          >
            HỦY BỎ
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded text-xs transition shadow-lg flex items-center justify-center space-x-1.5 uppercase tracking-wider"
          >
            <CheckCircle className="w-4 h-4" />
            <span>LƯU CẤU HÌNH SL / TP & ĐỒNG BỘ SENTINEL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
