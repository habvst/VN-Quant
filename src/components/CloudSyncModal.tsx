import React, { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  PieChart,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  activeFirebaseConfig,
  saveCustomFirebaseConfig,
  resetToDefaultFirebaseConfig,
  CUSTOM_FIREBASE_STORAGE_KEY,
} from '../lib/firebase';
import { User } from 'firebase/auth';
import { CloudSyncStatus, portfolioCloudSync } from '../services/portfolioCloudSync';

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
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);

  const [pinInput, setPinInput] = useState<string>(() => portfolioCloudSync.getPin());
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Local data summary snapshot
  const [summary, setSummary] = useState(() => portfolioCloudSync.getLocalDataSummary());

  // Custom Firebase configuration state (client-side override)
  const [showConfigEditor, setShowConfigEditor] = useState<boolean>(false);
  const [configJsonInput, setConfigJsonInput] = useState<string>('');
  const [configError, setConfigError] = useState<string | null>(null);
  const hasCustomLocalConfig = typeof window !== 'undefined' && Boolean(localStorage.getItem(CUSTOM_FIREBASE_STORAGE_KEY));

  const handleApplyCustomConfig = () => {
    setConfigError(null);
    try {
      let cleanInput = configJsonInput.trim();
      if (cleanInput.startsWith('const ') || cleanInput.startsWith('var ') || cleanInput.startsWith('let ')) {
        const eqIdx = cleanInput.indexOf('=');
        if (eqIdx !== -1) {
          cleanInput = cleanInput.substring(eqIdx + 1).trim();
        }
      }
      if (cleanInput.endsWith(';')) {
        cleanInput = cleanInput.slice(0, -1).trim();
      }
      // Replace unquoted object keys like apiKey: with "apiKey":
      cleanInput = cleanInput.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

      const parsed = JSON.parse(cleanInput);
      if (!parsed.projectId || !parsed.apiKey) {
        throw new Error('Dữ liệu cấu hình phải có ít nhất projectId và apiKey.');
      }

      saveCustomFirebaseConfig({
        projectId: String(parsed.projectId).trim(),
        apiKey: String(parsed.apiKey).trim(),
        authDomain: parsed.authDomain ? String(parsed.authDomain).trim() : `${parsed.projectId}.firebaseapp.com`,
        storageBucket: parsed.storageBucket ? String(parsed.storageBucket).trim() : `${parsed.projectId}.appspot.com`,
        messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId).trim() : '',
        appId: parsed.appId ? String(parsed.appId).trim() : '',
        firestoreDatabaseId: parsed.firestoreDatabaseId ? String(parsed.firestoreDatabaseId).trim() : '(default)',
      });

      window.location.reload();
    } catch (e: any) {
      setConfigError(e?.message || 'Định dạng JSON cấu hình không hợp lệ. Vui lòng kiểm tra lại.');
    }
  };

  const handleResetConfig = () => {
    resetToDefaultFirebaseConfig();
    window.location.reload();
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setCurrentUser(u);
    });

    const unsubSync = portfolioCloudSync.onStatusChange((status, time, err) => {
      setSyncStatus(status);
      setLastSyncTime(time);
      if (err) setErrorMsg(err);
      else setErrorMsg(null);
      setSummary(portfolioCloudSync.getLocalDataSummary());
    });

    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPinInput(portfolioCloudSync.getPin());
      setSummary(portfolioCloudSync.getLocalDataSummary());
    }
  }, [isOpen]);

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
    setSyncSuccessMsg(`Đã lưu & áp dụng mã PIN E2EE! Khóa giải mã AES-256 đã sẵn sàng.`);
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
      const res = await portfolioCloudSync.syncNow();
      if (res.success) {
        setSyncSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
      setSummary(portfolioCloudSync.getLocalDataSummary());
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi đồng bộ');
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleForceUpload = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const ok = await portfolioCloudSync.pushToCloud();
      if (ok) {
        setSyncSuccessMsg('Đã mã hóa và tải toàn bộ danh mục lên Cloud Firestore an toàn!');
        setSummary(portfolioCloudSync.getLocalDataSummary());
        setTimeout(() => setSyncSuccessMsg(null), 4000);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi khi tải lên Cloud');
    } finally {
      setIsUploading(false);
    }
  };

  const handleForceDownload = async () => {
    setIsDownloading(true);
    setErrorMsg(null);
    try {
      const ok = await portfolioCloudSync.pullFromCloud();
      if (ok) {
        setSyncSuccessMsg('Đã khôi phục dữ liệu từ Cloud Firestore về thiết bị thành công!');
        setSummary(portfolioCloudSync.getLocalDataSummary());
        setTimeout(() => setSyncSuccessMsg(null), 4000);
      } else {
        setErrorMsg('Chưa tìm thấy dữ liệu đã lưu trên Cloud hoặc mã PIN chưa chính xác.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi khi kéo dữ liệu từ Cloud');
    } finally {
      setIsDownloading(false);
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
        <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Notifications */}
          {syncSuccessMsg && (
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-600/80 rounded text-emerald-300 text-[11px] flex items-center space-x-2 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="space-y-2 animate-in fade-in">
              <div className="p-2.5 bg-red-950/80 border border-red-600/80 rounded text-red-300 text-[11px] flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>

              {errorMsg.toLowerCase().includes('unauthorized-domain') && (
                <div className="p-3 bg-blue-950/40 border border-blue-600/60 rounded text-blue-200 text-xs space-y-2.5 font-sans">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Cách xử lý: Thêm tên miền Render vào Firebase Authorized Domains</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Firebase Auth chặn các tên miền lạ để bảo vệ tài khoản. Bạn chỉ cần sao chép tên miền hiện tại của Render và dán vào phần cài đặt của Firebase:
                  </p>

                  <div className="bg-[#050811] p-2 rounded border border-gray-700 flex items-center justify-between text-xs font-mono">
                    <span className="text-emerald-400 select-all truncate mr-2 font-bold">
                      {typeof window !== 'undefined' ? window.location.hostname : 'your-app.onrender.com'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(window.location.hostname);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 2500);
                        }
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold flex items-center gap-1 shrink-0 transition"
                    >
                      {copiedDomain ? <CheckCircle2 className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                      {copiedDomain ? 'Đã sao chép' : 'Sao chép Domain'}
                    </button>
                  </div>

                  <div className="text-[11px] text-gray-300 space-y-2 pl-2.5 border-l-2 border-blue-500">
                    <div className="bg-black/40 p-2 rounded border border-gray-700 text-[11px]">
                      <span className="text-gray-400">Firebase Project đang nhận: </span>
                      <span className={`font-mono font-bold ${activeFirebaseConfig.projectId === 'phrasal-perigee-bkm1r' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {activeFirebaseConfig.projectId}
                      </span>
                      {hasCustomLocalConfig && (
                        <span className="ml-2 text-[10px] text-emerald-300 bg-emerald-950/70 border border-emerald-700 px-1.5 py-0.5 rounded font-mono">
                          (Tùy chỉnh cục bộ)
                        </span>
                      )}
                      {activeFirebaseConfig.projectId === 'phrasal-perigee-bkm1r' && (
                        <div className="text-amber-300 text-[10px] mt-1">
                          ⚠️ Render hiện vẫn đang chạy với Project mặc định cũ (chưa nhận biến môi trường của dự án <b>my-vnquant-terminal</b>).
                        </div>
                      )}
                    </div>
                    <div>
                      <b>Cách 1 (Nhanh nhất):</b> Bấm nút <b>"Cấu hình Firebase trực tiếp"</b> bên dưới để dán cấu hình dự án <b>my-vnquant-terminal</b> và đăng nhập Google ngay lập tức mà không cần chờ Render build lại!
                    </div>
                    <div>
                      <b>Cách 2:</b> Cấu hình biến môi trường <code>VITE_FIREBASE_*</code> trên Render.
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConfigEditor(!showConfigEditor)}
                      className="inline-flex items-center gap-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-1 rounded transition"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      {showConfigEditor ? 'Đóng form cấu hình' : 'Cấu hình Firebase trực tiếp'}
                    </button>

                    <a
                      href={`https://console.firebase.google.com/project/${activeFirebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 underline font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Mở Firebase Console
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Direct Firebase Configuration Box (Collapsible) */}
          {showConfigEditor && (
            <div className="p-3 bg-[#0a0f1d] border border-blue-500/80 rounded space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                  <Settings2 className="w-4 h-4 text-blue-400" />
                  <span>Dán cấu hình Firebase của bạn (Project: my-vnquant-terminal)</span>
                </div>
                {hasCustomLocalConfig && (
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-950/50 px-2 py-0.5 rounded border border-red-800 transition"
                    title="Xóa cấu hình tùy chỉnh để quay về mặc định"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Khôi phục mặc định</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-gray-300 leading-relaxed">
                Vào <b>Firebase Console</b> &rarr; <b>Project Settings</b> &rarr; cuộn xuống mục <b>Your apps</b> (Web app) &rarr; sao chép đoạn mã <code>firebaseConfig</code> và dán vào ô bên dưới:
              </p>

              <textarea
                value={configJsonInput}
                onChange={(e) => setConfigJsonInput(e.target.value)}
                placeholder={`{\n  "apiKey": "AIzaSy...",\n  "authDomain": "my-vnquant-terminal.firebaseapp.com",\n  "projectId": "my-vnquant-terminal",\n  "storageBucket": "my-vnquant-terminal.appspot.com",\n  "messagingSenderId": "...",\n  "appId": "..."\n}`}
                className="w-full h-28 bg-[#04060b] border border-gray-700 rounded p-2 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-blue-500"
              />

              {configError && (
                <div className="text-[11px] text-red-400 bg-red-950/60 p-2 rounded border border-red-800">
                  {configError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigEditor(false)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomConfig}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs flex items-center gap-1.5 transition shadow"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Lưu & Áp Dụng Ngay
                </button>
              </div>
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
                    <div className="font-bold text-white">{currentUser.displayName || 'Nhà đầu tư Quant'}</div>
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
                <strong className="text-amber-300">Cơ chế bảo mật Zero-Knowledge:</strong> Dữ liệu danh mục, vốn, tiền mặt, lệnh và watchlist được mã hóa trực tiếp trên trình duyệt bằng mã PIN của bạn trước khi tải lên Cloud.
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
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded transition cursor-pointer shrink-0 flex items-center space-x-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>LƯU & ÁP DỤNG PIN</span>
              </button>
            </div>

            <div className="text-[10px] text-gray-400 flex items-center justify-between pt-0.5">
              <span>Mã PIN đang kích hoạt: <strong className="text-amber-400 font-mono">••••</strong> (Tự động ghi nhớ trên thiết bị)</span>
            </div>
          </div>

          {/* Section 3: Data Protected Summary */}
          <div className="bg-[#050811] p-3 rounded border border-gray-800 space-y-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <PieChart className="w-3.5 h-3.5 text-blue-400" />
              <span>DỮ LIỆU ĐƯỢC BẢO VỆ & ĐỒNG BỘ</span>
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-black/60 rounded border border-gray-800">
                <div className="text-[10px] text-gray-400">Vị thế sở hữu</div>
                <div className="text-xs font-bold text-emerald-400">{summary.positionsCount} mã CP</div>
              </div>
              <div className="p-2 bg-black/60 rounded border border-gray-800">
                <div className="text-[10px] text-gray-400">Theo dõi (Watchlist)</div>
                <div className="text-xs font-bold text-blue-400">{summary.watchlistCount} mã</div>
              </div>
              <div className="p-2 bg-black/60 rounded border border-gray-800">
                <div className="text-[10px] text-gray-400">Lệnh đã chốt</div>
                <div className="text-xs font-bold text-purple-400">{summary.tradesCount} lệnh</div>
              </div>
              <div className="p-2 bg-black/60 rounded border border-gray-800">
                <div className="text-[10px] text-gray-400">Tiền khả dụng</div>
                <div className="text-xs font-bold text-amber-400">
                  {summary.cashBalance ? (summary.cashBalance / 1e6).toFixed(0) + ' Tr' : '0 Tr'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Live Sync State & Diagnostics */}
          <div className="bg-[#050811] p-3 rounded border border-gray-800 space-y-2.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span>TRẠNG THÁI & THAO TÁC ĐỒNG BỘ ĐA THIẾT BỊ</span>
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

            <div className="pt-1 flex flex-wrap justify-end gap-2">
              <button
                onClick={handleForceDownload}
                disabled={isDownloading || !currentUser}
                title="Khôi phục dữ liệu từ Cloud Firestore về máy này"
                className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-gray-300 px-3 py-1.5 rounded font-bold transition cursor-pointer disabled:opacity-50"
              >
                <ArrowDownToLine className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span>KHÔI PHỤC TỪ CLOUD</span>
              </button>

              <button
                onClick={handleForceUpload}
                disabled={isUploading || !currentUser}
                title="Mã hóa và tải dữ liệu máy này lên Cloud Firestore"
                className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-blue-300 px-3 py-1.5 rounded font-bold transition cursor-pointer disabled:opacity-50"
              >
                <ArrowUpToLine className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
                <span>TẢI LÊN CLOUD (BACKUP)</span>
              </button>

              <button
                onClick={handleForceManualSync}
                disabled={isSyncingNow || !currentUser}
                className="flex items-center space-x-1.5 bg-blue-900/60 hover:bg-blue-800 border border-blue-700 text-blue-200 px-3.5 py-1.5 rounded font-bold transition cursor-pointer disabled:opacity-50 shadow-md"
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

