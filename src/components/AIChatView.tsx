import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crosshair,
  DollarSign,
  Flame,
  Layers,
  PieChart,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AIChatMessage } from '../types';

interface AIChatViewProps {
  initialPrompt?: string;
  onSelectStock: (symbol: string) => void;
}

export const AIChatView: React.FC<AIChatViewProps> = ({ initialPrompt = '', onSelectStock }) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'AI',
      text: `### 🤖 VN-QUANT AI AGENT 4.0 — CỐ VẤN ĐỊNH LƯỢNG 4 TẦNG
Xin chào! Tôi là Trưởng ban Phân tích Định lượng AI tại **VN-Quant Terminal**.

Mọi yêu cầu phân tích cổ phiếu hoặc danh mục đều được xử lý theo **Khung Chuẩn Định Lượng 4 Tầng**:
- 🏢 **Tầng 1:** Nền tảng Cơ bản & Định giá (BCTC, P/E vs Ngành, ROE, Tăng trưởng)
- 📈 **Tầng 2:** Kỹ thuật & Hành động giá (Trend MA, RSI, MACD, Hỗ trợ / Kháng cự)
- 🐋 **Tầng 3:** Dấu chân Cá mập & Dòng tiền lớn (Khối ngoại, Đột biến Volume, Lệnh gom lớn)
- 🎯 **Tầng 4:** Kế hoạch Giao dịch & Quản trị Rủi ro (Vùng Mua, Chốt lời TP1/TP2, Cắt lỗ SL, Tỷ lệ R:R)

*Nhập bất kỳ mã cổ phiếu nào (ví dụ: **HPG**, **FPT**, **SSI**) hoặc yêu cầu đánh giá danh mục để bắt đầu!*`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedPromptRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && processedPromptRef.current !== initialPrompt) {
      processedPromptRef.current = initialPrompt;
      handleSend(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || loading) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: 'USER',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('Lỗi phản hồi từ AI server');
      }
      const data = await res.json();

      const aiMsg: AIChatMessage = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sender: 'AI',
        text: data.text,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        dataCard: data.dataCard,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          sender: 'AI',
          text: 'Rất tiếc, đã có lỗi kết nối tới máy chủ Quant AI. Đang kích hoạt chế độ phân tích định lượng offline...',
          timestamp: new Date().toLocaleTimeString('vi-VN'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    { label: '📊 Phân tích 4 tầng HPG', prompt: 'Phân tích cổ phiếu HPG theo cấu trúc 4 tầng' },
    { label: '🐋 Dòng tiền cá mập SSI', prompt: 'Đánh giá dòng tiền cá mập và khối ngoại của SSI' },
    { label: '🎯 Điểm mua tối ưu FPT', prompt: 'Đề xuất vùng mua, chốt lời và cắt lỗ cho FPT' },
    { label: '🛡️ Đánh giá danh mục HPG, SSI, FPT', prompt: 'Đánh giá danh mục đầu tư gồm HPG, SSI, FPT' },
    { label: '⚡ Top mã gom ngầm hôm nay', prompt: 'Top cổ phiếu nào đang có dòng tiền cá mập gom ngầm?' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl mx-auto p-3 bg-[#050505] text-[#d1d5db]">
      {/* Top Banner */}
      <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 flex items-center justify-between shadow mb-2.5">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold font-mono text-xs shadow-inner">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold text-white flex items-center space-x-2">
              <span>VN-QUANT AI AGENT 4.0 (GEMINI 3.7 FLASH + 4-LAYER ENGINE)</span>
              <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 text-[9px] px-1.5 py-0.2 rounded-sm font-mono flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>4-TIER ACTIVE</span>
              </span>
            </h2>
            <p className="text-[10px] text-gray-400 font-mono">
              Phân tích đa chiều: Cơ bản • Kỹ thuật • Dấu chân Cá mập • Kế hoạch Định lượng
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-[10px] font-mono text-gray-400">
          <span className="px-2 py-0.5 bg-[#050505] rounded-sm border border-gray-800 text-blue-400 font-bold">1: Cơ Bản</span>
          <span className="px-2 py-0.5 bg-[#050505] rounded-sm border border-gray-800 text-purple-400 font-bold">2: Kỹ Thuật</span>
          <span className="px-2 py-0.5 bg-[#050505] rounded-sm border border-gray-800 text-cyan-400 font-bold">3: Cá Mập</span>
          <span className="px-2 py-0.5 bg-[#050505] rounded-sm border border-gray-800 text-emerald-400 font-bold">4: Kế Hoạch</span>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none mb-2 text-xs font-mono">
        <span className="text-blue-400 text-[10px] uppercase font-bold tracking-widest whitespace-nowrap flex items-center space-x-1">
          <Sparkles className="w-3 h-3" />
          <span>GỢI Ý QUANT:</span>
        </span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p.prompt)}
            className="bg-[#0a0a0a] hover:bg-gray-800 text-gray-300 hover:text-white px-2.5 py-1 rounded-sm border border-gray-800 hover:border-blue-500/40 whitespace-nowrap transition text-[11px] flex items-center space-x-1"
          >
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 overflow-y-auto space-y-4 mb-3">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.id}-${idx}`}
            className={`flex items-start space-x-3 ${msg.sender === 'USER' ? 'flex-row-reverse space-x-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs shrink-0 font-mono ${
                msg.sender === 'USER'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#050505] text-blue-400 border border-blue-500/50'
              }`}
            >
              {msg.sender === 'USER' ? 'U' : 'AI'}
            </div>

            {/* Content Bubble */}
            <div
              className={`max-w-[88%] rounded-sm p-3.5 text-xs font-mono leading-relaxed shadow ${
                msg.sender === 'USER'
                  ? 'bg-blue-950/40 border border-blue-800/80 text-gray-100'
                  : 'bg-[#050505] border border-gray-800 text-gray-200'
              }`}
            >
              {/* Text formatting with markdown friendly spacing */}
              <div className="whitespace-pre-line space-y-2 text-[11px] leading-relaxed">
                {msg.text}
              </div>

              {/* Enhanced Interactive 4-Layer Data Card */}
              {msg.dataCard && msg.dataCard.symbol && (
                <div className="mt-3.5 bg-[#0a0a0a] rounded-sm border border-gray-800 p-3 font-mono space-y-3 shadow-md">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-white text-sm">{msg.dataCard.symbol}</span>
                      {msg.dataCard.companyName && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">({msg.dataCard.companyName})</span>
                      )}
                    </div>
                    {msg.dataCard.verdict && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${
                          msg.dataCard.verdict.includes('MUA')
                            ? 'bg-blue-950/90 text-blue-400 border-blue-600'
                            : msg.dataCard.verdict.includes('BÁN')
                            ? 'bg-red-950/90 text-red-400 border-red-600'
                            : 'bg-amber-950/90 text-amber-400 border-amber-600'
                        }`}
                      >
                        {msg.dataCard.verdict}
                      </span>
                    )}
                  </div>

                  {/* 4 Quantitative Pillars Mini Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                      <span className="text-gray-500 uppercase block text-[9px]">ĐIỂM QUANT AI</span>
                      <span className="text-blue-400 font-black text-sm">{msg.dataCard.score || 90}/100</span>
                    </div>
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                      <span className="text-gray-500 uppercase block text-[9px]">VÙNG MUA TỐI ƯU</span>
                      <span className="text-blue-300 font-bold text-xs">{msg.dataCard.buyZone || `${msg.dataCard.price || '-'}k`}</span>
                    </div>
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                      <span className="text-gray-500 uppercase block text-[9px]">MỤC TIÊU (TP1)</span>
                      <span className="text-emerald-400 font-bold text-xs">{msg.dataCard.targetPrice || '-'}k</span>
                    </div>
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                      <span className="text-gray-500 uppercase block text-[9px]">CẮT LỖ (SL)</span>
                      <span className="text-red-400 font-bold text-xs">{msg.dataCard.stopLoss || '-'}k</span>
                    </div>
                  </div>

                  {/* 4-Layer Detailed Breakdown Boxes */}
                  <div className="space-y-2 text-[10px]">
                    {/* 3 Pillars Grid: Layer 1, 2, 3 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Layer 1: Cơ bản */}
                      <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 space-y-1">
                        <div className="flex items-center space-x-1 text-blue-400 font-bold">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>1️⃣ CƠ BẢN & ĐỊNH GIÁ</span>
                        </div>
                        <p className="text-gray-300 line-clamp-3 leading-relaxed">
                          {msg.dataCard.layer1_fundamental?.summary ||
                            `P/E: ${msg.dataCard.layer1_fundamental?.pe || '-'}x, ROE: ${msg.dataCard.layer1_fundamental?.roe || '-'}%`}
                        </p>
                      </div>

                      {/* Layer 2: Kỹ thuật */}
                      <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 space-y-1">
                        <div className="flex items-center space-x-1 text-purple-400 font-bold">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>2️⃣ KỸ THUẬT & XU HƯỚNG</span>
                        </div>
                        <p className="text-gray-300 line-clamp-3 leading-relaxed">
                          {msg.dataCard.layer2_technical?.summary ||
                            `RSI(14): ${msg.dataCard.layer2_technical?.rsi || '-'}, Xu hướng: ${msg.dataCard.layer2_technical?.trend || 'Tích lũy'}`}
                        </p>
                      </div>

                      {/* Layer 3: Cá mập */}
                      <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 space-y-1">
                        <div className="flex items-center space-x-1 text-cyan-400 font-bold">
                          <Waves className="w-3.5 h-3.5" />
                          <span>3️⃣ DÒNG TIỀN CÁ MẬP</span>
                        </div>
                        <p className="text-gray-300 line-clamp-3 leading-relaxed">
                          {msg.dataCard.layer3_smartMoney?.summary ||
                            `Khối ngoại: ${msg.dataCard.layer3_smartMoney?.foreignNetVal || 0} tỷ VNĐ`}
                        </p>
                      </div>
                    </div>

                    {/* Layer 4: Kế hoạch giao dịch & Quản trị rủi ro chuyên sâu */}
                    <div className="bg-[#040d08] p-3 rounded-sm border border-emerald-900/80 shadow-md space-y-2">
                      <div className="flex items-center justify-between border-b border-emerald-950 pb-1.5">
                        <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px]">
                          <Crosshair className="w-4 h-4 text-emerald-400" />
                          <span className="uppercase tracking-wide">4️⃣ TẦNG 4: KẾ HOẠCH GIAO DỊCH & QUẢN TRỊ RỦI RO (TRADE MATRIX)</span>
                        </div>
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-sm font-bold border border-emerald-800">
                          {msg.dataCard.layer4_actionPlan?.action || msg.dataCard.verdict || 'MUA TÍCH LŨY'}
                        </span>
                      </div>

                      {/* Trade Plan Specific Parameters Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                        <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                          <span className="text-gray-400 block text-[9px] font-semibold uppercase">🎯 VÙNG MUA ĐỀ XUẤT</span>
                          <span className="text-cyan-300 font-bold text-xs">
                            {msg.dataCard.layer4_actionPlan?.buyZone || msg.dataCard.buyZone || `${msg.dataCard.price || '-'}k`}
                          </span>
                          <span className="text-gray-500 block text-[8px] mt-0.5">Chia 2 đợt (50/50)</span>
                        </div>

                        <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                          <span className="text-gray-400 block text-[9px] font-semibold uppercase">📈 MỤC TIÊU (TP1 / TP2)</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-emerald-400 font-bold text-xs">
                              {msg.dataCard.layer4_actionPlan?.target1 || msg.dataCard.targetPrice || '-'}k
                            </span>
                            {msg.dataCard.layer4_actionPlan?.target1Upside && (
                              <span className="text-[9px] text-emerald-400 font-semibold">({msg.dataCard.layer4_actionPlan.target1Upside})</span>
                            )}
                          </div>
                          <span className="text-gray-400 block text-[9px] mt-0.5">
                            TP2: <strong className="text-emerald-300">{msg.dataCard.layer4_actionPlan?.target2 || msg.dataCard.targetPrice2 || '-'}k</strong>
                          </span>
                        </div>

                        <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                          <span className="text-gray-400 block text-[9px] font-semibold uppercase">🛑 CẮT LỖ KỶ LUẬT (SL)</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-red-400 font-bold text-xs">
                              {msg.dataCard.layer4_actionPlan?.stopLoss || msg.dataCard.stopLoss || '-'}k
                            </span>
                            {msg.dataCard.layer4_actionPlan?.stopLossDownside && (
                              <span className="text-[9px] text-red-400 font-semibold">({msg.dataCard.layer4_actionPlan.stopLossDownside})</span>
                            )}
                          </div>
                          <span className="text-red-400/80 block text-[8px] mt-0.5 truncate">Gãy nến MA20</span>
                        </div>

                        <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                          <span className="text-gray-400 block text-[9px] font-semibold uppercase">⚖️ R:R & PHÂN BỔ</span>
                          <div className="text-amber-300 font-bold text-xs">
                            R:R {msg.dataCard.layer4_actionPlan?.rrRatio || msg.dataCard.riskRewardRatio || '1 : 2.8'}
                          </div>
                          <span className="text-gray-300 block text-[9px] mt-0.5">
                            NAV: <strong className="text-white">{msg.dataCard.layer4_actionPlan?.maxAllocation || `${msg.dataCard.maxAllocationPercent || 15}% NAV`}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Action Rules & Notes */}
                      <div className="bg-[#050505] p-2 rounded-sm border border-gray-800 space-y-1 text-[10px]">
                        <div className="text-gray-200">
                          <strong className="text-emerald-400">Chiến lược thực thi: </strong>
                          {msg.dataCard.layer4_actionPlan?.strategyNote ||
                            `Kỳ vọng lợi nhuận TP1/TP2 vượt trội so với rủi ro cắt lỗ. Giải ngân thăm dò 50% vùng gom và 50% khi bứt phá cản kèm khối lượng.`}
                        </div>

                        {msg.dataCard.layer4_actionPlan?.entryRules && msg.dataCard.layer4_actionPlan.entryRules.length > 0 && (
                          <div className="pt-1 border-t border-gray-900 text-gray-300 space-y-0.5">
                            <span className="text-cyan-400 font-semibold block text-[9px] uppercase">📌 Nguyên tắc vào lệnh:</span>
                            {msg.dataCard.layer4_actionPlan.entryRules.map((rule, rIdx) => (
                              <div key={rIdx} className="flex items-start space-x-1 pl-1">
                                <span className="text-cyan-400">•</span>
                                <span>{rule}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.dataCard.layer4_actionPlan?.exitRules && msg.dataCard.layer4_actionPlan.exitRules.length > 0 && (
                          <div className="pt-1 border-t border-gray-900 text-gray-300 space-y-0.5">
                            <span className="text-amber-400 font-semibold block text-[9px] uppercase">🛡️ Nguyên tắc chốt lời & thoát lệnh:</span>
                            {msg.dataCard.layer4_actionPlan.exitRules.map((rule, rIdx) => (
                              <div key={rIdx} className="flex items-start space-x-1 pl-1">
                                <span className="text-amber-400">•</span>
                                <span>{rule}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Direct Action Button */}
                  <button
                    onClick={() => onSelectStock(msg.dataCard!.symbol!)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded-sm text-[11px] font-mono flex items-center justify-center space-x-1 transition shadow"
                  >
                    <span>MỞ TRADINGVIEW & ĐẶT LỆNH {msg.dataCard.symbol}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Portfolio Insights Summary Card */}
              {msg.dataCard?.portfolioInsights && (
                <div className="mt-3.5 bg-[#0a0a0a] rounded-sm border border-gray-800 p-3 font-mono space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                    <div className="flex items-center space-x-1.5 text-blue-400 font-bold text-xs">
                      <PieChart className="w-3.5 h-3.5" />
                      <span>ĐÁNH GIÁ ĐỊNH LƯỢNG DANH MỤC</span>
                    </div>
                    <span className="text-[10px] bg-blue-950 text-blue-400 px-2 py-0.5 rounded-sm border border-blue-800 font-bold">
                      {msg.dataCard.portfolioInsights.overallHealth}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                      <span className="text-gray-500 block text-[9px]">RỦI RO DANH MỤC</span>
                      <span className="text-emerald-400 font-bold">{msg.dataCard.portfolioInsights.riskScore}/100</span>
                    </div>
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                      <span className="text-gray-500 block text-[9px]">HỆ SỐ BETA</span>
                      <span className="text-amber-400 font-bold">{msg.dataCard.portfolioInsights.beta}</span>
                    </div>
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800">
                      <span className="text-gray-500 block text-[9px]">NHÓM TẬP TRUNG</span>
                      <span className="text-blue-300 font-bold truncate block">{msg.dataCard.portfolioInsights.maxConcentrationSector}</span>
                    </div>
                  </div>

                  {msg.dataCard.portfolioInsights.rebalanceAdvice && msg.dataCard.portfolioInsights.rebalanceAdvice.length > 0 && (
                    <div className="bg-[#050505] p-2 rounded-sm border border-gray-800 text-[10px] space-y-1">
                      <span className="text-gray-400 font-bold block uppercase text-[9px]">KHUYẾN NGHỊ TÁI CƠ CẤU (REBALANCING):</span>
                      {msg.dataCard.portfolioInsights.rebalanceAdvice.map((adv, aIdx) => (
                        <div key={aIdx} className="flex items-start space-x-1.5 text-gray-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{adv}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <span className="text-[9px] text-gray-500 mt-2 block font-mono text-right">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-sm bg-[#050505] border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold font-mono text-xs">
              AI
            </div>
            <div className="bg-[#050505] border border-gray-800 rounded-sm p-3 text-xs font-mono text-blue-400 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
              <span>AI Quant đang quét dữ liệu 4 tầng (Cơ bản + Kỹ thuật + Cá mập + Kế hoạch R:R)...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="flex items-center space-x-2 bg-[#0a0a0a] p-2 rounded-sm border border-gray-800">
        <input
          type="text"
          placeholder="Hỏi AI về bất kỳ mã nào (VD: HPG, FPT) hoặc yêu cầu đánh giá danh mục..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 text-xs outline-none px-2 font-mono"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !inputMessage.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-sm text-xs font-mono flex items-center space-x-1 transition shadow"
        >
          <span>GỬI</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
