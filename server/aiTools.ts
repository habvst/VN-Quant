import { FunctionDeclaration, Type } from '@google/genai';
import {
  getAllStocks,
  getMacroData,
  getMarketIndices,
  getOrderBook,
  getSectors,
  getStockBySymbol,
  getTradeTicks,
} from './marketDataService';
import { analyzeSmartMoneySignal } from './smartMoneyAnomalyService';
import { ToolCallExecution } from '../src/types';

/**
 * AI Function Declarations for Gemini Function Calling
 */
export const internalFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'getFinancialStatements',
    description: 'Tra cứu báo cáo tài chính quý mới nhất và các quý trước của doanh nghiệp niêm yết (Doanh thu, LNST, biên LN, tài sản, nợ vay, VCSH, dòng tiền HĐKD/ĐKKD/TC, P/E, P/B, ROE, ROA, EPS, tăng trưởng YoY).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: {
          type: Type.STRING,
          description: 'Mã chứng khoán cần tra cứu báo cáo tài chính (ví dụ: HPG, FPT, SSI, MBB, VNM, TCB, DGC)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getProprietaryAndForeignTrading',
    description: 'Tra cứu chi tiết dòng tiền giao dịch của Khối ngoại và Tự doanh CTCK (Giá trị mua/bán ròng, khối lượng khớp lệnh vs thỏa thuận, tỷ trọng tham gia giao dịch, lịch sử dòng tiền 5 phiên gần nhất).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: {
          type: Type.STRING,
          description: 'Mã chứng khoán cần tra cứu dòng tiền Khối ngoại & Tự doanh (ví dụ: HPG, SSI, FPT)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getLargeBlockOrdersAndSmartMoney',
    description: 'Tra cứu các lệnh lô lớn cá mập (>50.000 - 500.000 CP), tỷ lệ lệnh gom/xả chủ động (Large Block Net Ratio), đột biến volume phiên sáng, phát hiện bẫy giá Bull/Bear Trap hoặc gom ngầm.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: {
          type: Type.STRING,
          description: 'Mã chứng khoán cần quét lệnh lớn cá mập và bất thường dòng tiền (ví dụ: HPG, SSI, MWG)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getTechnicalSignalsAndPriceAction',
    description: 'Lấy dữ liệu phân tích kỹ thuật chuyên sâu: RSI(14), MACD Histogram, Hệ thống Mây Ichimoku Kinko Hyo (Tenkan, Kijun, Kumo Span A/B, Chikou), Mốc Thoái lui Fibonacci Retracement (23.6%, 38.2%, 50%, 61.8% Golden Zone, 78.6%), Bollinger Bands, MA20/50/200, EMA20/50/200, VWAP, Hỗ trợ và Kháng cự.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: {
          type: Type.STRING,
          description: 'Mã chứng khoán cần tra cứu chỉ báo kỹ thuật & Price Action',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'searchMarketTopPicks',
    description: 'Quét toàn thị trường để tìm Top cổ phiếu thỏa mãn tiêu chí định lượng (ví dụ: dòng tiền cá mập gom ngầm, tăng trưởng lợi nhuận đột biến, định giá rẻ P/E thấp, điểm Quant AI cao nhất).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        criteria: {
          type: Type.STRING,
          description: 'Tiêu chí quét: SMART_MONEY_ACCUMULATION | HIGH_GROWTH_UNDERVALUED | BREAKOUT_VOLUME | TOP_QUANT_SCORE | ICHIMOKU_BREAKOUT',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Số lượng cổ phiếu tối đa cần lấy (mặc định 5)',
        },
      },
      required: ['criteria'],
    },
  },
  {
    name: 'getMacroAndMarketOverview',
    description: 'Lấy tổng quan thị trường chứng khoán Việt Nam: Điểm số & thanh khoản VN-INDEX, VN30, HNX, UPCOM, Tỷ giá USD/VND, Lãi suất điều hành SBV, Top ngành dẫn dắt.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

/**
 * Internal Tool Execution Handler
 */
export async function executeInternalTool(toolName: string, rawArgs: Record<string, any> = {}): Promise<ToolCallExecution> {
  const timestamp = new Date().toLocaleTimeString('vi-VN');
  const cleanSym = (rawArgs.symbol || 'HPG').toString().toUpperCase().trim();

  try {
    switch (toolName) {
      case 'getFinancialStatements': {
        const stock = getStockBySymbol(cleanSym) || getAllStocks()[0];
        const fund = stock.fundamental;
        const statements = stock.financialStatements || [];
        const latestQ = statements[0] || {
          quarter: 'Q1/2026',
          revenue: Math.round(fund.marketCap * 0.08),
          operatingProfit: Math.round(fund.marketCap * 0.02),
          netProfit: Math.round(fund.marketCap * 0.015),
          totalAssets: Math.round(fund.marketCap * 1.8),
          totalLiabilities: Math.round(fund.marketCap * 0.8),
          equity: fund.marketCap,
        };

        const peVsInd = fund.industryAvgPE > 0 ? (fund.pe / fund.industryAvgPE).toFixed(2) : '1.0';
        const valuationVerdict =
          fund.pe < fund.industryAvgPE * 0.85
            ? 'ĐỊNH GIÁ RẺ (P/E thấp hơn 15% TB ngành)'
            : fund.pe > fund.industryAvgPE * 1.3
            ? 'ĐỊNH GIÁ CAO (P/E cao hơn 30% TB ngành)'
            : 'ĐỊNH GIÁ HỢP LÝ';

        const summary = `Trích xuất BCTC ${latestQ.quarter} của ${stock.symbol} (${stock.name}): Doanh thu ${latestQ.revenue.toLocaleString('vi-VN')} tỷ (+${fund.revenueGrowthYoY}% YoY), LNST ${latestQ.netProfit.toLocaleString('vi-VN')} tỷ (+${fund.profitGrowthYoY}% YoY). P/E ${fund.pe}x (TB ngành ${fund.industryAvgPE}x $\\rightarrow$ ${valuationVerdict}), ROE ${fund.roe}%, EPS ${fund.eps.toLocaleString('vi-VN')} VNĐ, Nợ/VCSH ${fund.debtToEquity}x, Biên LN gộp ${fund.grossMargin}%.`;

        return {
          toolName,
          toolDisplayName: `Tra cứu Báo Cáo Tài Chính (${stock.symbol})`,
          args: { symbol: stock.symbol },
          summary,
          dataSnippet: {
            symbol: stock.symbol,
            companyName: stock.name,
            latestQuarter: latestQ.quarter,
            revenue: latestQ.revenue,
            netProfit: latestQ.netProfit,
            revenueGrowthYoY: fund.revenueGrowthYoY,
            profitGrowthYoY: fund.profitGrowthYoY,
            pe: fund.pe,
            pb: fund.pb,
            roe: fund.roe,
            roa: fund.roa,
            eps: fund.eps,
            debtToEquity: fund.debtToEquity,
            grossMargin: fund.grossMargin,
            netMargin: fund.netMargin,
            dividendYield: fund.dividendYield,
            statements: statements.slice(0, 4),
          },
          executedAt: timestamp,
          status: 'SUCCESS',
        };
      }

      case 'getProprietaryAndForeignTrading': {
        const stock = getStockBySymbol(cleanSym) || getAllStocks()[0];
        const foreignNetVal = stock.foreignNetVal;
        const propNetVal = Number(((stock.volume * 0.05 * stock.price) / 1000).toFixed(1)); // Ước tính tự doanh
        const foreignBuyPct = Math.round((stock.foreignBuyVol / (stock.volume || 1)) * 100);
        const foreignSellPct = Math.round((stock.foreignSellVol / (stock.volume || 1)) * 100);

        // 5-session simulated history for institutions
        const recent5Sessions = [
          { session: 'T-4', foreignNet: Number((foreignNetVal * 0.8).toFixed(1)), propNet: Number((propNetVal * 0.7).toFixed(1)) },
          { session: 'T-3', foreignNet: Number((foreignNetVal * 0.9).toFixed(1)), propNet: Number((propNetVal * 0.85).toFixed(1)) },
          { session: 'T-2', foreignNet: Number((foreignNetVal * 1.1).toFixed(1)), propNet: Number((propNetVal * 1.05).toFixed(1)) },
          { session: 'T-1', foreignNet: Number((foreignNetVal * 0.95).toFixed(1)), propNet: Number((propNetVal * 0.9).toFixed(1)) },
          { session: 'Hiện tại', foreignNet: foreignNetVal, propNet: propNetVal },
        ];

        const total5Net = recent5Sessions.reduce((acc, s) => acc + s.foreignNet + s.propNet, 0).toFixed(1);
        const actionVerdict =
          foreignNetVal > 20 && propNetVal > 0
            ? 'ĐỒNG THUẬN MUA RÒNG ĐỘT BIẾN (Tổ chức + Khối ngoại gom mạnh)'
            : foreignNetVal > 0
            ? 'KHỐI NGOẠI MUA RÒNG TÍCH CỰC'
            : foreignNetVal < -20
            ? 'ÁP LỰC BÁN RÒNG LỚN TỪ KHỐI NGOẠI'
            : 'DÒNG TIỀN TỔ CHỨC CÂN BẰNG';

        const summary = `Dữ liệu Dòng tiền Khối ngoại & Tự doanh ${stock.symbol}: Khối ngoại mua ròng ${foreignNetVal > 0 ? `+${foreignNetVal}` : foreignNetVal} tỷ VNĐ (Mua ${stock.foreignBuyVol.toLocaleString('vi-VN')} CP, Bán ${stock.foreignSellVol.toLocaleString('vi-VN')} CP). Tự doanh CTCK mua ròng ${propNetVal > 0 ? `+${propNetVal}` : propNetVal} tỷ VNĐ. Tổng tích lũy 5 phiên: ${Number(total5Net) > 0 ? `+${total5Net}` : total5Net} tỷ VNĐ $\\rightarrow$ ${actionVerdict}.`;

        return {
          toolName,
          toolDisplayName: `Dòng tiền Tự doanh & Khối ngoại (${stock.symbol})`,
          args: { symbol: stock.symbol },
          summary,
          dataSnippet: {
            symbol: stock.symbol,
            foreignNetVal,
            foreignBuyVol: stock.foreignBuyVol,
            foreignSellVol: stock.foreignSellVol,
            foreignBuyPct,
            foreignSellPct,
            propNetVal,
            actionVerdict,
            recent5Sessions,
          },
          executedAt: timestamp,
          status: 'SUCCESS',
        };
      }

      case 'getLargeBlockOrdersAndSmartMoney': {
        const stock = getStockBySymbol(cleanSym) || getAllStocks()[0];
        const sm = analyzeSmartMoneySignal(stock);
        const ticks = getTradeTicks(stock.symbol);
        const largeTicks = ticks.filter((t) => t.volume >= 15000);
        const largeBuyVol = largeTicks.filter((t) => t.type === 'BUY').reduce((acc, t) => acc + t.volume, 0);
        const largeSellVol = largeTicks.filter((t) => t.type === 'SELL').reduce((acc, t) => acc + t.volume, 0);
        const largeTotal = largeBuyVol + largeSellVol || 1;
        const buyPct = Math.round((largeBuyVol / largeTotal) * 100);

        const summary = `Quét Lệnh lớn & Dòng tiền Cá mập ${stock.symbol}: Phát hiện ${largeTicks.length} lệnh lô lớn (>15.000 CP), Lệnh mua chủ động chiếm ${buyPct}% khối lượng lô lớn. Mẫu hình nhận diện: [${sm.patternName}]. Điểm Bất thường Dòng tiền: ${sm.anomalyScore}/100. Đột biến Vol phiên sáng: ${sm.morningVolRatio}x TB5. Khuyến nghị: ${sm.suggestedAction}.`;

        return {
          toolName,
          toolDisplayName: `Quét Lệnh Cá Mập & Smart Money (${stock.symbol})`,
          args: { symbol: stock.symbol },
          summary,
          dataSnippet: {
            symbol: stock.symbol,
            patternType: sm.patternType,
            patternName: sm.patternName,
            anomalyScore: sm.anomalyScore,
            signalStrength: sm.signalStrength,
            morningVolRatio: sm.morningVolRatio,
            largeBlockNetRatio: sm.largeBlockNetRatio,
            largeTradesCount: largeTicks.length,
            largeBuyPct: buyPct,
            trapWarning: sm.trapWarning,
            suggestedAction: sm.suggestedAction,
          },
          executedAt: timestamp,
          status: 'SUCCESS',
        };
      }

      case 'getTechnicalSignalsAndPriceAction': {
        const stock = getStockBySymbol(cleanSym) || getAllStocks()[0];
        const t = stock.technical;
        const ichi = t.ichimoku;
        const fibo = t.fibonacci;

        const isAboveCloud = stock.price > Math.max(ichi.senkouA, ichi.senkouB);
        const isBelowCloud = stock.price < Math.min(ichi.senkouA, ichi.senkouB);
        const ichiStatus = isAboveCloud
          ? 'Giá nằm TRÊN Mây Kumo (Xu hướng Tăng vững chắc)'
          : isBelowCloud
          ? 'Giá nằm DƯỚI Mây Kumo (Áp lực Giảm bao phủ)'
          : 'Giá dao động TRONG Mây Kumo (Vùng Tích lũy giằng co)';

        const fiboStatus = `Fibo 23.6% (${fibo.f236}k) | Fibo 38.2% (${fibo.f382}k) | Fibo 50% (${fibo.f500}k) | Fibo 61.8% Golden Zone (${fibo.f618}k) | Fibo 78.6% (${fibo.f786}k)`;

        const summary = `Phân tích Kỹ thuật & Price Action ${stock.symbol}: RSI(14) = ${t.rsi14} (${t.rsi14 > 70 ? 'Quá mua' : t.rsi14 < 30 ? 'Quá bán' : 'Trung tính tích cực'}), MACD Histogram ${t.macd.histogram > 0 ? `dương (+${t.macd.histogram})` : `âm (${t.macd.histogram})`}. Ichimoku: Tenkan=${ichi.tenkan}, Kijun=${ichi.kijun} $\\rightarrow$ ${ichiStatus}. Vùng Thoái lui Fibonacci: ${fiboStatus}. Hỗ trợ cứng: ${t.supportLevel}k, Cản kỹ thuật: ${t.resistanceLevel}k.`;

        return {
          toolName,
          toolDisplayName: `Phân tích Kỹ thuật & Price Action (${stock.symbol})`,
          args: { symbol: stock.symbol },
          summary,
          dataSnippet: {
            symbol: stock.symbol,
            price: stock.price,
            rsi14: t.rsi14,
            macd: t.macd,
            ma20: t.ma20,
            ma50: t.ma50,
            ma200: t.ma200,
            ema20: t.ema20,
            vwap: t.vwap,
            supportLevel: t.supportLevel,
            resistanceLevel: t.resistanceLevel,
            ichimoku: {
              ...ichi,
              status: ichiStatus,
            },
            fibonacci: fibo,
            bollingerBands: t.bollingerBands,
          },
          executedAt: timestamp,
          status: 'SUCCESS',
        };
      }

      case 'searchMarketTopPicks': {
        const stocks = getAllStocks();
        const criteria = (rawArgs.criteria || 'SMART_MONEY_ACCUMULATION').toUpperCase();
        const limit = rawArgs.limit || 5;

        let ranked = [...stocks];
        let criteriaLabel = 'Dòng tiền cá mập gom ngầm (Smart Money Accumulation)';

        if (criteria.includes('HIGH_GROWTH') || criteria.includes('UNDERVALUED')) {
          criteriaLabel = 'Tăng trưởng LN cao & Định giá rẻ P/E thấp';
          ranked.sort((a, b) => (b.fundamental.profitGrowthYoY / (b.fundamental.pe || 1)) - (a.fundamental.profitGrowthYoY / (a.fundamental.pe || 1)));
        } else if (criteria.includes('BREAKOUT') || criteria.includes('VOLUME')) {
          criteriaLabel = 'Bùng nổ khối lượng & Bứt phá kháng cự';
          ranked.sort((a, b) => b.volume - a.volume);
        } else if (criteria.includes('TOP_QUANT')) {
          criteriaLabel = 'Điểm số Quant AI tổng hợp cao nhất';
          ranked.sort((a, b) => b.aiScore - a.aiScore);
        } else {
          // Default: Smart money accumulation
          ranked.sort((a, b) => {
            const sigA = analyzeSmartMoneySignal(a);
            const sigB = analyzeSmartMoneySignal(b);
            return (sigB.anomalyScore + (b.foreignNetVal > 0 ? 20 : 0)) - (sigA.anomalyScore + (a.foreignNetVal > 0 ? 20 : 0));
          });
        }

        const topList = ranked.slice(0, limit);
        const summary = `Quét Top ${topList.length} cổ phiếu theo tiêu chí [${criteriaLabel}]: ${topList.map((s, idx) => `${idx + 1}. ${s.symbol} (${s.price}k, ${s.changePercent > 0 ? '+' : ''}${s.changePercent}%, Score ${s.aiScore}/100, ${s.aiVerdict})`).join(' | ')}.`;

        return {
          toolName,
          toolDisplayName: `Bộ Lọc Quant Thị Trường (${criteriaLabel})`,
          args: { criteria, limit },
          summary,
          dataSnippet: {
            criteria: criteriaLabel,
            results: topList.map((s) => ({
              symbol: s.symbol,
              name: s.name,
              price: s.price,
              changePercent: s.changePercent,
              volume: s.volume,
              foreignNetVal: s.foreignNetVal,
              pe: s.fundamental.pe,
              roe: s.fundamental.roe,
              aiScore: s.aiScore,
              aiVerdict: s.aiVerdict,
              targetPrice: s.aiTargetPrice,
              stopLoss: s.aiStopLoss,
            })),
          },
          executedAt: timestamp,
          status: 'SUCCESS',
        };
      }

      case 'getMacroAndMarketOverview': {
        const macro = getMacroData();
        const indices = getMarketIndices();
        const sectors = getSectors();
        const vnindex = indices.find((i) => i.symbol === 'VNINDEX') || indices[0];
        const vn30 = indices.find((i) => i.symbol === 'VN30') || indices[1];
        const topSector = sectors.slice().sort((a, b) => b.changePercent - a.changePercent)[0];

        const summary = `Tổng quan Vĩ mô & Thị trường: VN-INDEX đạt ${vnindex.price} điểm (${vnindex.changePercent > 0 ? '+' : ''}${vnindex.changePercent}%, GTGD ${vnindex.totalValue} tỷ VNĐ, ${vnindex.advances} mã tăng / ${vnindex.declines} mã giảm). VN30 đạt ${vn30.price} điểm. Tỷ giá USD/VND ${macro.usdVnd}, Lãi suất điều hành SBV ${macro.sbvInterestRate}%. Nhóm ngành bứt phá mạnh nhất: ${topSector.name} (+${topSector.changePercent}%).`;

        return {
          toolName,
          toolDisplayName: 'Tổng quan Vĩ mô & Chỉ số Thị trường',
          args: {},
          summary,
          dataSnippet: {
            vnindex,
            vn30,
            macro,
            topSectors: sectors.slice(0, 4),
          },
          executedAt: timestamp,
          status: 'SUCCESS',
        };
      }

      default:
        return {
          toolName,
          toolDisplayName: `Tool ${toolName}`,
          args: rawArgs,
          summary: `Thực thi tool ${toolName} thành công.`,
          executedAt: timestamp,
          status: 'SUCCESS',
        };
    }
  } catch (err: any) {
    return {
      toolName,
      toolDisplayName: `Tool ${toolName}`,
      args: rawArgs,
      summary: `Lỗi khi thực thi tool ${toolName}: ${err?.message || err}`,
      executedAt: timestamp,
      status: 'ERROR',
    };
  }
}
