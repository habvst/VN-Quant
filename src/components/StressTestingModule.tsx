import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Flame,
  HelpCircle,
  History,
  Info,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { StockData } from '../types';
import {
  HISTORICAL_SCENARIOS,
  runPortfolioStressTest,
  StressScenario,
} from '../utils/stressTestEngine';

interface StressTestingModuleProps {
  positions: {
    id: string;
    symbol: string;
    quantity: number;
    buyPrice: number;
    currentPrice: number;
    currentValue: number;
  }[];
  stocks: StockData[];
  freeCash: number;
  pendingCash: number;
  onSelectStock?: (symbol: string) => void;
}

export const StressTestingModule: React.FC<StressTestingModuleProps> = ({
  positions,
  stocks,
  freeCash,
  pendingCash,
  onSelectStock,
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('FLASH_CRASH_55PTS');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customDropPercent, setCustomDropPercent] = useState<number>(-5.0);

  const selectedScenario = useMemo(() => {
    return (
      HISTORICAL_SCENARIOS.find((s) => s.id === selectedScenarioId) ||
      HISTORICAL_SCENARIOS[0]
    );
  }, [selectedScenarioId]);

  const stressResult = useMemo(() => {
    return runPortfolioStressTest(
      positions,
      stocks,
      freeCash,
      pendingCash,
      selectedScenario,
      isCustomMode ? customDropPercent : undefined
    );
  }, [positions, stocks, freeCash, pendingCash, selectedScenario, isCustomMode, customDropPercent]);

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Module Title Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-400 font-bold shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                MÔ PHỎNG KHỦNG HOẢNG & STRESS-TESTING (HISTORICAL SCENARIO ANALYSIS)
              </h2>
              <span className="bg-red-950 text-red-400 px-1.5 py-0.2 rounded text-[9px] border border-red-800 font-bold">
                QUANT RISK LAB
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Kiểm tra sức chịu đựng của danh mục trước các cú sụp đổ lịch sử của VN-Index & Phân tích lớp đệm tiền mặt
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsCustomMode(false)}
            className={`px-3 py-1.5 rounded font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              !isCustomMode
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>KỊCH BẢN LỊCH SỬ</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className={`px-3 py-1.5 rounded font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              isCustomMode
                ? 'bg-amber-600 text-white shadow'
                : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>TÙY BIẾN SHOCK (%)</span>
          </button>
        </div>
      </div>

      {/* Scenario Selector Cards */}
      {!isCustomMode ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HISTORICAL_SCENARIOS.map((sc) => {
            const isSelected = sc.id === selectedScenarioId;
            return (
              <div
                key={sc.id}
                onClick={() => setSelectedScenarioId(sc.id)}
                className={`p-3.5 rounded-sm border cursor-pointer transition relative flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? 'bg-gradient-to-b from-blue-950/80 to-slate-900/90 border-blue-500 shadow-lg ring-1 ring-blue-500'
                    : 'bg-[#0a0a0a] border-gray-800 hover:border-gray-700 hover:bg-[#0f121d]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 bg-black/60 px-1.5 py-0.5 rounded border border-gray-800">
                      {sc.badge}
                    </span>
                    <span className="text-red-400 font-bold text-xs">
                      VN-Index {sc.marketShockPercent}%
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-xs line-clamp-1">{sc.name}</h3>
                  <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">
                    {sc.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Hồi phục tb:</span>
                  <span className="text-emerald-400 font-bold">~{sc.historicalRecoveryDays} ngày</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Custom Shock Slider Panel */
        <div className="bg-[#0a0a0a] p-4 rounded-sm border border-amber-500/50 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-xs uppercase">
                BẢNG ĐIỀU KHIỂN TÙY BIẾN CÚ SỐC THỊ TRƯỜNG (CUSTOM QUANT SHOCK SLIDER)
              </span>
            </div>
            <span className="text-amber-300 font-black text-sm">
              Mức giảm VN-Index: {customDropPercent.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-1">
            <input
              type="range"
              min="-30"
              max="-1"
              step="0.5"
              value={customDropPercent}
              onChange={(e) => setCustomDropPercent(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>-1% (Phiên điều chỉnh nhẹ)</span>
              <span>-4.5% (-55 điểm)</span>
              <span>-10% (Điều chỉnh kỹ thuật sâu)</span>
              <span>-20% (Thị trường gấu)</span>
              <span>-30% (Khủng hoảng cực đại)</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Impact Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: NAV Sụt giảm */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span>SỤT GIẢM NAV DỰ KIẾN</span>
            </span>
            <span className="text-[10px] text-red-400 bg-red-950/60 px-1.5 py-0.2 rounded border border-red-900 font-bold">
              {stressResult.navDropPercent}%
            </span>
          </div>

          <div className="text-lg font-black text-white">
            {stressResult.stressedNav.toLocaleString('vi-VN')} VNĐ
          </div>

          <div className="text-[11px] text-red-400 flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span>Thiệt hại NAV:</span>
            <span className="font-bold">
              {stressResult.navDropAmount.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>
        </div>

        {/* Card 2: Giá trị Cổ phiếu sụt giảm */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
              <span>GIÁ TRỊ DANH MỤC CỔ PHIẾU</span>
            </span>
            <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-900 font-bold">
              {stressResult.stockDropPercent}%
            </span>
          </div>

          <div className="text-lg font-black text-amber-300">
            {stressResult.stressedStockValue.toLocaleString('vi-VN')} VNĐ
          </div>

          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span>Trước biến cố:</span>
            <span className="text-gray-200 font-bold">
              {stressResult.originalStockValue.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>
        </div>

        {/* Card 3: Đệm Tiền Mặt Bảo Vệ (Cash Buffer Cushion) */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-emerald-900/60 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>ĐỆM TIỀN MẶT BẢO VỆ (CASH BUFFER)</span>
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800 font-bold">
              BẢO TOÀN 100%
            </span>
          </div>

          <div className="text-lg font-black text-emerald-400">
            {stressResult.totalCashBuffer.toLocaleString('vi-VN')} VNĐ
          </div>

          <div className="text-[10px] text-gray-300 flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span>Tỷ trọng sau cú sốc:</span>
            <span className="text-emerald-300 font-bold">
              {stressResult.originalCashRatio}% ➔ {stressResult.stressedCashRatio}% NAV
            </span>
          </div>
        </div>

        {/* Card 4: Đánh giá Margin & Kỳ vọng hồi phục */}
        <div className="bg-[#0a0a0a] p-3.5 rounded-sm border border-gray-800 shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-bold flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>KỲ VỌNG HỒI PHỤC LỊCH SỬ</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${
                stressResult.marginRisk.isForceSell
                  ? 'bg-red-950 text-red-400 border-red-800 animate-pulse'
                  : stressResult.marginRisk.isMarginCall
                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                  : 'bg-blue-950 text-blue-400 border-blue-800'
              }`}
            >
              {stressResult.marginRisk.isForceSell
                ? '🚨 NGUY CƠ FORCE-SELL'
                : stressResult.marginRisk.isMarginCall
                ? '⚠️ CẢNH BÁO MARGIN'
                : '✅ AN TOÀN ĐÒN BẨY'}
            </span>
          </div>

          <div className="text-lg font-black text-blue-300">
            ~{stressResult.recoveryEstimate.estimatedDays} Ngày
          </div>

          <div className="text-[10px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-800/80">
            <span>Tiềm năng tăng lại từ đáy:</span>
            <span className="text-emerald-400 font-bold">
              +{stressResult.recoveryEstimate.historicalReboundPotential}%
            </span>
          </div>
        </div>
      </div>

      {/* Cash Cushion Analysis Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-black p-3.5 rounded-sm border border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center space-x-2">
              <span>HIỆU ỨNG GIẢM CHẤN CỦA TIỀN MẶT (CASH ABSORPTION EFFECT)</span>
              <span className="text-emerald-400 text-[10px] font-bold">
                Giảm nhẹ cú sốc {stressResult.cashBufferAbsorptionPercent}%
              </span>
            </div>
            <p className="text-[11px] text-gray-300">
              Nhờ nắm giữ <strong className="text-emerald-400">{stressResult.totalCashBuffer.toLocaleString('vi-VN')} VNĐ</strong> tiền mặt (chiếm {stressResult.originalCashRatio}% danh mục), NAV của bạn chỉ sụt giảm <strong className="text-red-400">{stressResult.navDropPercent}%</strong> thay vì giảm toàn bộ <strong className="text-red-400">{stressResult.stockDropPercent}%</strong> như danh mục full cổ phiếu.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] text-gray-400">Sức mua tích lũy đáy:</div>
          <div className="text-xs font-bold text-emerald-400">
            {stressResult.freeCashAmount.toLocaleString('vi-VN')} VNĐ Khả dụng
          </div>
        </div>
      </div>

      {/* Detailed Asset-by-Asset Stress Table */}
      <div className="bg-[#0a0a0a] rounded-sm border border-gray-800 overflow-hidden shadow-xl">
        <div className="p-3 border-b border-gray-800 flex items-center justify-between bg-[#050505]">
          <h3 className="font-bold text-xs text-blue-400 uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4" />
            <span>CHI TIẾT MỨC ĐỘ TỔN THƯƠNG TỪNG CỔ PHIẾU (ASSET-LEVEL STRESS MATRIX)</span>
          </h3>
          <span className="text-[10px] text-gray-500">
            Tính toán theo Hệ số Beta ngành & Độ nhạy khủng hoảng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left min-w-[850px]">
            <thead className="bg-[#080b12] text-gray-400 border-b border-gray-800 uppercase text-[10px] tracking-wider whitespace-nowrap">
              <tr>
                <th className="p-3">Mã CP</th>
                <th className="p-3">Nhóm Ngành</th>
                <th className="p-3 text-center">Hệ Số Beta</th>
                <th className="p-3 text-right">Số Lượng</th>
                <th className="p-3 text-right">Giá Hiện Tại</th>
                <th className="p-3 text-right">Giá Sau Cú Sốc</th>
                <th className="p-3 text-right">% Sụt Giảm</th>
                <th className="p-3 text-right">Thiệt Hại (VNĐ)</th>
                <th className="p-3 text-center">Mức Rủi Ro</th>
                <th className="p-3 text-left">Đề Xuất Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stressResult.assetDetails.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Chưa có vị thế nào trong danh mục để chạy kiểm tra Stress-Test.
                  </td>
                </tr>
              ) : (
                stressResult.assetDetails.map((asset) => (
                  <tr
                    key={asset.symbol}
                    className="hover:bg-[#111624] transition cursor-pointer"
                    onClick={() => onSelectStock && onSelectStock(asset.symbol)}
                  >
                    <td className="p-3 font-bold text-white flex items-center space-x-1.5">
                      <span className="text-blue-400">{asset.symbol}</span>
                    </td>
                    <td className="p-3 text-gray-400 text-[11px]">{asset.sector}</td>
                    <td className="p-3 text-center font-bold text-amber-400">{asset.beta}</td>
                    <td className="p-3 text-right text-gray-300">
                      {asset.quantity.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-right text-gray-300 font-bold">
                      {asset.originalPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-red-400 font-bold">
                      {asset.stressedPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-red-400 font-bold">
                      {asset.priceDropPercent}%
                    </td>
                    <td className="p-3 text-right text-red-400 font-bold">
                      {asset.lossAmount.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          asset.riskLevel === 'CRITICAL'
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : asset.riskLevel === 'HIGH'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : asset.riskLevel === 'MEDIUM'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {asset.riskLevel === 'CRITICAL'
                          ? 'CỰC CAO'
                          : asset.riskLevel === 'HIGH'
                          ? 'CAO'
                          : asset.riskLevel === 'MEDIUM'
                          ? 'TRUNG BÌNH'
                          : 'THẤP'}
                      </span>
                    </td>
                    <td className="p-3 text-left text-gray-300 text-[11px]">
                      {asset.recommendedAction}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quant AI Strategic Defense Plan */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 space-y-3 shadow-xl">
        <h3 className="font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>KẾ HOẠCH PHÒNG VỆ ĐỊNH LƯỢNG & TẬN DỤNG CƠ HỘI (QUANT ACTION PLAN)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {stressResult.quantRecommendations.map((rec, idx) => (
            <div
              key={idx}
              className="p-3 bg-[#050811] rounded border border-gray-800 text-gray-300 space-y-1"
            >
              <div className="text-[10px] text-gray-500 font-bold uppercase">
                Khuyến nghị chiến thuật #{idx + 1}
              </div>
              <p className="text-[11px] leading-relaxed text-gray-200">{rec}</p>
            </div>
          ))}
        </div>

        <div className="p-3 bg-blue-950/30 rounded border border-blue-900/50 text-[11px] text-blue-300 flex items-start space-x-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Chiến lược tích sản ngược xu hướng (Contrarian Quant Strategy):</strong>{' '}
            {stressResult.recoveryEstimate.reboundStrategy}
          </div>
        </div>
      </div>
    </div>
  );
};
