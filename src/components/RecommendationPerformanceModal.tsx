import { ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Filter, Search, ShieldAlert, Sparkles, TrendingUp, X } from 'lucide-react';
import React, { useState } from 'react';
import { ClosedTrade, RecommendationPerformance } from '../types';

interface RecommendationPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  performance: RecommendationPerformance;
  onSelectStock: (symbol: string) => void;
}

export const RecommendationPerformanceModal: React.FC<RecommendationPerformanceModalProps> = ({
  isOpen,
  onClose,
  performance,
  onSelectStock,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CHỐT_LỜI_TP' | 'CẮT_LỖ_SL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredTrades = performance.closedTrades.filter((trade) => {
    if (filterStatus !== 'ALL' && trade.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        trade.symbol.toLowerCase().includes(q) ||
        trade.name.toLowerCase().includes(q) ||
        trade.sector.toLowerCase().includes(q) ||
        trade.signalPattern.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-gray-800 w-full max-w-5xl max-h-[90vh] rounded-sm shadow-2xl flex flex-col font-mono text-gray-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#070707]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-sm bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  NHẬT KÝ KIỂM ĐỊNH LỆNH THỰC CHIẾN (AUDIT TRAIL)
                </h3>
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-sm">
                  WIN-RATE {performance.winRate}%
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Minh bạch lịch sử {performance.totalTrades} khuyến nghị đã đóng chu kỳ {performance.period}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-sm hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#050505] border-b border-gray-800 text-xs">
          <div className="bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800">
            <span className="text-gray-500 text-[10px] block">TỔNG SỐ LỆNH ĐÃ ĐÓNG</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-bold text-white">{performance.totalTrades}</span>
              <span className="text-gray-400 text-[11px]">
                ({performance.winningTrades} Thắng / {performance.losingTrades} Thua)
              </span>
            </div>
          </div>
          <div className="bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800">
            <span className="text-gray-500 text-[10px] block">LỢI NHUẬN TRUNG BÌNH</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-bold text-emerald-400">+{performance.avgProfitPercent}%</span>
              <span className="text-gray-400 text-[11px]">/ Lệnh</span>
            </div>
          </div>
          <div className="bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800">
            <span className="text-gray-500 text-[10px] block">PROFIT FACTOR (LÃI/LỖ)</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-bold text-cyan-400">{performance.profitFactor}x</span>
              <span className="text-gray-400 text-[11px]">(Lãi TB: +{performance.avgWinningProfitPercent}%)</span>
            </div>
          </div>
          <div className="bg-[#0a0a0a] p-2.5 rounded-sm border border-gray-800">
            <span className="text-gray-500 text-[10px] block">THỜI GIAN NẮM GIỮ TB</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-bold text-amber-400">{performance.avgHoldingDays}</span>
              <span className="text-gray-400 text-[11px]">Ngày / Vị thế</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-[#080808] border-b border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-sm border transition ${
                filterStatus === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-500 font-bold'
                  : 'bg-[#050505] text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              Tất cả ({performance.totalTrades})
            </button>
            <button
              onClick={() => setFilterStatus('CHỐT_LỜI_TP')}
              className={`px-2.5 py-1 rounded-sm border transition flex items-center space-x-1 ${
                filterStatus === 'CHỐT_LỜI_TP'
                  ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                  : 'bg-[#050505] text-emerald-400 border-gray-800 hover:border-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Chốt Lời TP ({performance.winningTrades})</span>
            </button>
            <button
              onClick={() => setFilterStatus('CẮT_LỖ_SL')}
              className={`px-2.5 py-1 rounded-sm border transition flex items-center space-x-1 ${
                filterStatus === 'CẮT_LỖ_SL'
                  ? 'bg-red-700 text-white border-red-600 font-bold'
                  : 'bg-[#050505] text-red-400 border-gray-800 hover:border-red-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cắt Lỗ SL ({performance.losingTrades})</span>
            </button>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Tìm mã CP, ngành, mẫu hình..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#050505] text-gray-200 pl-8 pr-3 py-1 rounded-sm border border-gray-800 outline-none text-xs w-full focus:border-cyan-500 transition"
            />
          </div>
        </div>

        {/* Trades Table */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <div className="border border-gray-800 rounded-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f0f0f] text-gray-400 border-b border-gray-800 text-[11px]">
                  <th className="py-2.5 px-3">MÃ CP</th>
                  <th className="py-2.5 px-3">SÀN & NGÀNH</th>
                  <th className="py-2.5 px-3">CHU KỲ (T+)</th>
                  <th className="py-2.5 px-3 text-right">GIÁ MUA</th>
                  <th className="py-2.5 px-3 text-right">GIÁ CHỐT</th>
                  <th className="py-2.5 px-3 text-right">LỢI NHUẬN %</th>
                  <th className="py-2.5 px-3 text-center">KẾT QUẢ</th>
                  <th className="py-2.5 px-3">TÍN HIỆU CĂN CỨ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80 bg-[#050505]">
                {filteredTrades.map((t) => {
                  const isWin = t.status === 'CHỐT_LỜI_TP';
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-900/60 transition group cursor-pointer"
                      onClick={() => {
                        onSelectStock(t.symbol);
                        onClose();
                      }}
                    >
                      <td className="py-2.5 px-3 font-bold text-white group-hover:text-cyan-400">
                        <div className="flex items-center space-x-1.5">
                          <span>{t.symbol}</span>
                          <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-cyan-400" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">
                        <span className="text-[10px] px-1 py-0.2 bg-gray-900 border border-gray-800 rounded-sm mr-1.5 text-gray-300">
                          {t.exchange}
                        </span>
                        <span className="text-gray-400 text-[11px]">{t.sector}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-[11px]">
                        <div>{t.entryDate} → {t.closedDate}</div>
                        <div className="text-[10px] text-gray-500">({t.holdingDays} ngày)</div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-300 font-mono">
                        {t.entryPrice.toFixed(1)}k
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-100 font-bold font-mono">
                        {t.closedPrice.toFixed(1)}k
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono">
                        <span
                          className={`inline-flex items-center space-x-0.5 ${
                            isWin ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isWin ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          <span>{t.returnPercent > 0 ? `+${t.returnPercent}%` : `${t.returnPercent}%`}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-sm border ${
                            isWin
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                              : 'bg-red-950/80 text-red-300 border-red-800'
                          }`}
                        >
                          {isWin ? '🎯 ĐẠT TP' : '🛑 CẮT LỖ SL'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-300 text-[11px] max-w-[280px] truncate">
                        {t.signalPattern}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#070707] border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>* Các lệnh khuyến nghị được tự động ghi nhận tại điểm phát hiện tín hiệu Smart Money và đóng lệnh khi chạm giá TP/SL</span>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-1.5 rounded-sm transition font-bold"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
};
