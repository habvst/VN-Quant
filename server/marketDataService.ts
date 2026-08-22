import { Candle, FundamentalData, MacroData, MarketIndex, MarketType, NewsItem, OrderBook, RealtimeAlert, SectorData, StockData, TradeTick } from '../src/types';
import { computeTechnicalIndicators } from '../src/utils/technicalEngine';
import { analyzeSmartMoneySignal } from './smartMoneyAnomalyService';
import { enrichNewsItemWithDeepScoring } from './newsSentimentEngine';

// Seed raw stock universe info with realistic base prices
interface RawStockSeed {
  symbol: string;
  name: string;
  exchange: MarketType;
  sector: string;
  basePrice: number; // Trong nghìn VNĐ
  referencePrice: number;
  ceilingPrice: number;
  floorPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number; // Tỷ VNĐ
  pe: number;
  pb: number;
  eps: number;
  roe: number;
  roa: number;
  debtToEquity: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  revenueGrowthYoY: number;
  profitGrowthYoY: number;
  dividendYield: number;
  aiVerdict: 'MUA MẠNH' | 'MUA' | 'THEO DÕI' | 'BÁN' | 'BÁN MẠNH';
  aiScore: number;
  aiTarget: number;
  aiStop: number;
  aiReasoning: string;
}

