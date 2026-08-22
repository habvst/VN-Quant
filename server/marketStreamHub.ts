import { Response } from 'express';
import {
  getAllStocks,
  getMarketIndices,
  getOrderBook,
  getOrFetchStockBySymbol,
  getStockBySymbol,
  getTradeTicks,
} from './marketDataService';
import { OrderBook, StockData, TradeTick, MarketIndex } from '../src/types';
import { getVietnamTimeString } from './timeUtils';

export interface StreamClient {
  id: string;
  res: Response;
  symbols: Set<string>;
  channels: Set<'stock' | 'orderbook' | 'ticks' | 'indices'>;
  activeSymbol: string;
  lastPingTime: number;
}

class MarketStreamHub {
  private clients: Map<string, StreamClient> = new Map();
  private streamIntervalId: NodeJS.Timeout | null = null;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private simulatedTickSeq = 0;

  constructor() {
    this.startStreamBroadcast();
    this.startHeartbeatDaemon();
  }

  /**
   * Register a new SSE Client Connection
   */
  public registerClient(
    clientId: string,
    res: Response,
    initialSymbol = 'HPG',
    channels: string[] = ['stock', 'orderbook', 'ticks', 'indices']
  ): StreamClient {
    // If client ID already exists, close previous
    if (this.clients.has(clientId)) {
      try {
        this.clients.get(clientId)?.res.end();
      } catch {}
    }

    const channelSet = new Set<'stock' | 'orderbook' | 'ticks' | 'indices'>(
      channels.filter((c): c is 'stock' | 'orderbook' | 'ticks' | 'indices' =>
        ['stock', 'orderbook', 'ticks', 'indices'].includes(c)
      )
    );

    const client: StreamClient = {
      id: clientId,
      res,
      symbols: new Set([initialSymbol.toUpperCase()]),
      channels: channelSet.size > 0 ? channelSet : new Set(['stock', 'orderbook', 'ticks', 'indices']),
      activeSymbol: initialSymbol.toUpperCase(),
      lastPingTime: Date.now(),
    };

    this.clients.set(clientId, client);

    // Setup SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering in Nginx
    res.flushHeaders();

    // Send initial snapshot immediately
    this.sendInitialSnapshot(client);

    return client;
  }

