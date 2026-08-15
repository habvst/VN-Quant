import fs from 'fs';
import path from 'path';
import { StockAlert } from '../src/types/alert';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  // 4-Tier Priority Level Toggles
  enableP1Portfolio?: boolean; // P1: Khẩn cấp - Danh mục đang sở hữu (Stop-Loss / Take-Profit / Drop)
  enableP2CustomAlerts?: boolean; // P2: Ưu tiên cao - Cảnh báo thủ công do người dùng tự đặt
  enableP3Watchlist?: boolean; // P3: Ưu tiên vừa - Danh mục quan tâm Watchlist (Sentinel Indicators)
  enableP4MarketOpportunities?: boolean; // P4: Thông tin - Cơ hội thị trường AI & Smart Money
  // Smart Filters
  filterVolumeSurgeOnly?: boolean; // Chỉ gửi khi khối lượng > 200% MA20
  filterStopLossTakeProfitOnly?: boolean; // Chỉ gửi khi chạm Stop-loss / Take-profit
  filterBreakoutOnly?: boolean; // Chỉ gửi khi có Breakout / Golden Cross
  minPriceChangePercent?: number; // Chỉ gửi khi biến động >= %
  // Deduplication & Cooldown Control
  cooldownMinutes?: number; // Thời gian chống lặp lại cùng tín hiệu (phút)
}

export interface PortfolioPositionStoreItem {
  symbol: string;
  buyPrice: number;
  quantity: number;
  stopLossPrice?: number;
  targetPrice?: number;
  trailingStopPercent?: number;
  tradeDate?: string;
}

export interface WatchlistSentinelConfig {
  enabled: boolean;
  autoScanIntervalSeconds: number;
  monitorRsi: boolean;
  monitorMa: boolean;
  monitorMacd: boolean;
  monitorVolumeSurge: boolean;
  monitorBreakout: boolean;
  rsiOversoldThreshold: number;
  rsiOverboughtThreshold: number;
}

export interface TriggerHistoryItem {
  id: string;
  symbol: string;
  alertId: string;
  message: string;
  tier?: 'P1' | 'P2' | 'P3' | 'P4';
  telegramSuccess: boolean;
  timestamp: string;
}

export interface CooldownRecord {
  lastSentAt: string;
  stateKey?: string;
  value?: number;
}

export interface AppDataStore {
  telegramConfig: TelegramConfig;
  watchlistSentinelConfig: WatchlistSentinelConfig;
  watchlistSignatures: Record<string, string>;
  cooldownEntries: Record<string, CooldownRecord>;
  serverAlerts: StockAlert[];
  portfolioPositions: PortfolioPositionStoreItem[];
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
    enableP1Portfolio: true,
    enableP2CustomAlerts: true,
    enableP3Watchlist: true,
    enableP4MarketOpportunities: false,
    cooldownMinutes: 120, // 2 hours default cooldown for indicator signals
  },
  watchlistSentinelConfig: {
    enabled: true,
    autoScanIntervalSeconds: 60,
    monitorRsi: true,
    monitorMa: true,
    monitorMacd: true,
    monitorVolumeSurge: true,
    monitorBreakout: true,
    rsiOversoldThreshold: 30,
    rsiOverboughtThreshold: 70,
  },
  watchlistSignatures: {},
  cooldownEntries: {},
  portfolioPositions: [],
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
        watchlistSentinelConfig: {
          ...DEFAULT_STORE.watchlistSentinelConfig,
          ...(parsed.watchlistSentinelConfig || {}),
        },
        watchlistSignatures: parsed.watchlistSignatures || {},
        cooldownEntries: parsed.cooldownEntries || {},
        portfolioPositions: Array.isArray(parsed.portfolioPositions) ? parsed.portfolioPositions : [],
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
    ...inMemoryStore.telegramConfig,
    botToken: process.env.TELEGRAM_BOT_TOKEN || inMemoryStore.telegramConfig.botToken,
    chatId: process.env.TELEGRAM_CHAT_ID || inMemoryStore.telegramConfig.chatId,
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

// 4. Portfolio Positions Accessors (P1: Real Holding Assets)
export function getPortfolioPositionsStore(): PortfolioPositionStoreItem[] {
  return inMemoryStore.portfolioPositions || [];
}

export function updatePortfolioPositionsStore(positions: PortfolioPositionStoreItem[]): PortfolioPositionStoreItem[] {
  inMemoryStore.portfolioPositions = positions;
  saveStore();
  return inMemoryStore.portfolioPositions;
}

// 5. Watchlist Accessors
export function getWatchlistStore(): string[] {
  return inMemoryStore.watchlistSymbols || [];
}

export function updateWatchlistStore(symbols: string[]): string[] {
  inMemoryStore.watchlistSymbols = symbols;
  saveStore();
  return inMemoryStore.watchlistSymbols;
}

// 6. Watchlist Sentinel Accessors
export function getWatchlistSentinelConfigStore(): WatchlistSentinelConfig {
  return inMemoryStore.watchlistSentinelConfig || DEFAULT_STORE.watchlistSentinelConfig;
}

export function updateWatchlistSentinelConfigStore(config: Partial<WatchlistSentinelConfig>): WatchlistSentinelConfig {
  inMemoryStore.watchlistSentinelConfig = {
    ...getWatchlistSentinelConfigStore(),
    ...config,
  };
  saveStore();
  return inMemoryStore.watchlistSentinelConfig;
}

export function getWatchlistSignaturesStore(): Record<string, string> {
  return inMemoryStore.watchlistSignatures || {};
}

export function setWatchlistSignatureStore(key: string, signature: string): void {
  if (!inMemoryStore.watchlistSignatures) {
    inMemoryStore.watchlistSignatures = {};
  }
  inMemoryStore.watchlistSignatures[key] = signature;
  saveStore();
}

export function clearWatchlistSignatureStore(key: string): void {
  if (inMemoryStore.watchlistSignatures && inMemoryStore.watchlistSignatures[key]) {
    delete inMemoryStore.watchlistSignatures[key];
    saveStore();
  }
}

// 7. Intelligent Deduplication & Cooldown Cache
export function getCooldownEntriesStore(): Record<string, CooldownRecord> {
  return inMemoryStore.cooldownEntries || {};
}

/**
 * Checks if a signal key is still within its active cooldown period (prevents duplicate spam)
 */
export function isSignalInCooldown(key: string, cooldownMinutes: number = 120): boolean {
  if (!inMemoryStore.cooldownEntries) {
    inMemoryStore.cooldownEntries = {};
    return false;
  }
  const entry = inMemoryStore.cooldownEntries[key];
  if (!entry || !entry.lastSentAt) {
    return false;
  }

  const lastSentTime = new Date(entry.lastSentAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - lastSentTime) / (1000 * 60);

  return elapsedMinutes < cooldownMinutes;
}

/**
 * Records a signal timestamp and state to enforce cooldown
 */
export function recordSignalSent(key: string, stateKey?: string, value?: number): void {
  if (!inMemoryStore.cooldownEntries) {
    inMemoryStore.cooldownEntries = {};
  }
  inMemoryStore.cooldownEntries[key] = {
    lastSentAt: new Date().toISOString(),
    stateKey,
    value,
  };
  saveStore();
}

/**
 * Clears cooldown when a condition resets (e.g. price drops back below trigger level)
 */
export function clearSignalCooldown(key: string): void {
  if (inMemoryStore.cooldownEntries && inMemoryStore.cooldownEntries[key]) {
    delete inMemoryStore.cooldownEntries[key];
    saveStore();
  }
}