const RAW_STOCKS: RawStockSeed[] = [
  {
    symbol: 'HPG',
    name: 'Tập đoàn Hòa Phát',
    exchange: 'HOSE',
    sector: 'Thép',
    basePrice: 21.7,
    referencePrice: 21.15,
    ceilingPrice: 22.6,
    floorPrice: 19.7,
    change: 0.55,
    changePercent: 2.6,
    volume: 25138400,
    marketCap: 128900,
    pe: 13.8,
    pb: 1.5,
    eps: 2017,
    roe: 12.8,
    roa: 7.4,
    debtToEquity: 0.62,
    grossMargin: 15.4,
    operatingMargin: 11.2,
    netMargin: 9.1,
    revenueGrowthYoY: 18.5,
    profitGrowthYoY: 34.2,
    dividendYield: 3.5,
    aiVerdict: 'MUA MẠNH',
    aiScore: 92,
    aiTarget: 28.5,
    aiStop: 19.5,
    aiReasoning: 'Khu liên hợp Dung Quất 2 chạy tối đa công suất giúp sản lượng HRC tăng 40%. Chu kỳ ngành thép phục hồi mạnh mẽ cùng biên lợi nhuận gộp mở rộng.',
  },
  {
    symbol: 'FPT',
    name: 'Công ty Cổ phần FPT',
    exchange: 'HOSE',
    sector: 'Công nghệ',
    basePrice: 72.0,
    referencePrice: 69.8,
    ceilingPrice: 74.6,
    floorPrice: 65.0,
    change: 2.2,
    changePercent: 3.15,
    volume: 7035800,
    marketCap: 108000,
    pe: 24.2,
    pb: 5.1,
    eps: 5423,
    roe: 26.4,
    roa: 12.1,
    debtToEquity: 0.35,
    grossMargin: 38.6,
    operatingMargin: 20.4,
    netMargin: 16.8,
    revenueGrowthYoY: 22.1,
    profitGrowthYoY: 23.8,
    dividendYield: 2.1,
    aiVerdict: 'MUA MẠNH',
    aiScore: 95,
    aiTarget: 92.0,
    aiStop: 63.0,
    aiReasoning: 'Động lực từ mảng AI, Semiconductor và dịch vụ CNTT nước ngoài tăng trưởng >25%. Hợp đồng ký mới ký kết kỷ lục tại Nhật Bản và Mỹ.',
  },
  {
    symbol: 'VNM',
    name: 'Công ty Cổ phần Sữa Việt Nam',
    exchange: 'HOSE',
    sector: 'Bán lẻ',
    basePrice: 63.8,
    referencePrice: 64.0,
    ceilingPrice: 68.4,
    floorPrice: 59.6,
    change: -0.2,
    changePercent: -0.31,
    volume: 3581800,
    marketCap: 124300,
    pe: 15.2,
    pb: 4.0,
    eps: 4346,
    roe: 24.2,
    roa: 16.5,
    debtToEquity: 0.18,
    grossMargin: 42.1,
    operatingMargin: 22.5,
    netMargin: 18.2,
    revenueGrowthYoY: 5.2,
    profitGrowthYoY: 8.6,
    dividendYield: 5.8,
    aiVerdict: 'MUA',
    aiScore: 78,
    aiTarget: 72.0,
    aiStop: 57.5,
    aiReasoning: 'Tỷ lệ cổ tức tiền mặt cao và ổn định (5.8%). Giá nguyên liệu sữa bột đầu vào duy trì ở mức thấp hỗ trợ mở rộng biên lợi nhuận.',
  },
  {
    symbol: 'MBB',
    name: 'Ngân hàng TMCP Quân Đội',
    exchange: 'HOSE',
    sector: 'Ngân hàng',
    basePrice: 20.85,
    referencePrice: 20.3,
    ceilingPrice: 21.7,
    floorPrice: 18.9,
    change: 0.55,
    changePercent: 2.71,
    volume: 15698000,
    marketCap: 129000,
    pe: 5.9,
    pb: 1.1,
    eps: 4000,
    roe: 21.5,
    roa: 2.4,
    debtToEquity: 8.2,
    grossMargin: 48.0,
    operatingMargin: 38.0,
    netMargin: 30.5,
    revenueGrowthYoY: 16.2,
    profitGrowthYoY: 19.5,
    dividendYield: 4.0,
    aiVerdict: 'MUA MẠNH',
    aiScore: 89,
    aiTarget: 26.0,
    aiStop: 18.5,
    aiReasoning: 'Định giá P/B cực kỳ hấp dẫn (1.1x) so với hiệu suất ROE vượt trội 21.5%. Tăng trưởng tín dụng dẫn đầu ngành ngân hàng.',
  },
  {
    symbol: 'SSI',
    name: 'Công ty Cổ phần Chứng khoán SSI',
    exchange: 'HOSE',
    sector: 'Chứng khoán',
    basePrice: 20.75,
    referencePrice: 19.4,
    ceilingPrice: 20.75,
    floorPrice: 18.05,
    change: 1.35,
    changePercent: 6.96,
    volume: 38706800,
    marketCap: 52400,
    pe: 16.5,
    pb: 1.7,
    eps: 1848,
    roe: 14.5,
    roa: 6.2,
    debtToEquity: 1.1,
    grossMargin: 52.0,
    operatingMargin: 42.0,
    netMargin: 34.0,
    revenueGrowthYoY: 28.4,
    profitGrowthYoY: 41.2,
    dividendYield: 3.0,
    aiVerdict: 'MUA MẠNH',
    aiScore: 92,
    aiTarget: 26.0,
    aiStop: 19.0,
    aiReasoning: 'Hưởng lợi trực tiếp từ thanh khoản thị trường bùng nổ và hệ thống KRX vận hành chính thức, tiến tới nâng hạng thị trường FTSE KRX.',
  },
  {
    symbol: 'TCB',
    name: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
    exchange: 'HOSE',
    sector: 'Ngân hàng',
    basePrice: 31.65,
    referencePrice: 31.0,
    ceilingPrice: 33.15,
    floorPrice: 28.85,
    change: 0.65,
    changePercent: 2.1,
    volume: 9772000,
    marketCap: 208000,
    pe: 6.8,
    pb: 1.05,
    eps: 3310,
    roe: 18.2,
    roa: 2.6,
    debtToEquity: 7.8,
    grossMargin: 50.0,
    operatingMargin: 40.0,
    netMargin: 32.0,
    revenueGrowthYoY: 20.1,
    profitGrowthYoY: 25.4,
    dividendYield: 3.8,
    aiVerdict: 'MUA MẠNH',
    aiScore: 90,
    aiTarget: 38.5,
    aiStop: 28.0,
    aiReasoning: 'Tỷ lệ CASA vượt mốc 40% giúp chi phí vốn cực thấp. Mảng trái phiếu doanh nghiệp và bất động sản đang hồi phục tích cực.',
  },
  {
    symbol: 'MWG',
    name: 'Công ty Cổ phần Đầu tư Thế Giới Di Động',
    exchange: 'HOSE',
    sector: 'Bán lẻ',
    basePrice: 75.0,
    referencePrice: 72.7,
    ceilingPrice: 77.7,
    floorPrice: 67.7,
    change: 2.3,
    changePercent: 3.16,
    volume: 4995900,
    marketCap: 105400,
    pe: 22.0,
    pb: 3.3,
    eps: 2920,
    roe: 16.8,
    roa: 6.2,
    debtToEquity: 0.85,
    grossMargin: 23.5,
    operatingMargin: 6.2,
    netMargin: 4.5,
    revenueGrowthYoY: 14.8,
    profitGrowthYoY: 120.0,
    dividendYield: 1.5,
    aiVerdict: 'MUA',
    aiScore: 86,
    aiTarget: 88.0,
    aiStop: 66.0,
    aiReasoning: 'Chuỗi Bách Hóa Xanh bắt đầu ghi nhận lợi nhuận ròng tăng đều đặn. Tái cơ cấu thành công hệ thống Thế Giới Di Động & Điện Máy Xanh.',
  },
  {
    symbol: 'VHM',
    name: 'Công ty Cổ phần Vinhomes',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 71.7,
    referencePrice: 69.5,
    ceilingPrice: 74.3,
    floorPrice: 64.7,
    change: 2.2,
    changePercent: 3.17,
    volume: 5100800,
    marketCap: 301000,
    pe: 8.2,
    pb: 1.02,
    eps: 4950,
    roe: 17.5,
    roa: 8.2,
    debtToEquity: 0.55,
    grossMargin: 46.2,
    operatingMargin: 35.1,
    netMargin: 28.4,
    revenueGrowthYoY: 12.0,
    profitGrowthYoY: 15.2,
    dividendYield: 0.0,
    aiVerdict: 'THEO DÕI',
    aiScore: 72,
    aiTarget: 82.5,
    aiStop: 63.0,
    aiReasoning: 'Định giá lịch sử siêu rẻ P/B ~ 1.02x. Quỹ đất lớn nhất Việt Nam sẵn sàng mở bán các đại dự án mới khi thị trường BĐS ấm lên.',
  },
  {
    symbol: 'VIC',
    name: 'Tập đoàn Vingroup',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 205.0,
    referencePrice: 202.0,
    ceilingPrice: 216.1,
    floorPrice: 187.9,
    change: 3.0,
    changePercent: 1.49,
    volume: 3196900,
    marketCap: 760000,
    pe: 32.0,
    pb: 1.35,
    eps: 1284,
    roe: 4.8,
    roa: 1.2,
    debtToEquity: 1.85,
    grossMargin: 18.2,
    operatingMargin: 5.4,
    netMargin: 3.1,
    revenueGrowthYoY: 25.0,
    profitGrowthYoY: -10.5,
    dividendYield: 0.0,
    aiVerdict: 'THEO DÕI',
    aiScore: 65,
    aiTarget: 245.0,
    aiStop: 198.0,
    aiReasoning: 'VinFast tiếp tục mở rộng quy mô bàn giao xe điện toàn cầu nhưng áp lực tài chính và chi phí đầu tư ban đầu vẫn còn lớn.',
  },
  {
    symbol: 'VCB',
    name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    exchange: 'HOSE',
    sector: 'Ngân hàng',
    basePrice: 59.1,
    referencePrice: 57.8,
    ceilingPrice: 61.8,
    floorPrice: 53.8,
    change: 1.3,
    changePercent: 2.25,
    volume: 4695200,
    marketCap: 324000,
    pe: 13.5,
    pb: 2.4,
    eps: 6250,
    roe: 21.0,
    roa: 2.2,
    debtToEquity: 8.5,
    grossMargin: 52.0,
    operatingMargin: 45.0,
    netMargin: 36.5,
    revenueGrowthYoY: 11.2,
    profitGrowthYoY: 14.1,
    dividendYield: 2.5,
    aiVerdict: 'MUA',
    aiScore: 88,
    aiTarget: 68.0,
    aiStop: 53.0,
    aiReasoning: 'Chất lượng tài sản hàng đầu toàn hệ thống với tỷ lệ bao phủ nợ xấu vượt 200%. Vị thế anh cả ngành ngân hàng giữ nhịp chỉ số VNIndex.',
  },
  {
    symbol: 'STB',
    name: 'Ngân hàng TMCP Sài Gòn Thương Tín',
    exchange: 'HOSE',
    sector: 'Ngân hàng',
    basePrice: 74.7,
    referencePrice: 74.5,
    ceilingPrice: 79.7,
    floorPrice: 69.3,
    change: 0.2,
    changePercent: 0.27,
    volume: 1953800,
    marketCap: 141000,
    pe: 8.5,
    pb: 1.3,
    eps: 4070,
    roe: 18.5,
    roa: 1.8,
    debtToEquity: 7.9,
    grossMargin: 44.0,
    operatingMargin: 32.0,
    netMargin: 25.4,
    revenueGrowthYoY: 15.0,
    profitGrowthYoY: 38.0,
    dividendYield: 0.0,
    aiVerdict: 'MUA MẠNH',
    aiScore: 91,
    aiTarget: 88.5,
    aiStop: 68.0,
    aiReasoning: 'Đã hoàn tất trích lập toàn bộ nợ tồn đọng VAMC. Chuẩn bị đấu giá 32.5% cổ phần phong tỏa mở ra kỳ vọng bùng nổ định giá.',
  },
  {
    symbol: 'DGC',
    name: 'Công ty Cổ phần Tập đoàn Hóa chất Đức Giang',
    exchange: 'HOSE',
    sector: 'Hóa chất',
    basePrice: 43.05,
    referencePrice: 41.4,
    ceilingPrice: 44.25,
    floorPrice: 38.55,
    change: 1.65,
    changePercent: 3.99,
    volume: 451600,
    marketCap: 15800,
    pe: 14.0,
    pb: 2.8,
    eps: 8780,
    roe: 27.5,
    roa: 21.2,
    debtToEquity: 0.12,
    grossMargin: 34.5,
    operatingMargin: 26.8,
    netMargin: 23.1,
    revenueGrowthYoY: 16.5,
    profitGrowthYoY: 21.0,
    dividendYield: 4.5,
    aiVerdict: 'MUA MẠNH',
    aiScore: 93,
    aiTarget: 52.0,
    aiStop: 38.0,
    aiReasoning: 'Giá Phốt pho vàng (P4) thế giới tăng vọt do nhu cầu sản xuất chip bán dẫn và pin xe điện. Dự án Nghi Sơn sẵn sàng khởi công.',
  },
  {
    symbol: 'KDH',
    name: 'Công ty Cổ phần Đầu tư và Kinh doanh Nhà Khang Điền',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 18.0,
    referencePrice: 17.15,
    ceilingPrice: 18.35,
    floorPrice: 15.95,
    change: 0.85,
    changePercent: 4.96,
    volume: 6264700,
    marketCap: 12500,
    pe: 18.0,
    pb: 1.4,
    eps: 1680,
    roe: 9.2,
    roa: 5.1,
    debtToEquity: 0.45,
    grossMargin: 72.0,
    operatingMargin: 45.0,
    netMargin: 35.0,
    revenueGrowthYoY: 35.0,
    profitGrowthYoY: 48.0,
    dividendYield: 2.0,
    aiVerdict: 'MUA',
    aiScore: 83,
    aiTarget: 22.0,
    aiStop: 16.0,
    aiReasoning: 'Pháp lý quỹ đất sạch tại TP.HCM hoàn chỉnh nhất ngành. Mở bán dự án The Privia và Clarita đóng góp doanh thu khủng trong 2026.',
  },
  {
    symbol: 'PDR',
    name: 'Công ty Cổ phần Phát triển Bất động sản Phát Đạt',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 12.3,
    referencePrice: 11.8,
    ceilingPrice: 12.6,
    floorPrice: 11.0,
    change: 0.5,
    changePercent: 4.24,
    volume: 8033600,
    marketCap: 10500,
    pe: 20.0,
    pb: 1.2,
    eps: 800,
    roe: 6.5,
    roa: 3.2,
    debtToEquity: 0.38,
    grossMargin: 55.0,
    operatingMargin: 32.0,
    netMargin: 22.0,
    revenueGrowthYoY: 42.0,
    profitGrowthYoY: 65.0,
    dividendYield: 0.0,
    aiVerdict: 'MUA',
    aiScore: 79,
    aiTarget: 15.5,
    aiStop: 10.5,
    aiReasoning: 'Xử lý xong dư nợ trái phiếu doanh nghiệp, tập trung phát triển dự án Thuận An 1 & 2 và Bắc Hà Thanh mang lại dòng tiền thực.',
  },
  {
    symbol: 'DIG',
    name: 'Tổng Công ty Cổ phần Đầu tư Phát triển Xây dựng',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 11.0,
    referencePrice: 10.3,
    ceilingPrice: 11.0,
    floorPrice: 9.58,
    change: 0.7,
    changePercent: 6.8,
    volume: 10507200,
    marketCap: 6400,
    pe: 35.0,
    pb: 1.1,
    eps: 570,
    roe: 4.2,
    roa: 2.1,
    debtToEquity: 0.42,
    grossMargin: 28.0,
    operatingMargin: 12.0,
    netMargin: 8.5,
    revenueGrowthYoY: 15.0,
    profitGrowthYoY: 20.0,
    dividendYield: 0.0,
    aiVerdict: 'THEO DÕI',
    aiScore: 68,
    aiTarget: 13.5,
    aiStop: 9.5,
    aiReasoning: 'Quỹ đất lớn tại Bà Rịa - Vũng Tàu và Đồng Nai nhưng tiến độ bàn giao và hạch toán doanh thu còn chậm.',
  },
  {
    symbol: 'REE',
    name: 'Công ty Cổ phần Cơ Điện Lạnh',
    exchange: 'HOSE',
    sector: 'Điện',
    basePrice: 46.1,
    referencePrice: 45.6,
    ceilingPrice: 48.75,
    floorPrice: 42.45,
    change: 0.5,
    changePercent: 1.1,
    volume: 384700,
    marketCap: 21500,
    pe: 11.5,
    pb: 1.4,
    eps: 5760,
    roe: 14.2,
    roa: 8.5,
    debtToEquity: 0.48,
    grossMargin: 42.0,
    operatingMargin: 34.0,
    netMargin: 28.0,
    revenueGrowthYoY: 12.5,
    profitGrowthYoY: 18.2,
    dividendYield: 3.8,
    aiVerdict: 'MUA MẠNH',
    aiScore: 87,
    aiTarget: 56.0,
    aiStop: 41.0,
    aiReasoning: 'Hiện tượng La Nina quay trở lại giúp sản lượng thủy điện bùng nổ. Tòa nhà Etown 6 đi vào hoạt động gia tăng dòng tiền cho thuê cố định.',
  },
  {
    symbol: 'GMD',
    name: 'Công ty Cổ phần Gemadept',
    exchange: 'HOSE',
    sector: 'Cảng biển',
    basePrice: 77.4,
    referencePrice: 77.0,
    ceilingPrice: 82.3,
    floorPrice: 71.7,
    change: 0.4,
    changePercent: 0.52,
    volume: 1388900,
    marketCap: 24200,
    pe: 12.0,
    pb: 2.2,
    eps: 5320,
    roe: 15.8,
    roa: 9.8,
    debtToEquity: 0.28,
    grossMargin: 46.0,
    operatingMargin: 36.0,
    netMargin: 30.0,
    revenueGrowthYoY: 19.5,
    profitGrowthYoY: 28.0,
    dividendYield: 2.8,
    aiVerdict: 'MUA MẠNH',
    aiScore: 90,
    aiTarget: 95.0,
    aiStop: 72.0,
    aiReasoning: 'Cảng Gemalink giai đoạn 2 mở rộng công suất, sản lượng hàng hóa thông quan qua khu vực Cái Mép - Thị Vải tăng trưởng 2 con số.',
  },
  {
    symbol: 'PVD',
    name: 'Tổng Công ty Cổ phần Khoan và Dịch vụ Khoan Dầu khí',
    exchange: 'HOSE',
    sector: 'Dầu khí',
    basePrice: 18.6,
    referencePrice: 18.35,
    ceilingPrice: 19.6,
    floorPrice: 17.1,
    change: 0.25,
    changePercent: 1.36,
    volume: 2938800,
    marketCap: 10200,
    pe: 16.0,
    pb: 1.0,
    eps: 1310,
    roe: 5.8,
    roa: 3.2,
    debtToEquity: 0.32,
    grossMargin: 24.0,
    operatingMargin: 15.0,
    netMargin: 11.5,
    revenueGrowthYoY: 28.0,
    profitGrowthYoY: 85.0,
    dividendYield: 0.0,
    aiVerdict: 'MUA',
    aiScore: 82,
    aiTarget: 23.0,
    aiStop: 16.5,
    aiReasoning: 'Hiệu suất hoạt động giàn khoan đạt 100%, giá thuê giàn tự nâng (JU) duy trì ở mức cao. Đại dự án Lô B Ô Môn mang lại khối lượng công việc khổng lồ.',
  },
  {
    symbol: 'PVS',
    name: 'Tổng Công ty Cổ phần Dịch vụ Kỹ thuật Dầu khí Việt Nam',
    exchange: 'HNX',
    sector: 'Dầu khí',
    basePrice: 37.0,
    referencePrice: 37.0,
    ceilingPrice: 40.7,
    floorPrice: 33.3,
    change: 0.0,
    changePercent: 0.0,
    volume: 2869423,
    marketCap: 17100,
    pe: 15.5,
    pb: 1.3,
    eps: 2225,
    roe: 8.5,
    roa: 4.1,
    debtToEquity: 0.18,
    grossMargin: 8.5,
    operatingMargin: 5.8,
    netMargin: 4.8,
    revenueGrowthYoY: 22.0,
    profitGrowthYoY: 30.0,
    dividendYield: 2.5,
    aiVerdict: 'MUA MẠNH',
    aiScore: 89,
    aiTarget: 44.0,
    aiStop: 32.0,
    aiReasoning: 'Trúng thầu các hợp đồng EPCIC điện gió ngoài khơi quốc tế và gói thầu chính của Lô B Ô Môn giá trị hàng tỷ USD.',
  },
  {
    symbol: 'FRT',
    name: 'Công ty Cổ phần Bán lẻ Kỹ thuật số FPT',
    exchange: 'HOSE',
    sector: 'Bán lẻ',
    basePrice: 143.5,
    referencePrice: 145.0,
    ceilingPrice: 155.1,
    floorPrice: 134.9,
    change: -1.5,
    changePercent: -1.03,
    volume: 469400,
    marketCap: 19800,
    pe: 42.0,
    pb: 8.5,
    eps: 3700,
    roe: 28.0,
    roa: 5.2,
    debtToEquity: 1.45,
    grossMargin: 22.8,
    operatingMargin: 4.2,
    netMargin: 2.8,
    revenueGrowthYoY: 24.5,
    profitGrowthYoY: 150.0,
    dividendYield: 0.0,
    aiVerdict: 'MUA MẠNH',
    aiScore: 91,
    aiTarget: 175.0,
    aiStop: 132.0,
    aiReasoning: 'Chuỗi nhà thuốc Long Châu độc bá thị trường bán lẻ dược phẩm với hơn 1.800 cửa hàng, bắt đầu mở rộng mảng trung tâm tiêm chủng.',
  },
  {
    symbol: 'NLG',
    name: 'Công ty Cổ phần Đầu tư Nam Long',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 24.0,
    referencePrice: 23.45,
    ceilingPrice: 25.05,
    floorPrice: 21.85,
    change: 0.55,
    changePercent: 2.35,
    volume: 3392700,
    marketCap: 9000,
    pe: 16.0,
    pb: 1.2,
    eps: 1790,
    roe: 7.2,
    roa: 4.0,
    debtToEquity: 0.36,
    grossMargin: 48.0,
    operatingMargin: 25.0,
    netMargin: 18.0,
    revenueGrowthYoY: 28.0,
    profitGrowthYoY: 32.0,
    dividendYield: 1.2,
    aiVerdict: 'MUA',
    aiScore: 81,
    aiTarget: 29.0,
    aiStop: 21.0,
    aiReasoning: 'Dòng sản phẩm căn hộ vừa túi tiền bàn giao liên tục tại dự án Akari City và Mizuki Park mang lại dòng tiền bán hàng ổn định.',
  },
  {
    symbol: 'KBC',
    name: 'Tổng Công ty Phát triển Đô thị Kinh Bắc',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 27.35,
    referencePrice: 27.1,
    ceilingPrice: 28.95,
    floorPrice: 25.25,
    change: 0.25,
    changePercent: 0.92,
    volume: 1544600,
    marketCap: 20700,
    pe: 14.5,
    pb: 1.1,
    eps: 2020,
    roe: 8.8,
    roa: 4.5,
    debtToEquity: 0.42,
    grossMargin: 54.0,
    operatingMargin: 38.0,
    netMargin: 28.0,
    revenueGrowthYoY: 18.0,
    profitGrowthYoY: 24.0,
    dividendYield: 0.0,
    aiVerdict: 'MUA',
    aiScore: 80,
    aiTarget: 34.5,
    aiStop: 24.5,
    aiReasoning: 'Hưởng lợi từ làn sóng dịch chuyển FDI công nghệ cao vào Việt Nam, chuẩn bị bàn giao quỹ đất khu công nghiệp Nam Sơn Hạp Lĩnh.',
  },
  {
    symbol: 'VRE',
    name: 'Công ty Cổ phần Vincom Retail',
    exchange: 'HOSE',
    sector: 'Bất động sản',
    basePrice: 25.3,
    referencePrice: 24.15,
    ceilingPrice: 25.8,
    floorPrice: 22.5,
    change: 1.15,
    changePercent: 4.76,
    volume: 6035600,
    marketCap: 55400,
    pe: 13.0,
    pb: 1.5,
    eps: 1910,
    roe: 11.5,
    roa: 8.2,
    debtToEquity: 0.22,
    grossMargin: 56.0,
    operatingMargin: 48.0,
    netMargin: 38.0,
    revenueGrowthYoY: 8.2,
    profitGrowthYoY: 12.0,
    dividendYield: 0.0,
    aiVerdict: 'THEO DÕI',
    aiScore: 74,
    aiTarget: 30.0,
    aiStop: 22.0,
    aiReasoning: 'Hệ thống TTTM lấp đầy >85% tạo dòng tiền cho thuê bền vững.',
  },
  {
    symbol: 'CTG',
    name: 'Ngân hàng TMCP Công Thương Việt Nam',
    exchange: 'HOSE',
    sector: 'Ngân hàng',
    basePrice: 32.15,
    referencePrice: 31.4,
    ceilingPrice: 33.55,
    floorPrice: 29.25,
    change: 0.75,
    changePercent: 2.39,
    volume: 6428200,
    marketCap: 169000,
    pe: 6.2,
    pb: 1.1,
    eps: 4330,
    roe: 17.2,
    roa: 1.5,
    debtToEquity: 8.4,
    grossMargin: 46.0,
    operatingMargin: 36.0,
    netMargin: 28.0,
    revenueGrowthYoY: 14.2,
    profitGrowthYoY: 22.0,
    dividendYield: 3.2,
    aiVerdict: 'MUA MẠNH',
    aiScore: 89,
    aiTarget: 38.5,
    aiStop: 28.5,
    aiReasoning: 'Chủ động tăng tỷ lệ trích lập dự phòng rủi ro nợ xấu, biên lãi thuần NIM giữ mức cao 3.0%. Tốc độ giải ngân vốn đầu tư công thúc đẩy tín dụng.',
  },
  {
    symbol: 'ACB',
    name: 'Ngân hàng TMCP Á Châu',
    exchange: 'HOSE',
    sector: 'Ngân hàng',
    basePrice: 22.75,
    referencePrice: 21.95,
    ceilingPrice: 23.45,
    floorPrice: 20.45,
    change: 0.8,
    changePercent: 3.64,
    volume: 12170700,
    marketCap: 84000,
    pe: 5.8,
    pb: 1.15,
    eps: 3700,
    roe: 22.8,
    roa: 2.4,
    debtToEquity: 7.5,
    grossMargin: 49.0,
    operatingMargin: 39.0,
    netMargin: 31.0,
    revenueGrowthYoY: 12.8,
    profitGrowthYoY: 15.4,
    dividendYield: 6.0,
    aiVerdict: 'MUA MẠNH',
    aiScore: 91,
    aiTarget: 27.5,
    aiStop: 19.5,
    aiReasoning: 'Ngân hàng quản trị rủi ro tốt nhất hệ thống, không có nợ xấu trái phiếu hay bất động sản đầu cơ. Cổ tức cổ phiếu + tiền mặt đều đặn.',
  },
];

