import { AlertTriangle, Bell, Check, CheckCheck, Clock, ExternalLink, Play, Plus, Trash2, Volume2, X, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { StockData } from '../types';
import { MockNotification, StockAlert } from '../types/alert';
import { checkAlertTrigger, formatConditionLabel, playAlertSound } from '../services/alertService';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: StockAlert[];
  notifications: MockNotification[];
  stocks: StockData[];
  onToggleAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onOpenSetModal: () => void;
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
  onTriggerMockNotif: (notif: Omit<MockNotification, 'id' | 'timestamp' | 'read'>) => void;
  onSelectStock: (symbol: string) => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  notifications,
  stocks,
  onToggleAlert,
  onDeleteAlert,
  onOpenSetModal,
  onMarkNotificationsRead,
  onClearNotifications,
  onTriggerMockNotif,
  onSelectStock,
}) => {
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'LOGS'>('ALERTS');
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!isOpen) return null;

  const handleTestAlertTrigger = (alert: StockAlert) => {
    const targetStock = stocks.find((s) => s.symbol === alert.symbol);
    if (!targetStock) return;

    playAlertSound();
    const evalRes = checkAlertTrigger(alert, targetStock);

    const title = evalRes.isTriggered
      ? `🚨 KÍCH HOẠT CẢNH BÁO ${alert.symbol}`
      : `🔔 MÔ PHỎNG THỬ CẢNH BÁO ${alert.symbol}`;

    const message = evalRes.isTriggered
      ? evalRes.message
      : `Tín hiệu ${formatConditionLabel(alert.triggerType, alert.condition, alert.targetValue)}. Giá ${alert.symbol} hiện tại: ${targetStock.price} VNĐ.`;

    onTriggerMockNotif({
      alertId: alert.id,
      symbol: alert.symbol,
      triggerType: alert.triggerType,
      title,
      message,
      channel: alert.channel,
      severity: evalRes.isTriggered ? evalRes.severity : 'INFO',
    });
  };

  const handleEvaluateAllLive = () => {
    let triggeredCount = 0;
    playAlertSound();

    alerts.forEach((alt) => {
      if (!alt.isActive) return;
      const stk = stocks.find((s) => s.symbol === alt.symbol);
      if (!stk) return;

      const res = checkAlertTrigger(alt, stk);
      if (res.isTriggered) {
        triggeredCount++;
        onTriggerMockNotif({
          alertId: alt.id,
          symbol: alt.symbol,
          triggerType: alt.triggerType,
          title: `🔥 KÍCH HOẠT TÍN HIỆU THỜI GIAN THỰC: ${alt.symbol}`,
          message: res.message,
          channel: alt.channel,
          severity: res.severity,
        });
      }
    });

    if (triggeredCount === 0) {
      onTriggerMockNotif({
        symbol: 'MARKET',
        triggerType: 'PRICE_THRESHOLD',
        title: 'ℹ️ QUÉT TÍN HIỆU CẢNH BÁO TOÀN THỊ TRƯỜNG',
        message: 'Tất cả điều kiện cảnh báo hiện tại đang trong trạng thái an toàn, chưa vi phạm ngưỡng đặt.',
        channel: 'IN_APP',
        severity: 'INFO',
      });
    }

    setActiveTab('LOGS');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm font-mono animate-fadeIn">
      <div className="bg-[#0a0a0a] border-l border-gray-800 w-full max-w-xl text-[#d1d5db] shadow-2xl h-full flex flex-col">
        {/* Header */}
        <div className="bg-[#050505] p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
              <Bell className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">HỆ THỐNG CẢNH BÁO & NOTIFICATION</h3>
              <p className="text-[11px] text-gray-400">Quản lý tín hiệu thời gian thực & lịch sử thông báo</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenSetModal}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-sm text-xs flex items-center space-x-1 shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>TẠO MỚI</span>
            </button>

            <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-gray-800 text-gray-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#050505] px-4 py-2 border-b border-gray-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('ALERTS')}
              className={`px-3 py-1.5 rounded-sm font-bold transition flex items-center space-x-1.5 border ${
                activeTab === 'ALERTS'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#0a0a0a] text-gray-400 hover:text-gray-200 border-gray-800'
              }`}
            >
              <span>DANH SÁCH CẢNH BÁO</span>
              <span className="bg-[#050505] px-1.5 py-0.5 rounded text-[10px] text-blue-400 border border-gray-800">
                {alerts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 rounded-sm font-bold transition flex items-center space-x-1.5 border ${
                activeTab === 'LOGS'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#0a0a0a] text-gray-400 hover:text-gray-200 border-gray-800'
              }`}
            >
              <span>LỊCH SỬ THÔNG BÁO</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] font-black animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handleEvaluateAllLive}
            className="px-2.5 py-1 bg-[#0a0a0a] hover:bg-gray-800 text-amber-400 border border-amber-500/40 rounded-sm text-[11px] font-bold flex items-center space-x-1 transition"
            title="Quét toàn bộ cổ phiếu đối chiếu với cảnh báo"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>QUÉT THỜI GIAN THỰC</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {/* TAB 1: ALERTS LIST */}
          {activeTab === 'ALERTS' && (
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-gray-500 space-y-2">
                  <Bell className="w-10 h-10 mx-auto opacity-30 text-gray-400" />
                  <p className="text-xs">Chưa có cảnh báo nào được cài đặt.</p>
                  <button
                    onClick={onOpenSetModal}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-sm text-xs font-bold"
                  >
                    Tạo cảnh báo đầu tiên
                  </button>
                </div>
              ) : (
                alerts.map((alt) => {
                  const stk = stocks.find((s) => s.symbol === alt.symbol);
                  const label = formatConditionLabel(alt.triggerType, alt.condition, alt.targetValue);

                  return (
                    <div
                      key={alt.id}
                      className={`p-3.5 rounded-sm border transition space-y-2.5 ${
                        alt.isActive
                          ? 'bg-[#050505] border-gray-800 hover:border-gray-700'
                          : 'bg-[#050505]/50 border-gray-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            onClick={() => onSelectStock(alt.symbol)}
                            className="text-sm font-black text-white hover:text-blue-400 cursor-pointer underline decoration-dotted"
                          >
                            {alt.symbol}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#0a0a0a] border border-gray-800 text-blue-400 font-bold rounded-sm uppercase">
                            {alt.triggerType.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-gray-500 font-bold">
                            Kênh: {alt.channel}
                          </span>
                        </div>

                        {/* Active Toggle & Delete */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onToggleAlert(alt.id)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm border transition ${
                              alt.isActive
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                : 'bg-gray-900 text-gray-500 border-gray-800'
                            }`}
                          >
                            {alt.isActive ? 'BẬT' : 'TẮT'}
                          </button>

                          <button
                            onClick={() => onDeleteAlert(alt.id)}
                            className="p-1 hover:bg-red-950/80 hover:text-red-400 text-gray-500 rounded-sm transition"
                            title="Xóa cảnh báo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Condition Text */}
                      <div className="text-xs font-bold text-gray-200">
                        {label}
                      </div>

                      {stk && (
                        <div className="text-[11px] text-gray-400 flex items-center justify-between bg-[#0a0a0a] p-2 rounded-sm border border-gray-800/80">
                          <span>Giá hiện tại: <strong className="text-white">{stk.price.toFixed(2)} VNĐ</strong></span>
                          <span>Đã kích hoạt: <strong className="text-blue-400">{alt.triggerCount} lần</strong></span>
                        </div>
                      )}

                      {alt.note && (
                        <p className="text-[11px] text-amber-400/90 italic">
                          "{alt.note}"
                        </p>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-800/60 text-[10px]">
                        <span className="text-gray-500">
                          Tạo lúc: {new Date(alt.createdAt).toLocaleTimeString('vi-VN')}
                        </span>

                        <button
                          onClick={() => handleTestAlertTrigger(alt)}
                          className="px-2 py-1 bg-[#0a0a0a] hover:bg-gray-800 text-amber-400 font-bold rounded-sm border border-gray-800 flex items-center space-x-1 transition"
                        >
                          <Play className="w-3 h-3" />
                          <span>MÔ PHỎNG THỬ</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS LOGS */}
          {activeTab === 'LOGS' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-gray-800">
                <span className="text-gray-400 font-bold">LỊCH SỬ TÍN HIỆU THỜI GIAN THỰC ({notifications.length})</span>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkNotificationsRead}
                      className="text-blue-400 hover:underline text-[11px] flex items-center space-x-1 font-bold"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Đánh dấu đã đọc</span>
                    </button>
                  )}
                  <button
                    onClick={onClearNotifications}
                    className="text-gray-500 hover:text-red-400 text-[11px] transition"
                  >
                    Xóa nhật ký
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500 space-y-2">
                  <Clock className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs">Chưa có thông báo nào được ghi nhận.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-sm border space-y-1.5 transition ${
                      notif.severity === 'SUCCESS'
                        ? 'bg-emerald-950/30 border-emerald-800/80'
                        : notif.severity === 'DANGER'
                        ? 'bg-red-950/30 border-red-800/80'
                        : notif.severity === 'WARNING'
                        ? 'bg-amber-950/30 border-amber-800/80'
                        : 'bg-[#050505] border-gray-800'
                    } ${!notif.read ? 'border-l-4 border-l-blue-500 font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span
                          onClick={() => notif.symbol !== 'MARKET' && onSelectStock(notif.symbol)}
                          className="font-black text-white hover:text-blue-400 cursor-pointer underline decoration-dotted"
                        >
                          {notif.symbol}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">[{notif.channel}]</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{notif.timestamp}</span>
                    </div>

                    <h4 className="text-xs font-bold text-gray-100">{notif.title}</h4>
                    <p className="text-[11px] text-gray-300 leading-relaxed font-sans">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
