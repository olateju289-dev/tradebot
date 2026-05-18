const https  = require('https');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sign(params, secret) {
  return crypto.createHmac('sha256', secret).update(params).digest('hex');
}

class ExchangeClient {
  constructor() {
    this.apiKey    = config.exchange.apiKey;
    this.apiSecret = config.exchange.apiSecret;
    this.baseHost  = 'api.bybit.com';
  }

  // ── Public: Fetch candles ─────────────────────────────
  async getCandles(symbol, timeframe, limit = 100) {
    // Bybit uses different interval format
    const intervalMap = { '1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','1d':'D' };
    const interval    = intervalMap[timeframe] || '60';
    const pair        = symbol.replace('/', '');

    const path = `/v5/market/kline?category=spot&symbol=${pair}&interval=${interval}&limit=${limit}`;
    const data = await httpsRequest({ host: this.baseHost, path, method: 'GET', headers: { 'User-Agent': 'tradebot/1.0' } });

    if (data.retCode !== 0) {
      logger.error(`Bybit candles error: ${data.retMsg}`);
      throw new Error(data.retMsg);
    }

    // Bybit returns newest first — reverse to oldest first
    // Format: [startTime, open, high, low, close, volume, turnover]
    const candles = data.result.list.reverse();
    return candles.map(c => [+c[0], +c[1], +c[2], +c[3], +c[4], +c[5]]);
  }

  // ── Public: Get current price ─────────────────────────
  async getPrice(symbol) {
    const pair = symbol.replace('/', '');
    const path = `/v5/market/tickers?category=spot&symbol=${pair}`;
    const data = await httpsRequest({ host: this.baseHost, path, method: 'GET', headers: { 'User-Agent': 'tradebot/1.0' } });

    if (data.retCode !== 0) throw new Error(data.retMsg);
    return parseFloat(data.result.list[0].lastPrice);
  }

  // ── Private: Get USDT balance ─────────────────────────
  async getBalance(currency) {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const queryString = `accountType=UNIFIED`;
    const toSign  = timestamp + this.apiKey + recvWindow + queryString;
    const signature = sign(toSign, this.apiSecret);

    const data = await httpsRequest({
      host: this.baseHost,
      path: `/v5/account/wallet-balance?${queryString}`,
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY':     this.apiKey,
        'X-BAPI-TIMESTAMP':   timestamp,
        'X-BAPI-SIGN':        signature,
        'X-BAPI-RECV-WINDOW': recvWindow,
      }
    });

    if (data.retCode !== 0) throw new Error(data.retMsg);

    const coins = data.result.list[0]?.coin || [];
    const coin  = coins.find(c => c.coin === currency);
    return parseFloat(coin?.availableToWithdraw || 0);
  }

  // ── Private: Place market order ───────────────────────
  async placeOrder(symbol, side, amount) {
    const timestamp  = Date.now().toString();
    const recvWindow = '5000';
    const pair       = symbol.replace('/', '');

    const body = JSON.stringify({
      category: 'spot',
      symbol:   pair,
      side:     side === 'buy' ? 'Buy' : 'Sell',
      orderType: 'Market',
      qty:      amount.toFixed(6),
    });

    const toSign    = timestamp + this.apiKey + recvWindow + body;
    const signature = sign(toSign, this.apiSecret);

    const data = await httpsRequest({
      host: this.baseHost,
      path: '/v5/order/create',
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-BAPI-API-KEY':     this.apiKey,
        'X-BAPI-TIMESTAMP':   timestamp,
        'X-BAPI-SIGN':        signature,
        'X-BAPI-RECV-WINDOW': recvWindow,
      }
    }, body);

    if (data.retCode !== 0) {
      logger.error(`Bybit order error: ${data.retMsg}`);
      throw new Error(data.retMsg);
    }

    logger.info(`Order placed | ID: ${data.result.orderId}`);
    return { id: data.result.orderId, status: 'filled' };
  }
}
name: process.env.EXCHANGE || 'bybit',
module.exports = new ExchangeClient();