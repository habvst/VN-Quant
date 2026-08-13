import { Eye, EyeOff, KeyRound, Lock, Shield, ShieldCheck, Sparkles, Unlock, AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface LockScreenProps {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ isLocked, setIsLocked }) => {
  const [password, setPassword] = useState<string>('');
  const [storedPassword, setStoredPassword] = useState<string>(() => {
    return localStorage.getItem('vnquant_lock_password') || '1234';
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);

  // Settings modal inside lock screen or when unlocked
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [oldPassInput, setOldPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmPassInput, setConfirmPassInput] = useState<string>('');
  const [changeSuccessMsg, setChangeSuccessMsg] = useState<string>('');

  useEffect(() => {
    // Check lock state from localStorage immediately on mount
    const savedLockState = localStorage.getItem('vnquant_is_locked');
    if (savedLockState === 'false') {
      setIsLocked(false);
    } else {
      setIsLocked(true);
      localStorage.setItem('vnquant_is_locked', 'true');
    }
  }, []);

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu mở khóa!');
      triggerShake();
      return;
    }

    if (password === storedPassword) {
      setIsLocked(false);
      localStorage.setItem('vnquant_is_locked', 'false');
      setPassword('');
      setErrorMsg('');
    } else {
      setErrorMsg('Mật khẩu không chính xác! Vui lòng thử lại.');
      triggerShake();
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPassInput !== storedPassword) {
      alert('Mật khẩu hiện tại không đúng!');
      return;
    }
    if (!newPassInput || newPassInput.length < 4) {
      alert('Mật khẩu mới phải có ít nhất 4 ký tự!');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      alert('Xác nhận mật khẩu mới không khớp!');
      return;
    }

    localStorage.setItem('vnquant_lock_password', newPassInput);
    setStoredPassword(newPassInput);
    setOldPassInput('');
    setNewPassInput('');
    setConfirmPassInput('');
    setIsChangingPassword(false);
    setChangeSuccessMsg('Đã cập nhật mật khẩu mới thành công!');
    setTimeout(() => setChangeSuccessMsg(''), 4000);
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#03050a]/95 backdrop-blur-2xl flex items-center justify-center p-4 font-mono select-none">
      <div className="w-full max-w-md">
        {/* Terminal Header Branding */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-blue-900/40 via-indigo-950/60 to-black border-2 border-blue-500/50 shadow-2xl shadow-blue-500/20 mb-2 relative">
            <Lock className="w-10 h-10 text-blue-400 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-ping" />
          </div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center justify-center space-x-2">
            <span>VN-QUANT TERMINAL</span>
            <span className="bg-red-950/90 text-red-400 border border-red-800 text-[10px] px-2 py-0.5 rounded font-bold">LOCKED</span>
          </h1>
          <p className="text-xs text-gray-400">Hệ Thống Đã Được Khóa Bảo Mật (Secure LockScreen)</p>
        </div>

        {/* Lock Card Container */}
        <div
          className={`bg-[#0a0f1d] border-2 border-blue-500/40 rounded-xl p-6 shadow-2xl shadow-black/80 space-y-5 transition-transform duration-200 ${
            shake ? 'animate-bounce border-red-500' : ''
          }`}
        >
          {/* Status Indicator */}
          <div className="flex items-center justify-between bg-[#050811] p-3 rounded-lg border border-gray-800 text-xs">
            <div className="flex items-center space-x-2 text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Dữ Liệu Mã Hóa Cục Bộ</span>
            </div>
            <span className="text-[10px] text-gray-500">MãPIN mặc định: <strong className="text-amber-400 font-bold">1234</strong></span>
          </div>

          {/* Password Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase mb-2">Nhập Mật Khẩu Khóa Terminal:</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mã PIN hoặc mật khẩu..."
                  autoFocus
                  className="w-full bg-[#050811] text-white placeholder-gray-600 px-4 py-3 rounded-lg border-2 border-gray-800 focus:border-blue-500 outline-none text-sm font-bold tracking-widest transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Quick Numpad / PIN Helper */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1234'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => {
                    if (digit === '1234') {
                      setPassword('1234');
                    } else {
                      setPassword((prev) => prev + digit);
                    }
                  }}
                  className={`py-2 rounded border text-xs font-bold transition ${
                    digit === '1234'
                      ? 'col-span-2 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-800'
                      : 'bg-[#050811] hover:bg-blue-900/40 text-gray-300 border-gray-800'
                  }`}
                >
                  {digit === '1234' ? 'Thử 1234' : digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPassword('')}
                className="col-span-2 py-2 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/60 text-xs font-bold transition"
              >
                XÓA NHẬP
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-950/80 border border-red-500/80 text-red-300 p-3 rounded-lg text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-150">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {changeSuccessMsg && (
              <div className="bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 p-3 rounded-lg text-xs font-bold flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{changeSuccessMsg}</span>
              </div>
            )}

            {/* Unlock Action Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3 rounded-lg text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-blue-600/30 transition transform hover:scale-[1.02] cursor-pointer"
            >
              <Unlock className="w-5 h-5" />
              <span>MỞ KHÓA TÀI KHOẢN (UNLOCK)</span>
            </button>
          </form>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
            <button
              onClick={() => setIsChangingPassword(true)}
              className="text-blue-400 hover:underline flex items-center space-x-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Đổi Mật Khẩu Khóa</span>
            </button>
            <span className="text-gray-600">Trạng thái: Active</span>
          </div>
        </div>

        {/* Change Password Modal inside LockScreen */}
        {isChangingPassword && (
          <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0a0f1d] border-2 border-blue-500/80 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center space-x-2">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  <span>ĐỔI MẬT KHẨU KHÓA MÀN HÌNH</span>
                </h3>
                <button
                  onClick={() => setIsChangingPassword(false)}
                  className="text-gray-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Mật khẩu hiện tại (mặc định 1234):</label>
                  <input
                    type="password"
                    value={oldPassInput}
                    onChange={(e) => setOldPassInput(e.target.value)}
                    placeholder="Nhập MK hiện tại..."
                    className="w-full bg-[#050811] text-white p-2.5 rounded border border-gray-800 focus:border-blue-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Mật khẩu mới (ít nhất 4 ký tự):</label>
                  <input
                    type="password"
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    placeholder="Nhập MK mới..."
                    className="w-full bg-[#050811] text-white p-2.5 rounded border border-gray-800 focus:border-blue-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Xác nhận mật khẩu mới:</label>
                  <input
                    type="password"
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    placeholder="Xác nhận MK mới..."
                    className="w-full bg-[#050811] text-white p-2.5 rounded border border-gray-800 focus:border-blue-500 outline-none font-bold"
                  />
                </div>

                <div className="pt-2 flex items-center space-x-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-xs uppercase"
                  >
                    Cập Nhật Mật Khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
