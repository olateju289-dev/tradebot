/**
 * backtest.js
 *
 * Replays historical candle data through your strategy and reports results.
 *
 * Usage:
 *   1. First fetch data:  node backtest/fetchData.js
 *   2. Then run backtest: node backtest/backtest.js
 *
 * You can also tweak these settings at the top to test different configs.
 */

const fs   = require('fs');
const path = require('path');
const { calculateRSI } = require('../src/utils/rsi');

// ─── Settings (tweak these and compare results) ───────────────────────────────
const STARTING_BALANCE  = 1000;   // Start with $1,000 USDT
const SHORT_PERIOD      = 5;      // Short SMA period
const LONG_PERIOD       = 10;    // Long SMA period (must be > short
const RSI_PERIOD        = 14;
const RSI_BUY_MAX       = 45;  // Only buy when RSI is below this
const RSI_SELL_MIN      = 55;     // Only sell when RSI is above this
const STOP_LOSS_PCT     = 0.015; // 1.5% stop loss
const TAKE_PROFIT_PCT   = 0.06;   // 6% take profit
const TRADE_SIZE_PCT    = 0.50;   // Risk 50% of balance per trade
const CSV_FILE          = path.join(__dirname, 'data', 'btc-usdt-1h.csv');
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────
function sma(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function loadCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Data file not found: ${filePath}`);
    console.error('   Run first: node backtest/fetchData.js\n');
    process.exit(1);
  }

  const lines   = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const candles = [];

  for (let i = 1; i < lines.length; i++) { // skip header
    const [timestamp, open, high, low, close, volume] = lines[i].split(',');
    candles.push([
      parseInt(timestamp),
      parseFloat(open),
      parseFloat(high),
      parseFloat(low),
      parseFloat(close),
      parseFloat(volume),
    ]);
  }

  return candles;
}

function getSignal(candles) {
  const closes    = candles.map(c => c[4]);
  const shortNow  = sma(closes, SHORT_PERIOD);
  const longNow   = sma(closes, LONG_PERIOD);
  const prevClose = closes.slice(0, -1);
  const shortPrev = sma(prevClose, SHORT_PERIOD);
  const longPrev  = sma(prevClose, LONG_PERIOD);
  const rsi       = calculateRSI(closes, RSI_PERIOD);

  if (!shortNow || !longNow || !shortPrev || !longPrev) return 'HOLD';

  const goldenCross = shortPrev <= longPrev && shortNow > longNow;
  if (goldenCross && rsi !== null && rsi < RSI_BUY_MAX) return 'BUY';

  const deathCross = shortPrev >= longPrev && shortNow < longNow;
  if (deathCross && rsi !== null && rsi > RSI_SELL_MIN) return 'SELL';

  return 'HOLD';
}

// ── Main Backtest Loop ────────────────────────────────────────────────────────
function runBacktest() {
  const allCandles = loadCSV(CSV_FILE);
  console.log(`\nLoaded ${allCandles.length} candles from CSV\n`);

  let balance     = STARTING_BALANCE;
  let position    = null;   // { entryPrice, amount, stopLoss, takeProfit, entryTime }
  const trades    = [];
  const balanceHistory = [{ time: allCandles[0][0], balance }];

  const WINDOW = Math.max(LONG_PERIOD, RSI_PERIOD) + 5;

  for (let i = WINDOW; i < allCandles.length; i++) {
    const window       = allCandles.slice(0, i + 1);
    const currentPrice = allCandles[i][4]; // close price
    const currentTime  = new Date(allCandles[i][0]).toISOString();

    // ── Check stop-loss / take-profit on open position ──
    if (position) {
      const hitSL = currentPrice <= position.stopLoss;
      const hitTP = currentPrice >= position.takeProfit;

      if (hitSL || hitTP) {
        const exitPrice = hitSL ? position.stopLoss : position.takeProfit;
        const pnl       = (exitPrice - position.entryPrice) * position.amount;
        balance        += exitPrice * position.amount;

        trades.push({
          type:       'SELL',
          reason:     hitSL ? 'STOP_LOSS' : 'TAKE_PROFIT',
          entryPrice: position.entryPrice,
          exitPrice,
          amount:     position.amount,
          pnl:        parseFloat(pnl.toFixed(4)),
          entryTime:  position.entryTime,
          exitTime:   currentTime,
        });

        balanceHistory.push({ time: allCandles[i][0], balance: parseFloat(balance.toFixed(2)) });
        position = null;
        continue;
      }
    }

    // ── Run strategy signal ──────────────────────────────
    const signal = getSignal(window);

    if (signal === 'BUY' && !position) {
      const tradeAmount = (balance * TRADE_SIZE_PCT) / currentPrice;
      const cost        = tradeAmount * currentPrice;

      if (cost > balance) continue; // not enough funds

      balance  -= cost;
      position  = {
        entryPrice:  currentPrice,
        amount:      tradeAmount,
        stopLoss:    currentPrice * (1 - STOP_LOSS_PCT),
        takeProfit:  currentPrice * (1 + TAKE_PROFIT_PCT),
        entryTime:   currentTime,
      };
    }

    if (signal === 'SELL' && position) {
      const pnl  = (currentPrice - position.entryPrice) * position.amount;
      balance   += currentPrice * position.amount;

      trades.push({
        type:       'SELL',
        reason:     'SIGNAL',
        entryPrice: position.entryPrice,
        exitPrice:  currentPrice,
        amount:     position.amount,
        pnl:        parseFloat(pnl.toFixed(4)),
        entryTime:  position.entryTime,
        exitTime:   currentTime,
      });

      balanceHistory.push({ time: allCandles[i][0], balance: parseFloat(balance.toFixed(2)) });
      position = null;
    }
  }

  // ── Close any open position at last candle price ──
  if (position) {
    const lastPrice = allCandles[allCandles.length - 1][4];
    const pnl       = (lastPrice - position.entryPrice) * position.amount;
    balance        += lastPrice * position.amount;

    trades.push({
      type:       'SELL',
      reason:     'END_OF_DATA',
      entryPrice: position.entryPrice,
      exitPrice:  lastPrice,
      amount:     position.amount,
      pnl:        parseFloat(pnl.toFixed(4)),
      entryTime:  position.entryTime,
      exitTime:   'END',
    });
  }

  return { trades, finalBalance: parseFloat(balance.toFixed(2)), balanceHistory };
}

// ── Print Report ──────────────────────────────────────────────────────────────
function printReport({ trades, finalBalance, balanceHistory }) {
  const wins       = trades.filter(t => t.pnl > 0);
  const losses     = trades.filter(t => t.pnl < 0);
  const totalPnL   = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate    = trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : 0;
  const bestTrade  = trades.reduce((best, t) => t.pnl > (best?.pnl ?? -Infinity) ? t : best, null);
  const worstTrade = trades.reduce((worst, t) => t.pnl < (worst?.pnl ?? Infinity) ? t : worst, null);

  const divider = '─'.repeat(52);

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║           BACKTEST RESULTS                         ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Strategy   : MA(${SHORT_PERIOD}/${LONG_PERIOD}) + RSI(${RSI_PERIOD})`.padEnd(52) + '║');
  console.log(`║  RSI Buy <  : ${RSI_BUY_MAX} | RSI Sell > ${RSI_SELL_MIN}`.padEnd(52) + '║');
  console.log(`║  Stop Loss  : ${(STOP_LOSS_PCT * 100)}% | Take Profit: ${(TAKE_PROFIT_PCT * 100)}%`.padEnd(52) + '║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Starting Balance : $${STARTING_BALANCE.toFixed(2)}`.padEnd(52) + '║');
  console.log(`║  Final Balance    : $${finalBalance}`.padEnd(52) + '║');
  console.log(`║  Net Profit/Loss  : $${totalPnL.toFixed(2)} (${((totalPnL / STARTING_BALANCE) * 100).toFixed(2)}%)`.padEnd(52) + '║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Total Trades  : ${trades.length}`.padEnd(52) + '║');
  console.log(`║  Wins          : ${wins.length}`.padEnd(52) + '║');
  console.log(`║  Losses        : ${losses.length}`.padEnd(52) + '║');
  console.log(`║  Win Rate      : ${winRate}%`.padEnd(52) + '║');
  console.log('╠════════════════════════════════════════════════════╣');
  if (bestTrade)  console.log(`║  Best Trade    : +$${bestTrade.pnl}`.padEnd(52) + '║');
  if (worstTrade) console.log(`║  Worst Trade   : $${worstTrade.pnl}`.padEnd(52) + '║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  if (trades.length > 0) {
    console.log('TRADE LOG (last 10):');
    console.log(divider);
    const recent = trades.slice(-10);
    recent.forEach((t, i) => {
      const arrow = t.pnl >= 0 ? '✅' : '❌';
      console.log(`${arrow} #${trades.length - 10 + i + 1} | ${t.reason.padEnd(12)} | Entry: $${t.entryPrice.toFixed(2)} | Exit: $${t.exitPrice.toFixed(2)} | PnL: $${t.pnl}`);
    });
  }

  // Save results to JSON for the dashboard to use
  const results = {
    settings: { shortPeriod: SHORT_PERIOD, longPeriod: LONG_PERIOD, rsiBuyMax: RSI_BUY_MAX, rsiSellMin: RSI_SELL_MIN },
    summary:  { startingBalance: STARTING_BALANCE, finalBalance, totalPnL: parseFloat(totalPnL.toFixed(2)), winRate, totalTrades: trades.length, wins: wins.length, losses: losses.length },
    trades,
    balanceHistory,
  };

  const outPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Full results saved to: backtest/results.json\n`);
}

const results = runBacktest();
printReport(results);
