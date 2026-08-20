/*
# Update bot configurations with proven worldwide strategies

1. Changes
   - Update existing 6 bots to use distinct proven strategies
   - Add 4 new bots: MACD, Darvas Box, Gap Trading, ATR Trend
   - Each bot now uses a genuinely different technical analysis approach
   - Reset available_cash to match budget for fresh start

2. Bot strategies (10 total):
   - RSI Mean Reversion (Wilder, 1978) - buys oversold conditions
   - EMA Crossover 9/21 - classic trend following
   - Bollinger Breakout (Bollinger) - squeeze and breakout detection
   - MACD Crossover (Appel, 1979) - momentum divergence
   - Volume Accumulation - institutional buying detection
   - Darvas Box (Darvas, 1960) - consolidation breakout
   - Gap Trading - opening gap with follow-through
   - ATR Trend Following (Turtle Traders, 1983) - channel breakout
   - Sector Rotation - momentum across NEPSE sectors
   - Smart Money Concepts (ICT) - order blocks and fair value gaps

3. Notes
   - Each strategy has unique parameters tuned for NEPSE market characteristics
   - Budgets allocated based on strategy risk profile
*/

-- Update existing bots with new strategies
UPDATE bot_configs SET
  name = 'RSI Reversal',
  strategy = 'rsi_reversion',
  parameters = '{"rsi_threshold": 30, "stoploss_pct": 3, "target_pct": 5, "risk_per_trade": 0.02, "max_positions": 3}'::jsonb,
  available_cash = budget,
  total_pnl = 0, win_count = 0, loss_count = 0,
  updated_at = now()
WHERE name = 'EMA Crossover';

UPDATE bot_configs SET
  name = 'EMA Crossover',
  strategy = 'ema_crossover',
  parameters = '{"fast_period": 9, "slow_period": 21, "stoploss_pct": 3, "target_pct": 7, "risk_per_trade": 0.025, "max_positions": 3}'::jsonb,
  available_cash = budget,
  total_pnl = 0, win_count = 0, loss_count = 0,
  updated_at = now()
WHERE name = 'Momentum Hunter';

UPDATE bot_configs SET
  name = 'Bollinger Breakout',
  strategy = 'bollinger_breakout',
  parameters = '{"bb_period": 20, "bb_std": 2, "stoploss_pct": 2.5, "target_pct": 6, "risk_per_trade": 0.02, "max_positions": 3}'::jsonb,
  available_cash = budget,
  total_pnl = 0, win_count = 0, loss_count = 0,
  updated_at = now()
WHERE name = 'Volume Breakout';

UPDATE bot_configs SET
  name = 'Volume Accumulation',
  strategy = 'volume_accumulation',
  parameters = '{"lookback": 5, "stoploss_pct": 3, "target_pct": 8, "risk_per_trade": 0.025, "max_positions": 3}'::jsonb,
  available_cash = budget,
  total_pnl = 0, win_count = 0, loss_count = 0,
  updated_at = now()
WHERE name = 'Mean Reversion';

UPDATE bot_configs SET
  name = 'Smart Money (ICT)',
  strategy = 'smc',
  parameters = '{"stoploss_pct": 3, "target_pct": 7, "risk_per_trade": 0.02, "max_positions": 3}'::jsonb,
  available_cash = budget,
  total_pnl = 0, win_count = 0, loss_count = 0,
  updated_at = now()
WHERE name = 'SMC Strategy';

UPDATE bot_configs SET
  name = 'Sector Rotation',
  strategy = 'sector_rotation',
  parameters = '{"stoploss_pct": 4, "target_pct": 8, "risk_per_trade": 0.02, "max_positions": 3}'::jsonb,
  available_cash = budget,
  total_pnl = 0, win_count = 0, loss_count = 0,
  updated_at = now()
WHERE name = 'Sector Rotation';

-- Add 4 new bots with unique strategies
INSERT INTO bot_configs (name, strategy, budget, available_cash, is_active, parameters) VALUES
  ('MACD Divergence', 'macd_crossover', 180000, 180000, true,
   '{"stoploss_pct": 3.5, "target_pct": 7, "risk_per_trade": 0.02, "max_positions": 3}'::jsonb),
  ('Darvas Box', 'darvas_box', 150000, 150000, true,
   '{"box_days": 10, "target_pct": 8, "risk_per_trade": 0.025, "max_positions": 2}'::jsonb),
  ('Gap Trader', 'gap_trading', 120000, 120000, true,
   '{"min_gap_pct": 2, "target_pct": 6, "risk_per_trade": 0.03, "max_positions": 2}'::jsonb),
  ('Turtle Trend', 'atr_trend', 200000, 200000, true,
   '{"channel_days": 20, "risk_per_trade": 0.02, "max_positions": 3}'::jsonb)
ON CONFLICT DO NOTHING;
