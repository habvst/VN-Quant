import {
  AlertTriangle,
  Award,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Layers,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TestTube,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'ROADMAP' | 'CREDENTIALS' | 'FILTERS'>('ROADMAP');

  // Credentials & Master Switch
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(true);

  // 4-Tier Priorities Toggles
  const [enableP1Portfolio, setEnableP1Portfolio] = useState(true);
  const [enableP2CustomAlerts, setEnableP2CustomAlerts] = useState(true);
  const [enableP3Watchlist, setEnableP3Watchlist] = useState(true);
  const [enableP4MarketOpportunities, setEnableP4MarketOpportunities] = useState(false);

  // Smart Filters
  const [filterVolumeSurgeOnly, setFilterVolumeSurgeOnly] = useState(false);
  const [filterStopLossTakeProfitOnly, setFilterStopLossTakeProfitOnly] = useState(false);
  const [filterBreakoutOnly, setFilterBreakoutOnly] = useState(false);
  const [minPriceChangePercent, setMinPriceChangePercent] = useState<number>(0);
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(120);

  // Loading and Feedback States
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/telegram/config')
      .then((res) => res.json())
      .then((data) => {
        setBotToken(data.botToken || '');
        setChatId(data.chatId || '');
        setEnabled(data.enabled !== false);
        setEnableP1Portfolio(data.enableP1Portfolio !== false);
        setEnableP2CustomAlerts(data.enableP2CustomAlerts !== false);
        setEnableP3Watchlist(data.enableP3Watchlist !== false);
        setEnableP4MarketOpportunities(Boolean(data.enableP4MarketOpportunities));
        setFilterVolumeSurgeOnly(!!data.filterVolumeSurgeOnly);
        setFilterStopLossTakeProfitOnly(!!data.filterStopLossTakeProfitOnly);
        setFilterBreakoutOnly(!!data.filterBreakoutOnly);
        setMinPriceChangePercent(data.minPriceChangePercent ?? 0);
        setCooldownMinutes(data.cooldownMinutes ?? 120);
      })
      .catch((err) => console.error('Failed to load telegram config:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken,
          chatId,
          enabled,
          enableP1Portfolio,
          enableP2CustomAlerts,
          enableP3Watchlist,
          enableP4MarketOpportunities,
          filterVolumeSurgeOnly,
          filterStopLossTakeProfitOnly,
          filterBreakoutOnly,
          minPriceChangePercent: Number(minPriceChangePercent),
          cooldownMinutes: Number(cooldownMinutes),
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatusMsg({ type: 'success', text: '✅ Đã lưu toàn bộ cấu hình 4 tầng & bộ lọc Telegram thành công!' });
      } else {
        setStatusMsg({ type: 'error', text: '❌ Lỗi khi lưu cấu hình Telegram Bot' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi kết nối: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleTestGeneral = async () => {
    setTestLoading('GENERAL');
    setStatusMsg(null);

    try {
      await handleSave();
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: 'success', text: '🎉 Tin nhắn thử nghiệm chung đã được gửi tới Telegram của bạn thành công!' });
      } else {
        setStatusMsg({ type: 'error', text: `❌ Lỗi Telegram: ${data.error}` });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi kết nối: ${err.message}` });
    } finally {
      setTestLoading(null);
    }
  };

  const handleTestTier = async (tier: 'P1' | 'P2' | 'P3' | 'P4') => {
    setTestLoading(tier);
    setStatusMsg(null);

    try {
      await handleSave();
      const res = await fetch('/api/telegram/test-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();

      if (data.telegramResult?.success) {
        setStatusMsg({
          type: 'success',
          text: `🎉 Đã gửi tin nhắn mẫu cấp độ [${tier}] tới Telegram! Hãy kiểm tra ứng dụng Telegram của bạn.`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `❌ Lỗi gửi tin Telegram [${tier}]: ${data.telegramResult?.error || data.message || 'Chưa gửi được'}`,
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi kết nối: ${err.message}` });
    } finally {
      setTestLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 font-mono animate-fadeIn">
      <div className="bg-[#0a0a0c] border border-blue-500/40 rounded-lg w-full max-w-2xl text-[#d1d5db] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0b1329] via-[#141b3a] to-[#0b1329] p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-md bg-blue-600/30 border border-blue-400 flex items-center justify-center text-blue-400 font-bold shadow-lg">
              <Send className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  TRUNG TÂM ĐIỀU KHIỂN & LỘ TRÌNH THÔNG BÁO TELEGRAM
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                  4-TIER PRIORITY
                </span>
              </div>
              <p className="text-[11px] text-blue-300">
                Phân cấp ưu tiên thông minh: Danh mục sở hữu &gt; Cảnh báo đã đặt &gt; Watchlist quan tâm &gt; Cơ hội AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 bg-[#070709] px-3 pt-2 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('ROADMAP')}
            className={`px-3 py-2 font-bold rounded-t flex items-center space-x-1.5 border-t border-x transition ${
              activeTab === 'ROADMAP'
                ? 'bg-[#0e111a] border-blue-500/60 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Lộ Trình 4 Tầng Ưu Tiên</span>
          </button>

          <button
            onClick={() => setActiveTab('CREDENTIALS')}
            className={`px-3 py-2 font-bold rounded-t flex items-center space-x-1.5 border-t border-x transition ${
              activeTab === 'CREDENTIALS'
                ? 'bg-[#0e111a] border-blue-500/60 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>2. Kết Nối Bot &amp; Chat ID</span>
          </button>

          <button
            onClick={() => setActiveTab('FILTERS')}
            className={`px-3 py-2 font-bold rounded-t flex items-center space-x-1.5 border-t border-x transition ${
              activeTab === 'FILTERS'
                ? 'bg-[#0e111a] border-blue-500/60 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Chống Trùng Lặp &amp; Bộ Lọc</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* TAB 1: 4-TIER PRIORITY ROADMAP */}
          {activeTab === 'ROADMAP' && (
            <div className="space-y-3.5">
              <div className="bg-[#050811] p-2.5 rounded border border-blue-900/60 text-[11px] text-gray-300">
                <span className="font-bold text-blue-400 block mb-0.5">
                  🛡️ QUY TRÌNH ĐIỀU PHỐI CẢNH BÁO TỐI ƯU (EDGE-TRIGGERING &amp; COOLDOWN):
                </span>
                Hệ thống áp dụng thuật toán chuyển trạng thái (Edge Triggering) để <strong>tuyệt đối không gửi lặp</strong> các thông báo ngoài cài đặt. Các tầng ưu tiên cao luôn được xử lý trước và bắn ngay lập tức.
              </div>

              {/* TIER P1 */}
              <div className="bg-[#0e0808] p-3 rounded-lg border border-red-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[10px] rounded uppercase shadow">
                      P1 - KHẨN CẤP
                    </span>
                    <span className="font-bold text-red-300 text-xs">DANH MỤC ĐANG SỞ HỮU (PORTFOLIO REAL HOLDINGS)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleTestTier('P1')}
                      disabled={testLoading === 'P1' || !botToken || !chatId}
                      className="px-2 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/50 rounded text-[10px] font-bold flex items-center space-x-1 transition disabled:opacity-40"
                    >
                      {testLoading === 'P1' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                      <span>Gửi Mẫu P1</span>
                    </button>
                    <input
                      type="checkbox"
                      checked={enableP1Portfolio}
                      onChange={(e) => setEnableP1Portfolio(e.target.checked)}
                      className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  • <strong>Sự kiện giám sát:</strong> Vi phạm giá Cắt lỗ (Stop Loss) hoặc Chạm mục tiêu Chốt lời (Take Profit) tính theo giá vốn thực tế; Biến động giảm sốc &gt; 3.5%; Thủng hỗ trợ kỹ thuật cứng.
                  <br />• <strong>Cơ chế:</strong> Bắn cảnh báo ngay lập tức, Cooldown nhắc nhở 60 phút nếu rủi ro chưa được xử lý.
                </p>
              </div>

              {/* TIER P2 */}
              <div className="bg-[#0f0e08] p-3 rounded-lg border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-amber-600 text-black font-black text-[10px] rounded uppercase shadow">
                      P2 - ƯU TIÊN CAO
                    </span>
                    <span className="font-bold text-amber-300 text-xs">CẢNH BÁO ĐÃ ĐẶT THỦ CÔNG (CUSTOM ALERTS)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={enableP2CustomAlerts}
                      onChange={(e) => setEnableP2CustomAlerts(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  • <strong>Sự kiện giám sát:</strong> Các lệnh cảnh báo do bạn chủ động thiết lập (Giá vượt mốc, RSI Quá mua/Quá bán, Cắt lên MA20, Đột biến Vol).
                  <br />• <strong>Cơ chế:</strong> Single-Shot (bắn 1 lần duy nhất khi chạm điều kiện) và tự động Reset khi giá quay về vùng an toàn.
                </p>
              </div>

              {/* TIER P3 */}
              <div className="bg-[#080d14] p-3 rounded-lg border border-blue-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-blue-600 text-white font-black text-[10px] rounded uppercase shadow">
                      P3 - ƯU TIÊN VỪA
                    </span>
                    <span className="font-bold text-blue-300 text-xs">DANH MỤC THEO DÕI QUAN TÂM (WATCHLIST SENTINEL)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleTestTier('P3')}
                      disabled={testLoading === 'P3' || !botToken || !chatId}
                      className="px-2 py-1 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-500/50 rounded text-[10px] font-bold flex items-center space-x-1 transition disabled:opacity-40"
                    >
                      {testLoading === 'P3' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                      <span>Gửi Mẫu P3</span>
                    </button>
                    <input
                      type="checkbox"
                      checked={enableP3Watchlist}
                      onChange={(e) => setEnableP3Watchlist(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  • <strong>Sự kiện giám sát:</strong> Giao cắt Vàng Golden Cross (MA20/MA50), RSI Đảo chiều tạo đáy (cắt lên 30), Dòng tiền cá mập gom hàng bùng nổ Vol, Bứt phá đỉnh kháng cự.
                  <br />• <strong>Cơ chế:</strong> Edge-triggering chỉ báo khi mới đảo chiều + Cooldown thông minh {cooldownMinutes} phút chống spam.
                </p>
              </div>

              {/* TIER P4 */}
              <div className="bg-[#0a0812] p-3 rounded-lg border border-purple-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-purple-600 text-white font-black text-[10px] rounded uppercase shadow">
                      P4 - THÔNG TIN
                    </span>
                    <span className="font-bold text-purple-300 text-xs">CƠ HỘI TOÀN THỊ TRƯỜNG &amp; SMART MONEY AI</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleTestTier('P4')}
                      disabled={testLoading === 'P4' || !botToken || !chatId}
                      className="px-2 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/50 rounded text-[10px] font-bold flex items-center space-x-1 transition disabled:opacity-40"
                    >
                      {testLoading === 'P4' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                      <span>Gửi Mẫu P4</span>
                    </button>
                    <input
                      type="checkbox"
                      checked={enableP4MarketOpportunities}
                      onChange={(e) => setEnableP4MarketOpportunities(e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  • <strong>Sự kiện giám sát:</strong> Cổ phiếu toàn sàn đạt Quant Composite Score &ge; 85/100 kèm dấu chân dòng tiền tổ chức mua ròng đột biến.
                  <br />• <strong>Cơ chế:</strong> Tần suất thấp, Cooldown 360 phút để không làm loãng tin nhắn của nhà đầu tư.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CREDENTIALS & BOT SETUP */}
          {activeTab === 'CREDENTIALS' && (
            <div className="space-y-4">
              <div className="bg-[#050811] p-3 rounded border border-blue-900/60 space-y-2">
                <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs uppercase">
                  <Sparkles className="w-4 h-4" />
                  <span>Hướng Dẫn 3 Bước Tạo Bot Telegram Miễn Phí (1 Phút):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-300 leading-relaxed">
                  <li>
                    Mở Telegram, tìm <strong>@BotFather</strong> và gửi lệnh <code className="bg-blue-950 text-blue-300 px-1 rounded">/newbot</code> để nhận <strong>Bot Token</strong>.
                  </li>
                  <li>
                    Tìm bot <strong>@userinfobot</strong> hoặc chat với Bot vừa tạo, gửi 1 tin nhắn bất kỳ để lấy <strong>Chat ID</strong> của bạn.
                  </li>
                  <li>
                    Dán <strong>Bot Token</strong> và <strong>Chat ID</strong> vào ô bên dưới rồi bấm <strong>LƯU CẤU HÌNH</strong>.
                  </li>
                </ol>
              </div>

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

                {/* Enable Master Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#050505] rounded border border-gray-800">
                  <div>
                    <span className="font-bold text-gray-200 block">Kích hoạt thông báo tự động</span>
                    <span className="text-[10px] text-gray-500">Tự động đẩy cảnh báo định kỳ từ hệ thống cron-job &amp; daemon</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                {/* Cron Webhook Target */}
                <div className="bg-[#050811] p-3 rounded border border-gray-800 space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Webhook / URL Target cho cron-job.org (Mỗi 5 phút):</span>
                  <div className="flex items-center justify-between bg-[#000] p-2 rounded border border-gray-800">
                    <code className="text-emerald-400 font-bold text-[11px] truncate">
                      {window.location.origin}/api/cron/sync
                    </code>
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
              </div>
            </div>
          )}

          {/* TAB 3: SMART FILTERS & DEDUPLICATION */}
          {activeTab === 'FILTERS' && (
            <div className="space-y-3.5">
              <div className="bg-[#050811] p-3 rounded border border-blue-500/30 space-y-2.5">
                <div className="flex items-center space-x-1.5 text-blue-400 font-bold text-xs uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Bộ Lọc Chuyên Sâu &amp; Chống Trùng Lặp Thông Minh:</span>
                </div>
                <p className="text-[10px] text-gray-400">
                  Tùy chỉnh các điều kiện lọc và thời gian giãn cách để Telegram chỉ nhận đúng các tín hiệu chất lượng nhất:
                </p>

                {/* Cooldown minutes select */}
                <div className="bg-[#050505] p-2.5 rounded border border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Thời gian Giãn Cách Chống Trùng Lặp (Smart Cooldown):</span>
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Khoảng thời gian tối thiểu trước khi gửi lại cùng một loại tín hiệu cho một mã cổ phiếu
                    </span>
                  </div>
                  <select
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                    className="bg-[#000] border border-gray-700 rounded px-2 py-1 text-xs font-bold text-white outline-none focus:border-blue-500"
                  >
                    <option value={30}>30 phút</option>
                    <option value={60}>60 phút (1 giờ)</option>
                    <option value={120}>120 phút (2 giờ)</option>
                    <option value={240}>240 phút (4 giờ - Nửa phiên)</option>
                    <option value={480}>480 phút (1 phiên giao dịch)</option>
                  </select>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer bg-[#050505] p-2 rounded border border-gray-800 hover:border-gray-700">
                    <input
                      type="checkbox"
                      checked={filterVolumeSurgeOnly}
                      onChange={(e) => setFilterVolumeSurgeOnly(e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-500 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-amber-400">🔥 Đột biến khối lượng giao dịch</span>
                      <span className="text-[10px] text-gray-400 block">Chỉ gửi khi Volume vượt &gt; 180-200% so với MA20 phiên (Dòng tiền lớn)</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer bg-[#050505] p-2 rounded border border-gray-800 hover:border-gray-700">
                    <input
                      type="checkbox"
                      checked={filterStopLossTakeProfitOnly}
                      onChange={(e) => setFilterStopLossTakeProfitOnly(e.target.checked)}
                      className="w-3.5 h-3.5 accent-rose-500 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-rose-400">🛑 Ngưỡng Cắt Lỗ (Stop-Loss) &amp; Chốt Lời</span>
                      <span className="text-[10px] text-gray-400 block">Chỉ gửi khi chạm ngưỡng bảo vệ vốn hoặc mục tiêu chốt lãi / Trailing Stop</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer bg-[#050505] p-2 rounded border border-gray-800 hover:border-gray-700">
                    <input
                      type="checkbox"
                      checked={filterBreakoutOnly}
                      onChange={(e) => setFilterBreakoutOnly(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-emerald-400">🚀 Bứt phá Kỹ thuật &amp; Golden Cross</span>
                      <span className="text-[10px] text-gray-400 block">Chỉ gửi tín hiệu Breakout kháng cự hoặc MA20 cắt lên MA50</span>
                    </div>
                  </label>

                  <div className="bg-[#050505] p-2 rounded border border-gray-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-300">Biến động tối thiểu trong phiên (%):</span>
                      <span className="text-[10px] text-gray-500 block">Bỏ qua các mã chỉ dao động biên độ nhỏ quanh tham chiếu</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0"
                        max="15"
                        step="0.5"
                        value={minPriceChangePercent}
                        onChange={(e) => setMinPriceChangePercent(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-[#000] border border-gray-700 rounded px-2 py-1 text-center text-xs font-bold text-white outline-none focus:border-blue-500"
                      />
                      <span className="text-gray-400 text-xs">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Alert Banner */}
          {statusMsg && (
            <div
              className={`p-3 rounded text-xs font-bold border ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-red-950/80 border-red-500 text-red-300'
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#050505] p-3 border-t border-gray-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestGeneral}
            disabled={testLoading === 'GENERAL' || !botToken || !chatId}
            className="px-3 py-2 bg-[#0f172a] hover:bg-blue-900 text-amber-400 font-bold border border-amber-500/50 rounded text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            {testLoading === 'GENERAL' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
            <span>THỬ GỬI TIN CHUNG</span>
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
              onClick={() => handleSave()}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs flex items-center space-x-1.5 shadow transition disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>LƯU CẤU HÌNH</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
