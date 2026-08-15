import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { analyzeBatchNewsSentiment, analyzeStockNewsSentiment, analyzeStockWithAI, chatWithAIAgent } from './server/aiAgent';
import { analyzeNewsDeepAI } from './server/newsSentimentEngine';
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
  getWatchlistSentinelConfigStore,
  updateWatchlistSentinelConfigStore,
  getPortfolioPositionsStore,
  updatePortfolioPositionsStore,
} from './server/dataStore';
import {
  runWatchlistSentinelScan,
  startWatchlistSentinelDaemon,
  evaluateWatchlistStockSignals,
  formatWatchlistTelegramAlert,
  formatPortfolioTelegramAlert,
  formatMarketOpportunityTelegramAlert,
} from './server/watchlistSentinelService';

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

  // Telegram Config Endpoints (Full 4-Tier & Smart Filters)
  app.get('/api/telegram/config', (req, res) => {
    const cfg = getTelegramConfig();
    // Mask bot token for security
    const maskedToken = cfg.botToken ? `${cfg.botToken.substring(0, 6)}...${cfg.botToken.slice(-4)}` : '';
    res.json({
      botToken: cfg.botToken,
      maskedToken,
      chatId: cfg.chatId,
      enabled: cfg.enabled,
      enableP1Portfolio: cfg.enableP1Portfolio !== false,
      enableP2CustomAlerts: cfg.enableP2CustomAlerts !== false,
      enableP3Watchlist: cfg.enableP3Watchlist !== false,
      enableP4MarketOpportunities: Boolean(cfg.enableP4MarketOpportunities),
      filterVolumeSurgeOnly: Boolean(cfg.filterVolumeSurgeOnly),
      filterStopLossTakeProfitOnly: Boolean(cfg.filterStopLossTakeProfitOnly),
      filterBreakoutOnly: Boolean(cfg.filterBreakoutOnly),
      minPriceChangePercent: cfg.minPriceChangePercent ?? 0,
      cooldownMinutes: cfg.cooldownMinutes ?? 120,
      isConfigured: Boolean(cfg.botToken && cfg.chatId),
    });
  });

  app.post('/api/telegram/config', (req, res) => {
    const {
      botToken,
      chatId,
      enabled,
      enableP1Portfolio,
      enableP2CustomAlerts,
      enableP3Watchlist,
      enableP4MarketOpportunities,
      filterVolumeSurgeOnly,
      filterStopLossTakeProfitOnly,
      filterBreakoutOnly,
      minPriceChangePercent,
      cooldownMinutes,
    } = req.body;

    const updated = updateTelegramConfig({
      botToken: typeof botToken === 'string' ? botToken.trim() : undefined,
      chatId: typeof chatId === 'string' ? chatId.trim() : undefined,
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
      enableP1Portfolio: typeof enableP1Portfolio === 'boolean' ? enableP1Portfolio : undefined,
      enableP2CustomAlerts: typeof enableP2CustomAlerts === 'boolean' ? enableP2CustomAlerts : undefined,
      enableP3Watchlist: typeof enableP3Watchlist === 'boolean' ? enableP3Watchlist : undefined,
      enableP4MarketOpportunities: typeof enableP4MarketOpportunities === 'boolean' ? enableP4MarketOpportunities : undefined,
      filterVolumeSurgeOnly: typeof filterVolumeSurgeOnly === 'boolean' ? filterVolumeSurgeOnly : undefined,
      filterStopLossTakeProfitOnly: typeof filterStopLossTakeProfitOnly === 'boolean' ? filterStopLossTakeProfitOnly : undefined,
      filterBreakoutOnly: typeof filterBreakoutOnly === 'boolean' ? filterBreakoutOnly : undefined,
      minPriceChangePercent: typeof minPriceChangePercent === 'number' ? minPriceChangePercent : undefined,
      cooldownMinutes: typeof cooldownMinutes === 'number' ? cooldownMinutes : undefined,
    });
    res.json({ status: 'success', config: updated });
  });

  // Send Test Message via Telegram Bot (General)
  app.post('/api/telegram/test', async (req, res) => {
    const { message } = req.body;
    const testText = message || `🧪 <b>VIETSTOCK QUANT - THỬ NGHIỆM TELEGRAM BOT</b> 🤖\n---------------------------------------------\n✅ Kết nối giữa Server Vietstock Quant và Telegram Chat thành công!\n⏰ Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
    const result = await sendTelegramMessage(testText);
    res.json(result);
  });

  // Send Test Message for Specific Priority Tier (P1, P2, P3, P4)
  app.post('/api/telegram/test-tier', async (req, res) => {
    try {
      const { tier, symbol } = req.body;
      const targetSymbol = (symbol || (tier === 'P1' ? 'HPG' : tier === 'P2' ? 'SSI' : tier === 'P4' ? 'FPT' : 'VCB')).toUpperCase();
      const stock = (await getOrFetchStockBySymbol(targetSymbol)) || getAllStocks()[0];

      if (!stock) {
        return res.status(404).json({ status: 'error', message: `Stock ${targetSymbol} not found` });
      }

      let formattedHtml = '';
      if (tier === 'P1') {
        const samplePos = {
          symbol: stock.symbol,
          buyPrice: Number((stock.price * 1.08).toFixed(2)),
          quantity: 2500,
          stopLossPrice: Number((stock.price * 1.01).toFixed(2)),
          targetPrice: Number((stock.price * 1.25).toFixed(2)),
        };
        const sampleSignal = {
          symbol: stock.symbol,
          tier: 'P1' as const,
          type: 'PORTFOLIO_STOP_LOSS' as const,
          headerBadge: '🚨 <b>[P1 - DANH MỤC ĐANG SỞ HỮU] CẢNH BÁO VI PHẠM CẮT LỖ KHẨN CẤP!</b>',
          indicatorName: `Chạm ngưỡng Cắt Lỗ: Thị giá ${stock.price.toFixed(2)}k &le; Ngưỡng SL ${samplePos.stopLossPrice}k (Lỗ: -7.4%)`,
          description: `Cổ phiếu #${stock.symbol} trong danh mục thực tế của bạn đã vi phạm ngưỡng cắt lỗ bảo toàn vốn. Khối lượng nắm giữ: 2,500 CP.`,
          severity: 'DANGER' as const,
          recommendation: `KÍCH HOẠT LỆNH BÁN CẮT LỖ NGAY để bảo vệ tổng NAV. Tuyệt đối không gồng lỗ hoặc bắt đáy trung bình giá xuống!`,
          signature: `TEST_P1_${stock.symbol}`,
        };
        formattedHtml = formatPortfolioTelegramAlert(samplePos, stock, sampleSignal);
      } else if (tier === 'P4') {
        const sampleSignal = {
          symbol: stock.symbol,
          tier: 'P4' as const,
          type: 'MARKET_OPPORTUNITY' as const,
          headerBadge: '💡 <b>[P4 - CƠ HỘI THỊ TRƯỜNG] AI SMART MONEY TOP PICK</b>',
          indicatorName: `Quant Score: 92/100 | Smart Money: Gom hàng mạnh mẽ`,
          description: `Mã CP #${stock.symbol} bùng nổ điểm định lượng 92/100 kèm dòng tiền cá mập vào ròng đột biến. Xác suất sinh lời vượt trội VN-Index.`,
          severity: 'SUCCESS' as const,
          recommendation: `Đề xuất thêm vào Watchlist hoặc giải ngân thăm dò 15-20% NAV.`,
          signature: `TEST_P4_${stock.symbol}`,
        };
        formattedHtml = formatMarketOpportunityTelegramAlert(stock, sampleSignal);
      } else {
        // Tier P3 or default
        const sampleSignal = {
          symbol: stock.symbol,
          tier: 'P3' as const,
          type: 'RSI_CROSSOVER' as const,
          headerBadge: '✨ <b>[P3 - DANH MỤC QUAN TÂM] RSI ĐẢO CHIỀU TẠO ĐÁY (BULLISH REVERSAL)</b>',
          indicatorName: `RSI(14) = ${stock.technical.rsi14.toFixed(1)} (Bứt phá cắt lên mốc Quá Bán 30)`,
          description: `RSI(14) vừa bứt phá cắt lên trên mốc 30 kèm xung lực hồi phục (+${stock.changePercent.toFixed(2)}%). Đây là điểm đảo chiều tạo đáy chuẩn theo trường phái Phân tích Kỹ thuật Quant.`,
          severity: 'SUCCESS' as const,
          recommendation: `Mở vị thế mua gom thăm dò 40% NAV quanh vùng giá hiện tại. Đặt mục tiêu TP1 (+12%) và quản trị rủi ro cắt lỗ nếu gãy đáy ngắn hạn.`,
          signature: `TEST_P3_${stock.symbol}`,
        };
        formattedHtml = formatWatchlistTelegramAlert(stock, sampleSignal);
      }

      const sendRes = await sendTelegramMessage(formattedHtml);
      res.json({
        status: 'success',
        tier,
        symbol: stock.symbol,
        telegramResult: sendRes,
        previewMessage: formattedHtml,
      });
    } catch (err: any) {
      console.error('[TEST TIER ALERT ERROR]:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Portfolio Positions Server Endpoints (For P1 Sentinel Integration)
  app.get('/api/portfolio/positions', (req, res) => {
    res.json(getPortfolioPositionsStore());
  });

  app.post('/api/portfolio/sync', (req, res) => {
    const { positions } = req.body;
    if (Array.isArray(positions)) {
      const sanitized = positions.map((p) => ({
        symbol: String(p.symbol || '').toUpperCase(),
        buyPrice: Number(p.buyPrice || p.avgPrice || p.price || 0),
        quantity: Number(p.quantity || p.shares || 100),
        stopLossPrice: p.stopLossPrice ? Number(p.stopLossPrice) : undefined,
        targetPrice: p.targetPrice ? Number(p.targetPrice) : undefined,
        trailingStopPercent: p.trailingStopPercent ? Number(p.trailingStopPercent) : undefined,
        tradeDate: p.tradeDate || new Date().toISOString(),
      })).filter((p) => p.symbol.length > 0 && p.buyPrice > 0);

      const updated = updatePortfolioPositionsStore(sanitized);
      console.log(`[PORTFOLIO SYNC] 💼 Đã đồng bộ ${updated.length} vị thế nắm giữ lên Server Sentinel.`);
      res.json({ status: 'success', count: updated.length, positions: updated });
    } else {
      res.status(400).json({ status: 'error', message: 'positions array is required' });
    }
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

  // Watchlist Sentinel Automated Alert Monitor Endpoints
  app.get('/api/watchlist/sentinel/config', (req, res) => {
    res.json(getWatchlistSentinelConfigStore());
  });

  app.post('/api/watchlist/sentinel/config', (req, res) => {
    const updated = updateWatchlistSentinelConfigStore(req.body);
    res.json({ status: 'success', config: updated });
  });

  app.post('/api/watchlist/sentinel/scan', async (req, res) => {
    try {
      const forceSendAll = Boolean(req.body?.forceSendAll);
      const report = await runWatchlistSentinelScan({ forceSendAll });
      res.json({ status: 'success', report });
    } catch (err: any) {
      console.error('[SENTINEL SCAN ERROR]:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/watchlist/sentinel/test-alert', async (req, res) => {
    try {
      const { symbol } = req.body;
      const targetSymbol = (symbol || 'SSI').toUpperCase();
      const stock = (await getOrFetchStockBySymbol(targetSymbol)) || getAllStocks()[0];

      if (!stock) {
        return res.status(404).json({ status: 'error', message: `Stock ${targetSymbol} not found` });
      }

      // Generate a representative indicator signal for testing
      const sampleSignal = {
        symbol: stock.symbol,
        tier: 'P3' as const,
        type: 'RSI_CROSSOVER' as const,
        headerBadge: '✨ <b>[P3 - DANH MỤC QUAN TÂM] RSI ĐẢO CHIỀU TẠO ĐÁY (BULLISH REVERSAL)</b>',
        indicatorName: `RSI(14) = ${stock.technical.rsi14.toFixed(1)} (Cắt lên vùng Quá Bán 30)`,
        description: `RSI(14) vừa bứt phá cắt lên trên mốc 30 kèm xung lực giá hồi phục (+${stock.changePercent.toFixed(2)}%). Đây là điểm đảo chiều tạo đáy chuẩn theo trường phái Phân tích Kỹ thuật Quant.`,
        severity: 'SUCCESS' as const,
        recommendation: `Mở vị thế mua gom thăm dò 40% NAV quanh vùng giá hiện tại. Đặt mục tiêu TP1 (+12%) và quản trị rủi ro cắt lỗ nếu gãy đáy ngắn hạn.`,
        signature: `TEST_RSI_CROSSOVER_${stock.symbol}_${Date.now()}`,
      };

      const formattedHtml = formatWatchlistTelegramAlert(stock, sampleSignal);
      const sendRes = await sendTelegramMessage(formattedHtml);

      res.json({
        status: 'success',
        symbol: stock.symbol,
        telegramResult: sendRes,
        previewMessage: formattedHtml,
      });
    } catch (err: any) {
      console.error('[SENTINEL TEST ALERT ERROR]:', err);
      res.status(500).json({ status: 'error', message: err.message });
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

  // 12b. Gemini AI News Sentiment Analysis (Single & Batch)
  app.post('/api/ai/news-sentiment', async (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
      res.status(400).json({ error: 'Symbol parameter required' });
      return;
    }
    const sentiment = await analyzeStockNewsSentiment(symbol);
    res.json(sentiment);
  });

  app.post('/api/ai/news-sentiment/batch', async (req, res) => {
    const { symbols } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      res.status(400).json({ error: 'symbols array parameter required' });
      return;
    }
    const batchResults = await analyzeBatchNewsSentiment(symbols);
    res.json(batchResults);
  });

  // 12c. Deep Sentiment & Authenticity & Price Impact 5-Session AI Model
  app.post('/api/ai/news-deep-analyze', async (req, res) => {
    const { newsId, title } = req.body;
    if (!newsId && !title) {
      res.status(400).json({ error: 'newsId or title parameter required' });
      return;
    }
    const result = await analyzeNewsDeepAI(newsId || '', title);
    res.json(result);
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

    // Auto-start Watchlist Sentinel Daemon for technical indicator monitoring
    try {
      startWatchlistSentinelDaemon();
    } catch (daemonErr) {
      console.error('[WATCHLIST SENTINEL DAEMON START ERROR]:', daemonErr);
    }

    // Auto-start internal 5-minute background sync timer as server backup
    setInterval(() => {
      runCronMarketSyncAndCheckAlerts().catch((err) =>
        console.error('[INTERNAL CRON ERROR]:', err)
      );
    }, 5 * 60 * 1000);
  });
}

startServer();