// Memory store for candle history and live quote updates
const candleStore: Record<string, Candle[]> = {};
const stockStore: Record<string, StockData> = {};

// Helper to generate deterministic historical daily candles (3 years) that GUARANTEE ending at targetPrice and referencePrice
function generateHistoricalCandles(targetPrice: number, referencePrice: number = targetPrice, changePercent: number = 0): Candle[] {
  const now = new Date();
  const daysToGenerate = 750; // ~3 years of trading days

  let currentClose = referencePrice;

  const dates: string[] = [];
  let dayOffset = 0;
  while (dates.length < daysToGenerate) {
    const d = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    dayOffset++;
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    dates.push(d.toISOString().split('T')[0]);
  }

  const backwardsCandles: Candle[] = [];

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i];
    if (i === 0) {
      // Latest candle (today)
      const open = Math.max(0.5, Number((referencePrice + (targetPrice - referencePrice) * 0.3).toFixed(2)));
      const high = Number((Math.max(open, targetPrice) * 1.008).toFixed(2));
      const low = Number((Math.min(open, targetPrice) * 0.992).toFixed(2));
      const volume = Math.floor(2500000 + Math.random() * 8000000);
      backwardsCandles.push({
        time: dateStr,
        open,
        high,
        low,
        close: targetPrice,
        volume,
      });
      continue;
    }

    if (i === 1) {
      // Previous day candle (yesterday = reference price)
      const open = Number((referencePrice * 0.995).toFixed(2));
      const high = Number((referencePrice * 1.01).toFixed(2));
      const low = Number((referencePrice * 0.99).toFixed(2));
      const volume = Math.floor(2000000 + Math.random() * 6000000);
      backwardsCandles.push({
        time: dateStr,
        open,
        high,
        low,
        close: referencePrice,
        volume,
      });
      currentClose = referencePrice;
      continue;
    }

    const dailyChange = (Math.random() - 0.485) * 0.032;
    const open = Math.max(0.5, Number((currentClose / (1 + dailyChange)).toFixed(2)));
    const high = Number((Math.max(open, currentClose) * (1 + Math.random() * 0.015)).toFixed(2));
    const low = Number((Math.min(open, currentClose) * (1 - Math.random() * 0.015)).toFixed(2));
    const volume = Math.floor(1500000 + Math.random() * 10000000);

    backwardsCandles.push({
      time: dateStr,
      open,
      high,
      low,
      close: Number(currentClose.toFixed(2)),
      volume,
    });

    currentClose = Math.max(0.5, open * (1 + (Math.random() - 0.5) * 0.005));
  }

  // Reverse so chronological order: oldest to newest
  const sorted = backwardsCandles.reverse();
  if (sorted.length > 1) {
    sorted[sorted.length - 2].close = referencePrice;
    sorted[sorted.length - 1].close = targetPrice;
  }
  return sorted;
}

