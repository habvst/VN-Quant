import { Eye, EyeOff, KeyRound, Lock, Shield, ShieldAlert, ShieldCheck, Sparkles, Unlock, AlertTriangle, Clock, Sliders, Check } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { verifyPassword, saveNewPassword, getAutoLockTimeout, setAutoLockTimeout } from '../utils/security';

interface LockScreenProps {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
}

const MAX_FAILED_ATTEMPTS = 5;

export const LockScreen: React.FC<LockScreenProps> = ({ isLocked, setIsLocked }) => {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Auto-lock inactivity state
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(() => getAutoLockTimeout());

  // Brute-force Protection States (Persisted in localStorage)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const val = localStorage.getItem('vnquant_lock_failed_attempts');
    return val ? parseInt(val, 10) : 0;
  });

  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    const val = localStorage.getItem('vnquant_lockout_until');
    return val ? parseInt(val, 10) : 0;
  });

  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Settings modal inside lock screen or when unlocked
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [isSettingAutoLock, setIsSettingAutoLock] = useState<boolean>(false);
  const [oldPassInput, setOldPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmPassInput, setConfirmPassInput] = useState<string>('');
  const [changeSuccessMsg, setChangeSuccessMsg] = useState<string>('');

  const currentCycleAttempts = failedAttempts % MAX_FAILED_ATTEMPTS;
  const remainingAttempts = lockoutRemaining > 0 ? 0 : MAX_FAILED_ATTEMPTS - currentCycleAttempts;

  // 1. Enforce lock on page reload / mount
  useEffect(() => {
    setIsLocked(true);
    localStorage.setItem('vnquant_is_locked', 'true');
  }, []);

  // 2. Lockout Countdown Timer Interval
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (lockoutUntil && lockoutUntil > now) {
        const remainingSec = Math.ceil((lockoutUntil - now) / 1000);
        setLockoutRemaining(remainingSec);
      } else {
        setLockoutRemaining(0);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Block unlock attempt if currently locked out by brute-force protection
    if (lockoutRemaining > 0) {
      setErrorMsg(`Tài khoản đang bị tạm khóa bảo vệ! Vui lòng chờ ${lockoutRemaining}s...`);
      triggerShake();
      return;
    }

    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu mở khóa!');
      triggerShake();
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await verifyPassword(password);

      if (isValid) {
        // Success: Reset brute-force counters
        setIsLocked(false);
        localStorage.setItem('vnquant_is_locked', 'false');
        setPassword('');
        setErrorMsg('');
        setFailedAttempts(0);
        setLockoutUntil(0);
        localStorage.removeItem('vnquant_lock_failed_attempts');
        localStorage.removeItem('vnquant_lockout_until');
      } else {
        // Failed attempt
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        localStorage.setItem('vnquant_lock_failed_attempts', String(newAttempts));

        if (newAttempts % MAX_FAILED_ATTEMPTS === 0) {
          // Progressive lockout duration: 5 attempts = 30s, 10 attempts = 60s, 15+ attempts = 300s
          let durationSec = 30;
          if (newAttempts >= 15) {
            durationSec = 300;
          } else if (newAttempts >= 10) {
            durationSec = 60;
          }

          const lockoutTime = Date.now() + durationSec * 1000;
          setLockoutUntil(lockoutTime);
          localStorage.setItem('vnquant_lockout_until', String(lockoutTime));
          setLockoutRemaining(durationSec);

          setErrorMsg(`CƠ CHẾ CHỐNG DÒ MẬT KHẨU KÍCH HOẠT! Nhập sai ${newAttempts} lần liên tiếp. Khóa thử lại trong ${durationSec}s.`);
        } else {
          const remaining = MAX_FAILED_ATTEMPTS - (newAttempts % MAX_FAILED_ATTEMPTS);
          setErrorMsg(`Mật khẩu không chính xác! Cảnh báo: Còn ${remaining} lần thử trước khi bị tạm khóa.`);
        }

        triggerShake();
      }
    } catch (err) {
      console.error('Password verification error:', err);
      setErrorMsg('Lỗi xác thực mật khẩu. Vui lòng thử lại!');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const isOldValid = await verifyPassword(oldPassInput);
    if (!isOldValid) {
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

    await saveNewPassword(newPassInput);
    setOldPassInput('');
    setNewPassInput('');
    setConfirmPassInput('');
    setIsChangingPassword(false);
    setChangeSuccessMsg('Đã băm SHA-256 và cập nhật mật khẩu mới an toàn!');
    setTimeout(() => setChangeSuccessMsg(''), 4000);
  };

  const handleUpdateAutoLock = (mins: number) => {
    setAutoLockTimeout(mins);
    setAutoLockMinutesState(mins);
    setIsSettingAutoLock(false);
    setChangeSuccessMsg(mins === 0 ? 'Đã tắt tính năng tự động khóa khi rảnh' : `Tự động khóa sau ${mins} phút không tương tác`);
    setTimeout(() => setChangeSuccessMsg(''), 4000);
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#020408]/80 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none">
      {/* Subtle Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Terminal Header Branding */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-blue-500/40 shadow-2xl shadow-blue-500/20 mb-2 relative group">
            <Lock className={`w-10 h-10 ${lockoutRemaining > 0 ? 'text-red-500' : 'text-blue-400'} animate-pulse`} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-ping" />
          </div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center justify-center space-x-2 drop-shadow-md">
            <span>VN-QUANT TERMINAL</span>
            <span className="bg-red-950/90 text-red-400 border border-red-800/80 text-[10px] px-2 py-0.5 rounded font-bold shadow-inner">LOCKED</span>
          </h1>
          <p className="text-xs text-gray-300 font-medium">Yêu Cầu Mật Khẩu Đăng Nhập Mỗi Khi Tải Trang (Auth Protection)</p>
        </div>

        {/* Lock Card Container - Glassmorphism */}
        <div
          className={`bg-slate-900/65 backdrop-blur-xl border ${
            lockoutRemaining > 0 ? 'border-red-500/80 shadow-red-950/50' : 'border-slate-700/70 hover:border-blue-500/60'
          } rounded-2xl p-6 shadow-[0_16px_40px_rgba(0,0,0,0.8)] space-y-5 transition-all duration-300 relative overflow-hidden ${
            shake ? 'animate-bounce border-red-500' : ''
          }`}
        >
          {/* Subtle Inner Glass Refraction Line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent pointer-events-none" />

          {/* Status & Security Indicator */}
          <div className="flex items-center justify-between bg-slate-950/70 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center space-x-2 text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Chống Dò Mật Khẩu Active</span>
            </div>
            <span className="text-[10px] text-gray-400">Mã PIN mặc định: <strong className="text-amber-400 font-bold">1234</strong></span>
          </div>

          {/* Brute-Force Lockout Banner */}
          {lockoutRemaining > 0 ? (
            <div className="bg-red-950/90 border-2 border-red-500 p-4 rounded-xl text-center space-y-2 animate-pulse">
              <div className="flex items-center justify-center space-x-2 text-red-400 font-black text-sm uppercase">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <span>ĐÃ KÍCH HOẠT BẢO VỆ CHỐNG DÒ MẬT KHẨU</span>
              </div>
              <p className="text-xs text-red-200">
                Bạn đã nhập sai {failedAttempts} lần liên tiếp. Hệ thống tự động khóa đăng nhập tạm thời.
              </p>
              <div className="inline-flex items-center space-x-2 bg-black/60 px-4 py-2 rounded-lg border border-red-800/80 text-amber-300 font-bold text-base font-mono">
                <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                <span>Thử lại sau: {String(Math.floor(lockoutRemaining / 60)).padStart(2, '0')}:{String(lockoutRemaining % 60).padStart(2, '0')}s</span>
              </div>
            </div>
          ) : failedAttempts > 0 ? (
            <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg flex items-center space-x-2 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Cảnh báo: Bạn đã nhập sai <strong className="text-white font-bold">{failedAttempts}</strong> lần. Nhập sai quá {MAX_FAILED_ATTEMPTS} lần sẽ bị khóa đăng nhập tạm thời.
              </span>
            </div>
          ) : null}

          {/* Password Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-300 uppercase">Nhập Mật Khẩu Khóa Terminal:</label>
                {/* Visual Counter Badge */}
                <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                  <span className="text-gray-400">Khả dụng:</span>
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-bold transition ${
                      lockoutRemaining > 0
                        ? 'bg-red-950 text-red-400 border-red-700 animate-pulse'
                        : remainingAttempts === 1
                        ? 'bg-amber-950 text-amber-300 border-amber-600 animate-pulse'
                        : remainingAttempts < 5
                        ? 'bg-blue-950 text-blue-300 border-blue-700'
                        : 'bg-emerald-950 text-emerald-400 border-emerald-700'
                    }`}
                  >
                    {lockoutRemaining > 0 ? '0/5 (Đã Khóa)' : `${remainingAttempts}/${MAX_FAILED_ATTEMPTS} Lần`}
                  </span>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={lockoutRemaining > 0}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lockoutRemaining > 0 ? `Bị khóa tạm thời... (${lockoutRemaining}s)` : 'Nhập mã PIN hoặc mật khẩu...'}
                  autoFocus
                  className={`w-full bg-slate-950/80 backdrop-blur-md text-white placeholder-gray-500 px-4 py-3 rounded-xl border-2 ${
                    lockoutRemaining > 0
                      ? 'border-red-600 shadow-red-950/40'
                      : remainingAttempts === 1
                      ? 'border-amber-500 focus:border-amber-400 shadow-amber-950/40'
                      : 'border-slate-800/90 focus:border-blue-500/80 focus:shadow-[0_0_15px_rgba(59,130,246,0.25)]'
                  } outline-none text-sm font-bold tracking-widest transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner`}
                />
                <button
                  type="button"
                  disabled={lockoutRemaining > 0}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition disabled:opacity-30"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Visual Segmented Progress Bar Indicator */}
              <div className="mt-2.5 bg-slate-950/70 backdrop-blur-md p-2.5 rounded-xl border border-slate-800/90 space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-gray-400 flex items-center space-x-1">
                    <ShieldAlert className="w-3 h-3 text-gray-400" />
                    <span>Tiến trình cơ chế chống dò PIN:</span>
                  </span>
                  <span
                    className={`font-bold ${
                      lockoutRemaining > 0
                        ? 'text-red-400'
                        : remainingAttempts === 1
                        ? 'text-amber-400'
                        : remainingAttempts < 5
                        ? 'text-blue-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {lockoutRemaining > 0
                      ? 'TẠM KHÓA TOÀN BỘ'
                      : remainingAttempts === 1
                      ? '⚠️ CẢNH BÁO LẦN THỬ CUỐI'
                      : `Còn lại ${remainingAttempts} lần thử`}
                  </span>
                </div>

                {/* Segmented Progress Bars (5 blocks) */}
                <div className="grid grid-cols-5 gap-1.5 h-2.5 w-full">
                  {Array.from({ length: MAX_FAILED_ATTEMPTS }).map((_, idx) => {
                    const isUsed = idx < currentCycleAttempts || lockoutRemaining > 0;
                    const isCurrentWarning = idx === currentCycleAttempts && remainingAttempts === 1 && lockoutRemaining === 0;

                    return (
                      <div
                        key={idx}
                        className={`h-full rounded-sm transition-all duration-300 relative overflow-hidden ${
                          lockoutRemaining > 0
                            ? 'bg-red-600 animate-pulse'
                            : isUsed
                            ? 'bg-slate-800 border border-slate-700/50 opacity-40'
                            : isCurrentWarning
                            ? 'bg-amber-400 border border-amber-300 animate-pulse shadow-sm shadow-amber-400/50'
                            : 'bg-emerald-500 border border-emerald-400/80 shadow-sm shadow-emerald-500/20'
                        }`}
                        title={
                          lockoutRemaining > 0
                            ? 'Đã bị khóa tạm thời'
                            : isUsed
                            ? `Thử sai lần ${idx + 1}`
                            : `Lần thử ${idx + 1} khả dụng`
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Numpad / PIN Helper */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1234'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={lockoutRemaining > 0}
                  onClick={() => {
                    if (digit === '1234') {
                      setPassword('1234');
                    } else {
                      setPassword((prev) => prev + digit);
                    }
                  }}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition duration-150 backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed ${
                    digit === '1234'
                      ? 'col-span-2 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border-amber-800/80 shadow-lg shadow-amber-950/30'
                      : 'bg-slate-950/60 hover:bg-blue-900/40 text-gray-200 border-slate-800/90 hover:border-blue-500/50'
                  }`}
                >
                  {digit === '1234' ? 'Thử 1234' : digit}
                </button>
              ))}
              <button
                type="button"
                disabled={lockoutRemaining > 0}
                onClick={() => setPassword('')}
                className="col-span-2 py-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/70 text-red-400 border border-red-900/60 text-xs font-bold transition duration-150 backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                XÓA NHẬP
              </button>
            </div>

            {errorMsg && lockoutRemaining === 0 && (
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
              disabled={lockoutRemaining > 0}
              className={`w-full font-black py-3 rounded-lg text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl transition transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ${
                lockoutRemaining > 0
                  ? 'bg-red-950 border border-red-700 text-red-400'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white hover:scale-[1.02] shadow-blue-600/30'
              }`}
            >
              {lockoutRemaining > 0 ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  <span>TÀI KHOẢN TẠM KHÓA ({lockoutRemaining}s)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  <span>MỞ KHÓA TÀI KHOẢN (UNLOCK)</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-gray-400">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsChangingPassword(true)}
                className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Đổi Mật Khẩu</span>
              </button>
              <span className="text-gray-700">|</span>
              <button
                type="button"
                onClick={() => setIsSettingAutoLock(true)}
                className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer transition"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Tự khóa: {autoLockMinutes === 0 ? 'Tắt' : `${autoLockMinutes}p`}</span>
              </button>
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              SHA-256 + Salt
            </span>
          </div>
        </div>

        {/* Auto-Lock Inactivity Configuration Modal */}
        {isSettingAutoLock && (
          <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0a0f1d] border-2 border-indigo-500/80 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>CẤU HÌNH TỰ ĐỘNG KHÓA KHI RẢNH</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSettingAutoLock(false)}
                  className="text-gray-400 hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Tự động khóa màn hình và bảo vệ dữ liệu khi không phát hiện thao tác chuột hoặc bàn phím:
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { label: '5 Phút', val: 5 },
                  { label: '10 Phút (Chuẩn)', val: 10 },
                  { label: '15 Phút', val: 15 },
                  { label: '30 Phút', val: 30 },
                  { label: 'Tắt tự động khóa', val: 0 },
                ].map((opt) => {
                  const isSelected = autoLockMinutes === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => handleUpdateAutoLock(opt.val)}
                      className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                        opt.val === 0 ? 'col-span-2' : ''
                      } ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                          : 'bg-slate-900/80 hover:bg-slate-800 text-gray-300 border-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal inside LockScreen */}
        {isChangingPassword && (
          <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0a0f1d] border-2 border-blue-500/80 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center space-x-2">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  <span>ĐỔI MẬT KHẨU BẢO MẬT (SHA-256)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="text-gray-400 hover:text-white font-bold cursor-pointer"
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
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-xs uppercase cursor-pointer"
                  >
                    Mã Hóa & Lưu Mật Khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs cursor-pointer"
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

