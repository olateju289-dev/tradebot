require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');
const Trade    = require('../src/models/Trade');

const app  = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tradebot')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err.message));

app.get('/api/trades', async (req, res) => {
  try {
    const trades = await Trade.find().sort({ createdAt: -1 }).limit(200);
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const trades      = await Trade.find({ status: 'closed' });
    const totalTrades = trades.length;
    const wins        = trades.filter(t => t.pnl > 0);
    const losses      = trades.filter(t => t.pnl < 0);
    const totalPnL    = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const winRate     = totalTrades ? ((wins.length / totalTrades) * 100).toFixed(1) : 0;
    const avgWin      = wins.length   ? (wins.reduce((s, t) => s + t.pnl, 0) / wins.length).toFixed(2) : 0;
    const avgLoss     = losses.length ? (losses.reduce((s, t) => s + t.pnl, 0) / losses.length).toFixed(2) : 0;
    const openTrade   = await Trade.findOne({ status: 'open' });

    res.json({
      totalTrades, wins: wins.length, losses: losses.length,
      winRate, totalPnL: parseFloat(totalPnL.toFixed(2)),
      avgWin: parseFloat(avgWin), avgLoss: parseFloat(avgLoss),
      openTrade: openTrade || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/balance-history', async (req, res) => {
  try {
    const trades  = await Trade.find({ status: 'closed' }).sort({ closedAt: 1 });
    let   balance = 1000;
    const history = [{ time: 'Start', balance }];

    for (const trade of trades) {
      balance += (trade.pnl || 0);
      history.push({
        time:    trade.closedAt ? new Date(trade.closedAt).toLocaleDateString() : '?',
        balance: parseFloat(balance.toFixed(2)),
        pnl:     trade.pnl,
      });
    }
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backtest', (req, res) => {
  const resultsPath = path.join(__dirname, '../backtest/results.json');
  if (!fs.existsSync(resultsPath)) {
    return res.status(404).json({ error: 'No backtest results yet.' });
  }
  res.json(JSON.parse(fs.readFileSync(resultsPath, 'utf8')));
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard running at http://localhost:${PORT}\n`);
});