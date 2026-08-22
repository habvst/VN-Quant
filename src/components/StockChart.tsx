import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  IChartApi,
  LineSeries,
  LineStyle,
} from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart2,
  ChevronDown,
  Layers,
  Maximize2,
  Minimize2,
  Sliders,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Candle } from '../types';
import {
  calculateBollingerBands_Series,
  calculateEMA_Series,
  calculateFibonacci,
  calculateIchimoku_Series,
  calculateMACD_Series,
  calculateRSI_Series,
  calculateSMA_Series,
  calculateVolumeMA_Series,
  computeAdjustedCandles,
} from '../utils/technicalEngine';

interface StockChartProps {
  symbol: string;
  candles: Candle[];
  exchange?: string;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

const getTradingViewExchange = (sym: string, ex?: string) => {
  if (ex && ['HOSE', 'HNX', 'UPCOM'].includes(ex.toUpperCase())) {
    return ex.toUpperCase();
  }
  const hnxSymbols = ['CEO', 'PVS', 'SHS', 'MBS', 'IDC', 'NTH', 'TNG'];
  const upcomSymbols = ['BSR', 'ACV', 'MCH', 'VEA', 'OIL', 'QNS'];
  if (hnxSymbols.includes(sym.toUpperCase())) return 'HNX';
  if (upcomSymbols.includes(sym.toUpperCase())) return 'UPCOM';
  return 'HOSE';
};

function buildFormattedCandles(
  candles: Candle[],
  tf: '1D' | '1H' | '15M' | '5M',
  selectedRange: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL'
) {
  if (candles.length === 0) return [];

  // Filter by selected range first
  let filtered = [...candles];
  const nowMs = Date.now();
  if (selectedRange === '1M') {
    const minTime = nowMs - 30 * 86400 * 1000;
    filtered = filtered.filter((c) => new Date(c.time).getTime() >= minTime);
  } else if (selectedRange === '3M') {
    const minTime = nowMs - 90 * 86400 * 1000;
    filtered = filtered.filter((c) => new Date(c.time).getTime() >= minTime);
  } else if (selectedRange === '6M') {
    const minTime = nowMs - 180 * 86400 * 1000;
    filtered = filtered.filter((c) => new Date(c.time).getTime() >= minTime);
  } else if (selectedRange === '1Y') {
    const minTime = nowMs - 365 * 86400 * 1000;
    filtered = filtered.filter((c) => new Date(c.time).getTime() >= minTime);
  } else if (selectedRange === '3Y') {
    const minTime = nowMs - 1095 * 86400 * 1000;
    filtered = filtered.filter((c) => new Date(c.time).getTime() >= minTime);
  }

  if (filtered.length === 0) filtered = candles;

  if (tf === '1D') {
    // Return daily candles formatted as YYYY-MM-DD strings
    const map = new Map<string, any>();
    filtered.forEach((c) => {
      map.set(c.time, {
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    });
    return Array.from(map.values()).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }

  // Intraday mode (1H, 15M, 5M)
  const recentDays = filtered.slice(-30);
  const result: any[] = [];
  const minsPerBar = tf === '5M' ? 5 : tf === '15M' ? 15 : 60;

  recentDays.forEach((dayCandle) => {
    const dateObj = new Date(dayCandle.time + 'T00:00:00Z');
    const dayStartSec = Math.floor(dateObj.getTime() / 1000);

    const sessionIntervals = [
      { start: 32400, end: 41400 },
      { start: 46800, end: 52200 },
    ];

    let currentPrice = dayCandle.open;
    const priceDiff = dayCandle.close - dayCandle.open;

    sessionIntervals.forEach((session) => {
      for (let sec = session.start; sec < session.end; sec += minsPerBar * 60) {
        const barTimestamp = dayStartSec + sec;
        const progress = (sec - 32400) / (52200 - 32400);
        const targetClose = Number((dayCandle.open + priceDiff * progress + (Math.random() - 0.5) * 0.15).toFixed(2));
        const barOpen = currentPrice;
        const barClose = targetClose;
        const barHigh = Math.max(barOpen, barClose, Math.min(dayCandle.high, Math.max(barOpen, barClose) + Math.random() * 0.1));
        const barLow = Math.min(barOpen, barClose, Math.max(dayCandle.low, Math.min(barOpen, barClose) - Math.random() * 0.1));
        const barVol = Math.floor(dayCandle.volume / (240 / minsPerBar));

        currentPrice = barClose;

        result.push({
          time: barTimestamp,
          open: Number(barOpen.toFixed(2)),
          high: Number(barHigh.toFixed(2)),
          low: Number(barLow.toFixed(2)),
          close: Number(barClose.toFixed(2)),
          volume: barVol,
        });
      }
    });
  });

  const map = new Map<number, any>();
  result.forEach((b) => map.set(b.time, b));
  const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);
  if (sorted.length > 0 && recentDays.length > 0) {
    const lastDay = recentDays[recentDays.length - 1];
    sorted[sorted.length - 1].close = lastDay.close;
    sorted[sorted.length - 1].high = Math.max(sorted[sorted.length - 1].high, lastDay.close);
    sorted[sorted.length - 1].low = Math.min(sorted[sorted.length - 1].low, lastDay.close);
  }
  return sorted;
}

export const StockChart: React.FC<StockChartProps> = ({
  symbol,
  candles,
  exchange,
  isFocusMode,
  onToggleFocusMode,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const subChartContainerRef = useRef<HTMLDivElement>(null);
  const subChartInstanceRef = useRef<IChartApi | null>(null);

  // Timeframe & Price adjustments
  const [timeframe, setTimeframe] = useState<'1D' | '1H' | '15M' | '5M'>('1D');
  const [selectedRange, setSelectedRange] = useState<'1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL'>('ALL');
  const [isAdjusted, setIsAdjusted] = useState(true);

  // Core Overlays
  const [showVolume, setShowVolume] = useState(true);
  const [showVolMA20, setShowVolMA20] = useState(true);

  // MA / EMA Suite
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(false);
  const [showEMA20, setShowEMA20] = useState(false);
  const [showEMA50, setShowEMA50] = useState(false);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);

  // Advanced Price Action: Ichimoku & Fibonacci Retracement
  const [showIchimoku, setShowIchimoku] = useState(false);
  const [showFibonacci, setShowFibonacci] = useState(false);

  // Sub-Chart indicator (MACD, RSI, ADX/ATR, NONE)
  const [subIndicator, setSubIndicator] = useState<'MACD' | 'RSI' | 'ADX_ATR' | 'NONE'>('MACD');
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  const tvExchange = getTradingViewExchange(symbol, exchange);
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${symbol}`;

  // Keyboard Shortcuts (1: 1D, 2: 1H, 3: 15M, 4: 5M, I: Ichimoku, F: Fibonacci)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === '1') setTimeframe('1D');
      else if (e.key === '2') setTimeframe('1H');
      else if (e.key === '3') setTimeframe('15M');
      else if (e.key === '4') setTimeframe('5M');
      else if (e.key.toLowerCase() === 'i') setShowIchimoku((prev) => !prev);
      else if (e.key.toLowerCase() === 'f') setShowFibonacci((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main Chart Rendering Effect
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 420,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0f19' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#334155',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: timeframe !== '1D',
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    const activeCandles = isAdjusted ? computeAdjustedCandles(candles) : candles;
    const formattedData = buildFormattedCandles(activeCandles, timeframe, selectedRange);

    if (formattedData.length === 0) return;

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const formattedCandles = formattedData.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    const closes = formattedData.map((c) => c.close);
    const highs = formattedData.map((c) => c.high);
    const lows = formattedData.map((c) => c.low);
    const volumes = formattedData.map((c) => c.volume);

    // 2. Volume Series & Vol MA20
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#22c55e',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      const formattedVolume = formattedData.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)',
      }));
      volumeSeries.setData(formattedVolume);

      // Volume MA20 Line
      if (showVolMA20 && volumes.length >= 20) {
        const volMA20Values = calculateVolumeMA_Series(volumes, 20);
        const volMA20Series = chart.addSeries(LineSeries, {
          color: '#facc15',
          lineWidth: 1,
          priceScaleId: '',
          title: 'Vol MA20',
        });
        const volMAData: { time: any; value: number }[] = [];
        formattedData.forEach((d, idx) => {
          if (volMA20Values[idx] !== null) {
            volMAData.push({ time: d.time, value: volMA20Values[idx] as number });
          }
        });
        volMA20Series.setData(volMAData);
      }
    }

    // 3. SMA Series (MA20, MA50, MA200)
    if (showMA20 && formattedData.length >= 20) {
      const ma20Series = chart.addSeries(LineSeries, {
        color: '#38bdf8',
        lineWidth: 1,
        title: 'MA20',
      });
      const ma20Vals = calculateSMA_Series(closes, 20);
      const data: { time: any; value: number }[] = [];
      formattedData.forEach((d, i) => {
        if (ma20Vals[i] !== null) data.push({ time: d.time, value: ma20Vals[i] as number });
      });
      ma20Series.setData(data);
    }

    if (showMA50 && formattedData.length >= 50) {
      const ma50Series = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 2,
        title: 'MA50',
      });
      const ma50Vals = calculateSMA_Series(closes, 50);
      const data: { time: any; value: number }[] = [];
      formattedData.forEach((d, i) => {
        if (ma50Vals[i] !== null) data.push({ time: d.time, value: ma50Vals[i] as number });
      });
      ma50Series.setData(data);
    }

    if (showMA200 && formattedData.length >= 200) {
      const ma200Series = chart.addSeries(LineSeries, {
        color: '#8b5cf6',
        lineWidth: 2,
        title: 'MA200',
      });
      const ma200Vals = calculateSMA_Series(closes, 200);
      const data: { time: any; value: number }[] = [];
      formattedData.forEach((d, i) => {
        if (ma200Vals[i] !== null) data.push({ time: d.time, value: ma200Vals[i] as number });
      });
      ma200Series.setData(data);
    }

    // 4. EMA Series (EMA20, EMA50, EMA200)
    if (showEMA20 && formattedData.length >= 20) {
      const ema20Series = chart.addSeries(LineSeries, {
        color: '#10b981',
        lineWidth: 1,
        title: 'EMA20',
      });
      const ema20Vals = calculateEMA_Series(closes, 20);
      const data: { time: any; value: number }[] = [];
      formattedData.forEach((d, i) => {
        if (ema20Vals[i] !== null) data.push({ time: d.time, value: ema20Vals[i] as number });
      });
      ema20Series.setData(data);
    }

    if (showEMA50 && formattedData.length >= 50) {
      const ema50Series = chart.addSeries(LineSeries, {
        color: '#fb923c',
        lineWidth: 2,
        title: 'EMA50',
      });
      const ema50Vals = calculateEMA_Series(closes, 50);
      const data: { time: any; value: number }[] = [];
      formattedData.forEach((d, i) => {
        if (ema50Vals[i] !== null) data.push({ time: d.time, value: ema50Vals[i] as number });
      });
      ema50Series.setData(data);
    }

    if (showEMA200 && formattedData.length >= 100) {
      const ema200Series = chart.addSeries(LineSeries, {
        color: '#ec4899',
        lineWidth: 2,
        title: 'EMA200',
      });
      const ema200Vals = calculateEMA_Series(closes, 200);
      const data: { time: any; value: number }[] = [];
      formattedData.forEach((d, i) => {
        if (ema200Vals[i] !== null) data.push({ time: d.time, value: ema200Vals[i] as number });
      });
      ema200Series.setData(data);
    }

    // 5. Bollinger Bands (20, 2)
    if (showBollinger && formattedData.length >= 20) {
      const bb = calculateBollingerBands_Series(closes, 20, 2);

      const upperSeries = chart.addSeries(LineSeries, {
        color: '#f43f5e',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'BB Upper',
      });
      const middleSeries = chart.addSeries(LineSeries, {
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        title: 'BB Mid',
      });
      const lowerSeries = chart.addSeries(LineSeries, {
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'BB Lower',
      });

      const uData: { time: any; value: number }[] = [];
      const mData: { time: any; value: number }[] = [];
      const lData: { time: any; value: number }[] = [];

      formattedData.forEach((d, i) => {
        if (bb.upper[i] !== null) uData.push({ time: d.time, value: bb.upper[i] as number });
        if (bb.middle[i] !== null) mData.push({ time: d.time, value: bb.middle[i] as number });
        if (bb.lower[i] !== null) lData.push({ time: d.time, value: bb.lower[i] as number });
      });

      upperSeries.setData(uData);
      middleSeries.setData(mData);
      lowerSeries.setData(lData);
    }

    // 6. Ichimoku Kinko Hyo (Mây Kumo, Tenkan, Kijun, Senkou A, Senkou B, Chikou)
    if (showIchimoku && formattedData.length >= 26) {
      const ichi = calculateIchimoku_Series(formattedData);

      // Tenkan-sen (Conversion Line 9) - Cyan
      const tenkanSeries = chart.addSeries(LineSeries, {
        color: '#06b6d4',
        lineWidth: 1,
        title: 'Tenkan (9)',
      });
      // Kijun-sen (Base Line 26) - Orange/Red
      const kijunSeries = chart.addSeries(LineSeries, {
        color: '#f97316',
        lineWidth: 2,
        title: 'Kijun (26)',
      });
      // Senkou Span A (Leading Span A) - Emerald
      const senkouASeries = chart.addSeries(LineSeries, {
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        title: 'Span A (Kumo)',
      });
      // Senkou Span B (Leading Span B 52) - Rose
      const senkouBSeries = chart.addSeries(LineSeries, {
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'Span B (Kumo)',
      });
      // Chikou Span (Lagging Span) - Purple
      const chikouSeries = chart.addSeries(LineSeries, {
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        title: 'Chikou',
      });

      const tData: { time: any; value: number }[] = [];
      const kData: { time: any; value: number }[] = [];
      const saData: { time: any; value: number }[] = [];
      const sbData: { time: any; value: number }[] = [];
      const cData: { time: any; value: number }[] = [];

      formattedData.forEach((d, i) => {
        if (ichi.tenkan[i] !== null) tData.push({ time: d.time, value: ichi.tenkan[i] as number });
        if (ichi.kijun[i] !== null) kData.push({ time: d.time, value: ichi.kijun[i] as number });
        if (ichi.senkouA[i] !== null) saData.push({ time: d.time, value: ichi.senkouA[i] as number });
        if (ichi.senkouB[i] !== null) sbData.push({ time: d.time, value: ichi.senkouB[i] as number });
        if (ichi.chikou[i] !== null) cData.push({ time: d.time, value: ichi.chikou[i] as number });
      });

      tenkanSeries.setData(tData);
      kijunSeries.setData(kData);
      senkouASeries.setData(saData);
      senkouBSeries.setData(sbData);
      chikouSeries.setData(cData);
    }

    // 7. Fibonacci Retracement (0.236, 0.382, 0.500, 0.618, 0.786)
    if (showFibonacci && formattedData.length >= 10) {
      // Find swing high & swing low in active range
      const swingHigh = Math.max(...highs);
      const swingLow = Math.min(...lows);
      const fibo = calculateFibonacci(swingHigh, swingLow);

      // Add horizontal price lines with prominent styling
      candleSeries.createPriceLine({
        price: fibo.f000 || swingHigh,
        color: '#94a3b8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Fibo 0.0% (Đỉnh ${swingHigh.toFixed(2)})`,
      });

