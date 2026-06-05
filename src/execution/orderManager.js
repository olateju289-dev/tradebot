const exchangeClient = require('../exchange/client');
const riskManager    = require('../risk/riskManager');
const Trade          = require('../models/Trade');
const config         = require('../config');
const logger         = require('../utils/logger');

class OrderManager {
  constructor() {
    this.openTrade = null; // Tracks current open position in memory
  }

  async hasOpenPosition() {
    if (this.openTrade) return true;
    // Also check DB in case the bot restarted
    const trade = await Trade.findOne({ status: 'open' });
    if (trade) this.openTrade = trade;
    return !!trade;
  }

  async executeBuy(symbol) {
    if (await this.hasOpenPosition()) {
      logger.info('Skipping BUY — already in a position.');
      return;
    }

    const [base, quote] = symbol.split('/');
    const balance  = await exchangeClient.getBalance(quote);  // e.g. USDT
    const price    = await exchangeClient.getPrice(symbol);
    const amount   = riskManager.calcPositionSize(balance, price);

    if (amount <= 0) {
      logger.warn('Insufficient balance to open a position.');
      return;
    }

    let orderId = null;

    if (!config.exchange.paperTrade) {
      const order = await exchangeClient.placeOrder(symbol, 'buy', amount);
      orderId = order.id;
    } else {
      logger.info(`[PAPER] BUY ${amount} ${base} @ ${price} USDT`);
    }

    const trade = await Trade.create({
      symbol,
      side: 'buy',
      price,
      amount,
      cost: price * amount,
      orderId,
      paperTrade: config.exchange.paperTrade,
      signal: 'MA_CROSSOVER_BUY',
    });

    this.openTrade = trade;
    logger.info(`Trade recorded | ID: ${trade._id}`);
  }

  async executeSell(symbol, reason = 'SIGNAL') {
    if (!(await this.hasOpenPosition())) {
      logger.info('Skipping SELL — no open position.');
      return;
    }

    const price    = await exchangeClient.getPrice(symbol);
    const currency = symbol.split('/')[0]; // XRP from XRP/USDT

    // Use actual exchange balance instead of recorded amount
    const actualBalance = await exchangeClient.getBalance(currency);
    const amount        = actualBalance;

    if (!config.exchange.paperTrade) {
      await exchangeClient.placeOrder(symbol, 'sell', amount);
    } else {
      logger.info(`[PAPER] SELL ${amount} @ ${price} USDT`);
    }

    const pnl = (price - this.openTrade.price) * amount;

    await Trade.findByIdAndUpdate(this.openTrade._id, {
      status:   'closed',
      closedAt: new Date(),
      pnl,
      signal:   reason,
    });

    logger.info(`Position closed | PnL: ${pnl.toFixed(4)} USDT | Reason: ${reason}`);
    this.openTrade = null;
  }

  // Called every tick to check SL/TP regardless of strategy signal
  async checkExits(symbol) {
    if (!(await this.hasOpenPosition())) return;

    const currentPrice = await exchangeClient.getPrice(symbol);
    const exitReason   = riskManager.checkExitCondition(this.openTrade, currentPrice);

    if (exitReason) {
      await this.executeSell(symbol, exitReason);
    }
  }
}

module.exports = new OrderManager();