// Initialize Stock Database
RAW_STOCKS.forEach((raw) => {
  const candles = generateHistoricalCandles(raw.basePrice, raw.referencePrice, raw.changePercent);
  candleStore[raw.symbol] = candles;

  const technical = computeTechnicalIndicators(candles);

  const fundamental: FundamentalData = {
    pe: raw.pe,
    pb: raw.pb,
    eps: raw.eps,
    roe: raw.roe,
    roa: raw.roa,
    debtToEquity: raw.debtToEquity,
    currentRatio: 1.45,
    quickRatio: 1.12,
    grossMargin: raw.grossMargin,
    operatingMargin: raw.operatingMargin,
    netMargin: raw.netMargin,
    bookValue: Number((raw.basePrice * 1000 / raw.pb).toFixed(0)),
    dividendYield: raw.dividendYield,
    evEbitda: Number((raw.pe * 0.85).toFixed(1)),
    peg: Number((raw.pe / raw.profitGrowthYoY).toFixed(2)),
    revenueGrowthYoY: raw.revenueGrowthYoY,
    profitGrowthYoY: raw.profitGrowthYoY,
    fcf: Number((raw.marketCap * 0.06).toFixed(0)),
    marketCap: raw.marketCap,
    sharesOutstanding: Number((raw.marketCap / raw.basePrice).toFixed(0)),
    industryAvgPE: 15.2,
    industryAvgPB: 1.8,
    industryAvgROE: 16.5,
  };

  const financialStatements = [
    { quarter: 'Q1/2026', revenue: Math.round(raw.marketCap * 0.08), operatingProfit: Math.round(raw.marketCap * 0.02), netProfit: Math.round(raw.marketCap * 0.015), totalAssets: Math.round(raw.marketCap * 1.8), totalLiabilities: Math.round(raw.marketCap * 0.8), equity: Math.round(raw.marketCap), operatingCashFlow: Math.round(raw.marketCap * 0.025), investingCashFlow: -Math.round(raw.marketCap * 0.01), financingCashFlow: -Math.round(raw.marketCap * 0.005) },
    { quarter: 'Q4/2025', revenue: Math.round(raw.marketCap * 0.078), operatingProfit: Math.round(raw.marketCap * 0.019), netProfit: Math.round(raw.marketCap * 0.014), totalAssets: Math.round(raw.marketCap * 1.75), totalLiabilities: Math.round(raw.marketCap * 0.78), equity: Math.round(raw.marketCap * 0.97), operatingCashFlow: Math.round(raw.marketCap * 0.022), investingCashFlow: -Math.round(raw.marketCap * 0.008), financingCashFlow: -Math.round(raw.marketCap * 0.004) },
    { quarter: 'Q3/2025', revenue: Math.round(raw.marketCap * 0.075), operatingProfit: Math.round(raw.marketCap * 0.018), netProfit: Math.round(raw.marketCap * 0.013), totalAssets: Math.round(raw.marketCap * 1.7), totalLiabilities: Math.round(raw.marketCap * 0.75), equity: Math.round(raw.marketCap * 0.95), operatingCashFlow: Math.round(raw.marketCap * 0.02), investingCashFlow: -Math.round(raw.marketCap * 0.007), financingCashFlow: -Math.round(raw.marketCap * 0.003) },
    { quarter: 'Q2/2025', revenue: Math.round(raw.marketCap * 0.072), operatingProfit: Math.round(raw.marketCap * 0.017), netProfit: Math.round(raw.marketCap * 0.012), totalAssets: Math.round(raw.marketCap * 1.65), totalLiabilities: Math.round(raw.marketCap * 0.72), equity: Math.round(raw.marketCap * 0.93), operatingCashFlow: Math.round(raw.marketCap * 0.018), investingCashFlow: -Math.round(raw.marketCap * 0.006), financingCashFlow: -Math.round(raw.marketCap * 0.002) },
  ];

  stockStore[raw.symbol] = {
    symbol: raw.symbol,
    name: raw.name,
    exchange: raw.exchange,
    sector: raw.sector,
    price: raw.basePrice,
    change: raw.change,
    changePercent: raw.changePercent,
    openPrice: Number((raw.referencePrice + raw.change * 0.4).toFixed(2)),
    highPrice: Math.max(raw.basePrice, Number((raw.referencePrice + Math.abs(raw.change) * 1.2).toFixed(2))),
    lowPrice: Math.min(raw.basePrice, Number((raw.referencePrice - Math.abs(raw.change) * 0.3).toFixed(2))),
    referencePrice: raw.referencePrice,
    ceilingPrice: raw.ceilingPrice,
    floorPrice: raw.floorPrice,
    volume: raw.volume,
    value: Number(((raw.basePrice * raw.volume) / 10000000).toFixed(1)), // Tỷ VNĐ
    foreignBuyVol: Math.floor(raw.volume * 0.15),
    foreignSellVol: Math.floor(raw.volume * 0.08),
    foreignNetVal: Number(((raw.volume * 0.07 * raw.basePrice) / 1000000).toFixed(1)),
    technical,
    fundamental,
    financialStatements,
    aiScore: raw.aiScore,
    aiVerdict: raw.aiVerdict,
    aiConfidence: 85 + Math.floor(Math.random() * 10),
    aiTargetPrice: raw.aiTarget,
    aiStopLoss: raw.aiStop,
    aiReasoning: raw.aiReasoning,
  };
  stockStore[raw.symbol].smartMoney = analyzeSmartMoneySignal(stockStore[raw.symbol]);
});

