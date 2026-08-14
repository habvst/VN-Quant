import { Candle, MarketIndex, OrderBook, StockData, TradeTick } from '../types';

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
  // Current time in Vietnam (UTC+7)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const vnTime = new Date(utc + 3600000 * 7);

  const day = vnTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = vnTime.getHours();
  const minutes = vnTime.getMinutes();
  const timeNum = hours * 100 + minutes;

  // Weekend
  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      statusText: 'Đóng Cửa (Cuối Tuần)',
      badgeColor: 'text-gray-400 bg-gray-900 border-gray-700',
      recommendedIntervalMs: 30000,
    };
  }

  // Weekdays (Mon-Fri)
  if (timeNum < 900) {
    return {
      isOpen: false,
      statusText: 'Tiền Phiên (Trước 09:00)',
      badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800',
      recommendedIntervalMs: 15000,
    };
  }
  if (timeNum >= 900 && timeNum < 915) {
    return {
      isOpen: true,
      statusText: 'Phiên Khớp Lệnh ATO',
      badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800',
      recommendedIntervalMs: 3000,
    };
  }
  if (timeNum >= 915 && timeNum < 1130) {
    return {
      isOpen: true,
      statusText: 'Phiên Sáng (Liên Tục)',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
      recommendedIntervalMs: 4000,
    };
  }
  if (timeNum >= 1130 && timeNum < 1300) {
    return {
      isOpen: false,
      statusText: 'Nghỉ Giữa Phiên (Trưa)',
      badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800',
      recommendedIntervalMs: 20000,
    };
  }
  if (timeNum >= 1300 && timeNum < 1430) {
    return {
      isOpen: true,
      statusText: 'Phiên Chiều (Liên Tục)',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
      recommendedIntervalMs: 4000,
    };
  }
  if (timeNum >= 1430 && timeNum <= 1445) {
    return {
      isOpen: true,
      statusText: 'Phiên Khớp Lệnh ATC',
      badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800',
      recommendedIntervalMs: 3000,
    };
  }

  // After 15:00
  return {
    isOpen: false,
    statusText: 'Đóng Cửa Phiên',
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
      fetch(`/api/market/stock/${sym}`, { signal }),
      fetch(`/api/market/candles/${sym}`, { signal }),
      fetch(`/api/market/orderbook/${sym}`, { signal }),
      fetch(`/api/market/ticks/${sym}`, { signal }),
    ]);

    if (signal.aborted) return;

    const stockData = await safeParseJson<StockData>(stockRes);
    const candleData = await safeParseJson<Candle[]>(candleRes);
    const obData = await safeParseJson<OrderBook>(obRes);
    const ticksData = await safeParseJson<TradeTick[]>(ticksRes);

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
        candles: Array.isArray(candleData) ? candleData : cached?.candles || [],
        orderBook: obData || cached?.orderBook || defaultOrderBook,
        tradeTicks: Array.isArray(ticksData) ? ticksData : cached?.tradeTicks || [],
        timestamp: Date.now(),
      };

      // Save to cache
      saveStockBundleToCache(sym, bundle);

      // Trigger success callback
      callbacks.onSuccess(bundle);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Intentional abort due to rapid symbol switching - silent ignore
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
