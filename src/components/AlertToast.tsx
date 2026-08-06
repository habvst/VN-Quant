import { Bell, CheckCircle2, AlertOctagon, Info, AlertTriangle, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { MockNotification } from '../types/alert';

interface AlertToastProps {
  notification: MockNotification | null;
  onDismiss: () => void;
  onSelectStock: (symbol: string) => void;
}

export const AlertToast: React.FC<AlertToastProps> = ({ notification, onDismiss, onSelectStock }) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const getIcon = () => {
    switch (notification.severity) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'DANGER':
        return <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed top-16 right-4 z-50 max-w-md w-full font-mono animate-slideDown">
      <div
        className={`bg-[#0a0a0a] border p-4 rounded-sm shadow-2xl text-[#d1d5db] flex items-start space-x-3 backdrop-blur-md ${
          notification.severity === 'SUCCESS'
            ? 'border-emerald-500/80 bg-emerald-950/40'
            : notification.severity === 'DANGER'
            ? 'border-red-500/80 bg-red-950/40'
            : notification.severity === 'WARNING'
            ? 'border-amber-500/80 bg-amber-950/40'
            : 'border-blue-500/80 bg-blue-950/40'
        }`}
      >
        {getIcon()}

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span
                onClick={() => {
                  if (notification.symbol !== 'MARKET') onSelectStock(notification.symbol);
                  onDismiss();
                }}
                className="font-black text-sm text-white hover:text-blue-400 cursor-pointer underline decoration-dotted"
              >
                {notification.symbol}
              </span>
              <span className="text-[10px] bg-[#050505] text-blue-400 px-1.5 py-0.5 rounded-sm border border-gray-800 font-bold uppercase">
                {notification.channel}
              </span>
            </div>
            <span className="text-[10px] text-gray-400">{notification.timestamp}</span>
          </div>

          <h5 className="text-xs font-bold text-white">{notification.title}</h5>
          <p className="text-[11px] text-gray-300 font-sans leading-snug">{notification.message}</p>
        </div>

        <button onClick={onDismiss} className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-sm transition">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