// Real-time Orderbook generator for active symbol
export function getOrderBook(symbol: string): OrderBook {
  const stock = stockStore[symbol] || stockStore['HPG'];
  const price = stock.price;

  const bid: { price: number; volume: number }[] = [
    { price: Number((price - 0.05).toFixed(2)), volume: Math.floor(150000 + Math.random() * 200000) },
    { price: Number((price - 0.1).toFixed(2)), volume: Math.floor(220000 + Math.random() * 300000) },
    { price: Number((price - 0.15).toFixed(2)), volume: Math.floor(380000 + Math.random() * 400000) },
  ];

  const ask: { price: number; volume: number }[] = [
    { price: Number((price + 0.05).toFixed(2)), volume: Math.floor(120000 + Math.random() * 180000) },
    { price: Number((price + 0.1).toFixed(2)), volume: Math.floor(260000 + Math.random() * 250000) },
    { price: Number((price + 0.15).toFixed(2)), volume: Math.floor(410000 + Math.random() * 350000) },
  ];

  const totalBuyVol = bid.reduce((acc, item) => acc + item.volume, 0);
  const totalSellVol = ask.reduce((acc, item) => acc + item.volume, 0);

  return {
    symbol,
    bid,
    ask,
    lastPrice: price,
    lastVolume: Math.floor(5000 + Math.random() * 25000),
    totalBuyVol,
    totalSellVol,
  };
}

// Order trade ticks generator
export function getTradeTicks(symbol: string): TradeTick[] {
  const stock = stockStore[symbol] || stockStore['HPG'];
  const price = stock.price;
  const ticks: TradeTick[] = [];
  const now = new Date();

  for (let i = 0; i < 15; i++) {
    const time = new Date(now.getTime() - i * 15 * 1000).toLocaleTimeString('vi-VN');
    const type = Math.random() > 0.45 ? 'BUY' : 'SELL';
    const delta = type === 'BUY' ? 0.05 : -0.05;
    ticks.push({
      id: `tick-${i}`,
      time,
      price: Number((price + (Math.random() > 0.6 ? delta : 0)).toFixed(2)),
      volume: Math.floor(1000 + Math.random() * 40000),
      type,
    });
  }

  return ticks;
}

// Live Market Indices State
const liveIndices: MarketIndex[] = [
  {
    symbol: 'VNINDEX',
    name: 'VN-Index',
    price: 1777.23,
    change: 14.39,
    changePercent: 0.82,
    totalVolume: 533722479,
    totalValue: 18450.5,
    advances: 238,
    declines: 124,
    noChanges: 65,
    history: [
      { time: '09:15', value: 1762.84 },
      { time: '10:00', value: 1768.10 },
      { time: '11:30', value: 1772.45 },
      { time: '13:30', value: 1770.80 },
      { time: '14:30', value: 1777.23 },
    ],
  },
  {
    symbol: 'VN30',
    name: 'VN30-Index',
    price: 1927.35,
    change: 9.66,
    changePercent: 0.50,
    totalVolume: 232528773,
    totalValue: 9820.0,
    advances: 22,
    declines: 6,
    noChanges: 2,
    history: [
      { time: '09:15', value: 1917.69 },
      { time: '10:00', value: 1922.30 },
      { time: '11:30', value: 1925.10 },
      { time: '13:30', value: 1924.50 },
      { time: '14:30', value: 1927.35 },
    ],
  },
  {
    symbol: 'HNXINDEX',
    name: 'HNX-Index',
    price: 286.41,
    change: 7.13,
    changePercent: 2.55,
    totalVolume: 68500000,
    totalValue: 1240.2,
    advances: 85,
    declines: 54,
    noChanges: 42,
    history: [
      { time: '09:15', value: 279.28 },
      { time: '11:30', value: 282.50 },
      { time: '14:30', value: 286.41 },
    ],
  },
  {
    symbol: 'UPCOM',
    name: 'UPCoM-Index',
    price: 127.20,
    change: 0.53,
    changePercent: 0.42,
    totalVolume: 17698600,
    totalValue: 680.4,
    advances: 142,
    declines: 98,
    noChanges: 110,
    history: [
      { time: '09:15', value: 126.67 },
      { time: '11:30', value: 126.90 },
      { time: '14:30', value: 127.20 },
    ],
  },
];

export function getMarketIndices(): MarketIndex[] {
  return liveIndices;
}

// Sector Data
export function getSectors(): SectorData[] {
  return [
    { name: 'Công nghệ', changePercent: 2.15, totalValue: 2450.8, topGainer: 'FPT (+2.8%)', stockCount: 8, foreignNetVal: 145.2 },
    { name: 'Ngân hàng', changePercent: 1.45, totalValue: 6820.4, topGainer: 'STB (+3.5%)', stockCount: 18, foreignNetVal: 312.0 },
    { name: 'Thép', changePercent: 1.85, totalValue: 2840.1, topGainer: 'HPG (+2.4%)', stockCount: 10, foreignNetVal: 210.5 },
    { name: 'Chứng khoán', changePercent: 1.2, totalValue: 3120.0, topGainer: 'SSI (+2.1%)', stockCount: 14, foreignNetVal: -45.0 },
    { name: 'Bán lẻ', changePercent: 1.65, totalValue: 1950.5, topGainer: 'FRT (+3.8%)', stockCount: 9, foreignNetVal: 88.0 },
    { name: 'Cảng biển', changePercent: 1.95, totalValue: 840.0, topGainer: 'GMD (+2.6%)', stockCount: 6, foreignNetVal: 54.0 },
    { name: 'Bất động sản', changePercent: -0.45, totalValue: 4120.2, topGainer: 'KDH (+1.8%)', stockCount: 32, foreignNetVal: -185.0 },
    { name: 'Dầu khí', changePercent: 1.1, totalValue: 1280.5, topGainer: 'PVS (+2.2%)', stockCount: 11, foreignNetVal: 42.0 },
    { name: 'Hóa chất', changePercent: 2.4, totalValue: 1120.0, topGainer: 'DGC (+3.1%)', stockCount: 7, foreignNetVal: 95.0 },
  ];
}

// Live RSS News Cache and Fetching
let cachedNews: NewsItem[] = [];
let lastNewsFetchTime = 0;

export async function fetchLiveNewsFromRSS(): Promise<NewsItem[]> {
  const rssFeeds = [
    { url: 'https://cafef.vn/thi-truong-chung-khoan.rss', source: 'CafeF Chứng Khoán' },
    { url: 'https://cafef.vn/doanh-nghiep.rss', source: 'CafeF Doanh Nghiệp' },
    { url: 'https://vnexpress.net/rss/kinh-doanh.rss', source: 'VnExpress Kinh Doanh' },
  ];

  const stockSymbols = [
    'HPG', 'FPT', 'VNM', 'VIC', 'VHM', 'DIG', 'NVL', 'MBB', 'TCB', 'VCB', 'STB', 'CTG',
    'ACB', 'SSI', 'PVD', 'PVS', 'BSR', 'GAS', 'FRT', 'MWG', 'DXG', 'VPB', 'TPB', 'HDB',
    'SHB', 'EIB', 'VRE', 'MSN', 'REE', 'POW', 'VJC', 'SAB', 'GVR', 'PLX', 'BVH', 'VIB',
    'LPB', 'BCM', 'VGC', 'DCM', 'DPM', 'KDH', 'NLG', 'PDR', 'KBC', 'CEO', 'VCI', 'HCM',
    'VND', 'SHS', 'BSI', 'FTS', 'CTS', 'VDS', 'MSH', 'TCM', 'VHC', 'ANV', 'IDI', 'DBC'
  ];

  const posWords = [
    'tăng', 'lãi', 'bứt phá', 'kỷ kỷ lục', 'mua ròng', 'trúng hợp đồng', 'khởi sắc',
    'tăng trưởng', 'vượt kế hoạch', 'bơm ròng', 'mở rộng', 'sức hút', 'thắng lớn',
    'đột biến', 'dẫn đầu', 'tiềm năng', 'hợp tác', 'chia cổ tức', 'thưởng cổ phiếu'
  ];

  const negWords = [
    'lỗ', 'giảm', 'xử phạt', 'sụt giảm', 'bán tháo', 'giảm sàn', 'bán ròng', 'suy giảm',
    'áp lực', 'rủi ro', 'lo ngại', 'tháo chạy', 'ảnh hưởng', 'đối mặt', 'chốt lời',
    'thất thoát', 'vi phạm', 'truy cứu', 'thanh tra', 'hủy niêm yết'
  ];

  const items: NewsItem[] = [];

  for (const feed of rssFeeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!res.ok) continue;

      const xmlText = await res.text();
      const itemRegex = /<item>[\s\S]*?<\/item>/g;
      const matches = xmlText.match(itemRegex) || [];

      for (const itemXml of matches.slice(0, 15)) {
        let title = (itemXml.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
        let link = (itemXml.match(/<link>(.*?)<\/link>/s) || [])[1] || '';
        let pubDateStr = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || '';
        let desc = (itemXml.match(/<description>(.*?)<\/description>/s) || [])[1] || '';

        // Clean XML / CDATA / HTML tags
        title = title.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
        link = link.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
        desc = desc.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim();

        if (!title || !link) continue;

        // Sentiment Classification
        const lowerText = (title + ' ' + desc).toLowerCase();
        let sentiment: 'TÍCH CỰC' | 'TIÊU CỰC' | 'TRUNG TÍNH' = 'TRUNG TÍNH';

        let posCount = posWords.filter((w) => lowerText.includes(w)).length;
        let negCount = negWords.filter((w) => lowerText.includes(w)).length;

        if (posCount > negCount) sentiment = 'TÍCH CỰC';
        else if (negCount > posCount) sentiment = 'TIÊU CỰC';

        // Match stock symbols (direct ticker or keyword mapping)
        const matchedSymbolsSet = new Set<string>();
        stockSymbols.forEach((sym) => {
          if (new RegExp(`\\b${sym}\\b`, 'i').test(title + ' ' + desc)) {
            matchedSymbolsSet.add(sym);
          }
        });

        const keywordMap: Record<string, string[]> = {
          'vingroup': ['VIC', 'VHM', 'VRE'],
          'vinhomes': ['VHM'],
          'vinfast': ['VIC'],
          'eximbank': ['EIB'],
          'pvtrans': ['PVD', 'PVS'],
          'petrovietnam': ['PVD', 'PVS', 'GAS', 'BSR'],
          'dầu khí': ['PVD', 'PVS', 'GAS', 'BSR'],
          'hòa phát': ['HPG'],
          'thép': ['HPG'],
          'fpt': ['FPT'],
          'vietcombank': ['VCB'],
          'mbbank': ['MBB'],
          'techcombank': ['TCB'],
          'sacombank': ['STB'],
          'bất động sản': ['DIG', 'NVL', 'DXG', 'VHM'],
          'ngân hàng': ['VCB', 'MBB', 'TCB', 'STB', 'CTG', 'EIB'],
          'chứng khoán': ['SSI', 'VND', 'VCI'],
          'bán lẻ': ['FRT', 'MWG'],
          'nhà thuốc long châu': ['FRT'],
          'thế giới di động': ['MWG'],
          'thủy sản': ['VHC', 'ANV'],
          'phân bón': ['DCM', 'DPM'],
          'chăn nuôi': ['DBC'],
          'tập đoàn st8': ['ST8'],
          'st8': ['ST8'],
          'vn-index': ['VNINDEX', 'VN30'],
          'thị trường': ['VNINDEX', 'VN30'],
          'cổ tức': ['TCB', 'MBB', 'HPG'],
        };

        Object.entries(keywordMap).forEach(([keyword, syms]) => {
          if (lowerText.includes(keyword)) {
            syms.forEach((s) => matchedSymbolsSet.add(s));
          }
        });

        let matchedSymbols = Array.from(matchedSymbolsSet);
        if (matchedSymbols.length === 0) {
          matchedSymbols = ['VNINDEX', 'VN30'];
        }

        // Format Date / Time
        let timeStr = 'Vừa xong';
        if (pubDateStr) {
          try {
            const d = new Date(pubDateStr);
            if (!isNaN(d.getTime())) {
              const dayStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const timeFormatted = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              timeStr = `${dayStr} ${timeFormatted}`;
            }
          } catch {
            timeStr = pubDateStr;
          }
        }

        const rawItem: Partial<NewsItem> = {
          id: `news-live-${Math.random().toString(36).substring(2, 8)}`,
          title,
          source: feed.source,
          url: link,
          time: timeStr,
          summary: desc.length > 200 ? desc.substring(0, 200) + '...' : desc,
          symbols: matchedSymbols,
          sentiment,
          impactScore: sentiment === 'TRUNG TÍNH' ? 3 : 4,
        };

        items.push(enrichNewsItemWithDeepScoring(rawItem));
      }
    } catch (err) {
      console.error(`Error fetching RSS feed ${feed.url}:`, err);
    }
  }

  return items;
}

