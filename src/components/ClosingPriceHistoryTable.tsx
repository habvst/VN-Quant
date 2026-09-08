import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Calendar, Download, Filter, Search, TrendingDown, TrendingUp, BarChart2 } from 'lucide-react';
import { Candle, StockData } from '../types';
import { isVietnamStockMarketClosed } from '../utils/timeUtils';

interface ClosingPriceHistoryTableProps {
  stock: StockData;
  candles: Candle[];
}

interface HistoricalSession {
  index: number;
  dateStr: string; // DD/MM/YYYY
  rawDate: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  turnoverBillion: number;
  sma20: number | null;
  aboveSma20: boolean | null;
  statusType: 'CEILING' | 'FLOOR' | 'UP_STRONG' | 'UP' | 'DOWN_STRONG' | 'DOWN' | 'FLAT';
  statusLabel: string;
}

export const ClosingPriceHistoryTable: React.FC<ClosingPriceHistoryTableProps> = ({
  stock,
  candles,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'UP' | 'DOWN' | 'HIGH_VOL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Compute the 30 trading sessions ending at current date
  const { sessions, stats, maxVolume } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { sessions: [], stats: null, maxVolume: 1 };
    }

    // Filter strictly valid trading sessions: exclude weekends and official Vietnam stock exchange holidays (such as Quốc Khánh 02/09)
    const validCandles = candles.filter((c) => {
      if (!c.time) return false;
      const parts = c.time.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (isVietnamStockMarketClosed(d)) return false;
      }
      return true;
    });

    // Sort chronologically ascending
    const sortedCandles = [...validCandles].sort((a, b) => a.time.localeCompare(b.time));

    // Calculate SMA20 for all candles
    const sma20Map = new Map<string, number>();
    for (let i = 0; i < sortedCandles.length; i++) {
      if (i >= 19) {
        const slice = sortedCandles.slice(i - 19, i + 1);
        const avg = slice.reduce((sum, c) => sum + c.close, 0) / 20;
        sma20Map.set(sortedCandles[i].time, parseFloat(avg.toFixed(2)));
      }
    }

    // Take the last 30 trading sessions
    const last30 = sortedCandles.slice(-30);

    // Calculate daily average volume of these 30 sessions to detect high volume bursts
    const avgVol = last30.reduce((acc, c) => acc + (c.volume || 0), 0) / Math.max(1, last30.length);

    let maxVol = 1;

    // Build session records with previous close change calculations
    const sessionList: HistoricalSession[] = [];

    for (let i = 0; i < last30.length; i++) {
      const current = last30[i];
      // Previous candle in the sorted array
      const globalIndex = sortedCandles.findIndex((c) => c.time === current.time);
      const prev = globalIndex > 0 ? sortedCandles[globalIndex - 1] : null;

      const prevClose = prev ? prev.close : current.open || current.close;
      const change = parseFloat((current.close - prevClose).toFixed(2));
      const changePercent = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

      // Estimated turnover in billion VND (Price is in k VND, e.g. 21.85k * volume / 1,000,000)
      const turnover = parseFloat(((current.close * (current.volume || 0)) / 1000000).toFixed(2));

      if (current.volume > maxVol) {
        maxVol = current.volume;
      }

      // Format Date string: DD/MM/YYYY
      let dateDisplay = current.time;
      if (current.time.includes('-')) {
        const parts = current.time.split('-');
        if (parts.length === 3) {
          dateDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      // Determine session classification based on Vietnamese market rules (HOSE +-7%, HNX +-10%, UPCOM +-15%)
      const threshold = stock.market === 'UPCOM' ? 14.5 : stock.market === 'HNX' ? 9.5 : 6.85;

      let statusType: HistoricalSession['statusType'] = 'FLAT';
      let statusLabel = 'Đứng giá';

      if (changePercent >= threshold) {
        statusType = 'CEILING';
        statusLabel = 'Tím trần (Max)';
      } else if (changePercent <= -threshold) {
        statusType = 'FLOOR';
        statusLabel = 'Xanh sàn (Min)';
      } else if (changePercent >= 2.5) {
        statusType = 'UP_STRONG';
        statusLabel = 'Bứt phá mạnh';
      } else if (changePercent > 0) {
        statusType = 'UP';
        statusLabel = 'Tăng điểm';
      } else if (changePercent <= -2.5) {
        statusType = 'DOWN_STRONG';
        statusLabel = 'Áp lực bán lớn';
      } else if (changePercent < 0) {
        statusType = 'DOWN';
        statusLabel = 'Điều chỉnh';
      }

      const sma = sma20Map.get(current.time) || null;

      sessionList.push({
        index: i,
        dateStr: dateDisplay,
        rawDate: current.time,
        open: current.open,
        high: current.high,
        low: current.low,
        close: current.close,
        volume: current.volume,
        change,
        changePercent,
        turnoverBillion: turnover,
        sma20: sma,
        aboveSma20: sma !== null ? current.close >= sma : null,
        statusType,
        statusLabel,
      });
    }

    // Newest sessions first (T-0 to T-29)
    const reversed = [...sessionList].reverse().map((item, idx) => ({
      ...item,
      index: idx,
    }));

    // Calculate Comprehensive 30-Day Quant Summary Metrics
    const closes = last30.map((c) => c.close);
    const highestClose = Math.max(...closes);
    const lowestClose = Math.min(...closes);
    const highestSession = last30.find((c) => c.close === highestClose);
    const lowestSession = last30.find((c) => c.close === lowestClose);

    const firstSessionClose = last30[0].close;
    const latestSessionClose = last30[last30.length - 1].close;
    const net30DChange = parseFloat((latestSessionClose - firstSessionClose).toFixed(2));
    const net30DPercent = parseFloat(((net30DChange / firstSessionClose) * 100).toFixed(2));

    const upSessions = sessionList.filter((s) => s.change > 0).length;
    const downSessions = sessionList.filter((s) => s.change < 0).length;
    const flatSessions = sessionList.filter((s) => s.change === 0).length;
    const winRate = sessionList.length > 0 ? parseFloat(((upSessions / sessionList.length) * 100).toFixed(1)) : 0;

    // 30-Day Historical Volatility (Annualized)
    const returns = sessionList.map((s) => s.changePercent / 100);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length);
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / Math.max(1, returns.length - 1);
    const dailyStdDev = Math.sqrt(variance);
    const annualizedVol = parseFloat((dailyStdDev * Math.sqrt(252) * 100).toFixed(1));

    const statsData = {
      highestClose,
      highestDate: highestSession?.time || '',
      lowestClose,
      lowestDate: lowestSession?.time || '',
      net30DChange,
      net30DPercent,
      upSessions,
      downSessions,
      flatSessions,
      winRate,
      avgVol,
      annualizedVol,
      totalSessions: last30.length,
    };

    return {
      sessions: reversed,
      stats: statsData,
      maxVolume: maxVol,
    };
  }, [candles, stock.market]);

  // Apply filters and search
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Filter by category
      if (filterType === 'UP' && s.change <= 0) return false;
      if (filterType === 'DOWN' && s.change >= 0) return false;
      if (filterType === 'HIGH_VOL' && stats && s.volume < stats.avgVol * 1.2) return false;

      // Filter by search date
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        return s.dateStr.includes(query) || s.rawDate.includes(query);
      }
      return true;
    });
  }, [sessions, filterType, searchTerm, stats]);

  // Export to CSV for Excel / Python backtest
  const handleExportCSV = () => {
    if (sessions.length === 0) return;

    const headers = [
      'STT (T)',
      'Ngày',
      'Mã CK',
      'Sàn',
      'Giá Đóng Cửa (k VND)',
      'Thay Đổi (k VND)',
      '% Biến Động',
      'Giá Mở Cửa',
      'Giá Cao Nhất',
      'Giá Thấp Nhất',
      'Khối Lượng (CP)',
      'Giá Trị (Tỷ VNĐ)',
      'SMA20',
      'Vị Thế vs SMA20',
      'Trạng Thái Phiên',
    ];

    const rows = sessions.map((s) => [
      `T-${s.index}`,
      s.dateStr,
      stock.symbol,
      stock.market,
      s.close.toFixed(2),
      s.change > 0 ? `+${s.change.toFixed(2)}` : s.change.toFixed(2),
      `${s.changePercent}%`,
      s.open.toFixed(2),
      s.high.toFixed(2),
      s.low.toFixed(2),
      s.volume,
      s.turnoverBillion,
      s.sma20 ? s.sma20.toFixed(2) : 'N/A',
      s.aboveSma20 === null ? 'N/A' : s.aboveSma20 ? 'Trên SMA20' : 'Dưới SMA20',
      s.statusLabel,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${stock.symbol}_Bang_Gia_Dong_Cua_30_Phien.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!candles || candles.length === 0) {
    return (
      <div className="bg-[#050505] p-6 rounded-sm border border-gray-800 text-center font-mono">
        <p className="text-gray-400 text-xs mb-2">Đang nạp dữ liệu chuỗi thời gian cho mã {stock.symbol}...</p>
        <span className="text-[10px] text-gray-600">Vui lòng chờ tín hiệu đồng bộ từ Data Feed.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* 1. Quant Overview Summary Metric Cards (Thống kê định lượng 30 phiên) */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Card 1: 30D Net Return */}
          <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">HIỆU SUẤT 30 PHIÊN</span>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span
                className={`text-base font-bold ${
                  stats.net30DPercent > 0
                    ? 'text-emerald-400'
                    : stats.net30DPercent < 0
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {stats.net30DPercent > 0 ? `+${stats.net30DPercent}%` : `${stats.net30DPercent}%`}
              </span>
              <span className="text-[10px] text-gray-500">
                ({stats.net30DChange > 0 ? `+${stats.net30DChange}` : stats.net30DChange}k)
              </span>
            </div>
            <span className="text-[9px] text-gray-600 mt-0.5">T-29 &rarr; T-0</span>
          </div>

          {/* Card 2: Highest Close in 30 days */}
          <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between">
              <span>ĐỈNH 30 PHIÊN</span>
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            </span>
            <div className="mt-1">
              <span className="text-base font-bold text-emerald-400">{stats.highestClose.toFixed(2)}</span>
            </div>
            <span className="text-[9px] text-gray-500 mt-0.5">Ngày: {stats.highestDate}</span>
          </div>

          {/* Card 3: Lowest Close in 30 days */}
          <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between">
              <span>ĐÁY 30 PHIÊN</span>
              <TrendingDown className="w-3 h-3 text-red-400" />
            </span>
            <div className="mt-1">
              <span className="text-base font-bold text-red-400">{stats.lowestClose.toFixed(2)}</span>
            </div>
            <span className="text-[9px] text-gray-500 mt-0.5">Ngày: {stats.lowestDate}</span>
          </div>

          {/* Card 4: Win/Loss Ratio */}
          <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">TỶ LỆ PHIÊN XANH</span>
            <div className="mt-1 flex items-baseline space-x-1">
              <span className="text-base font-bold text-blue-400">{stats.winRate}%</span>
              <span className="text-[10px] text-gray-400">({stats.upSessions}T / {stats.downSessions}G)</span>
            </div>
            <span className="text-[9px] text-gray-500 mt-0.5">Không đổi: {stats.flatSessions} phiên</span>
          </div>

          {/* Card 5: 30D Average Volume */}
          <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">KLGD BÌNH QUÂN</span>
            <div className="mt-1">
              <span className="text-base font-bold text-amber-300">
                {(stats.avgVol / 1000000).toFixed(2)}M
              </span>
              <span className="text-[10px] text-gray-400 ml-1">CP/phiên</span>
            </div>
            <span className="text-[9px] text-gray-500 mt-0.5">Mức thanh khoản 30D</span>
          </div>

          {/* Card 6: Realized Volatility */}
          <div className="bg-[#050505] p-2.5 rounded-sm border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">BIẾN ĐỘNG (VOL HV)</span>
            <div className="mt-1">
              <span className="text-base font-bold text-purple-400">{stats.annualizedVol}%</span>
            </div>
            <span className="text-[9px] text-gray-500 mt-0.5">Chuẩn hóa 252 phiên</span>
          </div>
        </div>
      )}

      {/* 2. Control Toolbar (Bộ lọc, Tìm kiếm và Nút Xuất Excel) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-[#050505] p-2 rounded-sm border border-gray-800">
        {/* Quick Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition flex items-center space-x-1 border ${
              filterType === 'ALL'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#0a0a0a] text-gray-400 hover:text-gray-200 border-gray-800'
            }`}
          >
            <span>Tất cả ({sessions.length})</span>
          </button>
          <button
            onClick={() => setFilterType('UP')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition flex items-center space-x-1 border ${
              filterType === 'UP'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-[#0a0a0a] text-emerald-400 hover:text-emerald-300 border-gray-800'
            }`}
          >
            <ArrowUp className="w-3 h-3" />
            <span>Phiên Tăng ({stats?.upSessions || 0})</span>
          </button>
          <button
            onClick={() => setFilterType('DOWN')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition flex items-center space-x-1 border ${
              filterType === 'DOWN'
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-[#0a0a0a] text-red-400 hover:text-red-300 border-gray-800'
            }`}
          >
            <ArrowDown className="w-3 h-3" />
            <span>Phiên Giảm ({stats?.downSessions || 0})</span>
          </button>
          <button
            onClick={() => setFilterType('HIGH_VOL')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition flex items-center space-x-1 border ${
              filterType === 'HIGH_VOL'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-[#0a0a0a] text-amber-400 hover:text-amber-300 border-gray-800'
            }`}
            title="Khối lượng lớn hơn 120% trung bình 30 phiên"
          >
            <BarChart2 className="w-3 h-3" />
            <span>Đột biến Vol</span>
          </button>
        </div>

        {/* Search by date & Export CSV */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3 h-3 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm ngày (VD: 05/09)..."
              className="w-full bg-[#0a0a0a] border border-gray-800 rounded-sm pl-7 pr-2 py-1 text-[11px] text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-500 rounded-sm text-[11px] font-bold flex items-center space-x-1.5 transition whitespace-nowrap"
            title="Xuất bảng giá đóng cửa 30 ngày dạng tệp CSV để phân tích Excel"
          >
            <Download className="w-3 h-3 text-blue-400" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Detailed Data Table (Bảng giá đóng cửa 30 phiên) */}
      <div className="overflow-x-auto rounded-sm border border-gray-800 bg-[#050505]">
        <table className="w-full text-left border-collapse font-mono text-[11px]">
          <thead>
            <tr className="bg-[#0c0c0c] text-gray-400 border-b border-gray-800 select-none text-[10px] uppercase font-bold tracking-wider sticky top-0 z-10">
              <th className="py-2 px-2.5 text-center w-12">Kỳ (T)</th>
              <th className="py-2 px-2.5">Ngày</th>
              <th className="py-2 px-2.5 text-right font-bold text-gray-200">Đóng Cửa</th>
              <th className="py-2 px-2.5 text-right">Biến Động</th>
              <th className="py-2 px-2.5 text-right">% Thay Đổi</th>
              <th className="py-2 px-2.5 text-right">Mở Cửa</th>
              <th className="py-2 px-2.5 text-right">Cao Nhất</th>
              <th className="py-2 px-2.5 text-right">Thấp Nhất</th>
              <th className="py-2 px-2.5 text-right min-w-[140px]">Khối Lượng (CP)</th>
              <th className="py-2 px-2.5 text-right">GT (Tỷ)</th>
              <th className="py-2 px-2.5 text-center">Vị Thế SMA20</th>
              <th className="py-2 px-2.5 text-center">Tín Hiệu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filteredSessions.length > 0 ? (
              filteredSessions.map((session) => {
                const isLatest = session.index === 0;
                const isCeil = session.statusType === 'CEILING';
                const isFloor = session.statusType === 'FLOOR';
                const isUp = session.change > 0;
                const isDown = session.change < 0;

                // Color coding following Vietnam Stock Market conventions
                const textColor = isCeil
                  ? 'text-purple-400'
                  : isFloor
                  ? 'text-cyan-400'
                  : isUp
                  ? 'text-emerald-400'
                  : isDown
                  ? 'text-red-400'
                  : 'text-amber-400';

                const badgeBg = isCeil
                  ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
                  : isFloor
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
                  : isUp
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                  : isDown
                  ? 'bg-red-950/80 text-red-300 border-red-800/80'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800/80';

                // Volume comparison with 30D average
                const volRatio = stats ? session.volume / Math.max(1, stats.avgVol) : 1;
                const volBarWidth = Math.min(100, Math.max(8, (session.volume / maxVolume) * 100));

                return (
                  <tr
                    key={session.rawDate}
                    className={`hover:bg-gray-800/40 transition-colors ${
                      isLatest ? 'bg-blue-950/20 font-semibold' : ''
                    }`}
                  >
                    {/* Kỳ T */}
                    <td className="py-2 px-2.5 text-center text-gray-500">
                      {isLatest ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700">
                          T-0
                        </span>
                      ) : (
                        `T-${session.index}`
                      )}
                    </td>

                    {/* Ngày giao dịch */}
                    <td className="py-2 px-2.5 whitespace-nowrap text-gray-300 flex items-center space-x-1.5">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>{session.dateStr}</span>
                      {isLatest && (
                        <span className="text-[9px] text-blue-400 bg-blue-950/70 px-1 rounded border border-blue-800">
                          Mới nhất
                        </span>
                      )}
                    </td>

                    {/* Giá đóng cửa (k VND) */}
                    <td className="py-2 px-2.5 text-right font-bold">
                      <span className={`text-xs ${textColor}`}>
                        {session.close.toFixed(2)}
                      </span>
                    </td>

                    {/* Thay đổi (+/- k) */}
                    <td className="py-2 px-2.5 text-right">
                      <span className={`${textColor}`}>
                        {session.change > 0
                          ? `+${session.change.toFixed(2)}`
                          : session.change === 0
                          ? '0.00'
                          : session.change.toFixed(2)}
                      </span>
                    </td>

                    {/* % Thay đổi */}
                    <td className="py-2 px-2.5 text-right">
                      <span
                        className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold ${badgeBg}`}
                      >
                        {isUp && <ArrowUp className="w-2.5 h-2.5" />}
                        {isDown && <ArrowDown className="w-2.5 h-2.5" />}
                        <span>
                          {session.changePercent > 0
                            ? `+${session.changePercent}%`
                            : `${session.changePercent}%`}
                        </span>
                      </span>
                    </td>

                    {/* Mở cửa */}
                    <td className="py-2 px-2.5 text-right text-gray-400">
                      {session.open.toFixed(2)}
                    </td>

                    {/* Cao nhất */}
                    <td className="py-2 px-2.5 text-right text-gray-400">
                      {session.high.toFixed(2)}
                    </td>

                    {/* Thấp nhất */}
                    <td className="py-2 px-2.5 text-right text-gray-400">
                      {session.low.toFixed(2)}
                    </td>

                    {/* Khối lượng kèm Visual Bar */}
                    <td className="py-2 px-2.5 text-right">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-mono ${
                              volRatio > 1.3 ? 'text-amber-300 font-bold' : 'text-gray-300'
                            }`}
                          >
                            {session.volume.toLocaleString('vi-VN')}
                          </span>
                          {volRatio > 1.3 && (
                            <span className="text-[9px] text-amber-400 bg-amber-950/80 px-1 rounded border border-amber-800">
                              Burst
                            </span>
                          )}
                        </div>
                        {/* Mini visual volume sparkline bar */}
                        <div className="w-24 bg-gray-800/80 h-1 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${volBarWidth}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Giá trị giao dịch (Tỷ VNĐ) */}
                    <td className="py-2 px-2.5 text-right text-gray-300">
                      {session.turnoverBillion > 0 ? `${session.turnoverBillion} Tỷ` : '-'}
                    </td>

                    {/* Vị thế so với SMA20 */}
                    <td className="py-2 px-2.5 text-center">
                      {session.aboveSma20 === null ? (
                        <span className="text-gray-600">-</span>
                      ) : session.aboveSma20 ? (
                        <span className="text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-900/50">
                          Trên MA20
                        </span>
                      ) : (
                        <span className="text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded text-[10px] border border-red-900/50">
                          Dưới MA20
                        </span>
                      )}
                    </td>

                    {/* Tín hiệu & Trạng thái phiên */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeBg}`}>
                        {session.statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} className="py-8 text-center text-gray-500 font-mono">
                  Không tìm thấy phiên giao dịch nào phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Footer Note */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[10px] text-gray-500 px-1 gap-1">
        <span>
          💡 Hiển thị chuỗi giá đóng cửa 30 phiên giao dịch gần nhất của <strong>${stock.symbol}</strong> ({stock.market}). Tự động loại trừ các ngày nghỉ lễ/nghỉ bù chính thức (như Quốc Khánh 2/9, Tết Nguyên Đán, 30/4 - 1/5...) và Thứ Bảy/Chủ Nhật.
        </span>
        <span className="text-gray-600 whitespace-nowrap">
          Tổng số phiên chuẩn: {sessions.length}/30 phiên
        </span>
      </div>
    </div>
  );
};
