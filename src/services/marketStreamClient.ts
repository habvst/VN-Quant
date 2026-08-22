import { MarketIndex, OrderBook, StockData, TradeTick } from '../types';

export type StreamConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';

export interface TickUpdateEvent {
  symbol: string;
  stock?: StockData;
  orderBook: OrderBook;
  latestTick: TradeTick;
  timestamp: string;
}

export interface InitSnapshotEvent {
  clientId: string;
  symbol: string;
  stock?: StockData;
  orderBook: OrderBook;
  ticks: TradeTick[];
  indices: MarketIndex[];
  serverTime: string;
  feed: string;
  latencyMs: number;
}

type TickListener = (data: TickUpdateEvent) => void;
type IndicesListener = (indices: MarketIndex[]) => void;
type InitListener = (snapshot: InitSnapshotEvent) => void;
type StatusListener = (status: StreamConnectionStatus, latencyMs: number) => void;

class MarketStreamClient {
  private eventSource: EventSource | null = null;
  private clientId: string;
  private currentSymbol: string = 'HPG';
  private status: StreamConnectionStatus = 'OFFLINE';
  private latencyMs: number = 10;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private pingIntervalId: any = null;

  // Event Listeners Sets
  private tickListeners: Set<TickListener> = new Set();
  private indicesListeners: Set<IndicesListener> = new Set();
  private initListeners: Set<InitListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  constructor() {
    this.clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.connect();
    this.startPingLoop();
  }

  /**
   * Connect to Server-Sent Events Endpoint
   */
  public connect(symbol = this.currentSymbol): void {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    this.currentSymbol = symbol.toUpperCase();
    this.setStatus('RECONNECTING');

    const url = `/api/market/stream?clientId=${encodeURIComponent(this.clientId)}&symbol=${encodeURIComponent(this.currentSymbol)}&channels=stock,orderbook,ticks,indices`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('CONNECTED');
        this.measureLatency();
      };

      // 1. Initial Snapshot Event
      this.eventSource.addEventListener('INIT', (e: MessageEvent) => {
        try {
          const snapshot = JSON.parse(e.data) as InitSnapshotEvent;
          this.latencyMs = snapshot.latencyMs || 10;
          this.initListeners.forEach((fn) => fn(snapshot));
          if (snapshot.indices) {
            this.indicesListeners.forEach((fn) => fn(snapshot.indices));
          }
          this.notifyStatus();
        } catch (err) {
          console.warn('[StreamClient] Failed to parse INIT payload:', err);
        }
      });

      // 2. Real-time OrderBook & Tick Update Event
      this.eventSource.addEventListener('TICK_UPDATE', (e: MessageEvent) => {
        try {
          const update = JSON.parse(e.data) as TickUpdateEvent;
          this.tickListeners.forEach((fn) => fn(update));
        } catch (err) {
          console.warn('[StreamClient] Failed to parse TICK_UPDATE payload:', err);
        }
      });

      // 3. Symbol Switch Event
      this.eventSource.addEventListener('SYMBOL_SWITCH', (e: MessageEvent) => {
        try {
          const update = JSON.parse(e.data);
          if (update.orderBook && update.latestTick) {
            this.tickListeners.forEach((fn) => fn(update));
          }
        } catch (err) {}
      });

      // 4. Market Indices Update Event
      this.eventSource.addEventListener('INDICES_UPDATE', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data.indices)) {
            this.indicesListeners.forEach((fn) => fn(data.indices));
          }
        } catch (err) {}
      });

      // 5. Server Heartbeat Ping Event
      this.eventSource.addEventListener('PING', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.serverTime) {
            const now = Date.now();
            this.latencyMs = Math.max(4, Math.min(60, now - data.serverTime));
            this.notifyStatus();
          }
        } catch (err) {}
      });

      // Error / Disconnect Handler with Exponential Backoff
      this.eventSource.onerror = () => {
        this.setStatus('OFFLINE');
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts));
        this.reconnectAttempts++;

        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect(this.currentSymbol);
        }, delay);
      };
    } catch (err) {
      this.setStatus('OFFLINE');
    }
  }

  /**
   * Dynamic 2-Way Command: Switch watched stock symbol without disconnecting TCP connection
   */
  public async switchSymbol(symbol: string): Promise<void> {
    const sym = symbol.toUpperCase().trim();
    if (!sym || sym === this.currentSymbol) return;

    this.currentSymbol = sym;

    // Send 2-way subscription update request to server
    try {
      const res = await fetch('/api/market/stream/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.clientId,
          symbol: sym,
          channels: ['stock', 'orderbook', 'ticks', 'indices'],
        }),
      });

      if (!res.ok) {
        // Fallback: reconnect if client was not found
        this.connect(sym);
      }
    } catch (err) {
      console.warn('[StreamClient] Failed to send dynamic subscribe command, falling back to connect:', err);
      this.connect(sym);
    }
  }

  /**
   * Measure round-trip ping latency
   */
  public async measureLatency(): Promise<number> {
    const start = Date.now();
    try {
      const res = await fetch('/api/market/stream/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTimestamp: start }),
      });
      if (res.ok) {
        const data = await res.json();
        this.latencyMs = data.latencyMs || Date.now() - start;
        this.notifyStatus();
        return this.latencyMs;
      }
    } catch {}
    return this.latencyMs;
  }

  /**
   * Status updater
   */
  private setStatus(newStatus: StreamConnectionStatus): void {
    this.status = newStatus;
    this.notifyStatus();
  }

  private notifyStatus(): void {
    this.statusListeners.forEach((fn) => fn(this.status, this.latencyMs));
  }

  private startPingLoop(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = setInterval(() => {
      if (this.status === 'CONNECTED') {
        this.measureLatency();
      }
    }, 15000);
  }

  // Subscribe Listeners
  public onTickUpdate(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  public onIndicesUpdate(listener: IndicesListener): () => void {
    this.indicesListeners.add(listener);
    return () => this.indicesListeners.delete(listener);
  }

  public onInit(listener: InitListener): () => void {
    this.initListeners.add(listener);
    return () => this.initListeners.delete(listener);
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    // Trigger immediately with current status
    listener(this.status, this.latencyMs);
    return () => this.statusListeners.delete(listener);
  }

  public getStatus(): { status: StreamConnectionStatus; latencyMs: number; currentSymbol: string } {
    return {
      status: this.status,
      latencyMs: this.latencyMs,
      currentSymbol: this.currentSymbol,
    };
  }
}

// Export singleton instance
export const marketStreamClient = new MarketStreamClient();
