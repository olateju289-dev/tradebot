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
  const RSI_BUY_MAX  = 45;
  const RSI_SELL_MIN = 55;

  const needed = Math.max(longPeriod + 1, RSI_PERIOD + 1);
  if (candles.length < needed) {
    logger.warn(`Not enough candles (${candles.length}). Need ${needed}.`);
    return 'HOLD';
  }

  const closes    = candles.map(c => c[4]);
  const shortNow  = sma(closes, shortPeriod);
  const longNow   = sma(closes, longPeriod);
  const prevClose = closes.slice(0, -1);
  const shortPrev = sma(prevClose, shortPeriod);
  const longPrev  = sma(prevClose, longPeriod);
  const rsi       = calculateRSI(closes, RSI_PERIOD);

  logger.info(`MA(${shortPeriod}): ${shortNow?.toFixed(2)} | MA(${longPeriod}): ${longNow?.toFixed(2)} | RSI: ${rsi}`);

  const goldenCross = shortPrev <= longPrev && shortNow > longNow;
  if (goldenCross) {
    if (rsi !== null && rsi < RSI_BUY_MAX) {
      logger.info(`Signal: BUY (Golden Cross + RSI ${rsi} oversold)`);
      return 'BUY';
    }
    logger.info(`Signal: HOLD (Golden Cross but RSI ${rsi} not oversold yet)`);
    return 'HOLD';
  }

  const deathCross = shortPrev >= longPrev && shortNow < longNow;
  if (deathCross) {
    if (rsi !== null && rsi > RSI_SELL_MIN) {
      logger.info(`Signal: SELL (Death Cross + RSI ${rsi} overbought)`);
      return 'SELL';
    }
    logger.info(`Signal: HOLD (Death Cross but RSI ${rsi} not overbought yet)`);
    return 'HOLD';
  }

  logger.info('Signal: HOLD');
  return 'HOLD';
}

module.exports = { analyze };