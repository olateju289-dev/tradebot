require('dotenv').config();
const cron       = require('node-cron');
const mongoose   = require('mongoose');
const config     = require('./config');
const logger     = require('./utils/logger');
const exchange   = require('./exchange/client');
const strategy   = require('./strategies/movingAverageCrossover');
const orders     = require('./execution/orderManager');
const riskMgr    = require('./risk/riskManager');

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
async function connectDB() {
  await mongoose.connect(config.mongo.uri);
  logger.info(`MongoDB connected: ${config.mongo.uri}`);
}

// ─── Main trading tick ────────────────────────────────────────────────────────
async function tick() {
  const { symbol, timeframe } = config.trading;
  logger.info(`── Tick | ${symbol} | ${timeframe} ──────────────────`);

  try {
    // 1. Check SL/TP on any open position first
    await orders.checkExits(symbol);

    // 2. Check daily loss limit
    const balance = await exchange.getBalance('USDT');
    const dailyBreached = await riskMgr.isDailyLossBreached(balance);
    if (dailyBreached) {
      logger.warn('Daily loss limit hit — skipping this tick.');
      return;
    }

    // 3. Fetch candles and run strategy
    const candles = await exchange.getCandles(symbol, timeframe, 100);
    const signal  = strategy.analyze(candles);

    // 4. Execute signal
    if (signal === 'BUY') {
      await orders.executeBuy(symbol);
    } else if (signal === 'SELL') {
      await orders.executeSell(symbol);
    }

  } catch (err) {
    logger.error(`Tick error: ${err.message}`);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function start() {
  logger.info('╔══════════════════════════════════╗');
  logger.info('║        TRADEBOT STARTING         ║');
  logger.info(`║  Symbol   : ${config.trading.symbol.padEnd(20)}║`);
  logger.info(`║  Timeframe: ${config.trading.timeframe.padEnd(20)}║`);
  logger.info(`║  Mode     : ${(config.exchange.paperTrade ? 'PAPER TRADE' : '⚠ LIVE').padEnd(20)}║`);
  logger.info('╚══════════════════════════════════╝');

  await connectDB();

  // Run once immediately on start
  await tick();

  // Then schedule recurring ticks
  cron.schedule(config.cron.schedule, async () => {
    await tick();
  });

  logger.info(`Bot scheduled: ${config.cron.schedule}`);
}

start().catch(err => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