// Get latest news (with live RSS cache and fallback)
export async function getLatestNewsAsync(): Promise<NewsItem[]> {
  const NOW = Date.now();
  if (cachedNews.length > 0 && NOW - lastNewsFetchTime < 300000) {
    return cachedNews;
  }

  try {
    const liveItems = await fetchLiveNewsFromRSS();
    if (liveItems && liveItems.length > 0) {
      cachedNews = liveItems;
      lastNewsFetchTime = NOW;
      return cachedNews;
    }
  } catch (err) {
    console.error('Error in getLatestNewsAsync:', err);
  }

  if (cachedNews.length > 0) return cachedNews;

  // Fallback items with 100% valid Google Search links to prevent 404
  const rawFallback: Partial<NewsItem>[] = [
    {
      id: 'news-1',
      title: 'Hòa Phát (HPG) tăng tốc mở rộng Dung Quất 2, sản lượng HRC dự kiến vượt 5.6 triệu tấn',
      source: 'SSI Research',
      url: 'https://www.google.com/search?q=Hoa+Phat+HPG+Dung+Quat+2+SSI+Research',
      time: '04/08/2026 15:30 (15 phút trước)',
      summary: 'Dự án Dung Quất 2 đạt tiến độ 92%, dự kiến cho ra sản phẩm thương mại vào Q3/2026 giúp HPG củng cố vị thế dẫn đầu ngành thép Đông Nam Á.',
      symbols: ['HPG'],
      sentiment: 'TÍCH CỰC',
      impactScore: 5,
    },
    {
      id: 'news-2',
      title: 'FPT trúng hợp đồng dịch vụ công nghệ thông tin trị giá 120 triệu USD tại thị trường Nhật Bản',
      source: 'Vietstock',
      url: 'https://www.google.com/search?q=FPT+trung+hop+dong+120+trieu+USD+Nhat+Ban',
      time: '04/08/2026 15:10 (35 phút trước)',
      summary: 'Mảng công nghệ thông tin thị trường nước ngoài của FPT tiếp tục bứt phá với chuỗi hợp đồng quy mô lớn về Chuyển đổi số và AI Enterprise.',
      symbols: ['FPT'],
      sentiment: 'TÍCH CỰC',
      impactScore: 5,
    },
    {
      id: 'news-3',
      title: 'Áp lực chốt lời gia tăng mạnh ở nhóm Bất động sản thương mại, DIG & NVL quay đầu giảm sàn',
      source: 'CafeF',
      url: 'https://www.google.com/search?q=Ap+luc+chot+loi+bat+dong+san+DIG+NVL',
      time: '04/08/2026 14:45 (1 giờ trước)',
      summary: 'Làn sóng bán tháo ngắn hạn bùng nổ khi áp lực đáo hạn trái phiếu doanh nghiệp quý III gia tăng, khiến dòng tiền đầu cơ rút lui mạnh khỏi mã DIG và NVL.',
      symbols: ['DIG', 'NVL', 'DXG'],
      sentiment: 'TIÊU CỰC',
      impactScore: 4,
    },
    {
      id: 'news-4',
      title: 'Ngân hàng Nhà nước duy trì mặt bằng lãi suất điều hành thấp, bơm ròng hơn 15.000 tỷ qua OMO',
      source: 'VnExpress Finance',
      url: 'https://www.google.com/search?q=Ngan+hang+Nha+nuoc+bom+rong+OMO+lai+suat',
      time: '04/08/2026 14:15 (1.5 giờ trước)',
      summary: 'NHNN liên tục hỗ trợ thanh khoản hệ thống ngân hàng nhằm duy trì mặt bằng lãi suất cho vay cạnh tranh thúc đẩy tăng trưởng kinh tế.',
      symbols: ['MBB', 'TCB', 'VCB', 'STB', 'CTG', 'ACB'],
      sentiment: 'TÍCH CỰC',
      impactScore: 4,
    },
    {
      id: 'news-5',
      title: 'Giá dầu Brent sụt giảm 3.5% xuống mốc 74 USD/thùng, nhóm Dầu khí chịu áp lực chốt lời diện rộng',
      source: 'Báo Đầu tư',
      url: 'https://www.google.com/search?q=Gia+dau+Brent+giam+co+phieu+dau+khi+chot+loi',
      time: '04/08/2026 13:30 (2.5 giờ trước)',
      summary: 'Tồn kho dầu thô Mỹ tăng bất ngờ cùng lo ngại tăng trưởng kinh tế toàn cầu chậm lại khiến các mã PVD, PVS, BSR chịu áp lực điều chỉnh ngắn hạn.',
      symbols: ['PVD', 'PVS', 'BSR', 'GAS'],
      sentiment: 'TIÊU CỰC',
      impactScore: 4,
    },
    {
      id: 'news-6',
      title: 'Khối ngoại đảo chiều mua ròng hơn 450 tỷ đồng trên HOSE, tâm điểm HPG, STB, FPT',
      source: 'FireAnt News',
      url: 'https://www.google.com/search?q=Khoi+ngoai+mua+rong+450+ty+HOSE+HPG+STB+FPT',
      time: '04/08/2026 12:00 (4 giờ trước)',
      summary: 'Sau chuỗi ngày bán ròng dài, các quỹ ETF như Fubon và VNM ETF bắt đầu mua lại các cổ phiếu vốn hóa lớn có nền tảng cơ bản vững chắc.',
      symbols: ['HPG', 'STB', 'FPT', 'SSI'],
      sentiment: 'TÍCH CỰC',
      impactScore: 4,
    },
  ];

  cachedNews = rawFallback.map((item) => enrichNewsItemWithDeepScoring(item));
  lastNewsFetchTime = NOW;
  return cachedNews;
}

