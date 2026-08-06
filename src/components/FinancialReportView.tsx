import { Award, BarChart2, CheckCircle, FileText, PieChart, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';
import { StockData } from '../types';

interface FinancialReportViewProps {
  stock: StockData;
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
}

export const FinancialReportView: React.FC<FinancialReportViewProps> = ({ stock, stocks, onSelectStock }) => {
  const [activeTab, setActiveTab] = useState<'RATIOS' | 'INCOME' | 'BALANCE'>('RATIOS');
  const fund = stock.fundamental;

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4 font-mono">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white">
              BÁO CÁO TÀI CHÍNH CHUYÊN SÂU & ĐỊNH GIÁ {stock.symbol}
            </h2>
            <p className="text-xs text-gray-400 font-mono">Phân tích Báo cáo kết quả kinh doanh, Bảng cân đối kế toán & Chỉ số tài chính ngành</p>
          </div>
        </div>

        {/* Stock Selector Dropdown */}
        <select
          value={stock.symbol}
          onChange={(e) => onSelectStock(e.target.value)}
          className="bg-[#050505] text-blue-400 font-mono font-bold px-3 py-1.5 rounded-sm border border-gray-800 outline-none text-xs"
        >
          {stocks.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.symbol} - {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 bg-[#0a0a0a] p-2 rounded-sm border border-gray-800 text-xs font-mono">
        {(['RATIOS', 'INCOME', 'BALANCE'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 rounded-sm transition ${
              activeTab === t
                ? 'bg-blue-600 text-white font-bold shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'RATIOS' ? 'CHỈ SỐ TÀI CHÍNH & ĐỊNH GIÁ' : t === 'INCOME' ? 'KẾT QUẢ KINH DOANH (P&L)' : 'BẢNG CÂN ĐỐI KẾ TOÁN'}
          </button>
        ))}
      </div>

      {/* Ratios View */}
      {activeTab === 'RATIOS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
          {/* Valuation Card */}
          <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 space-y-3 shadow-xl">
            <h3 className="font-bold text-blue-400 border-b border-gray-800 pb-2 uppercase tracking-wider">ĐỊNH GIÁ VÀ GIÁ TRỊ CỔ PHIẾU</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">P/E Ratio:</span>
                <span className="font-bold text-gray-100">{fund.pe}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P/E Trung Bình Ngành:</span>
                <span className="font-bold text-gray-400">{fund.industryAvgPE}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P/B Ratio:</span>
                <span className="font-bold text-gray-100">{fund.pb}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">EPS (Thu nhập/CP):</span>
                <span className="font-bold text-emerald-400">{(fund?.eps ?? 0).toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Giá Trị Sổ Sách (BVPS):</span>
                <span className="font-bold text-blue-400">{(fund?.bvps ?? 0).toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tỷ Suất Cổ Tức Tiền Mặt:</span>
                <span className="font-bold text-emerald-400">{fund.dividendYield}%</span>
              </div>
            </div>
          </div>

          {/* Profitability Card */}
          <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 space-y-3 shadow-xl">
            <h3 className="font-bold text-emerald-400 border-b border-gray-800 pb-2 uppercase tracking-wider">HIỆU QUẢ SỬ DỤNG VỐN & SINH LỜI</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">ROE (Lợi nhuận/VCSH):</span>
                <span className="font-bold text-emerald-400 text-sm">{fund.roe}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ROA (Lợi nhuận/Tổng TS):</span>
                <span className="font-bold text-emerald-400">{fund.roa}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Biên Lợi Nhuận Gộp:</span>
                <span className="font-bold text-gray-100">{fund.grossMargin}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Biên Lợi Nhuận Ròng:</span>
                <span className="font-bold text-gray-100">{fund.netMargin}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tăng Trưởng Doanh Thu YoY:</span>
                <span className="font-bold text-emerald-400">+{fund.revenueGrowthYoY}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tăng Trưởng Lợi Nhuận YoY:</span>
                <span className="font-bold text-emerald-400">+{fund.profitGrowthYoY}%</span>
              </div>
            </div>
          </div>

          {/* Health & Debt Card */}
          <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 space-y-3 shadow-xl">
            <h3 className="font-bold text-blue-400 border-b border-gray-800 pb-2 uppercase tracking-wider">SỨC KHỎE TÀI CHÍNH & VỐN VAY</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Hệ Số Nợ / VCSH (D/E):</span>
                <span className="font-bold text-gray-100">{fund.debtToEquity}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Thanh Khoản Nhanh:</span>
                <span className="font-bold text-gray-100">1.45x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Vốn Hóa Thị Trường:</span>
                <span className="font-bold text-blue-400">{(fund?.marketCap ?? 0).toLocaleString('vi-VN')} Tỷ VNĐ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dòng Tiền Tự Do (FCF):</span>
                <span className="font-bold text-emerald-400">+1.850 Tỷ VNĐ</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Income Statement View */}
      {activeTab === 'INCOME' && (
        <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 font-mono text-xs shadow-xl space-y-3">
          <h3 className="font-bold text-gray-200 uppercase tracking-wider">KẾT QUẢ KINH DOANH 4 QUÝ GẦN NHẤT (ĐƠN VỊ: TỶ VNĐ)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#050505] text-gray-400 border-b border-gray-800 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">HẠNG MỤC BCTC</th>
                  <th className="p-3 text-right">Q3/2025</th>
                  <th className="p-3 text-right">Q4/2025</th>
                  <th className="p-3 text-right">Q1/2026</th>
                  <th className="p-3 text-right">Q2/2026</th>
                  <th className="p-3 text-right">TĂNG TRƯỞNG YoY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                <tr>
                  <td className="p-3 font-bold text-gray-200">Doanh Thu Thuần</td>
                  <td className="p-3 text-right text-gray-300">12.450</td>
                  <td className="p-3 text-right text-gray-300">14.100</td>
                  <td className="p-3 text-right text-gray-300">13.800</td>
                  <td className="p-3 text-right font-bold text-gray-100">15.200</td>
                  <td className="p-3 text-right font-bold text-emerald-400">+{fund.revenueGrowthYoY}%</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-gray-200">Giá Vốn Hàng Bán</td>
                  <td className="p-3 text-right text-gray-400">9.200</td>
                  <td className="p-3 text-right text-gray-400">10.100</td>
                  <td className="p-3 text-right text-gray-400">9.800</td>
                  <td className="p-3 text-right text-gray-400">10.900</td>
                  <td className="p-3 text-right text-gray-400">+14.2%</td>
                </tr>
                <tr className="bg-[#050505]">
                  <td className="p-3 font-bold text-blue-400">Lợi Nhuận Gộp</td>
                  <td className="p-3 text-right text-blue-400">3.250</td>
                  <td className="p-3 text-right text-blue-400">4.000</td>
                  <td className="p-3 text-right text-blue-400">4.000</td>
                  <td className="p-3 text-right font-bold text-blue-400">4.300</td>
                  <td className="p-3 text-right font-bold text-emerald-400">+{fund.grossMargin}%</td>
                </tr>
                <tr className="bg-[#050505]">
                  <td className="p-3 font-bold text-emerald-400">LỢI NHUẬN SAU THUẾ</td>
                  <td className="p-3 text-right font-bold text-emerald-400">1.850</td>
                  <td className="p-3 text-right font-bold text-emerald-400">2.200</td>
                  <td className="p-3 text-right font-bold text-emerald-400">2.150</td>
                  <td className="p-3 text-right font-bold text-emerald-400 text-sm">2.450</td>
                  <td className="p-3 text-right font-bold text-emerald-400">+{fund.profitGrowthYoY}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Balance Sheet View */}
      {activeTab === 'BALANCE' && (
        <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 font-mono text-xs shadow-xl space-y-3">
          <h3 className="font-bold text-gray-200 uppercase tracking-wider">BẢNG CÂN ĐỐI KẾ TOÁN (ĐƠN VỊ: TỶ VNĐ)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 bg-[#050505] p-3 rounded-sm border border-gray-800">
              <h4 className="font-bold text-blue-400 border-b border-gray-800 pb-1 uppercase">TỔNG TÀI SẢN</h4>
              <div className="flex justify-between">
                <span>Tiền & Tương Đương Tiền:</span>
                <span className="font-bold text-emerald-400">8.500 Tỷ</span>
              </div>
              <div className="flex justify-between">
                <span>Hàng Tồn Kho:</span>
                <span className="font-bold text-gray-300">14.200 Tỷ</span>
              </div>
              <div className="flex justify-between">
                <span>Tài Sản Cố Định (Nhà xưởng, máy móc):</span>
                <span className="font-bold text-gray-300">32.000 Tỷ</span>
              </div>
            </div>

            <div className="space-y-2 bg-[#050505] p-3 rounded-sm border border-gray-800">
              <h4 className="font-bold text-red-400 border-b border-gray-800 pb-1 uppercase">NGUỒN VỐN & NỢ PHẢI TRẢ</h4>
              <div className="flex justify-between">
                <span>Nợ Vay Vay Ngắn Hạn & Dài Hạn:</span>
                <span className="font-bold text-red-400">12.400 Tỷ</span>
              </div>
              <div className="flex justify-between">
                <span>Vốn Chủ Sở Hữu (VCSH):</span>
                <span className="font-bold text-emerald-400">42.500 Tỷ</span>
              </div>
              <div className="flex justify-between">
                <span>Lợi Nhuận Sau Thuế Chưa Phân Phối:</span>
                <span className="font-bold text-blue-400">9.800 Tỷ</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
