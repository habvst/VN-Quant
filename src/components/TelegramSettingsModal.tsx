import { Bell, Check, Copy, ExternalLink, RefreshCw, Send, ShieldCheck, Sparkles, TestTube } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({ isOpen, onClose }) => {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/telegram/config')
      .then((res) => res.json())
      .then((data) => {
        setBotToken(data.botToken || '');
        setChatId(data.chatId || '');
        setEnabled(data.enabled !== false);
      })
      .catch((err) => console.error('Failed to load telegram config:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId, enabled }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatusMsg({ type: 'success', text: '✅ Đã lưu cấu hình Telegram Bot thành công!' });
      } else {
        setStatusMsg({ type: 'error', text: '❌ Lỗi khi lưu cấu hình Telegram Bot' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi kết nối: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSend = async () => {
    setTestLoading(true);
    setStatusMsg(null);

    try {
      // First save current values
      await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId, enabled }),
      });

      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: 'success', text: '🎉 Tin nhắn thử nghiệm đã được gửi tới Telegram của bạn thành công!' });
      } else {
        setStatusMsg({ type: 'error', text: `❌ Lỗi Telegram: ${data.error}` });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi kết nối: ${err.message}` });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono animate-fadeIn">
      <div className="bg-[#0a0a0a] border border-blue-500/40 rounded-lg w-full max-w-xl text-[#d1d5db] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#0f172a] p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-md bg-blue-600/30 border border-blue-400 flex items-center justify-center text-blue-400 font-bold shadow-lg">
              <Send className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <span>CẤU HÌNH CẢNH BÁO TELEGRAM BOT</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40">AUTOMATION 5-MIN</span>
              </h3>
              <p className="text-[11px] text-blue-300">Nhận cảnh báo biến động cổ phiếu tự động qua Telegram sau mỗi 5 phút</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-gray-800 text-gray-400 hover:text-white transition">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Quick Setup Instructions */}
          <div className="bg-[#050811] p-3 rounded border border-blue-900/60 space-y-2">
            <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Hướng Dẫn 3 Bước Tạo Bot Telegram Miễn Phí:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-300 leading-relaxed">
              <li>
                Mở Telegram, tìm <strong>@BotFather</strong> và gõ <code className="bg-blue-950 text-blue-300 px-1 rounded">/newbot</code> để lấy <strong>Bot Token</strong>.
              </li>
              <li>
                Tìm bot <strong>@userinfobot</strong> hoặc chat với Bot vừa tạo, gửi 1 tin nhắn để lấy <strong>Chat ID</strong> của bạn.
              </li>
              <li>
                Dán <strong>Bot Token</strong> và <strong>Chat ID</strong> vào ô bên dưới rồi bấm <strong>Thử gửi tin nhắn</strong>.
              </li>
            </ol>
          </div>

          {/* Form Inputs */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase block font-bold mb-1">
                1. TELEGRAM BOT TOKEN <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 123456789:ABCdefGhIJKlmNoPQRstuVWXyz..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full bg-[#050505] border border-gray-800 rounded px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase block font-bold mb-1">
                2. TELEGRAM CHAT ID / GROUP ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 987654321 hoặc -100123456789 (nếu là Nhóm)"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full bg-[#050505] border border-gray-800 rounded px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
              />
            </div>

            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#050505] rounded border border-gray-800">
              <div>
                <span className="font-bold text-gray-200 block">Kích hoạt thông báo tự động</span>
                <span className="text-[10px] text-gray-500">Tự động đẩy cảnh báo mỗi 5 phút từ hệ thống cron-job</span>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Cron Target URL Banner for user */}
          <div className="bg-[#050811] p-3 rounded border border-gray-800 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase block">Webhook / URL Target cho cron-job.org (Mỗi 5 phút):</span>
            <div className="flex items-center justify-between bg-[#000] p-2 rounded border border-gray-800">
              <code className="text-emerald-400 font-bold text-[11px] truncate">https://[your-app-domain]/api/cron/sync</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/cron/sync`);
                  alert('Đã sao chép URL Cron endpoint thành công!');
                }}
                className="px-2 py-1 bg-blue-950 text-blue-300 hover:bg-blue-800 hover:text-white rounded text-[10px] font-bold flex items-center space-x-1 transition"
              >
                <Copy className="w-3 h-3" />
                <span>Copy URL</span>
              </button>
            </div>
          </div>

          {/* Status Alert Banner */}
          {statusMsg && (
            <div
              className={`p-3 rounded text-xs font-bold border ${
                statusMsg.type === 'success' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' : 'bg-red-950/80 border-red-500 text-red-300'
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="bg-[#050505] p-3 border-t border-gray-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestSend}
            disabled={testLoading || !botToken || !chatId}
            className="px-3.5 py-2 bg-[#0f172a] hover:bg-blue-900 text-amber-400 font-bold border border-amber-500/50 rounded text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
            <span>THỬ GỬI TIN NHẮN TỚI TELEGRAM</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#0a0a0a] hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-800 transition"
            >
              ĐÓNG
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs flex items-center space-x-1.5 shadow transition disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>LƯU CẤU HÌNH</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