// Synchronous wrapper for backwards compatibility
export function getLatestNews(): NewsItem[] {
  if (cachedNews.length > 0) return cachedNews;

  // Trigger async fetch in background
  getLatestNewsAsync();

  const rawFallback: Partial<NewsItem>[] = [
    {
      id: 'news-1',
      title: 'Hòa Phát (HPG) tăng tốc mở rộng Dung Quất 2, sản lượng HRC dự kiến vượt 5.6 triệu tấn',
      source: 'SSI Research',
      url: 'https://www.google.com/search?q=Hoa+Phat+HPG+Dung+Quat+2+SSI+Research',
      time: '04/08/2026 15:30 (15 phút trước)',
      summary: 'Dự án Dung Quất 2 đạt tiến độ 92%, dự kiến cho ra sản phẩm thương mại vào Q3/2026 giúp HPG củng cố vị thế dẫn đầu ngành thép Đông Nam Á.',
      symbols: ['HPG'],
      sentiment: 'TÍCH CỰC',
      impactScore: 5,
    },
    {
      id: 'news-2',
      title: 'FPT trúng hợp đồng dịch vụ công nghệ thông tin trị giá 120 triệu USD tại thị trường Nhật Bản',
      source: 'Vietstock',
      url: 'https://www.google.com/search?q=FPT+trung+hop+dong+120+trieu+USD+Nhat+Ban',
      time: '04/08/2026 15:10 (35 phút trước)',
      summary: 'Mảng công nghệ thông tin thị trường nước ngoài của FPT tiếp tục bứt phá với chuỗi hợp đồng quy mô lớn về Chuyển đổi số và AI Enterprise.',
      symbols: ['FPT'],
      sentiment: 'TÍCH CỰC',
      impactScore: 5,
    },
    {
      id: 'news-3',
      title: 'Áp lực chốt lời gia tăng mạnh ở nhóm Bất động sản thương mại, DIG & NVL quay đầu giảm sàn',
      source: 'CafeF',
      url: 'https://www.google.com/search?q=Ap+luc+chot+loi+bat+dong+san+DIG+NVL',
      time: '04/08/2026 14:45 (1 giờ trước)',
      summary: 'Làn sóng bán tháo ngắn hạn bùng nổ khi áp lực đáo hạn trái phiếu doanh nghiệp quý III gia tăng, khiến dòng tiền đầu cơ rút lui mạnh khỏi mã DIG và NVL.',
      symbols: ['DIG', 'NVL', 'DXG'],
      sentiment: 'TIÊU CỰC',
      impactScore: 4,
    },
  ];

  return rawFallback.map((item) => enrichNewsItemWithDeepScoring(item));
}

// Macro Data
export function getMacroData(): MacroData {
  return {
    usdVnd: 25420,
    usdVndChange: -15,
    dxy: 103.45,
    dxyChange: -0.28,
    sbvInterestRate: 4.5,
    fedRate: 5.25,
    goldPriceVnd: 88.5,
    goldPriceChange: 0.4,
    brentOilPrice: 78.2,
    brentOilChange: 1.15,
    inflation: 3.52,
    gdpGrowth: 6.82,
  };
}

// Export memory database accessors
export function getAllStocks(): StockData[] {
  return Object.values(stockStore);
}

export function getStockBySymbol(symbol: string): StockData | undefined {
  return stockStore[symbol.toUpperCase()];
}

export async function getOrFetchStockBySymbol(symbol: string): Promise<StockData | undefined> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return undefined;

  if (stockStore[sym]) {
    return stockStore[sym];
  }

  try {
    const safeFetchJson = async (url: string) => {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return null;
        const text = await res.text();
        if (!text || !text.trim()) return null;
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    // 1. Fetch info from finfo
    const infoUrl = `https://api-finfo.vndirect.com.vn/v4/stocks?q=code:${sym}`;
    const infoJson = await safeFetchJson(infoUrl);
    let companyName = `Công ty Cổ phần ${sym}`;
    let exchange: MarketType = 'HOSE';
    let sector = 'Tổng hợp';

    if (infoJson && infoJson.data && infoJson.data.length > 0) {
      const info = infoJson.data[0];
      companyName = info.companyName || info.shortName || companyName;
      exchange = (info.floor as MarketType) || 'HOSE';
      if (info.industryName) sector = info.industryName;
    }

    // 2. Fetch current price
    const priceUrl = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${sym}&size=1`;
    const priceJson = await safeFetchJson(priceUrl);
    let priceItem: any = null;
    if (priceJson && priceJson.data && priceJson.data.length > 0) {
      priceItem = priceJson.data[0];
    }

    // 3. Fetch daily candles (3 years history)
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600 * 24 * 1095; // 1095 days (3 years)
    const dchartUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${sym}&from=${from}&to=${now}`;
    const cData = await safeFetchJson(dchartUrl);
    let candles: Candle[] = [];

    if (cData && cData.t && cData.t.length > 0) {
      const tempCandles = cData.t.map((ts: number, idx: number) => ({
        time: new Date(ts * 1000).toISOString().split('T')[0],
        open: cData.o[idx],
        high: cData.h[idx],
        low: cData.l[idx],
        close: cData.c[idx],
        volume: cData.v[idx],
      }));

      // Deduplicate by time and sort ascending
      const map = new Map<string, Candle>();
      tempCandles.forEach((c: Candle) => map.set(c.time, c));
      candles = Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
    }

    if (candles.length === 0) {
      const basePrice = priceItem ? priceItem.close : 15.0;
      candles = generateHistoricalCandles(basePrice);
    }

    candleStore[sym] = candles;

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;

    const price = priceItem ? priceItem.close : lastCandle.close;
    const referencePrice = priceItem ? priceItem.basicPrice : prevCandle.close;
    const ceilingPrice = priceItem ? priceItem.ceilingPrice : Number((referencePrice * 1.07).toFixed(2));
    const floorPrice = priceItem ? priceItem.floorPrice : Number((referencePrice * 0.93).toFixed(2));
    const change = priceItem ? priceItem.change : Number((price - referencePrice).toFixed(2));
    const changePercent = priceItem ? Number((priceItem.pctChange ?? 0).toFixed(2)) : Number(((change / referencePrice) * 100).toFixed(2));
    const volume = priceItem ? priceItem.nmVolume : lastCandle.volume;
    const value = priceItem ? Number(((priceItem.nmValue ?? 0) / 1000000000).toFixed(1)) : Number(((price * volume) / 10000000).toFixed(1));

    const technical = computeTechnicalIndicators(candles);

    const estCap = Math.round(price * 1500); // Tỷ VNĐ
    const fundamental: FundamentalData = {
      pe: Number((12 + Math.random() * 8).toFixed(1)),
      pb: Number((1.2 + Math.random() * 1.5).toFixed(2)),
      eps: Math.round(price * 1000 / 14),
      roe: Number((12 + Math.random() * 10).toFixed(1)),
      roa: Number((5 + Math.random() * 6).toFixed(1)),
      debtToEquity: Number((0.4 + Math.random() * 0.8).toFixed(2)),
      currentRatio: 1.5,
      quickRatio: 1.2,
      grossMargin: Number((18 + Math.random() * 20).toFixed(1)),
      operatingMargin: Number((10 + Math.random() * 12).toFixed(1)),
      netMargin: Number((8 + Math.random() * 10).toFixed(1)),
      bookValue: Math.round(price * 1000 / 1.8),
      dividendYield: Number((2 + Math.random() * 4).toFixed(1)),
      evEbitda: 9.5,
      peg: 1.1,
      revenueGrowthYoY: Number((10 + Math.random() * 20).toFixed(1)),
      profitGrowthYoY: Number((12 + Math.random() * 25).toFixed(1)),
      fcf: Math.round(estCap * 0.05),
      marketCap: estCap,
      sharesOutstanding: Math.round(estCap / price),
      industryAvgPE: 15.0,
      industryAvgPB: 1.7,
      industryAvgROE: 15.5,
    };

    const financialStatements = [
      { quarter: 'Q1/2026', revenue: Math.round(estCap * 0.08), operatingProfit: Math.round(estCap * 0.02), netProfit: Math.round(estCap * 0.015), totalAssets: Math.round(estCap * 1.8), totalLiabilities: Math.round(estCap * 0.8), equity: Math.round(estCap), operatingCashFlow: Math.round(estCap * 0.025), investingCashFlow: -Math.round(estCap * 0.01), financingCashFlow: -Math.round(estCap * 0.005) },
      { quarter: 'Q4/2025', revenue: Math.round(estCap * 0.078), operatingProfit: Math.round(estCap * 0.019), netProfit: Math.round(estCap * 0.014), totalAssets: Math.round(estCap * 1.75), totalLiabilities: Math.round(estCap * 0.78), equity: Math.round(estCap * 0.97), operatingCashFlow: Math.round(estCap * 0.022), investingCashFlow: -Math.round(estCap * 0.008), financingCashFlow: -Math.round(estCap * 0.004) },
      { quarter: 'Q3/2025', revenue: Math.round(estCap * 0.075), operatingProfit: Math.round(estCap * 0.018), netProfit: Math.round(estCap * 0.013), totalAssets: Math.round(estCap * 1.7), totalLiabilities: Math.round(estCap * 0.75), equity: Math.round(estCap * 0.95), operatingCashFlow: Math.round(estCap * 0.02), investingCashFlow: -Math.round(estCap * 0.007), financingCashFlow: -Math.round(estCap * 0.003) },
      { quarter: 'Q2/2025', revenue: Math.round(estCap * 0.072), operatingProfit: Math.round(estCap * 0.017), netProfit: Math.round(estCap * 0.012), totalAssets: Math.round(estCap * 1.65), totalLiabilities: Math.round(estCap * 0.72), equity: Math.round(estCap * 0.93), operatingCashFlow: Math.round(estCap * 0.018), investingCashFlow: -Math.round(estCap * 0.006), financingCashFlow: -Math.round(estCap * 0.002) },
    ];

    const verdict = changePercent > 2 ? 'MUA MẠNH' : changePercent > 0 ? 'MUA' : changePercent > -2 ? 'THEO DÕI' : 'BÁN';
    const aiTargetPrice = Number((price * 1.25).toFixed(2));
    const aiStopLoss = Number((price * 0.9).toFixed(2));

    const newStock: StockData = {
      symbol: sym,
      name: companyName,
      exchange,
      sector,
      price,
      change,
      changePercent,
      openPrice: priceItem ? priceItem.open : lastCandle.open,
      highPrice: priceItem ? priceItem.high : lastCandle.high,
      lowPrice: priceItem ? priceItem.low : lastCandle.low,
      referencePrice,
      ceilingPrice,
      floorPrice,
      volume,
      value,
      foreignBuyVol: Math.floor(volume * 0.12),
      foreignSellVol: Math.floor(volume * 0.08),
      foreignNetVal: Number(((volume * 0.04 * price) / 1000).toFixed(1)),
      technical,
      fundamental,
      financialStatements,
      aiScore: Math.min(95, Math.max(60, Math.round(75 + changePercent * 2))),
      aiVerdict: verdict,
      aiConfidence: 88,
      aiTargetPrice,
      aiStopLoss,
      aiReasoning: `Mã cổ phiếu ${sym} (${companyName}) giao dịch thực tế trên sàn ${exchange} với khối lượng ${volume.toLocaleString('vi-VN')} CP. Tín hiệu kỹ thuật RSI=${technical.rsi14}, hỗ trợ ${technical.supportLevel}, kháng cự ${technical.resistanceLevel}.`,
    };

    stockStore[sym] = newStock;
    return newStock;
  } catch (err) {
    console.error(`Error dynamically fetching stock ${sym}:`, err);
    return undefined;
  }
}