  /**
   * Remove client when disconnected
   */
  public removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
    }
  }

  /**
   * 2-Way Command: Update dynamic subscriptions for client without reconnecting
   */
  public updateClientSubscription(
    clientId: string,
    activeSymbol?: string,
    channels?: string[]
  ): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    if (activeSymbol) {
      const sym = activeSymbol.toUpperCase();
      client.activeSymbol = sym;
      client.symbols.add(sym);
      // Fetch symbol data if missing
      getOrFetchStockBySymbol(sym).then(() => {
        this.sendSymbolSnapshot(client, sym);
      });
    }

    if (Array.isArray(channels)) {
      client.channels = new Set<'stock' | 'orderbook' | 'ticks' | 'indices'>(
        channels.filter((c): c is 'stock' | 'orderbook' | 'ticks' | 'indices' =>
          ['stock', 'orderbook', 'ticks', 'indices'].includes(c)
        )
      );
    }

    return true;
  }

  /**
   * Get total active streaming clients
   */
  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Send Initial Snapshot to a newly connected client
   */
  private sendInitialSnapshot(client: StreamClient): void {
    try {
      const sym = client.activeSymbol;
      const stock = getStockBySymbol(sym);
      const orderBook = getOrderBook(sym);
      const ticks = getTradeTicks(sym);
      const indices = getMarketIndices();

      this.sendEvent(client, 'INIT', {
        clientId: client.id,
        symbol: sym,
        stock,
        orderBook,
        ticks,
        indices,
        serverTime: new Date().toISOString(),
        feed: 'VNQUANT_ENTERPRISE_SSE_V2',
        latencyMs: 10,
      });
    } catch (err) {
      console.warn(`[SSE Hub] Error sending initial snapshot to ${client.id}:`, err);
    }
  }

  /**
   * Send single symbol snapshot when switching active stock
   */
  private sendSymbolSnapshot(client: StreamClient, symbol: string): void {
    try {
      const stock = getStockBySymbol(symbol);
      const orderBook = getOrderBook(symbol);
      const ticks = getTradeTicks(symbol);

      this.sendEvent(client, 'SYMBOL_SWITCH', {
        symbol,
        stock,
        orderBook,
        ticks,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(`[SSE Hub] Error sending symbol snapshot:`, err);
    }
  }

  /**
   * Send formatted SSE event
   */
  private sendEvent(client: StreamClient, eventType: string, data: any): void {
    try {
      client.res.write(`event: ${eventType}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      this.removeClient(client.id);
    }
  }

  /**
   * High-Performance Real-Time Stream Broadcast Loop
   */
  private startStreamBroadcast(): void {
    if (this.streamIntervalId) clearInterval(this.streamIntervalId);

    // Broadcast tick updates every 1000ms
    this.streamIntervalId = setInterval(() => {
      if (this.clients.size === 0) return;

      this.simulatedTickSeq++;
      const timeStr = getVietnamTimeString();

      // 1. Group active symbols being observed by connected clients
      const activeSymbols = new Set<string>();
      this.clients.forEach((c) => {
        if (c.activeSymbol) activeSymbols.add(c.activeSymbol);
      });

      // 2. Compute live OrderBook and Tick updates for active symbols
      const symbolUpdates = new Map<string, { stock: StockData | undefined; orderBook: OrderBook; latestTick: TradeTick }>();

      activeSymbols.forEach((sym) => {
        const stock = getStockBySymbol(sym);
        const ob = getOrderBook(sym);
        const currentPrice = stock ? stock.price : 25.0;

        // Generate dynamic micro tick strictly anchored to real market execution price
        const isBuy = Math.random() > 0.45;
        const matchPrice = currentPrice;
        const matchVol = Math.floor(1000 + Math.random() * 15000);

        const latestTick: TradeTick = {
          id: `live-tick-${this.simulatedTickSeq}-${Date.now()}`,
          time: timeStr,
          price: matchPrice,
          volume: matchVol,
          type: isBuy ? 'BUY' : 'SELL',
        };

        symbolUpdates.set(sym, { stock, orderBook: ob, latestTick });
      });

      // 3. Get Indices Update periodically
      const indices = getMarketIndices();

      // 4. Dispatch to each connected client according to their subscription
      this.clients.forEach((client) => {
        const sym = client.activeSymbol;
        const update = symbolUpdates.get(sym);

        if (update) {
          // Send OrderBook & Tick
          if (client.channels.has('orderbook') || client.channels.has('ticks')) {
            this.sendEvent(client, 'TICK_UPDATE', {
              symbol: sym,
              stock: update.stock,
              orderBook: update.orderBook,
              latestTick: update.latestTick,
              timestamp: timeStr,
            });
          }
        }

        // Send Indices update every 3 cycles
        if (this.simulatedTickSeq % 3 === 0 && client.channels.has('indices')) {
          this.sendEvent(client, 'INDICES_UPDATE', {
            indices,
            timestamp: timeStr,
          });
        }
      });
    }, 1000);
  }

  /**
   * Heartbeat Ping Daemon (Every 12 seconds to keep connections alive and check latency)
   */
  private startHeartbeatDaemon(): void {
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);

    this.heartbeatIntervalId = setInterval(() => {
      if (this.clients.size === 0) return;

      const pingPayload = {
        type: 'HEARTBEAT',
        serverTime: Date.now(),
        activeClients: this.clients.size,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      };

      this.clients.forEach((client) => {
        this.sendEvent(client, 'PING', pingPayload);
      });
    }, 12000);
  }
}

export const marketStreamHub = new MarketStreamHub();
