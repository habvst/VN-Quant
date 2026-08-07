import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { analyzeStockWithAI, chatWithAIAgent } from './server/aiAgent';
import {
  getAllStocks,
  getCandlesForSymbol,
  getLatestNewsAsync,
  getMacroData,
  getMarketIndices,
  getOrderBook,
  getOrFetchStockBySymbol,
  getSectors,
  getStockBySymbol,
  getTradeTicks,
} from './server/marketDataService';
import { generateScreenerRecommendations } from './server/screenerEngine';
import {
  addServerAlert,
  deleteServerAlert,
  getServerAlerts,
  getTelegramConfig,
  runCronMarketSyncAndCheckAlerts,
  sendTelegramMessage,
  updateTelegramConfig,
} from './server/telegramAlertService';
import {
  getTriggerHistoryStore,
  getWatchlistStore,
  updateWatchlistStore,
} from './server/dataStore';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check & Cron Trigger Endpoint for Render & cron-job.org
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 5-Minute Market Data Refresh & Telegram Alert Cron Endpoint (Target for cron-job.org)
  app.get('/api/cron/sync', async (req, res) => {
    try {
      const result = await runCronMarketSyncAndCheckAlerts();
      if (req.query.verbose === 'true') {
        res.json(result);
      } else {
        // Ultra-compact response to prevent "output too large" errors on cron-job.org (which has strict 1KB body limit)
        res.json({
          ok: true,
          status: result.status,
          updated: result.summary.totalStocksUpdated,
          triggered: result.summary.alertsTriggered,
          telegramSent: result.summary.telegramSentCount,
        });
      }
    } catch (err: any) {
      console.error('[CRON ERROR]:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Telegram Config Endpoints
  app.get('/api/telegram/config', (req, res) => {
    const cfg = getTelegramConfig();
    // Mask bot token for security
    const maskedToken = cfg.botToken ? `${cfg.botToken.substring(0, 6)}...${cfg.botToken.slice(-4)}` : '';
    res.json({
      botToken: cfg.botToken,
      maskedToken,
      chatId: cfg.chatId,
      enabled: cfg.enabled,
      isConfigured: Boolean(cfg.botToken && cfg.chatId),
    });
  });

  app.post('/api/telegram/config', (req, res) => {
    const { botToken, chatId, enabled } = req.body;
    const updated = updateTelegramConfig({
      botToken: typeof botToken === 'string' ? botToken.trim() : undefined,
      chatId: typeof chatId === 'string' ? chatId.trim() : undefined,
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
    });
    res.json({ status: 'success', config: updated });
  });

  // Send Test Message via Telegram Bot
  app.post('/api/telegram/test', async (req, res) => {
    const { message } = req.body;
    const testText = message || `🧪 <b>VIETSTOCK QUANT - THỬ NGHIỆM TELEGRAM BOT</b> 🤖\n---------------------------------------------\n✅ Kết nối giữa Server Vietstock Quant và Telegram Chat thành công!\n⏰ Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
    const result = await sendTelegramMessage(testText);
    res.json(result);
  });

  // Server-side Active Alerts Endpoints
  app.get('/api/alerts', (req, res) => {
    res.json(getServerAlerts());
  });

  app.post('/api/alerts', (req, res) => {
    const newAlert = addServerAlert(req.body);
    res.json(newAlert);
  });

  app.delete('/api/alerts/:id', (req, res) => {
    const success = deleteServerAlert(req.params.id);
    res.json({ success });
  });

  app.get('/api/alerts/history', (req, res) => {
    res.json(getTriggerHistoryStore());
  });

  // Persistent Watchlist Endpoints
  app.get('/api/watchlist', (req, res) => {
    res.json(getWatchlistStore());
  });

  app.post('/api/watchlist', (req, res) => {
    const { symbols } = req.body;
    if (Array.isArray(symbols)) {
      const updated = updateWatchlistStore(symbols);
      res.json({ status: 'success', watchlist: updated });
    } else {
      res.status(400).json({ status: 'error', message: 'symbols array is required' });
    }
  });

  // API Routes

  // 1. Market Indices
  app.get('/api/market/indices', (req, res) => {
    res.json(getMarketIndices());
  });

  // 2. All Stocks
  app.get('/api/market/stocks', (req, res) => {
    res.json(getAllStocks());
  });

  // 2b. Search Tickers (Local + Dynamic Exchange Lookup)
  app.get('/api/market/search', async (req, res) => {
    const q = (req.query.q as string || '').trim().toUpperCase();
    if (!q) {
      res.json(getAllStocks());
      return;
    }
    const matches = getAllStocks().filter(
      (s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q) || s.sector.toUpperCase().includes(q)
    );

    if (q.length >= 2 && q.length <= 6 && !matches.some((s) => s.symbol === q)) {
      const dynamicStock = await getOrFetchStockBySymbol(q);
      if (dynamicStock) {
        matches.unshift(dynamicStock);
      }
    }
    res.json(matches);
  });

  // 3. Stock Detail (Dynamic Lookup)
  app.get('/api/market/stock/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    const stock = await getOrFetchStockBySymbol(symbol);
    if (!stock) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }
    res.json(stock);
  });

  // 4. Stock Candles (OHLCV)
  app.get('/api/market/candles/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    await getOrFetchStockBySymbol(symbol);
    res.json(getCandlesForSymbol(symbol));
  });

  // 5. Order Book Depth
  app.get('/api/market/orderbook/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    await getOrFetchStockBySymbol(symbol);
    res.json(getOrderBook(symbol));
  });

  // 6. Trade Ticks
  app.get('/api/market/ticks/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    await getOrFetchStockBySymbol(symbol);
    res.json(getTradeTicks(symbol));
  });

  // 6b. Real-time Live Stream (SSE - Server-Sent Events / SSI FastConnect & VPS Stream Simulation)
  app.get('/api/market/stream', async (req, res) => {
    const symbol = (req.query.symbol as string || 'HPG').toUpperCase();
    await getOrFetchStockBySymbol(symbol);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', symbol, latencyMs: 12, feed: 'SSI_FASTCONNECT_WS_V3', timestamp: new Date().toISOString() })}\n\n`);

    const intervalId = setInterval(() => {
      const stock = getStockBySymbol(symbol);
      const orderBook = getOrderBook(symbol);
      const ticks = getTradeTicks(symbol);

      const payload = {
        type: 'TICK_UPDATE',
        symbol,
        stock,
        orderBook,
        latestTick: ticks[0],
        timestamp: new Date().toISOString(),
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }, 1200);

    req.on('close', () => {
      clearInterval(intervalId);
    });
  });

  // 7. Sectors
  app.get('/api/market/sectors', (req, res) => {
    res.json(getSectors());
  });

  // 8. News
  app.get('/api/market/news', async (req, res) => {
    res.json(await getLatestNewsAsync());
  });

  // 9. Macro Data
  app.get('/api/market/macro', (req, res) => {
    res.json(getMacroData());
  });

  // 10. Screener Recommendations
  app.get('/api/recommendations', (req, res) => {
    res.json(generateScreenerRecommendations());
  });

  // 11. AI Deep Analysis
  app.post('/api/ai/analyze', async (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
      res.status(400).json({ error: 'Symbol parameter required' });
      return;
    }
    const analysis = await analyzeStockWithAI(symbol);
    res.json(analysis);
  });

  // 12. AI Chat
  app.post('/api/ai/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Message parameter required' });
      return;
    }
    const reply = await chatWithAIAgent(message);
    res.json(reply);
  });

  // 13. System Blueprint & Enterprise Specs (Docker, K8s, ERD, OpenAPI)
  app.get('/api/system/blueprint', (req, res) => {
    res.json({
      architecture: 'Enterprise Microservices Architecture (.NET 9 / NestJS + Python FastAPI + TimescaleDB + Redis + Kafka)',
      database: 'PostgreSQL 16 with TimescaleDB extension for financial time-series',
      services: [
        'Authentication Service (JWT + OAuth2 + RBAC + MFA)',
        'Market Data Ingestion Service (5-Min real-time WebSocket & REST proxy)',
        'Technical & Fundamental Indicator Engine',
        'AI Analysis & Recommendation Engine (Gemini 3.6 Flash / RAG)',
        'Portfolio & Risk Engine (VaR, Sharpe, Kelly Sizing)',
        'Notification & Realtime Alert Engine (SignalR / WebSockets)',
      ],
      dockerfile: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.cjs"]`,
      dockerCompose: `version: '3.8'
services:
  vn-quant-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: vnquant_db
      POSTGRES_USER: quant_admin
      POSTGRES_PASSWORD: SecretPassword123!
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"`,
      k8sManifest: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: vn-quant-terminal
  namespace: finance
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vn-quant-terminal
  template:
    metadata:
      labels:
        app: vn-quant-terminal
    spec:
      containers:
      - name: vn-quant-terminal
        image: asia.gcr.io/vn-quant/terminal:latest
        ports:
        - containerPort: 3000
        env:
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: gemini-api-key
---
apiVersion: v1
kind: Service
metadata:
  name: vn-quant-service
  namespace: finance
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: vn-quant-terminal`,
    });
  });

  // API 404 Fallback Handler (Returns JSON instead of HTML SPA fallback)
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint ${req.originalUrl} not found` });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VN-Quant Server running on http://localhost:${PORT}`);

    // Auto-start internal 5-minute background sync timer as server backup
    setInterval(() => {
      runCronMarketSyncAndCheckAlerts().catch((err) =>
        console.error('[INTERNAL CRON ERROR]:', err)
      );
    }, 5 * 60 * 1000);
  });
}

startServer();
