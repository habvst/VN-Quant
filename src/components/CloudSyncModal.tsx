import React, { useEffect, useState } from 'react';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  User as UserIcon,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { auth, loginWithGoogle, logoutUser } from '../lib/firebase';
import { User } from 'firebase/auth';
import { CloudSyncStatus, portfolioCloudSync, PortfolioDataModel } from '../services/portfolioCloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManualSyncTrigger?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose, onManualSyncTrigger }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('LOCAL_ONLY');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pinInput, setPinInput] = useState<string>('0000');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setCurrentUser(u);
    });

    const unsubSync = portfolioCloudSync.onStatusChange((status, time, err) => {
      setSyncStatus(status);
      setLastSyncTime(time);
      if (err) setErrorMsg(err);
      else setErrorMsg(null);
    });

    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      setSyncSuccessMsg('Đăng nhập Google thành công! Hệ thống đang kích hoạt đồng bộ E2EE.');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập Google thất bại');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutUser();
      setSyncSuccessMsg('Đã đăng xuất tài khoản.');
      setTimeout(() => setSyncSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApplyPin = () => {
    if (pinInput.length < 4) {
      setErrorMsg('Mã PIN mã hóa phải có ít nhất 4 ký tự.');
      return;
    }
    portfolioCloudSync.setPin(pinInput);
    setSyncSuccessMsg(`Đã cập nhật mã PIN E2EE! Khóa giải mã AES-256 đang được thiết lập.`);
    setErrorMsg(null);
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  const handleForceManualSync = async () => {
    setIsSyncingNow(true);
    setErrorMsg(null);
    try {
      if (onManualSyncTrigger) {
        onManualSyncTrigger();
      }
      setSyncSuccessMsg('Đã phát tín hiệu đồng bộ đám mây tức thì!');
      setTimeout(() => setSyncSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setTimeout(() => setIsSyncingNow(false), 600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
      <div className="bg-[#0c101a] border border-blue-500/60 w-full max-w-lg rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-gray-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-black p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded bg-blue-600/30 text-blue-400 border border-blue-500/50">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  ĐỒNG BỘ ĐÁM MÂY & MÃ HÓA ĐẦU CUỐI (E2EE)
                </h3>
                <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] border border-emerald-800 font-bold">
                  ZERO-KNOWLEDGE
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                Cloud Firestore Persistent Storage • Đồng bộ đa thiết bị tức thời
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Notifications */}
          {syncSuccessMsg && (
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-600/80 rounded text-emerald-300 text-[11px] flex items-center space-x-2 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-red-950/80 border border-red-600/80 rounded text-red-300 text-[11px] flex items-center space-x-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: User Account & Authentication Status */}
          <div className="bg-[#050811] p-3 rounded border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>TÀI KHOẢN ĐỒNG BỘ ĐÁM MÂY</span>
              </span>

              {currentUser ? (
                <span className="flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>ĐÃ KẾT NỐI CLOUD</span>
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800">
                  LƯU TRỮ CỤC BỘ (CHƯA ĐĂNG NHẬP)
                </span>
              )}
            </div>

            {currentUser ? (
              <div className="flex items-center justify-between p-2 bg-[#090d18] rounded border border-gray-800">
                <div className="flex items-center space-x-2.5">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full border border-blue-500"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                      {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-white">{currentUser.displayName || 'Nhà đầu tư'}</div>
                    <div className="text-[10px] text-gray-400">{currentUser.email}</div>
                  </div>
                </div>

                <button
                  onClick={handleGoogleLogout}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded font-bold transition cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-r from-blue-950/40 via-slate-900/40 to-black rounded border border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="text-white font-bold">Đăng nhập bằng tài khoản Google</div>
                  <div className="text-[10px] text-gray-400">
                    Lưu trữ danh mục lên Cloud Firestore an toàn, tự động đồng bộ trên Điện thoại, Tablet, Laptop.
                  </div>
                </div>
                <button
                  onClick={handleGoogleLogin}
                  disabled={isAuthenticating}
                  className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-2 rounded shadow-md transition cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isAuthenticating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5" />
                  )}
                  <span>ĐĂNG NHẬP GOOGLE</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: End-to-End Encryption (E2EE) PIN Configuration */}
          <div className="bg-[#050811] p-3 rounded border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>MÃ HÓA ĐẦU CUỐI ZERO-KNOWLEDGE (E2EE)</span>
              </span>
              <span className="text-[9px] text-gray-400 font-mono">AES-GCM 256-bit + PBKDF2</span>
            </div>

            <div className="p-2.5 bg-black/60 rounded border border-amber-500/30 text-[11px] text-gray-300 space-y-1">
              <p>
                <strong className="text-amber-300">Cơ chế bảo mật Zero-Knowledge:</strong> Dữ liệu danh mục, vốn, tiền mặt và lịch sử lệnh được mã hóa trực tiếp trên trình duyệt bằng mã PIN của bạn trước khi tải lên Cloud.
              </p>
              <p className="text-[10px] text-gray-400">
                • Kể cả máy chủ hay nhà cung cấp Đám mây cũng không thể giải mã nội dung nếu không có mã PIN này.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Nhập mã PIN bảo mật (mặc định: 0000)..."
                  className="w-full bg-black border border-gray-700 rounded px-3 py-1.5 text-white font-mono font-bold text-xs focus:border-amber-500 outline-none pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={handleApplyPin}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded transition cursor-pointer shrink-0"
              >
                ÁP DỤNG PIN
              </button>
            </div>
          </div>

          {/* Section 3: Live Sync State & Diagnostics */}
          <div className="bg-[#050811] p-3 rounded border border-gray-800 space-y-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span>TRẠNG THÁI ĐỒNG BỘ ĐA THIẾT BỊ</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-black/50 rounded border border-gray-800 flex justify-between items-center">
                <span className="text-gray-400">Trạng thái:</span>
                <span
                  className={`font-bold ${
                    syncStatus === 'SYNCED'
                      ? 'text-emerald-400'
                      : syncStatus === 'SYNCING'
                      ? 'text-blue-400 animate-pulse'
                      : syncStatus === 'NEED_PIN'
                      ? 'text-amber-400'
                      : 'text-gray-400'
                  }`}
                >
                  {syncStatus === 'SYNCED'
                    ? '🟢 ĐÃ ĐỒNG BỘ'
                    : syncStatus === 'SYNCING'
                    ? '🟡 ĐANG ĐỒNG BỘ...'
                    : syncStatus === 'NEED_PIN'
                    ? '🔒 CẦN PIN GIẢI MÃ'
                    : '⚪ LOCAL ONLY'}
                </span>
              </div>

              <div className="p-2 bg-black/50 rounded border border-gray-800 flex justify-between items-center">
                <span className="text-gray-400">Lần cuối đồng bộ:</span>
                <span className="font-bold text-white">{lastSyncTime || 'Chưa đồng bộ'}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={handleForceManualSync}
                disabled={isSyncingNow}
                className="flex items-center space-x-1.5 bg-blue-900/60 hover:bg-blue-800 border border-blue-700 text-blue-200 px-3 py-1.5 rounded font-bold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                <span>ĐỒNG BỘ NGAY BÂY GIỜ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#080b12] border-t border-gray-800 flex justify-between items-center">
          <div className="text-[10px] text-gray-500 font-mono">
            Firebase Firestore Enterprise Edition • Encryption: AES-GCM 256
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold transition cursor-pointer"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
};
