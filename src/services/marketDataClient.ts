import { Candle, MarketIndex, OrderBook, StockData, TradeTick } from '../types';
import { getMarketSessionInfo } from '../utils/timeUtils';

/**
 * Market Data Client Service with:
 * 1. Stale-While-Revalidate (SWR) multi-tier caching (Memory + LocalStorage)
 * 2. AbortController to prevent race conditions when switching tickers rapidly
 * 3. Market session detector & Adaptive Polling (09:00 - 15:00 vs after-hours)
 * 4. Resilient fallback generator to prevent blank screens during network blips
 */

export interface CachedStockBundle {
  stock: StockData;
  candles: Candle[];
  orderBook: OrderBook;
  tradeTicks: TradeTick[];
  timestamp: number;
}

// In-Memory Fast Cache Map
const memoryCache = new Map<string, CachedStockBundle>();
const STALE_TIME_MS = 60 * 1000; // 1 minute fresh time

// Active AbortController for in-flight stock details
let activeStockDetailController: AbortController | null = null;

/**
 * Check Vietnam Stock Exchange (HOSE/HNX) Trading Session in UTC+7
 */
export function getVietnamMarketSession(): {
  isOpen: boolean;
  statusText: string;
  badgeColor: string;
  recommendedIntervalMs: number;
} {
  const session = getMarketSessionInfo();

  if (session.status === 'ATO' || session.status === 'ATC') {
    return {
      isOpen: true,
      statusText: session.label,
      badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800',
      recommendedIntervalMs: 3000,
    };
  }

  if (session.canMatchOrders) {
    return {
      isOpen: true,
      statusText: session.label,
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
      recommendedIntervalMs: 4000,
    };
  }

  if (session.status === 'LUNCH_BREAK') {
    return {
      isOpen: false,
      statusText: session.label,
      badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800',
      recommendedIntervalMs: 15000,
    };
  }

  if (session.status === 'PRE_OPEN') {
    return {
      isOpen: false,
      statusText: session.label,
      badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800',
      recommendedIntervalMs: 10000,
    };
  }

  return {
    isOpen: false,
    statusText: session.label,
    badgeColor: 'text-gray-400 bg-gray-900 border-gray-700',
    recommendedIntervalMs: 30000,
  };
}

/**
 * Retrieve Stale Cache instantly (< 10ms)
 */
export function getCachedStockBundle(symbol: string): CachedStockBundle | null {
  const sym = symbol.toUpperCase();
  // 1. Check in-memory fast cache
  if (memoryCache.has(sym)) {
    return memoryCache.get(sym)!;
  }

  // 2. Check localStorage snapshot cache
  try {
    const raw = localStorage.getItem(`vnquant_cache_${sym}`);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedStockBundle;
      memoryCache.set(sym, parsed);
      return parsed;
    }
  } catch {
    // Ignore storage parse errors
  }

  return null;
}

/**
 * Save stock bundle to memory and persistent cache
 */
export function saveStockBundleToCache(symbol: string, data: Omit<CachedStockBundle, 'timestamp'>): void {
  const sym = symbol.toUpperCase();
  const bundle: CachedStockBundle = {
    ...data,
    timestamp: Date.now(),
  };

  memoryCache.set(sym, bundle);

  try {
    localStorage.setItem(`vnquant_cache_${sym}`, JSON.stringify(bundle));
  } catch {
    // Handle storage quota limits gracefully
  }
}

/**
 * Safe JSON parser with content-type verification
 */
async function safeParseJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Client-Side Direct Live Quote Fetcher (Resilient Direct-to-Exchange Fallback)
 */