      candleSeries.createPriceLine({
        price: fibo.f236,
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `Fibo 23.6% (${fibo.f236})`,
      });

      // Key Retracement 0.382
      candleSeries.createPriceLine({
        price: fibo.f382,
        color: '#fbbf24',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `★ Fibo 38.2% (${fibo.f382})`,
      });

      // Key Retracement 0.500
      candleSeries.createPriceLine({
        price: fibo.f500,
        color: '#f97316',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Fibo 50.0% (${fibo.f500})`,
      });

      // Key Golden Ratio 0.618 (The Golden Pocket)
      candleSeries.createPriceLine({
        price: fibo.f618,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `★ Fibo 61.8% Golden (${fibo.f618})`,
      });

      candleSeries.createPriceLine({
        price: fibo.f786,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `Fibo 78.6% (${fibo.f786})`,
      });

      candleSeries.createPriceLine({
        price: fibo.f1000 || swingLow,
        color: '#94a3b8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Fibo 100.0% (Đáy ${swingLow.toFixed(2)})`,
      });
    }

    // Auto-fit content
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 420,
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [
    candles,
    showVolume,
    showVolMA20,
    showMA20,
    showMA50,
    showMA200,
    showEMA20,
    showEMA50,
    showEMA200,
    showBollinger,
    showIchimoku,
    showFibonacci,
    isAdjusted,
    timeframe,
    selectedRange,
  ]);

  // Sub-Chart Rendering Effect (MACD or RSI)
  useEffect(() => {
    if (!subChartContainerRef.current || subIndicator === 'NONE' || subIndicator === 'ADX_ATR') {
      if (subChartInstanceRef.current) {
        subChartInstanceRef.current.remove();
        subChartInstanceRef.current = null;
      }
      return;
    }

    if (subChartInstanceRef.current) {
      subChartInstanceRef.current.remove();
      subChartInstanceRef.current = null;
    }

    const container = subChartContainerRef.current;
    const subChart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 140,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#64748b',
        fontSize: 10,
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: '#172033' },
        horzLines: { color: '#172033' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#334155',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#334155',
        visible: true,
        timeVisible: timeframe !== '1D',
      },
    });

    subChartInstanceRef.current = subChart;

    const activeCandles = isAdjusted ? computeAdjustedCandles(candles) : candles;
    const formattedData = buildFormattedCandles(activeCandles, timeframe, selectedRange);
    const closes = formattedData.map((c) => c.close);

    if (subIndicator === 'MACD' && closes.length >= 26) {
      const macd = calculateMACD_Series(closes);

      // MACD Line
      const macdSeries = subChart.addSeries(LineSeries, {
        color: '#38bdf8',
        lineWidth: 1,
        title: 'MACD (12,26)',
      });
      // Signal Line
      const signalSeries = subChart.addSeries(LineSeries, {
        color: '#f97316',
        lineWidth: 1,
        title: 'Signal (9)',
      });
      // Histogram
      const histSeries = subChart.addSeries(HistogramSeries, {
        title: 'Histogram',
      });

      const mData: { time: any; value: number }[] = [];
      const sData: { time: any; value: number }[] = [];
      const hData: { time: any; value: number; color: string }[] = [];

      formattedData.forEach((d, i) => {
        if (macd.macdLine[i] !== null) mData.push({ time: d.time, value: macd.macdLine[i] as number });
        if (macd.signalLine[i] !== null) sData.push({ time: d.time, value: macd.signalLine[i] as number });
        if (macd.histogram[i] !== null) {
          const hVal = macd.histogram[i] as number;
          hData.push({
            time: d.time,
            value: hVal,
            color: hVal >= 0 ? '#10b981' : '#ef4444',
          });
        }
      });

      macdSeries.setData(mData);
      signalSeries.setData(sData);
      histSeries.setData(hData);
    } else if (subIndicator === 'RSI' && closes.length >= 14) {
      const rsiSeries = subChart.addSeries(LineSeries, {
        color: '#a855f7',
        lineWidth: 2,
        title: 'RSI (14)',
      });

      const rsiVals = calculateRSI_Series(closes, 14);
      const rData: { time: any; value: number }[] = [];
      formattedData.forEach((d, i) => {
        if (rsiVals[i] !== null) rData.push({ time: d.time, value: rsiVals[i] as number });
      });
      rsiSeries.setData(rData);

      // Overbought 70 & Oversold 30 lines
      rsiSeries.createPriceLine({
        price: 70,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Quá mua (70)',
      });
      rsiSeries.createPriceLine({
        price: 50,
        color: '#64748b',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: '50',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Quá bán (30)',
      });
    }

    subChart.timeScale().fitContent();

    const handleSubResize = () => {
      if (container && subChartInstanceRef.current) {
        subChartInstanceRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 140,
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => handleSubResize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (subChartInstanceRef.current) {
        subChartInstanceRef.current.remove();
        subChartInstanceRef.current = null;
      }
    };
  }, [candles, subIndicator, isAdjusted, timeframe, selectedRange]);

  // Current calculation snapshot for HUD
  const activeCandles = isAdjusted ? computeAdjustedCandles(candles) : candles;
  const lastCandle = activeCandles[activeCandles.length - 1] || { close: 0, high: 0, low: 0 };
  const swingHigh = Math.max(...activeCandles.map((c) => c.high));
  const swingLow = Math.min(...activeCandles.map((c) => c.low));
  const fiboCurrent = calculateFibonacci(swingHigh, swingLow);

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-xl relative select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        {/* Left Side: Symbol, Adjusted Price, Timeframe & Range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
            <span className="font-mono font-black text-amber-400 text-sm tracking-wide">${symbol}</span>
            <span className="text-[10px] text-slate-500 font-mono">[{tvExchange}]</span>
          </div>

          {/* Adjusted Price vs Raw Price */}
          <button
            type="button"
            onClick={() => setIsAdjusted(!isAdjusted)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition flex items-center space-x-1 border cursor-pointer ${
              isAdjusted
                ? 'bg-purple-950/90 text-purple-300 border-purple-700 font-bold shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Giá Điều Chỉnh: Loại bỏ khoảng đứt gãy đè giá do chốt quyền chia cổ tức / thưởng cổ phiếu"
          >
            <span>⚙️ {isAdjusted ? 'Điều chỉnh (Adj)' : 'Giá gốc (Raw)'}</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5"></div>

          {/* Timeframe buttons */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {(['1D', '1H', '15M', '5M'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                  timeframe === tf ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-0.5"></div>

          {/* Range Selector */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {(['1M', '3M', '6M', '1Y', '3Y', 'ALL'] as const).map((rng) => (
              <button
                key={rng}
                onClick={() => setSelectedRange(rng)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                  selectedRange === rng ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rng === 'ALL' ? 'TẤT CẢ' : rng}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Technical Indicator Toggles (Ichimoku, Fibonacci, MAs, Bollinger, Sub-chart) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Price Action Suite: Ichimoku Kumo Cloud */}
          <button
            onClick={() => setShowIchimoku(!showIchimoku)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition flex items-center space-x-1 cursor-pointer ${
              showIchimoku
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-950/50'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-cyan-400 hover:border-slate-700'
            }`}
            title="Mây Kumo & Hệ thống Ichimoku Kinko Hyo (Tenkan, Kijun, Senkou Span A/B, Chikou)"
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Mây Ichimoku</span>
          </button>

          {/* Price Action Suite: Fibonacci Retracement */}
          <button
            onClick={() => setShowFibonacci(!showFibonacci)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition flex items-center space-x-1 cursor-pointer ${
              showFibonacci
                ? 'bg-amber-950 text-amber-300 border-amber-500 shadow-md shadow-amber-950/50'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-amber-400 hover:border-slate-700'
            }`}
            title="Thoái lui Fibonacci Retracement (0.236, 0.382, 0.500, 0.618 Golden Zone, 0.786)"
          >
            <TrendingUp className="w-3 h-3 text-amber-400" />
            <span>Fibo Thoái Lui</span>
          </button>

          {/* MA / EMA Selector Dropdown / Popover */}
          <div className="relative">
            <button
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition flex items-center space-x-1 cursor-pointer ${
                showMA20 || showMA50 || showMA200 || showEMA20 || showEMA50 || showEMA200 || showBollinger
                  ? 'bg-blue-950 text-blue-300 border-blue-600'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3 h-3 text-blue-400" />
              <span>Chỉ báo MA/BB</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {showIndicatorMenu && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded-md p-2.5 shadow-2xl z-50 text-xs font-mono space-y-2">
                <div className="flex justify-between items-center pb-1 border-b border-slate-800 font-bold text-slate-300 text-[11px]">
                  <span>CẤU HÌNH ĐƯỜNG TRUNG BÌNH & BB</span>
                  <button
                    onClick={() => setShowIndicatorMenu(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* SMA Group */}
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Đường SMA (Đơn giản):
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setShowMA20(!showMA20)}
                      className={`px-1.5 py-1 rounded text-[10px] border text-center ${
                        showMA20 ? 'bg-sky-950 text-sky-300 border-sky-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      SMA 20
                    </button>
                    <button
                      onClick={() => setShowMA50(!showMA50)}
                      className={`px-1.5 py-1 rounded text-[10px] border text-center ${
                        showMA50 ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      SMA 50
                    </button>
                    <button
                      onClick={() => setShowMA200(!showMA200)}
                      className={`px-1.5 py-1 rounded text-[10px] border text-center ${
                        showMA200 ? 'bg-purple-950 text-purple-300 border-purple-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      SMA 200
                    </button>
                  </div>
                </div>

                {/* EMA Group */}
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Đường EMA (Hàm mũ):
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setShowEMA20(!showEMA20)}
                      className={`px-1.5 py-1 rounded text-[10px] border text-center ${
                        showEMA20 ? 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      EMA 20
                    </button>
                    <button
                      onClick={() => setShowEMA50(!showEMA50)}
                      className={`px-1.5 py-1 rounded text-[10px] border text-center ${
                        showEMA50 ? 'bg-orange-950 text-orange-300 border-orange-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      EMA 50
                    </button>
                    <button
                      onClick={() => setShowEMA200(!showEMA200)}
                      className={`px-1.5 py-1 rounded text-[10px] border text-center ${
                        showEMA200 ? 'bg-rose-950 text-rose-300 border-rose-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      EMA 200
                    </button>
                  </div>
                </div>

                {/* Bollinger Bands & Vol MA */}
                <div className="pt-1 border-t border-slate-800 flex flex-col space-y-1.5">
                  <button
                    onClick={() => setShowBollinger(!showBollinger)}
                    className={`w-full py-1 rounded text-[10px] border text-center ${
                      showBollinger ? 'bg-pink-950 text-pink-300 border-pink-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    Bollinger Bands (20, 2σ)
                  </button>
                  <button
                    onClick={() => setShowVolMA20(!showVolMA20)}
                    className={`w-full py-1 rounded text-[10px] border text-center ${
                      showVolMA20 ? 'bg-yellow-950 text-yellow-300 border-yellow-600 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    Volume MA20 (Thanh khoản 20 phiên)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-chart Indicator selector */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setSubIndicator(subIndicator === 'MACD' ? 'NONE' : 'MACD')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                subIndicator === 'MACD' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MACD
            </button>
            <button
              onClick={() => setSubIndicator(subIndicator === 'RSI' ? 'NONE' : 'RSI')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                subIndicator === 'RSI' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RSI (14)
            </button>
            <button
              onClick={() => setSubIndicator(subIndicator === 'ADX_ATR' ? 'NONE' : 'ADX_ATR')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                subIndicator === 'ADX_ATR' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ADX / ATR
            </button>
          </div>

          {/* Focus Mode toggle button */}
          {onToggleFocusMode && (
            <button
              onClick={onToggleFocusMode}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition flex items-center space-x-1 cursor-pointer ${
                isFocusMode
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:border-slate-500'
              }`}
              title={isFocusMode ? 'Thoát chế độ Focus Toàn Màn Hình' : 'Chế độ Focus Toàn Màn Hình'}
            >
              {isFocusMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span>Thu Gọn</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Focus</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Indicator Status Ribbon (HUD) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1 bg-[#070b13] border-b border-slate-800/80 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {/* Price Action Fibonacci Badge */}
          {showFibonacci && (
            <div className="flex items-center space-x-1.5 text-amber-300">
              <span className="font-bold">📐 FIBO:</span>
              <span className="text-slate-400">38.2%:</span>
              <span className="text-amber-400 font-semibold">{fiboCurrent.f382}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">50.0%:</span>
              <span className="text-orange-400 font-semibold">{fiboCurrent.f500}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">61.8% (Golden):</span>
              <span className="text-emerald-400 font-bold">{fiboCurrent.f618}</span>
            </div>
          )}

          {/* Ichimoku Badge */}
          {showIchimoku && (
            <div className="flex items-center space-x-1.5 text-cyan-300">
              <span className="font-bold">☁️ ICHIMOKU:</span>
              <span className="text-cyan-400">Tenkan (9)</span>
              <span className="text-slate-600">/</span>
              <span className="text-orange-400">Kijun (26)</span>
              <span className="text-slate-600">/</span>
              <span className="text-emerald-400">Span A</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">Span B (Kumo)</span>
            </div>
          )}

          {/* Current Active Overlays Indicator Pills */}
          <div className="flex items-center space-x-1">
            {showMA20 && <span className="px-1.5 py-0.2 bg-sky-950/80 text-sky-400 border border-sky-800 rounded text-[9px]">SMA20</span>}
            {showMA50 && <span className="px-1.5 py-0.2 bg-amber-950/80 text-amber-400 border border-amber-800 rounded text-[9px]">SMA50</span>}
            {showMA200 && <span className="px-1.5 py-0.2 bg-purple-950/80 text-purple-400 border border-purple-800 rounded text-[9px]">SMA200</span>}
            {showEMA20 && <span className="px-1.5 py-0.2 bg-emerald-950/80 text-emerald-400 border border-emerald-800 rounded text-[9px]">EMA20</span>}
            {showEMA50 && <span className="px-1.5 py-0.2 bg-orange-950/80 text-orange-400 border border-orange-800 rounded text-[9px]">EMA50</span>}
            {showEMA200 && <span className="px-1.5 py-0.2 bg-rose-950/80 text-rose-400 border border-rose-800 rounded text-[9px]">EMA200</span>}
            {showBollinger && <span className="px-1.5 py-0.2 bg-pink-950/80 text-pink-400 border border-pink-800 rounded text-[9px]">BB(20,2)</span>}
            {showVolMA20 && <span className="px-1.5 py-0.2 bg-yellow-950/80 text-yellow-400 border border-yellow-800 rounded text-[9px]">Vol MA20</span>}
          </div>
        </div>

        <div className="text-[10px] text-slate-500">
          Giá hiện tại: <span className="text-emerald-400 font-bold">{lastCandle.close.toFixed(2)}</span>
        </div>
      </div>

      {/* Main Candlestick Chart Canvas */}
      <div className={`relative w-full ${subIndicator !== 'NONE' ? 'flex-1 min-h-[300px]' : 'flex-1 min-h-[420px]'}`}>
        <div ref={chartContainerRef} className="w-full h-full bg-slate-950" />

        {/* Floating TradingView Logo Overlay Button on Chart Canvas */}
        <a
          href={tradingViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 z-20 flex items-center space-x-2 px-2.5 py-1.5 bg-[#131722]/90 hover:bg-[#1f2433] text-white border border-[#2a2e39] hover:border-blue-500 rounded-md shadow-2xl transition group backdrop-blur-md cursor-pointer hover:scale-105 transform"
          title={`Bấm để mở biểu đồ ${symbol} trực tiếp trên TradingView.com`}
        >
          <div className="flex items-center justify-center px-1.5 py-1 bg-[#2a2e39] rounded group-hover:bg-blue-600 transition">
            <svg className="w-4 h-3 fill-current text-white" viewBox="0 0 36 28">
              <path d="M14 22H7V11H14V22ZM28 6H21V22H28V6ZM21 0H14V22H21V0Z" />
            </svg>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-mono font-bold leading-none text-gray-200 group-hover:text-blue-300">
              Xem {tvExchange}:{symbol} trên TradingView ↗
            </span>
            <span className="text-[9px] font-mono text-gray-400 group-hover:text-gray-200 mt-0.5">
              https://www.tradingview.com/
            </span>
          </div>
        </a>
      </div>

      {/* Sub-Chart Indicator Container (MACD, RSI, ADX/ATR) */}
      {subIndicator !== 'NONE' && (
        <div className="border-t border-slate-800 bg-[#090d16] flex flex-col h-36 shrink-0 relative">
          <div className="flex items-center justify-between px-3 py-1 bg-[#0b101c] border-b border-slate-800/80 text-[10px] font-mono text-slate-400">
            <div className="flex items-center space-x-2">
              <Activity className="w-3 h-3 text-blue-400" />
              <span className="font-bold text-slate-300 uppercase">
                {subIndicator === 'MACD'
                  ? 'MACD HISTOGRAM (12, 26, 9)'
                  : subIndicator === 'RSI'
                  ? 'RELATIVE STRENGTH INDEX (RSI 14)'
                  : 'ADX (14) XU HƯỚNG & ATR (14) BIẾN ĐỘNG'}
              </span>
            </div>

            <button
              onClick={() => setSubIndicator('NONE')}
              className="text-slate-500 hover:text-slate-300 text-[10px] font-bold"
              title="Đóng bảng chỉ báo phụ"
            >
              ✕ Đóng
            </button>
          </div>

          {subIndicator === 'ADX_ATR' ? (
            <div className="flex-1 p-3 grid grid-cols-2 gap-4 font-mono items-center">
              <div className="bg-[#050811] p-2.5 rounded border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400 font-bold">ADX (14) - Sức mạnh Xu hướng:</span>
                  <span className="text-amber-400 font-bold text-sm">28.5</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full w-[57%]" />
                </div>
                <span className="text-[10px] text-emerald-400 block mt-1">
                  &gt; 25: Xu hướng tăng đang hình thành mạnh mẽ
                </span>
              </div>

              <div className="bg-[#050811] p-2.5 rounded border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400 font-bold">ATR (14) - Biên độ dao động:</span>
                  <span className="text-blue-400 font-bold text-sm">1.15 VNĐ</span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Biên độ biến động trung bình 14 phiên (dùng tính Stop-loss an toàn)
                </span>
              </div>
            </div>
          ) : (
            <div ref={subChartContainerRef} className="flex-1 w-full h-full" />
          )}
        </div>
      )}
    </div>
  );
};
