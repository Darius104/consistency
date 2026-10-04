-- One signed number the user logs per day (e.g. a trading day's result),
-- interpreted under whichever TradingResultUnit is currently set in
-- Settings rather than stored with its own unit - see src/utils/trading.ts.
CREATE TABLE trading_results (
  date  TEXT PRIMARY KEY,
  value REAL NOT NULL
);
