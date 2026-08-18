import { Bell, Check, Clock, Info, Layers, Play, Send, ShieldAlert, Sparkles, TrendingUp, X, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { StockData } from '../types';
import {
  AlertTriggerType,
  MACrossoverCondition,
  NotificationChannel,
  PriceCondition,
  RSICondition,
  StockAlert,
} from '../types/alert';
import { formatConditionLabel } from '../services/alertService';
import { numberToVietnameseWords } from '../utils/numberToVietnameseWords';

interface SetAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStock: StockData;
  allStocks: StockData[];
  onSaveAlert: (newAlert: Omit<StockAlert, 'id' | 'createdAt' | 'triggerCount'>) => void;
  onTestTriggerInstant: (symbol: string, title: string, message: string, severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER') => void;
}

export const SetAlertModal: React.FC<SetAlertModalProps> = ({
  isOpen,
  onClose,
  currentStock,
  allStocks,
  onSaveAlert,
  onTestTriggerInstant,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(currentStock.symbol);
  const targetStock = allStocks.find((s) => s.symbol === selectedSymbol) || currentStock;

  const [triggerType, setTriggerType] = useState<AlertTriggerType>('PRICE_THRESHOLD');

  // Price Condition state
  const [priceCond, setPriceCond] = useState<PriceCondition>('ABOVE_PRICE');
  const [targetPrice, setTargetPrice] = useState<number>(() => Math.round(targetStock.price * 1.03 * 10) / 10);
  const [percentValue, setPercentValue] = useState<number>(3);

  // MA Condition state
  const [maCond, setMaCond] = useState<MACrossoverCondition>('PRICE_CROSS_ABOVE_MA20');

  // RSI Condition state
  const [rsiCond, setRsiCond] = useState<RSICondition>('RSI_OVERBOUGHT');
  const [customRsiValue, setCustomRsiValue] = useState<number>(70);

  // General state
  const [channel, setChannel] = useState<NotificationChannel>('IN_APP');
  const [note, setNote] = useState<string>('');
  const [testSuccess, setTestSuccess] = useState(false);

  if (!isOpen) return null;

  const handleStockChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    const stk = allStocks.find((s) => s.symbol === symbol);
    if (stk) {
      setTargetPrice(Math.round(stk.price * 1.03 * 10) / 10);
    }
  };

  const calculateTargetValue = (): number => {
    if (triggerType === 'PRICE_THRESHOLD') {
      if (priceCond === 'GAIN_PERCENT' || priceCond === 'DROP_PERCENT') {
        return percentValue;
      }
      return targetPrice;
    }
    if (triggerType === 'MA_CROSSOVER') {
      return targetStock.technical.ma20;
    }
    if (triggerType === 'RSI_LEVEL') {
      if (rsiCond === 'RSI_OVERBOUGHT') return 70;
      if (rsiCond === 'RSI_OVERSOLD') return 30;
      return customRsiValue;
    }
    return targetStock.price;
  };

  const getConditionType = (): PriceCondition | MACrossoverCondition | RSICondition => {
    if (triggerType === 'PRICE_THRESHOLD') return priceCond;
    if (triggerType === 'MA_CROSSOVER') return maCond;
    return rsiCond;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const computedVal = calculateTargetValue();
    const cond = getConditionType();

    onSaveAlert({
      symbol: selectedSymbol,
      triggerType,
      condition: cond,
      targetValue: computedVal,
      note: note.trim() || undefined,
      channel,
      isActive: true,
    });

    onClose();
  };

  const handleTestTrigger = () => {
    setTestSuccess(true);
    const computedVal = calculateTargetValue();
    const cond = getConditionType();
    const label = formatConditionLabel(triggerType, cond, computedVal);

    onTestTriggerInstant(
      selectedSymbol,
      `🚨 THỬ NGHIỆM CẢNH BÁO ${selectedSymbol}`,
      `Tín hiệu mô phỏng: ${label}. Lệnh cảnh báo qua kênh [${channel}] đã được kích hoạt thành công!`,
      triggerType === 'RSI_LEVEL' && rsiCond === 'RSI_OVERBOUGHT' ? 'WARNING' : 'SUCCESS'
    );

    setTimeout(() => {
      setTestSuccess(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono animate-fadeIn">
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-sm w-full max-w-2xl text-[#d1d5db] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#050505] p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">CÀI ĐẶT CẢNH BÁO THỜI GIAN THỰC (REAL-TIME ALERT)</h3>
              <p className="text-[11px] text-gray-400">Thiết lập tín hiệu giá, đường trung bình MA & RSI cho cổ phiếu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Stock Selection & Price Overview */}
          <div className="bg-[#050505] p-3 rounded-sm border border-gray-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase block font-bold mb-1">MÃ CHỨNG KHOÁN</label>
                <select
                  value={selectedSymbol}
                  onChange={(e) => handleStockChange(e.target.value)}
                  className="bg-[#0a0a0a] text-blue-400 font-bold px-3 py-1.5 rounded-sm border border-gray-800 outline-none text-sm cursor-pointer"
                >
                  {allStocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-8 w-px bg-gray-800 hidden sm:block"></div>

              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-bold">GIÁ HIỆN TẠI</span>
                <span className="text-lg font-black text-white">{targetStock.price.toFixed(2)} VNĐ</span>
                <span className={`text-[11px] ml-2 font-bold ${targetStock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {targetStock.change >= 0 ? '+' : ''}
                  {targetStock.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="text-right text-[11px] text-gray-400 space-y-0.5">
              <div>MA20: <span className="text-blue-400 font-bold">{targetStock.technical.ma20}</span> | MA50: <span className="text-amber-400 font-bold">{targetStock.technical.ma50}</span></div>
              <div>RSI (14): <span className={targetStock.technical.rsi14 > 70 ? 'text-red-400 font-bold' : targetStock.technical.rsi14 < 30 ? 'text-emerald-400 font-bold' : 'text-blue-400 font-bold'}>{targetStock.technical.rsi14}</span></div>
            </div>
          </div>

          {/* Trigger Category Selector Tabs */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase block font-bold mb-1.5">1. LOẠI TÍN HIỆU CẢNH BÁO (TRIGGER CATEGORY)</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTriggerType('PRICE_THRESHOLD')}
                className={`p-2.5 rounded-sm text-xs font-bold border flex items-center justify-center space-x-1.5 transition ${
                  triggerType === 'PRICE_THRESHOLD'
                    ? 'bg-blue-600 text-white border-blue-500 shadow'
                    : 'bg-[#050505] text-gray-400 hover:text-gray-200 border-gray-800'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>🎯 NGƯỠNG GIÁ (PRICE)</span>
              </button>

              <button
                type="button"
                onClick={() => setTriggerType('MA_CROSSOVER')}
                className={`p-2.5 rounded-sm text-xs font-bold border flex items-center justify-center space-x-1.5 transition ${
                  triggerType === 'MA_CROSSOVER'
                    ? 'bg-blue-600 text-white border-blue-500 shadow'
                    : 'bg-[#050505] text-gray-400 hover:text-gray-200 border-gray-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>📈 GIAO CẮT MA</span>
              </button>

              <button
                type="button"
                onClick={() => setTriggerType('RSI_LEVEL')}
                className={`p-2.5 rounded-sm text-xs font-bold border flex items-center justify-center space-x-1.5 transition ${
                  triggerType === 'RSI_LEVEL'
                    ? 'bg-blue-600 text-white border-blue-500 shadow'
                    : 'bg-[#050505] text-gray-400 hover:text-gray-200 border-gray-800'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>📊 RSI QUÁ MUA/BÁN</span>
              </button>
            </div>
          </div>

          {/* Trigger Specific Configuration Box */}
          <div className="bg-[#050505] p-3.5 rounded-sm border border-gray-800 space-y-3">
            {/* PRICE THRESHOLD OPTIONS */}
            {triggerType === 'PRICE_THRESHOLD' && (
              <div className="space-y-3">
                <label className="text-[10px] text-gray-400 uppercase block font-bold">ĐIỀU KIỆN GIÁ (PRICE TRIGGER CONDITION)</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPriceCond('ABOVE_PRICE')}
                    className={`p-2 rounded-sm border text-left transition ${
                      priceCond === 'ABOVE_PRICE' ? 'bg-blue-950/80 border-blue-500 text-blue-300 font-bold' : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                    }`}
                  >
                    📈 Giá tăng vượt mức (Above)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceCond('BELOW_PRICE')}
                    className={`p-2 rounded-sm border text-left transition ${
                      priceCond === 'BELOW_PRICE' ? 'bg-blue-950/80 border-blue-500 text-blue-300 font-bold' : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                    }`}
                  >
                    📉 Giá giảm xuống mức (Below)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceCond('GAIN_PERCENT')}
                    className={`p-2 rounded-sm border text-left transition ${
                      priceCond === 'GAIN_PERCENT' ? 'bg-blue-950/80 border-blue-500 text-blue-300 font-bold' : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                    }`}
                  >
                    🚀 Giá tăng vượt +X% trong phiên
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceCond('DROP_PERCENT')}
                    className={`p-2 rounded-sm border text-left transition ${
                      priceCond === 'DROP_PERCENT' ? 'bg-blue-950/80 border-blue-500 text-blue-300 font-bold' : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                    }`}
                  >
                    🩸 Giá giảm vượt -X% trong phiên
                  </button>
                </div>

                {/* Value Input */}
                {priceCond === 'ABOVE_PRICE' || priceCond === 'BELOW_PRICE' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">Nhập giá mục tiêu (VNĐ):</span>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setTargetPrice(targetStock.technical.supportLevel)}
                          className="px-2 py-0.5 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-800 rounded-sm text-[10px] text-emerald-400 font-bold"
                        >
                          Hỗ trợ ({targetStock.technical.supportLevel})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetPrice(targetStock.technical.resistanceLevel)}
                          className="px-2 py-0.5 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-800 rounded-sm text-[10px] text-red-400 font-bold"
                        >
                          Kháng cự ({targetStock.technical.resistanceLevel})
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#0a0a0a] border border-gray-800 rounded-sm px-3 py-2 text-white font-bold outline-none focus:border-blue-500 text-sm pr-14"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-500 font-bold">.000 VNĐ</span>
                    </div>
                    {targetPrice > 0 && (
                      <div className="text-[10px] text-blue-300 italic bg-blue-950/30 px-2 py-1 rounded border border-blue-900/40 flex items-start gap-1">
                        <span className="font-bold text-blue-400 shrink-0">Bằng chữ:</span>
                        <span>{numberToVietnameseWords(Math.round(targetPrice * 1000))}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs text-gray-300 block">Phần trăm biến động (%):</span>
                    <div className="flex items-center space-x-2">
                      {[2, 3, 5, 7].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPercentValue(pct)}
                          className={`px-3 py-1 rounded-sm text-xs font-bold border ${
                            percentValue === pct ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                      <input
                        type="number"
                        step="0.5"
                        value={percentValue}
                        onChange={(e) => setPercentValue(parseFloat(e.target.value) || 0)}
                        className="w-24 bg-[#0a0a0a] border border-gray-800 rounded-sm px-2 py-1 text-white text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MA CROSSOVER OPTIONS */}
            {triggerType === 'MA_CROSSOVER' && (
              <div className="space-y-2 text-xs">
                <label className="text-[10px] text-gray-400 uppercase block font-bold">CHỌN TÍN HIỆU GIAO CẮT ĐƯỜNG TRUNG BÌNH MA</label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2.5 bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800 cursor-pointer hover:border-gray-700">
                    <input
                      type="radio"
                      name="maCond"
                      checked={maCond === 'PRICE_CROSS_ABOVE_MA20'}
                      onChange={() => setMaCond('PRICE_CROSS_ABOVE_MA20')}
                      className="accent-blue-500"
                    />
                    <div>
                      <span className="font-bold text-emerald-400 block">🚀 Giá bứt phá CẮT LÊN MA20 ({targetStock.technical.ma20})</span>
                      <span className="text-[10px] text-gray-500">Tín hiệu đảo chiều tăng ngắn hạn (Golden Cross ngắn)</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800 cursor-pointer hover:border-gray-700">
                    <input
                      type="radio"
                      name="maCond"
                      checked={maCond === 'PRICE_CROSS_BELOW_MA20'}
                      onChange={() => setMaCond('PRICE_CROSS_BELOW_MA20')}
                      className="accent-blue-500"
                    />
                    <div>
                      <span className="font-bold text-red-400 block">📉 Giá vi phạm CẮT XUỐNG MA20 ({targetStock.technical.ma20})</span>
                      <span className="text-[10px] text-gray-500">Tín hiệu vi phạm kỹ thuật ngắn hạn, cảnh báo cắt lỗ</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800 cursor-pointer hover:border-gray-700">
                    <input
                      type="radio"
                      name="maCond"
                      checked={maCond === 'MA20_CROSS_ABOVE_MA50'}
                      onChange={() => setMaCond('MA20_CROSS_ABOVE_MA50')}
                      className="accent-blue-500"
                    />
                    <div>
                      <span className="font-bold text-blue-400 block">✨ MA20 cắt lên MA50 (Golden Cross Trung Hạn)</span>
                      <span className="text-[10px] text-gray-500">MA20 ({targetStock.technical.ma20}) vượt MA50 ({targetStock.technical.ma50}) xác nhận sóng lớn</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800 cursor-pointer hover:border-gray-700">
                    <input
                      type="radio"
                      name="maCond"
                      checked={maCond === 'MA20_CROSS_BELOW_MA50'}
                      onChange={() => setMaCond('MA20_CROSS_BELOW_MA50')}
                      className="accent-blue-500"
                    />
                    <div>
                      <span className="font-bold text-amber-400 block">⚠️ MA20 cắt xuống MA50 (Death Cross)</span>
                      <span className="text-[10px] text-gray-500">Xác nhận xu hướng giảm trung hạn</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* RSI OVERBOUGHT/OVERSOLD OPTIONS */}
            {triggerType === 'RSI_LEVEL' && (
              <div className="space-y-3 text-xs">
                <label className="text-[10px] text-gray-400 uppercase block font-bold">CHỌN NGƯỠNG RSI (CHỈ BÁO THỨC ĐỜI LỰC MUA/BÁN)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRsiCond('RSI_OVERBOUGHT');
                      setCustomRsiValue(70);
                    }}
                    className={`p-2.5 rounded-sm border text-left transition ${
                      rsiCond === 'RSI_OVERBOUGHT' ? 'bg-red-950/80 border-red-500 text-red-300 font-bold' : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                    }`}
                  >
                    <span className="block text-red-400 font-bold">RSI &gt; 70 (Quá Mua)</span>
                    <span className="text-[10px] text-gray-500 block">Cảnh báo vùng rủi ro đảo chiều</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRsiCond('RSI_OVERSOLD');
                      setCustomRsiValue(30);
                    }}
                    className={`p-2.5 rounded-sm border text-left transition ${
                      rsiCond === 'RSI_OVERSOLD' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold' : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                    }`}
                  >
                    <span className="block text-emerald-400 font-bold">RSI &lt; 30 (Quá Bán)</span>
                    <span className="text-[10px] text-gray-500 block">Tín hiệu hỗ trợ mua bắt đáy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRsiCond('RSI_ABOVE_CUSTOM')}
                    className={`p-2.5 rounded-sm border text-left transition ${
                      rsiCond === 'RSI_ABOVE_CUSTOM' || rsiCond === 'RSI_BELOW_CUSTOM'
                        ? 'bg-blue-950/80 border-blue-500 text-blue-300 font-bold'
                        : 'bg-[#0a0a0a] border-gray-800 text-gray-400'
                    }`}
                  >
                    <span className="block text-blue-400 font-bold">Tùy chỉnh RSI</span>
                    <span className="text-[10px] text-gray-500 block">Nhập ngưỡng riêng (0 - 100)</span>
                  </button>
                </div>

                {(rsiCond === 'RSI_ABOVE_CUSTOM' || rsiCond === 'RSI_BELOW_CUSTOM') && (
                  <div className="flex items-center space-x-3 pt-2">
                    <select
                      value={rsiCond}
                      onChange={(e) => setRsiCond(e.target.value as RSICondition)}
                      className="bg-[#0a0a0a] text-white border border-gray-800 rounded-sm px-2 py-1.5 text-xs font-bold outline-none"
                    >
                      <option value="RSI_ABOVE_CUSTOM">RSI Vượt Trên (&gt;)</option>
                      <option value="RSI_BELOW_CUSTOM">RSI Giảm Xuống (&lt;)</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={customRsiValue}
                      onChange={(e) => setCustomRsiValue(parseInt(e.target.value) || 50)}
                      className="w-20 bg-[#0a0a0a] border border-gray-800 rounded-sm px-2 py-1.5 text-white font-bold text-xs outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-400 font-mono">Hiệu lực khi RSI hiện tại là {targetStock.technical.rsi14}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Channel & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase block font-bold mb-1">KÊNH NHẬN THÔNG BÁO (NOTIFICATION CHANNEL)</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setChannel('IN_APP')}
                  className={`p-2 rounded-sm text-[11px] font-bold border transition ${
                    channel === 'IN_APP' ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#050505] border-gray-800 text-gray-400'
                  }`}
                >
                  🔔 In-App
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('TELEGRAM')}
                  className={`p-2 rounded-sm text-[11px] font-bold border transition ${
                    channel === 'TELEGRAM' ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#050505] border-gray-800 text-gray-400'
                  }`}
                >
                  ✈️ Telegram
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('EMAIL')}
                  className={`p-2 rounded-sm text-[11px] font-bold border transition ${
                    channel === 'EMAIL' ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#050505] border-gray-800 text-gray-400'
                  }`}
                >
                  📧 Email
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 uppercase block font-bold mb-1">GHI CHÚ / CHIẾN LƯỢC (OPTIONAL NOTE)</label>
              <input
                type="text"
                placeholder="Ví dụ: Chốt lời 50%, cắt lỗ nếu lủng đáy..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[#050505] border border-gray-800 rounded-sm px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-[#050505] p-3 border-t border-gray-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestTrigger}
            className="px-3 py-2 bg-[#0a0a0a] hover:bg-gray-800 text-amber-400 font-bold border border-amber-500/40 rounded-sm text-xs flex items-center space-x-1.5 transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{testSuccess ? 'ĐÃ PHÁT TÍN HIỆU THỬ MẪU!' : 'THỬ NGHIỆM KÍCH HOẠT MÔ PHỎNG'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#0a0a0a] hover:bg-gray-800 text-gray-300 font-bold rounded-sm text-xs border border-gray-800 transition"
            >
              HỦY
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-sm text-xs flex items-center space-x-1.5 shadow transition"
            >
              <Check className="w-4 h-4" />
              <span>TẠO CẢNH BÁO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
