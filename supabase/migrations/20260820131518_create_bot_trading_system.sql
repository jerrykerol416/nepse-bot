/*
# Bot Trading System Tables

1. New Tables
  - `bot_configs` - Configuration for each trading bot (budget, strategy, active status)
    - `id` (uuid, primary key)
    - `name` (text, unique) - Bot display name
    - `strategy` (text) - Strategy identifier (ema_crossover, momentum, volume_breakout, mean_reversion, smc, sector_rotation)
    - `budget` (numeric) - Allocated paper trading budget in NPR
    - `is_active` (boolean) - Whether bot is currently running
    - `parameters` (jsonb) - Strategy-specific parameters
    - `created_at` / `updated_at` timestamps
    
  - `paper_trades` - All paper trades placed by bots
    - `id` (uuid, primary key)
    - `bot_id` (uuid, FK to bot_configs)
    - `symbol` (text) - Stock symbol
    - `action` (text) - BUY or SELL
    - `quantity` (integer) - Number of shares
    - `entry_price` (numeric) - Price at entry
    - `exit_price` (numeric, nullable) - Price at exit (null if still open)
    - `stoploss` (numeric) - Stoploss price
    - `target` (numeric) - Target price
    - `status` (text) - open, closed_profit, closed_loss, stopped_out
    - `pnl` (numeric) - Profit/loss amount
    - `reason` (text) - Why trade was taken
    - `lesson_learned` (text, nullable) - What bot learned if stopped out
    - `created_at` / `closed_at` timestamps

  - `bot_learning_log` - Records what the bot learns from each loss
    - `id` (uuid, primary key)
    - `bot_id` (uuid, FK to bot_configs)
    - `trade_id` (uuid, FK to paper_trades)
    - `pattern` (text) - Pattern that caused the loss
    - `adjustment` (text) - What parameter was adjusted
    - `old_value` (jsonb) - Previous parameter value
    - `new_value` (jsonb) - New parameter value
    - `created_at` timestamp

  - `bot_run_log` - Logs every scheduled bot execution
    - `id` (uuid, primary key)
    - `triggered_at` (timestamptz)
    - `market_open` (boolean)
    - `bots_run` (integer)
    - `trades_placed` (integer)
    - `trades_closed` (integer)
    - `errors` (jsonb, nullable)
    - `duration_ms` (integer)

2. Security
  - RLS enabled on all tables
  - anon + authenticated can read/write (single-tenant bot, no user auth)

3. Seed Data
  - 6 pre-configured bots with budgets
*/

-- Bot configurations
CREATE TABLE IF NOT EXISTS bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  strategy text NOT NULL,
  budget numeric NOT NULL DEFAULT 100000,
  available_cash numeric NOT NULL DEFAULT 100000,
  is_active boolean NOT NULL DEFAULT true,
  parameters jsonb NOT NULL DEFAULT '{}',
  total_pnl numeric NOT NULL DEFAULT 0,
  win_count integer NOT NULL DEFAULT 0,
  loss_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_configs" ON bot_configs;
CREATE POLICY "anon_select_bot_configs" ON bot_configs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bot_configs" ON bot_configs;
CREATE POLICY "anon_insert_bot_configs" ON bot_configs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_bot_configs" ON bot_configs;
CREATE POLICY "anon_update_bot_configs" ON bot_configs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_bot_configs" ON bot_configs;
CREATE POLICY "anon_delete_bot_configs" ON bot_configs FOR DELETE TO anon, authenticated USING (true);

-- Paper trades
CREATE TABLE IF NOT EXISTS paper_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bot_configs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  action text NOT NULL CHECK (action IN ('BUY', 'SELL')),
  quantity integer NOT NULL,
  entry_price numeric NOT NULL,
  exit_price numeric,
  stoploss numeric NOT NULL,
  target numeric NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed_profit', 'closed_loss', 'stopped_out')),
  pnl numeric DEFAULT 0,
  reason text,
  lesson_learned text,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_bot_id ON paper_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(status);
CREATE INDEX IF NOT EXISTS idx_paper_trades_symbol ON paper_trades(symbol);

ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_paper_trades" ON paper_trades;
CREATE POLICY "anon_select_paper_trades" ON paper_trades FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_paper_trades" ON paper_trades;
CREATE POLICY "anon_insert_paper_trades" ON paper_trades FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_paper_trades" ON paper_trades;
CREATE POLICY "anon_update_paper_trades" ON paper_trades FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_paper_trades" ON paper_trades;
CREATE POLICY "anon_delete_paper_trades" ON paper_trades FOR DELETE TO anon, authenticated USING (true);

-- Bot learning log
CREATE TABLE IF NOT EXISTS bot_learning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bot_configs(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES paper_trades(id) ON DELETE SET NULL,
  pattern text NOT NULL,
  adjustment text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_learning_bot_id ON bot_learning_log(bot_id);

ALTER TABLE bot_learning_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_learning" ON bot_learning_log;
CREATE POLICY "anon_select_bot_learning" ON bot_learning_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bot_learning" ON bot_learning_log;
CREATE POLICY "anon_insert_bot_learning" ON bot_learning_log FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Bot run log
CREATE TABLE IF NOT EXISTS bot_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  market_open boolean NOT NULL DEFAULT false,
  bots_run integer NOT NULL DEFAULT 0,
  trades_placed integer NOT NULL DEFAULT 0,
  trades_closed integer NOT NULL DEFAULT 0,
  errors jsonb,
  duration_ms integer NOT NULL DEFAULT 0
);

ALTER TABLE bot_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_run_log" ON bot_run_log;
CREATE POLICY "anon_select_bot_run_log" ON bot_run_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bot_run_log" ON bot_run_log;
CREATE POLICY "anon_insert_bot_run_log" ON bot_run_log FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Seed the 6 bots with budgets and strategy parameters
INSERT INTO bot_configs (name, strategy, budget, available_cash, parameters) VALUES
  ('EMA Crossover', 'ema_crossover', 200000, 200000, '{"fast_period": 9, "slow_period": 21, "risk_per_trade": 0.02, "stoploss_pct": 3, "target_pct": 6}'),
  ('Momentum Hunter', 'momentum', 200000, 200000, '{"rsi_oversold": 30, "rsi_overbought": 70, "volume_multiplier": 1.5, "risk_per_trade": 0.025, "stoploss_pct": 4, "target_pct": 8}'),
  ('Volume Breakout', 'volume_breakout', 150000, 150000, '{"volume_surge": 2.0, "price_breakout_pct": 2, "risk_per_trade": 0.03, "stoploss_pct": 3, "target_pct": 7}'),
  ('Mean Reversion', 'mean_reversion', 150000, 150000, '{"bb_period": 20, "bb_std": 2, "rsi_threshold": 35, "risk_per_trade": 0.02, "stoploss_pct": 2.5, "target_pct": 5}'),
  ('SMC Strategy', 'smc', 200000, 200000, '{"order_block_lookback": 10, "fvg_min_gap_pct": 1, "risk_per_trade": 0.02, "stoploss_pct": 3.5, "target_pct": 7}'),
  ('Sector Rotation', 'sector_rotation', 100000, 100000, '{"top_sectors": 3, "momentum_period": 20, "risk_per_trade": 0.02, "stoploss_pct": 4, "target_pct": 8}')
ON CONFLICT (name) DO NOTHING;
