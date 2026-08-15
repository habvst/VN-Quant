import { useEffect, useState } from 'react';
import { WatchlistItem } from '../types';

const WATCHLIST_STORAGE_KEY = 'vnquant_watchlist';
export const WATCHLIST_UPDATED_EVENT = 'vnquant_watchlist_updated';

// Read watchlist from localStorage
export function getStoredWatchlist(): WatchlistItem[] {
  try {
    const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse watchlist from storage:', e);
  }
  return [];
}

// Sync to backend store for Sentinel Daemon monitoring
export function syncWatchlistToBackend(symbols: string[]) {
  fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  }).catch((err) => console.warn('Failed to sync watchlist to server:', err));
}

// Save watchlist to storage and notify all listeners
export function saveWatchlist(watchlist: WatchlistItem[]): void {
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    // Dispatch custom event for cross-component reactive updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(WATCHLIST_UPDATED_EVENT, {
          detail: { watchlist, symbols: watchlist.map((w) => w.symbol) },
        })
      );
    }
    syncWatchlistToBackend(watchlist.map((w) => w.symbol));
  } catch (e) {
    console.error('Failed to save watchlist:', e);
  }
}

// Check if symbol is in watchlist
export function isSymbolInWatchlist(symbol: string): boolean {
  if (!symbol) return false;
  const current = getStoredWatchlist();
  return current.some((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
}

// Add a stock to watchlist
export function addToWatchlist(item: {
  symbol: string;
  targetPrice?: number;
  stopLoss?: number;
  note?: string;
}): { added: boolean; watchlist: WatchlistItem[] } {
  const sym = item.symbol.trim().toUpperCase();
  if (!sym) return { added: false, watchlist: getStoredWatchlist() };

  const current = getStoredWatchlist();
  if (current.some((w) => w.symbol === sym)) {
    return { added: false, watchlist: current };
  }

  const updated: WatchlistItem[] = [
    ...current,
    {
      symbol: sym,
      addedAt: new Date().toISOString().split('T')[0],
      targetPrice: item.targetPrice,
      stopLoss: item.stopLoss,
      note: item.note || 'Thêm vào danh mục theo dõi',
    },
  ];

  saveWatchlist(updated);
  return { added: true, watchlist: updated };
}

// Remove a stock from watchlist
export function removeFromWatchlist(symbol: string): { removed: boolean; watchlist: WatchlistItem[] } {
  const sym = symbol.trim().toUpperCase();
  const current = getStoredWatchlist();
  const filtered = current.filter((w) => w.symbol !== sym);
  const wasRemoved = filtered.length !== current.length;

  if (wasRemoved) {
    saveWatchlist(filtered);
  }
  return { removed: wasRemoved, watchlist: filtered };
}

// Toggle watchlist state for a stock
export function toggleWatchlist(
  symbol: string,
  details?: { targetPrice?: number; stopLoss?: number; note?: string }
): { inWatchlist: boolean; watchlist: WatchlistItem[] } {
  const sym = symbol.trim().toUpperCase();
  if (isSymbolInWatchlist(sym)) {
    const res = removeFromWatchlist(sym);
    return { inWatchlist: false, watchlist: res.watchlist };
  } else {
    const res = addToWatchlist({ symbol: sym, ...details });
    return { inWatchlist: true, watchlist: res.watchlist };
  }
}

// React hook for reactive watchlist status
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => getStoredWatchlist());

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail?.watchlist) {
        setWatchlist(e.detail.watchlist);
      } else {
        setWatchlist(getStoredWatchlist());
      }
    };

    window.addEventListener(WATCHLIST_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(WATCHLIST_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isWatching = (sym: string) => {
    return watchlist.some((w) => w.symbol.toUpperCase() === sym.toUpperCase());
  };

  const toggle = (sym: string, details?: { targetPrice?: number; stopLoss?: number; note?: string }) => {
    return toggleWatchlist(sym, details);
  };

  const add = (item: { symbol: string; targetPrice?: number; stopLoss?: number; note?: string }) => {
    return addToWatchlist(item);
  };

  const remove = (sym: string) => {
    return removeFromWatchlist(sym);
  };

  return {
    watchlist,
    symbols: watchlist.map((w) => w.symbol),
    isWatching,
    toggle,
    add,
    remove,
  };
}
