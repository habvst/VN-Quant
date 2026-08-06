import { Bot, ChevronRight, CornerDownLeft, Send, Sparkles, User, Zap } from 'lucide-react';
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
      text: `Xin chào! Tôi là **VN-Quant AI Agent** — Cố vấn Đầu tư & Technical Analyst cho Thị trường Chứng khoán Việt Nam.

Tôi được cấp quyền truy cập thời gian thực tới toàn bộ dữ liệu giá cổ phiếu (HOSE/HNX/UPCOM), chỉ báo kỹ thuật (RSI, MACD, MA), chỉ số cơ bản BCTC và tin tức kinh tế vĩ mô.

**Bạn có thể hỏi tôi:**
- *"HPG hôm nay thế nào?"*
- *"Nên mua FPT không?"*
- *"Cổ phiếu nào bứt phá hôm nay?"*
- *"Đánh giá rủi ro nhóm Ngân hàng"*`,
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
          text: 'Rất tiếc, đã có lỗi kết nối tới server AI. Vui lòng thử lại!',
          timestamp: new Date().toLocaleTimeString('vi-VN'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    'HPG hôm nay thế nào?',
    'Nên mua FPT không?',
    'Cổ phiếu nào breakout hôm nay?',
    'Đánh giá rủi ro ngành Ngân hàng',
    'Tại sao AI khuyến nghị STB?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl mx-auto p-3 bg-[#050505] text-[#d1d5db]">
      {/* Top Banner */}
      <div className="bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 flex items-center justify-between shadow mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold font-mono text-xs">
            A
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold text-white flex items-center space-x-2">
              <span>CHUYÊN GIA TƯ VẤN AI CHỨNG KHOÁN (GEMINI 3.6 FLASH)</span>
              <span className="bg-blue-600/20 text-blue-400 border border-blue-500/40 text-[9px] px-1.5 py-0.2 rounded-sm font-mono">ONLINE</span>
            </h2>
            <p className="text-[10px] text-gray-400 font-mono">Trợ lý phân tích dữ liệu thực kết hợp Quant & Gemini AI</p>
          </div>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none mb-2 text-xs font-mono">
        <span className="text-blue-400 text-[10px] uppercase font-bold tracking-widest whitespace-nowrap">GỢI Ý HỎI:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="bg-[#0a0a0a] hover:bg-gray-800 text-gray-300 px-2.5 py-1 rounded-sm border border-gray-800 whitespace-nowrap transition text-[11px]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 overflow-y-auto space-y-4 mb-3">
        {messages.map((msg, idx) => (
          <div key={`${msg.id}-${idx}`} className={`flex items-start space-x-3 ${msg.sender === 'USER' ? 'flex-row-reverse space-x-reverse' : ''}`}>
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
              className={`max-w-[80%] rounded-sm p-3 text-xs font-mono leading-relaxed shadow ${
                msg.sender === 'USER'
                  ? 'bg-blue-950/40 border border-blue-800/80 text-gray-100'
                  : 'bg-[#050505] border border-gray-800 text-gray-200'
              }`}
            >
              {/* Text formatting */}
              <div className="whitespace-pre-line space-y-1.5">{msg.text}</div>

              {/* Optional Interactive Data Card */}
              {msg.dataCard && msg.dataCard.symbol && (
                <div className="mt-3 bg-[#0a0a0a] p-3 rounded-sm border border-gray-800 font-mono space-y-2">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                    <span className="font-black text-white text-sm">{msg.dataCard.symbol}</span>
                    {msg.dataCard.verdict && (
                      <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-sm font-bold">
                        {msg.dataCard.verdict}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div>
                      <span className="text-gray-500 text-[9px] uppercase block">ĐIỂM AI</span>
                      <span className="text-blue-400 font-bold">{msg.dataCard.score || 90}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[9px] uppercase block">MỤC TIÊU</span>
                      <span className="text-emerald-400 font-bold">{msg.dataCard.targetPrice || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[9px] uppercase block">CẮT LỖ</span>
                      <span className="text-red-400 font-bold">{msg.dataCard.stopLoss || '-'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectStock(msg.dataCard!.symbol!)}
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 rounded-sm text-[11px] font-mono flex items-center justify-center space-x-1"
                  >
                    <span>XEM TRADINGVIEW {msg.dataCard.symbol}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
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
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>AI Agent đang tính toán luận điểm & truy vấn dữ liệu BCTC/Kỹ thuật...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="flex items-center space-x-2 bg-[#0a0a0a] p-2 rounded-sm border border-gray-800">
        <input
          type="text"
          placeholder="Hỏi AI về cổ phiếu, tin tức hoặc nhận định thị trường..."
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
