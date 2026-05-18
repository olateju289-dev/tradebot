require('dotenv').config();

module.exports = {
  exchange: {
    name: process.env.EXCHANGE || 'binance',
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    paperTrade: process.env.PAPER_TRADE === 'true',
  },
  trading: {
    symbol: process.env.SYMBOL || 'BTC/USDT',
    timeframe: process.env.TIMEFRAME || '1h',
  },
  strategy: {
    shortPeriod: parseInt(process.env.SHORT_PERIOD) || 9,
    longPeriod: parseInt(process.env.LONG_PERIOD) || 21,
  },
  risk: {
    maxTradePercent: parseFloat(process.env.MAX_TRADE_PERCENT) || 0.05,
    stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT) || 0.02,
    takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT) || 0.04,
    maxDailyLossPercent: parseFloat(process.env.MAX_DAILY_LOSS_PERCENT) || 0.10,
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/tradebot',
  },
  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 * * * *',
  },

  const http = require('http');

http.createServer((req, res) => {
  res.write('Bot is running');
  res.end();
}).listen(process.env.PORT || 3001, () => {
  console.log('Dashboard server running');
};
