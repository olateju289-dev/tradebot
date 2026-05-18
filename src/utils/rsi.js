/**
 * rsi.js — Relative Strength Index calculator
 *
 * RSI measures the speed and size of recent price changes.
 * Returns a number between 0 and 100.
 *
 *  < 30  = Oversold  → price dropped fast, potential BUY opportunity
 *  > 70  = Overbought → price rose fast, potential SELL opportunity
 *  30–70 = Neutral
 *
 * @param {number[]} closes  - Array of closing prices (oldest first)
 * @param {number}   period  - Lookback period (default: 14)
 * @returns {number|null}    - RSI value, or null if not enough data
 */
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  const recent = closes.slice(-(period + 1));

  // Step 1: Calculate price changes
  const changes = [];
  for (let i = 1; i < recent.length; i++) {
    changes.push(recent[i] - recent[i - 1]);
  }

  // Step 2: Separate gains and losses
  const gains  = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

  // Step 3: Average gain and average loss
  const avgGain = gains.reduce((s, v) => s + v, 0)  / period;
  const avgLoss = losses.reduce((s, v) => s + v, 0) / period;

  // Step 4: Relative Strength
  if (avgLoss === 0) return 100; // No losses = maximum strength

  const rs  = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return parseFloat(rsi.toFixed(2));
}

module.exports = { calculateRSI };
