const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const OUT_FILE = path.join(__dirname, 'data', 'btc-usdt-1h.csv');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'tradebot/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching BTC hourly candles from CoinGecko (90 days)...');

  // CoinGecko market_chart returns hourly prices for up to 90 days — free, no key needed
  const url  = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90&interval=hourly';
  const data = await httpsGet(url);

  if (!data.prices || !data.prices.length) {
    console.error('CoinGecko returned:', JSON.stringify(data));
    process.exit(1);
  }

  console.log(`  Fetched ${data.prices.length} hourly prices`);

  // CoinGecko prices format: [[timestamp, price], ...]
  // We use price as open/high/low/close (fine for MA + RSI backtesting)
  const header = 'timestamp,open,high,low,close,volume\n';
  const rows   = data.prices.map(([time, price]) =>
    `${time},${price},${price},${price},${price},0`
  ).join('\n');

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, header + rows);

  console.log(`✅ Saved ${data.prices.length} candles to ${OUT_FILE}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});