const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  symbol:     { type: String, required: true },
  side:       { type: String, enum: ['buy', 'sell'], required: true },
  price:      { type: Number, required: true },
  amount:     { type: Number, required: true },
  cost:       { type: Number },                   // price * amount
  orderId:    { type: String },                   // exchange order ID
  paperTrade: { type: Boolean, default: false },
  signal:     { type: String },                   // e.g. 'MA_CROSSOVER_BUY'
  pnl:        { type: Number, default: null },    // filled in when position closes
  status:     { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
  closedAt:   { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Trade', tradeSchema);
