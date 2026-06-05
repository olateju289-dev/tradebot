const config           = require('../config');
const logger           = require('../utils/logger');
const { calculateRSI } = require('../utils/rsi');

function sma(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

function analyze(candles) {
  const { shortPeriod, longPeriod } = config.strategy;
  const RSI_PERIOD   = 14;
  const RSI_BUY_MAX  = 75;
  const RSI_SELL_MIN = 55;

  const needed = Math.max(longPeriod + 1, RSI_PERIOD + 1);
  if (candles.length < needed) {
    logger.warn(`Not enough candles (${candles.length}). Need ${needed}.`);
    return 'HOLD';
  }

  const closes    = candles.map(c => c[4]);
  const shortNow  = sma(closes, shortPeriod);
  const longNow   = sma(closes, longPeriod);
  const rsi       = calculateRSI(closes, RSI_PERIOD);

  logger.info(`MA(${shortPeriod}): ${shortNow?.toFixed(2)} | MA(${longPeriod}): ${longNow?.toFixed(2)} | RSI: ${rsi}`);

  // BUY — short MA above long MA AND RSI oversold
  if (shortNow > longNow && rsi !== null && rsi < RSI_BUY_MAX) {
    logger.info(`Signal: BUY (MA bullish + RSI ${rsi} oversold)`);
    return 'BUY';
  }

  // SELL — short MA below long MA AND RSI overbought
  if (shortNow < longNow && rsi !== null && rsi > RSI_SELL_MIN) {
    logger.info(`Signal: SELL (MA bearish + RSI ${rsi} overbought)`);
    return 'SELL';
  }

  logger.info('Signal: HOLD');
  return 'HOLD';
}

module.exports = { analyze };