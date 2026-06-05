const config = require('../config');
const Trade = require('../models/Trade');
const logger = require('../utils/logger');

class RiskManager {
  /**
   * Calculate how many units to buy based on available balance + risk settings.
   * Never risks more than MAX_TRADE_PERCENT of the account per trade.
   */
  calcPositionSize(balance, price) {
    const riskableAmount = balance * config.risk.maxTradePercent;
    let amount = riskableAmount / price;

    // Bybit minimum BTC spot order is 0.000480 BTC
    const MIN_BTC = 0.000480;
    if (amount < MIN_BTC) {
      amount = MIN_BTC;
      logger.info(`Amount below minimum — using minimum: ${MIN_BTC} BTC`);
    }

    logger.info(`Position size: ${amount.toFixed(6)} (${(config.risk.maxTradePercent * 100)}% of ${balance.toFixed(2)} USDT @ ${price})`);
    return parseFloat(amount.toFixed(6));
  }

  /**
   * Stop-loss price: entry price minus the stop loss %.
   */
  calcStopLoss(entryPrice) {
    return entryPrice * (1 - config.risk.stopLossPercent);
  }

  /**
   * Take-profit price: entry price plus the take profit %.
   */
  calcTakeProfit(entryPrice) {
    return entryPrice * (1 + config.risk.takeProfitPercent);
  }

  /**
   * Check if current price hits stop-loss or take-profit for an open trade.
   * Returns 'STOP_LOSS' | 'TAKE_PROFIT' | null
   */
  checkExitCondition(trade, currentPrice) {
    const stopLoss   = this.calcStopLoss(trade.price);
    const takeProfit = this.calcTakeProfit(trade.price);

    if (currentPrice <= stopLoss) {
      logger.warn(`Stop-loss triggered! Entry: ${trade.price} | Current: ${currentPrice} | SL: ${stopLoss.toFixed(2)}`);
      return 'STOP_LOSS';
    }

    if (currentPrice >= takeProfit) {
      logger.info(`Take-profit triggered! Entry: ${trade.price} | Current: ${currentPrice} | TP: ${takeProfit.toFixed(2)}`);
      return 'TAKE_PROFIT';
    }

    return null;
  }

  /**
   * Check if total daily loss exceeds the allowed max.
   * If so, the bot should stop for the day.
   */
  async isDailyLossBreached(startingBalance) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const trades = await Trade.find({
      createdAt: { $gte: startOfDay },
      pnl: { $lt: 0 },
    });

    const totalLoss = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const lossPercent = Math.abs(totalLoss) / startingBalance;

    if (lossPercent >= config.risk.maxDailyLossPercent) {
      logger.warn(`Daily loss limit hit: ${(lossPercent * 100).toFixed(2)}% lost today. Bot paused.`);
      return true;
    }

    return false;
  }
}

module.exports = new RiskManager();
