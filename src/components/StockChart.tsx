import { CandlestickSeries, ColorType, createChart, HistogramSeries, IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import { Candle } from '../types';

interface StockChartProps {
  symbol: string;
  candles: Candle[];
  exchange?: string;
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

export const StockChart: React.FC<StockChartProps> = ({ symbol, candles, exchange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const [timeframe, setTimeframe] = useState<'1D' | '1H' | '15M' | '5M'>('1D');
  const [showVolume, setShowVolume] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);

  const tvExchange = getTradingViewExchange(symbol, exchange);
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${symbol}`;

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Clean up previous chart instance if present
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 450,
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
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // Emerald green
      downColor: '#ef4444', // Crimson red
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candlestickSeriesRef.current = candleSeries;

    const formattedCandles = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    // Volume Series
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#22c55e',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // Set as overlay
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8, // Volume occupies bottom 20%
          bottom: 0,
        },
      });

      const formattedVolume = candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      }));
      volumeSeries.setData(formattedVolume);
      volumeSeriesRef.current = volumeSeries;
    }

    // MA20 Line Series
    if (showMA20 && candles.length >= 20) {
      const ma20Series = chart.addSeries(LineSeries, {
        color: '#38bdf8', // Light blue
        lineWidth: 1,
        title: 'MA20',
      });
      const ma20Data = [];
      for (let i = 19; i < candles.length; i++) {
        const slice = candles.slice(i - 19, i + 1);
        const avg = slice.reduce((sum, item) => sum + item.close, 0) / 20;
        ma20Data.push({ time: candles[i].time, value: Number(avg.toFixed(2)) });
      }
      ma20Series.setData(ma20Data);
    }

    // MA50 Line Series
    if (showMA50 && candles.length >= 50) {
      const ma50Series = chart.addSeries(LineSeries, {
        color: '#f59e0b', // Amber/Yellow
        lineWidth: 2,
        title: 'MA50',
      });
      const ma50Data = [];
      for (let i = 49; i < candles.length; i++) {
        const slice = candles.slice(i - 49, i + 1);
        const avg = slice.reduce((sum, item) => sum + item.close, 0) / 50;
        ma50Data.push({ time: candles[i].time, value: Number(avg.toFixed(2)) });
      }
      ma50Series.setData(ma50Data);
    }

    // Auto-fit content
    chart.timeScale().fitContent();

    // ResizeObserver handler
    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 450,
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
  }, [candles, showVolume, showMA20, showMA50]);

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-xl relative">
      {/* Chart Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-mono font-bold text-amber-400 text-sm">${symbol}</span>
          
          {/* Clickable TradingView Logo & Link */}
          <a
            href={tradingViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#131722] hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-700/80 transition text-[11px] font-mono group shadow-sm cursor-pointer"
            title={`Mở biểu đồ ${symbol} trực tiếp trên TradingView.com`}
          >
            <svg className="w-4 h-3 fill-current text-blue-400 group-hover:text-white transition" viewBox="0 0 36 28">
              <path d="M14 22H7V11H14V22ZM28 6H21V22H28V6ZM21 0H14V22H21V0Z" />
            </svg>
            <span className="font-bold text-[11px]">TradingView ↗</span>
          </a>

          <div className="h-4 w-px bg-slate-800 mx-1"></div>

          {/* Timeframe buttons */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {(['1D', '1H', '15M', '5M'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                  timeframe === tf ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Indicators Overlay Toggles */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-0.5 rounded text-[11px] border transition ${
              showVolume ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            Volume
          </button>
          <button
            onClick={() => setShowMA20(!showMA20)}
            className={`px-2 py-0.5 rounded text-[11px] border transition ${
              showMA20 ? 'bg-sky-950/80 text-sky-400 border-sky-800' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            MA20
          </button>
          <button
            onClick={() => setShowMA50(!showMA50)}
            className={`px-2 py-0.5 rounded text-[11px] border transition ${
              showMA50 ? 'bg-amber-950/80 text-amber-400 border-amber-800' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            MA50
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative w-full flex-1 min-h-[380px]">
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
    </div>
  );
};
