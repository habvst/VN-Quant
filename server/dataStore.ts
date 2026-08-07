import fs from 'fs';
import path from 'path';
import { StockAlert } from '../src/types/alert';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface TriggerHistoryItem {
  id: string;
  symbol: string;
  alertId: string;
  message: string;
  telegramSuccess: boolean;
  timestamp: string;
}

export interface AppDataStore {
  telegramConfig: TelegramConfig;
  serverAlerts: StockAlert[];
  watchlistSymbols: string[];
  triggerHistory: TriggerHistoryItem[];
  lastUpdated: string;
}

// Default initial state
const DEFAULT_STORE: AppDataStore = {
  telegramConfig: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    enabled: true,
  },
  serverAlerts: [
    {
      id: 'srv-alt-1',
      symbol: 'HPG',
      triggerType: 'PRICE_THRESHOLD',
      condition: 'ABOVE_PRICE',
      targetValue: 22.0,
      note: 'Cảnh báo bứt phá HPG vùng giá 22.0',
      channel: 'TELEGRAM',
      isActive: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    },
    {
      id: 'srv-alt-2',
      symbol: 'FPT',
      triggerType: 'RSI_LEVEL',
      condition: 'RSI_OVERBOUGHT',
      targetValue: 70,
      note: 'Cảnh báo RSI FPT đi vào vùng quá mua (>70)',
      channel: 'TELEGRAM',
      isActive: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    },
    {
      id: 'srv-alt-3',
      symbol: 'SSI',
      triggerType: 'MA_CROSSOVER',
      condition: 'PRICE_CROSS_ABOVE_MA20',
      targetValue: 36.0,
      note: 'SSI cắt lên MA20',
      channel: 'TELEGRAM',
      isActive: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    },
  ],
  watchlistSymbols: ['VNINDEX', 'VN30', 'VCB', 'FPT', 'HPG', 'SSI', 'MWG', 'VHM'],
  triggerHistory: [],
  lastUpdated: new Date().toISOString(),
};

// Choose primary data file path with fallback to /tmp/
const DATA_DIR = path.join(process.cwd(), 'data');
const PRIMARY_FILE_PATH = path.join(DATA_DIR, 'store.json');
const FALLBACK_FILE_PATH = path.join('/tmp', 'vietstock_store.json');

let currentFilePath = PRIMARY_FILE_PATH;

/**
 * Ensures data directory exists
 */
function ensureDataDir(): string {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Test write permission
    const testFile = path.join(DATA_DIR, '.perm_test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return PRIMARY_FILE_PATH;
  } catch (err) {
    console.warn(`[PERSISTENCE] Workspace data dir non-writable. Falling back to ${FALLBACK_FILE_PATH}`);
    return FALLBACK_FILE_PATH;
  }
}

// Global In-Memory State
let inMemoryStore: AppDataStore = { ...DEFAULT_STORE };

/**
 * Load store from disk upon initialization
 */