export function getCandlesForSymbol(symbol: string): Candle[] {
  return candleStore[symbol.toUpperCase()] || generateHistoricalCandles(30);
}

// REAL-TIME MARKET DATA SYNCHRONIZATION ENGINE
export async function syncRealMarketData() {
  try {
    const symbols = Object.keys(stockStore);
    if (symbols.length === 0) return;

    // 1. Fetch real-time stock prices from exchange API
    const priceUrl = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${symbols.join(',')}&size=100`;
    let quoteSuccess = false;
    try {
      const res = await fetch(priceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const json = await res.json();
        const rawList = json.data || [];
        const latestMap: Record<string, any> = {};
        rawList.forEach((item: any) => {
          if (!latestMap[item.code]) {
            latestMap[item.code] = item;
          }
        });

        if (Object.keys(latestMap).length > 0) {
          quoteSuccess = true;
          symbols.forEach((sym) => {
            const item = latestMap[sym];
            const stock = stockStore[sym];
            if (item && stock) {
              stock.price = item.close;
              stock.referencePrice = item.basicPrice;
              stock.ceilingPrice = item.ceilingPrice;
              stock.floorPrice = item.floorPrice;
              stock.openPrice = item.open;
              stock.highPrice = item.high;
              stock.lowPrice = item.low;
              stock.change = item.change;
              stock.changePercent = Number((item.pctChange ?? 0).toFixed(2));
              stock.volume = item.nmVolume;
              stock.value = Number(((item.nmValue ?? 0) / 1000000000).toFixed(1));

              // Synchronize latest candle with live quote
              if (candleStore[sym] && candleStore[sym].length > 0) {
                const lastC = candleStore[sym][candleStore[sym].length - 1];
                lastC.close = item.close;
                lastC.high = Math.max(lastC.high, item.high || item.close);
                lastC.low = Math.min(lastC.low, item.low || item.close);
                lastC.volume = item.nmVolume || lastC.volume;
              }
            }
          });
        }
      }
    } catch {}

    // Fallback: If VNDirect is blocked/fails on Render cloud host, sync latest price from DNSE
    if (!quoteSuccess) {
      const dnseNow = Math.floor(Date.now() / 1000);
      for (const sym of symbols) {
        try {
          const dnseUrl = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?symbol=${sym}&from=${dnseNow - 86400 * 10}&to=${dnseNow}&resolution=1D`;
          const dRes = await fetch(dnseUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (dRes.ok) {
            const dJson = await dRes.json();
            if (dJson && dJson.c && dJson.c.length > 0) {
              const len = dJson.c.length - 1;
              const close = dJson.c[len];
              const prevClose = len > 0 ? dJson.c[len - 1] : close;
              const change = Number((close - prevClose).toFixed(2));
              const pct = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
              const stock = stockStore[sym];
              if (stock) {
                stock.price = close;
                stock.referencePrice = prevClose;
                stock.change = change;
                stock.changePercent = pct;
                stock.volume = dJson.v?.[len] || stock.volume;
                stock.highPrice = dJson.h?.[len] || close;
                stock.lowPrice = dJson.l?.[len] || close;
                stock.openPrice = dJson.o?.[len] || close;
              }
            }
          }
        } catch {}
      }
    }

    // 2. Fetch candle histories for active stocks to keep technical indicators exact
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600 * 24 * 750; // 750 days of historical daily candles

    for (const sym of symbols) {
      try {
        let realCandles: Candle[] | null = null;

        // Provider 1: VNDirect Dchart
        try {
          const dchartUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${sym}&from=${from}&to=${now}`;
          const cRes = await fetch(dchartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData && cData.t && cData.t.length > 0) {
              realCandles = cData.t.map((ts: number, idx: number) => ({
                time: new Date(ts * 1000).toISOString().split('T')[0],
                open: cData.o[idx],
                high: cData.h[idx],
                low: cData.l[idx],
                close: cData.c[idx],
                volume: cData.v[idx],
              }));
            }
          }
        } catch {}

        // Provider 2 Fallback: DNSE Entrade Chart API (Reliable internationally on Render/AWS)
        if (!realCandles || realCandles.length === 0) {
          try {
            const dnseUrl = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?symbol=${sym}&from=${from}&to=${now}&resolution=1D`;
            const dnseRes = await fetch(dnseUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (dnseRes.ok) {
              const dData = await dnseRes.json();
              if (dData && dData.t && dData.t.length > 0) {
                realCandles = dData.t.map((ts: number, idx: number) => ({
                  time: new Date(ts * 1000).toISOString().split('T')[0],
                  open: dData.o[idx],
                  high: dData.h[idx],
                  low: dData.l[idx],
                  close: dData.c[idx],
                  volume: dData.v[idx],
                }));
              }
            }
          } catch {}
        }

        if (realCandles && realCandles.length > 0) {
          // Deduplicate and ensure last candle matches live stock price
          const map = new Map<string, Candle>();
          realCandles.forEach((c) => map.set(c.time, c));
          const sortedCandles = Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
          
          const stock = stockStore[sym];
          if (stock && sortedCandles.length > 0) {
            sortedCandles[sortedCandles.length - 1].close = stock.price;
          }
          
          candleStore[sym] = sortedCandles;
          if (stock) {
            stock.technical = computeTechnicalIndicators(sortedCandles);
            stock.smartMoney = analyzeSmartMoneySignal(stock);
          }
        }
      } catch (e) {}
    }

    // 3. Fetch Market Indices (VNINDEX, VN30, HNX, UPCOM)
    const idxMap: Record<string, string> = {
      VNINDEX: 'VNINDEX',
      VN30: 'VN30',
      HNXINDEX: 'HNX',
      UPCOM: 'UPCOM',
    };

    for (const [key, dchartSymbol] of Object.entries(idxMap)) {
      try {
        let matched = false;
        try {
          const iUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${dchartSymbol}&from=${from}&to=${now}`;
          const iRes = await fetch(iUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (iRes.ok) {
            const iData = await iRes.json();
            if (iData && iData.t && iData.t.length > 0) {
              const len = iData.t.length - 1;
              const prev = len > 0 ? len - 1 : len;
              const currentPrice = iData.c[len];
              const prevPrice = iData.c[prev];
              const change = Number((currentPrice - prevPrice).toFixed(2));
              const changePercent = Number(((change / prevPrice) * 100).toFixed(2));

              const targetIdx = liveIndices.find((i) => i.symbol === key);
              if (targetIdx) {
                targetIdx.price = currentPrice;
                targetIdx.change = change;
                targetIdx.changePercent = changePercent;
                targetIdx.totalVolume = iData.v[len];
                matched = true;
              }
            }
          }
        } catch {}

        if (!matched) {
          try {
            const dnseIdxUrl = `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?symbol=${dchartSymbol}&from=${now - 86400 * 10}&to=${now}&resolution=1D`;
            const dnseRes = await fetch(dnseIdxUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (dnseRes.ok) {
              const dData = await dnseRes.json();
              if (dData && dData.t && dData.t.length > 0) {
                const len = dData.t.length - 1;
                const prev = len > 0 ? len - 1 : len;
                const currentPrice = dData.c[len];
                const prevPrice = dData.c[prev];
                const change = Number((currentPrice - prevPrice).toFixed(2));
                const changePercent = Number(((change / prevPrice) * 100).toFixed(2));

                const targetIdx = liveIndices.find((i) => i.symbol === key);
                if (targetIdx) {
                  targetIdx.price = currentPrice;
                  targetIdx.change = change;
                  targetIdx.changePercent = changePercent;
                  targetIdx.totalVolume = dData.v[len];
                }
              }
            }
          } catch {}
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error('Real market sync error:', err);
  }
}

// Initial Sync and recurring 15s refresh
syncRealMarketData();
setInterval(() => {
  syncRealMarketData();
}, 15 * 1000);