export async function fetchDirectLiveQuote(symbol: string): Promise<Partial<StockData> | null> {
  const sym = symbol.toUpperCase().trim();

  // 1. Direct VPS Priceboard API (Supports CORS natively)
  try {
    const res = await fetch(`https://bgapidatafeed.vps.com.vn/getliststockdata/${sym}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const item = list[0];
        const ref = Number(item.r || item.lastPrice || 0);
        const lastPrice = Number(item.lastPrice) > 0 ? Number(item.lastPrice) : ref;
        const openPrice = Number(item.openPrice) > 0 ? Number(item.openPrice) : lastPrice;
        const highPrice = Number(item.highPrice) > 0 ? Number(item.highPrice) : lastPrice;
        const lowPrice = Number(item.lowPrice) > 0 ? Number(item.lowPrice) : lastPrice;
        const ceilingPrice = Number(item.c) || Number((ref * 1.07).toFixed(2));
        const floorPrice = Number(item.f) || Number((ref * 0.93).toFixed(2));
        const change = Number(item.ot) || Number((lastPrice - ref).toFixed(2));
        const pct = Number(item.changePc) || (ref > 0 ? Number(((change / ref) * 100).toFixed(2)) : 0);
        const volume = Number(item.lot || 0) * 10;
        const value = Number(((lastPrice * volume) / 10000000).toFixed(1));

        return {
          price: lastPrice,
          referencePrice: ref,
          ceilingPrice,
          floorPrice,
          openPrice,
          highPrice,
          lowPrice,
          change,
          changePercent: pct,
          volume,
          value,
          foreignBuyVol: Number(item.fBVol || 0) * 10,
          foreignSellVol: Number(item.fSVolume || 0) * 10,
          lastUpdated: Date.now(),
        };
      }
    }
  } catch {}

  // 2. Direct VNDirect Finfo Fallback
  try {
    const res = await fetch(`https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${sym}&size=1`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && json.data.length > 0) {
        const item = json.data[0];
        if (typeof item.close === 'number' && item.close > 0) {
          const ref = item.basicPrice || item.close;
          const change = item.change ?? Number((item.close - ref).toFixed(2));
          const pct = item.pctChange ?? (ref > 0 ? Number(((change / ref) * 100).toFixed(2)) : 0);
          return {
            price: item.close,
            referencePrice: ref,
            ceilingPrice: item.ceilingPrice || Number((ref * 1.07).toFixed(2)),
            floorPrice: item.floorPrice || Number((ref * 0.93).toFixed(2)),
            openPrice: item.open || item.close,
            highPrice: item.high || item.close,
            lowPrice: item.low || item.close,
            change,
            changePercent: Number(pct.toFixed(2)),
            volume: item.nmVolume || 0,
            value: Number(((item.nmValue || item.close * (item.nmVolume || 0) * 1000) / 1e9).toFixed(1)),
            lastUpdated: Date.now(),
          };
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Fetch Stock Detail Bundle with Stale-While-Revalidate & AbortController
 */
export async function fetchStockDetailWithSWR(
  symbol: string,
  callbacks: {
    onStaleLoaded?: (cached: CachedStockBundle) => void;
    onSuccess: (bundle: CachedStockBundle) => void;
    onError?: (err: any) => void;
  }
): Promise<void> {
  const sym = symbol.toUpperCase();

  // 1. Abort any previous pending requests immediately to prevent race conditions
  if (activeStockDetailController) {
    activeStockDetailController.abort();
  }
  const controller = new AbortController();
  activeStockDetailController = controller;

  // 2. Immediately serve Stale data if available (<10ms UI rendering)
  const cached = getCachedStockBundle(sym);
  if (cached && callbacks.onStaleLoaded) {
    callbacks.onStaleLoaded(cached);
  }

  // 3. Perform network fetch with signal
  try {
    const signal = controller.signal;
    const [stockRes, candleRes, obRes, ticksRes] = await Promise.all([
      fetch(`/api/market/stock/${sym}`, { signal }).catch(() => null),
      fetch(`/api/market/candles/${sym}`, { signal }).catch(() => null),
      fetch(`/api/market/orderbook/${sym}`, { signal }).catch(() => null),
      fetch(`/api/market/ticks/${sym}`, { signal }).catch(() => null),
    ]);

    if (signal.aborted) return;

    let stockData = stockRes ? await safeParseJson<StockData>(stockRes) : null;
    const candleData = candleRes ? await safeParseJson<Candle[]>(candleRes) : null;
    const obData = obRes ? await safeParseJson<OrderBook>(obRes) : null;
    const ticksData = ticksRes ? await safeParseJson<TradeTick[]>(ticksRes) : null;

    // Direct Browser Live Patch if backend stock data is missing or needs live quote verification
    if (!stockData && cached?.stock) {
      stockData = { ...cached.stock };
    }

    const directQuote = await fetchDirectLiveQuote(sym);
    if (directQuote && stockData) {
      stockData = {
        ...stockData,
        price: directQuote.price ?? stockData.price,
        referencePrice: directQuote.referencePrice ?? stockData.referencePrice,
        ceilingPrice: directQuote.ceilingPrice ?? stockData.ceilingPrice,
        floorPrice: directQuote.floorPrice ?? stockData.floorPrice,
        openPrice: directQuote.openPrice ?? stockData.openPrice,
        highPrice: directQuote.highPrice ?? stockData.highPrice,
        lowPrice: directQuote.lowPrice ?? stockData.lowPrice,
        change: directQuote.change ?? stockData.change,
        changePercent: directQuote.changePercent ?? stockData.changePercent,
        volume: directQuote.volume ?? stockData.volume,
        value: directQuote.value ?? stockData.value,
        lastUpdated: Date.now(),
      };
    }

    if (stockData) {
      const defaultOrderBook: OrderBook = {
        symbol: sym,
        bid: [],
        ask: [],
        lastPrice: stockData.price,
        lastVolume: 0,
        totalBuyVol: 0,
        totalSellVol: 0,
      };

      const bundle: CachedStockBundle = {
        stock: stockData,
        candles: Array.isArray(candleData) && candleData.length > 0 ? candleData : cached?.candles || [],
        orderBook: obData || cached?.orderBook || defaultOrderBook,
        tradeTicks: Array.isArray(ticksData) && ticksData.length > 0 ? ticksData : cached?.tradeTicks || [],
        timestamp: Date.now(),
      };

      // Save to cache
      saveStockBundleToCache(sym, bundle);

      // Trigger success callback
      callbacks.onSuccess(bundle);
    } else if (cached) {
      callbacks.onSuccess(cached);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return;
    }
    console.warn(`[MarketDataClient] Fallback to cached state for ${sym}:`, err?.message || err);
    if (cached) {
      callbacks.onSuccess(cached);
    } else if (callbacks.onError) {
      callbacks.onError(err);
    }
  } finally {
    if (activeStockDetailController === controller) {
      activeStockDetailController = null;
    }
  }
}