function loadFromDisk(): AppDataStore {
  currentFilePath = ensureDataDir();

  try {
    if (fs.existsSync(currentFilePath)) {
      const rawData = fs.readFileSync(currentFilePath, 'utf-8');
      const parsed = JSON.parse(rawData) as Partial<AppDataStore>;

      console.log(`[PERSISTENCE] ✅ Loaded state from persistent storage (${currentFilePath})`);
      
      return {
        telegramConfig: {
          ...DEFAULT_STORE.telegramConfig,
          ...(parsed.telegramConfig || {}),
          // Environment variables override if present
          botToken: process.env.TELEGRAM_BOT_TOKEN || parsed.telegramConfig?.botToken || DEFAULT_STORE.telegramConfig.botToken,
          chatId: process.env.TELEGRAM_CHAT_ID || parsed.telegramConfig?.chatId || DEFAULT_STORE.telegramConfig.chatId,
        },
        serverAlerts: Array.isArray(parsed.serverAlerts) && parsed.serverAlerts.length > 0 ? parsed.serverAlerts : DEFAULT_STORE.serverAlerts,
        watchlistSymbols: Array.isArray(parsed.watchlistSymbols) && parsed.watchlistSymbols.length > 0 ? parsed.watchlistSymbols : DEFAULT_STORE.watchlistSymbols,
        triggerHistory: Array.isArray(parsed.triggerHistory) ? parsed.triggerHistory : DEFAULT_STORE.triggerHistory,
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error(`[PERSISTENCE] ⚠️ Failed to load ${currentFilePath}, starting with defaults:`, err);
  }

  // Initial save if file didn't exist
  saveToDiskSync(DEFAULT_STORE);
  return { ...DEFAULT_STORE };
}

/**
 * Synchronously & atomically save store to disk
 */
function saveToDiskSync(store: AppDataStore): boolean {
  try {
    store.lastUpdated = new Date().toISOString();
    const jsonStr = JSON.stringify(store, null, 2);
    
    // Write atomically using temporary file to prevent corruption
    const tempPath = `${currentFilePath}.tmp`;
    fs.writeFileSync(tempPath, jsonStr, 'utf-8');
    fs.renameSync(tempPath, currentFilePath);
    return true;
  } catch (err) {
    console.error(`[PERSISTENCE] ❌ Error persisting data to ${currentFilePath}:`, err);
    try {
      // Direct write fallback
      fs.writeFileSync(currentFilePath, JSON.stringify(store, null, 2), 'utf-8');
      return true;
    } catch (fallbackErr) {
      console.error(`[PERSISTENCE] ❌ Direct write fallback also failed:`, fallbackErr);
      return false;
    }
  }
}

// Initialize on module load
inMemoryStore = loadFromDisk();

// Public Getters & Mutators with Auto-Persistence

export function getStore(): AppDataStore {
  return inMemoryStore;
}

export function saveStore(): boolean {
  return saveToDiskSync(inMemoryStore);
}

// 1. Telegram Config Accessors
export function getTelegramConfigStore(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || inMemoryStore.telegramConfig.botToken,
    chatId: process.env.TELEGRAM_CHAT_ID || inMemoryStore.telegramConfig.chatId,
    enabled: inMemoryStore.telegramConfig.enabled,
  };
}

export function updateTelegramConfigStore(config: Partial<TelegramConfig>): TelegramConfig {
  inMemoryStore.telegramConfig = {
    ...inMemoryStore.telegramConfig,
    ...config,
  };
  saveStore();
  return getTelegramConfigStore();
}

// 2. Server Alerts Accessors
export function getServerAlertsStore(): StockAlert[] {
  return inMemoryStore.serverAlerts;
}

export function setServerAlertsStore(alerts: StockAlert[]): void {
  inMemoryStore.serverAlerts = alerts;
  saveStore();
}

export function addServerAlertStore(alert: Omit<StockAlert, 'id' | 'createdAt' | 'triggerCount'>): StockAlert {
  const newAlert: StockAlert = {
    ...alert,
    id: `srv-alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  };
  inMemoryStore.serverAlerts.unshift(newAlert);
  saveStore();
  return newAlert;
}

export function deleteServerAlertStore(id: string): boolean {
  const prevLength = inMemoryStore.serverAlerts.length;
  inMemoryStore.serverAlerts = inMemoryStore.serverAlerts.filter((a) => a.id !== id);
  if (inMemoryStore.serverAlerts.length !== prevLength) {
    saveStore();
    return true;
  }
  return false;
}

// 3. Trigger History Accessors
export function getTriggerHistoryStore(): TriggerHistoryItem[] {
  return inMemoryStore.triggerHistory || [];
}

export function addTriggerHistoryItem(item: Omit<TriggerHistoryItem, 'id' | 'timestamp'>): void {
  if (!inMemoryStore.triggerHistory) {
    inMemoryStore.triggerHistory = [];
  }
  const historyItem: TriggerHistoryItem = {
    ...item,
    id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  };
  // Keep last 100 trigger logs
  inMemoryStore.triggerHistory.unshift(historyItem);
  if (inMemoryStore.triggerHistory.length > 100) {
    inMemoryStore.triggerHistory = inMemoryStore.triggerHistory.slice(0, 100);
  }
  saveStore();
}

// 4. Watchlist Accessors
export function getWatchlistStore(): string[] {
  return inMemoryStore.watchlistSymbols || [];
}

export function updateWatchlistStore(symbols: string[]): string[] {
  inMemoryStore.watchlistSymbols = symbols;
  saveStore();
  return inMemoryStore.watchlistSymbols;
}
