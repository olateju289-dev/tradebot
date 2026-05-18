# 🤖 Tradebot — Node.js Automated Trading Bot

A clean, production-ready scaffold for a crypto trading bot built with Node.js, ccxt, and MongoDB.

---

## Stack
- **ccxt** — unified API for 100+ exchanges
- **MongoDB + Mongoose** — trade history & logging
- **node-cron** — scheduling
- **winston** — structured logging

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your exchange API keys and settings
```

### 3. Always start with paper trading
```bash
npm run paper
# or: PAPER_TRADE=true npm start
```

### 4. Go live only after thorough testing
```bash
# Set PAPER_TRADE=false in .env, then:
npm start
```

---

## Project Structure

```
src/
├── config/         → Environment config loader
├── exchange/       → ccxt exchange client wrapper
├── strategies/     → Trading strategy logic
│   └── movingAverageCrossover.js
├── execution/      → Order placement & position tracking
├── risk/           → Position sizing, SL/TP, daily loss limits
├── models/         → Mongoose schemas (Trade)
├── utils/          → Logger
└── bot.js          → Entry point + scheduler
```

---

## Strategy: Moving Average Crossover

- **BUY** when the short MA (default: 9) crosses above the long MA (default: 21) — Golden Cross
- **SELL** when the short MA crosses below the long MA — Death Cross

Tune the periods in `.env` (`SHORT_PERIOD`, `LONG_PERIOD`).

---

## Risk Management

| Setting | Default | Description |
|---|---|---|
| `MAX_TRADE_PERCENT` | 5% | Max account % per trade |
| `STOP_LOSS_PERCENT` | 2% | Auto-close if price drops 2% from entry |
| `TAKE_PROFIT_PERCENT` | 4% | Auto-close if price rises 4% from entry |
| `MAX_DAILY_LOSS_PERCENT` | 10% | Bot stops if 10% of balance lost in a day |

---

## Adding New Strategies

1. Create `src/strategies/yourStrategy.js`
2. Export an `analyze(candles)` function returning `'BUY' | 'SELL' | 'HOLD'`
3. Swap it in `bot.js`

---

## ⚠️ Disclaimer
This is a **demo scaffold** for learning purposes. Never trade with money you cannot afford to lose. Always paper trade first and backtest thoroughly.
