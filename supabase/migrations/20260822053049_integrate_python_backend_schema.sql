/*
# Integrate Python Backend with Supabase Database

This migration adds all tables and columns the Python FastAPI backend needs,
while keeping the existing edge-function schema intact.

1. Extended Tables
   - `bot_configs` — added 30+ nullable columns for Python backend's BotConfiguration model
     (description, component flags, sector config, screening config, liquidity config,
      pattern config, depth config, floorsheet config, risk config, indicator config,
      signal config, scheduling config, additional_config)
   - `paper_trades` — added nullable columns for Python backend's PaperTrade model
     (bot_name, strategy, direction, target_price, stop_price, entry_date,
      capital_allocated, shares_qty, timeframe, close_price, close_date, outcome,
      pnl_pct, pnl_nrs, is_open, signal_score, signal_context, mistake_analysis,
      regime_at_entry, sector, max_hold_days, updated_at)

2. New Tables
   - `sectors` — sector information and performance metrics
   - `stocks` — stock info, current prices, fundamentals, cached technical indicators
   - `stock_ohlcv` — historical OHLCV data (separate from stock_price_history for Python backend)
   - `signals` — trading signals with entry/exit, risk management, confidence scores
   - `patterns` — detected chart patterns and formations
   - `market_depth` — order book snapshots (top 5 bid/ask levels)
   - `floorsheet` — individual trade records with broker info
   - `bot_learning_states` — RL state per bot (accuracy, thresholds, weights, capital)
   - `live_market_cache` — latest scraped price snapshot per symbol

3. Security
   - RLS enabled on all new tables
   - anon + authenticated CRUD (single-tenant bot system, no user auth)

4. Notes
   - Existing edge functions continue to work unchanged — all new columns are nullable
   - Python models will be updated to use UUID PKs and match these table/column names
   - stock_ohlcv is separate from stock_price_history to avoid conflicts with edge functions
*/

-- ═══════════════════════════════════════════════════════════════════
-- PART 1: Extend existing bot_configs with Python backend columns
-- ═══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='description') THEN
    ALTER TABLE bot_configs ADD COLUMN description text;
  END IF;
  -- Component flags
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='sector_identifier_enabled') THEN
    ALTER TABLE bot_configs ADD COLUMN sector_identifier_enabled boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='liquidity_hunter_enabled') THEN
    ALTER TABLE bot_configs ADD COLUMN liquidity_hunter_enabled boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='market_depth_enabled') THEN
    ALTER TABLE bot_configs ADD COLUMN market_depth_enabled boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='floorsheet_enabled') THEN
    ALTER TABLE bot_configs ADD COLUMN floorsheet_enabled boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='fundamental_enabled') THEN
    ALTER TABLE bot_configs ADD COLUMN fundamental_enabled boolean DEFAULT false;
  END IF;
  -- Sector config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='sector_comparison_days') THEN
    ALTER TABLE bot_configs ADD COLUMN sector_comparison_days integer DEFAULT 30;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='sector_momentum_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN sector_momentum_threshold numeric DEFAULT 0.05;
  END IF;
  -- Screening config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='min_beta') THEN
    ALTER TABLE bot_configs ADD COLUMN min_beta numeric DEFAULT 0.8;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='max_beta') THEN
    ALTER TABLE bot_configs ADD COLUMN max_beta numeric DEFAULT 1.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='volume_days') THEN
    ALTER TABLE bot_configs ADD COLUMN volume_days integer DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='volume_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN volume_threshold numeric DEFAULT 1.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='min_volatility') THEN
    ALTER TABLE bot_configs ADD COLUMN min_volatility numeric DEFAULT 0.01;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='max_volatility') THEN
    ALTER TABLE bot_configs ADD COLUMN max_volatility numeric DEFAULT 0.05;
  END IF;
  -- Liquidity hunter config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='demand_zone_lookback') THEN
    ALTER TABLE bot_configs ADD COLUMN demand_zone_lookback integer DEFAULT 20;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='volume_spike_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN volume_spike_threshold numeric DEFAULT 2.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='rsi_oversold') THEN
    ALTER TABLE bot_configs ADD COLUMN rsi_oversold numeric DEFAULT 30.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='rsi_overbought') THEN
    ALTER TABLE bot_configs ADD COLUMN rsi_overbought numeric DEFAULT 70.0;
  END IF;
  -- Pattern config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='support_resistance_strength') THEN
    ALTER TABLE bot_configs ADD COLUMN support_resistance_strength integer DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='breakout_volume_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN breakout_volume_threshold numeric DEFAULT 1.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='pattern_lookback_days') THEN
    ALTER TABLE bot_configs ADD COLUMN pattern_lookback_days integer DEFAULT 60;
  END IF;
  -- Market depth config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='order_imbalance_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN order_imbalance_threshold numeric DEFAULT 0.3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='bid_wall_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN bid_wall_threshold numeric DEFAULT 100000.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='liquidity_score_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN liquidity_score_threshold numeric DEFAULT 0.6;
  END IF;
  -- Floorsheet config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='broker_accumulation_days') THEN
    ALTER TABLE bot_configs ADD COLUMN broker_accumulation_days integer DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='broker_volume_threshold') THEN
    ALTER TABLE bot_configs ADD COLUMN broker_volume_threshold numeric DEFAULT 50000.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='manipulation_detection_enabled') THEN
    ALTER TABLE bot_configs ADD COLUMN manipulation_detection_enabled boolean DEFAULT true;
  END IF;
  -- Risk management config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='max_risk_per_trade') THEN
    ALTER TABLE bot_configs ADD COLUMN max_risk_per_trade numeric DEFAULT 2.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='reward_risk_ratio') THEN
    ALTER TABLE bot_configs ADD COLUMN reward_risk_ratio numeric DEFAULT 2.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='max_open_positions') THEN
    ALTER TABLE bot_configs ADD COLUMN max_open_positions integer DEFAULT 5;
  END IF;
  -- Indicator config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='ema_short_period') THEN
    ALTER TABLE bot_configs ADD COLUMN ema_short_period integer DEFAULT 9;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='ema_long_period') THEN
    ALTER TABLE bot_configs ADD COLUMN ema_long_period integer DEFAULT 21;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='rsi_period') THEN
    ALTER TABLE bot_configs ADD COLUMN rsi_period integer DEFAULT 14;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='macd_fast') THEN
    ALTER TABLE bot_configs ADD COLUMN macd_fast integer DEFAULT 12;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='macd_slow') THEN
    ALTER TABLE bot_configs ADD COLUMN macd_slow integer DEFAULT 26;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='macd_signal') THEN
    ALTER TABLE bot_configs ADD COLUMN macd_signal integer DEFAULT 9;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='bollinger_period') THEN
    ALTER TABLE bot_configs ADD COLUMN bollinger_period integer DEFAULT 20;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='bollinger_std') THEN
    ALTER TABLE bot_configs ADD COLUMN bollinger_std numeric DEFAULT 2.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='atr_period') THEN
    ALTER TABLE bot_configs ADD COLUMN atr_period integer DEFAULT 14;
  END IF;
  -- Signal config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='min_confidence_score') THEN
    ALTER TABLE bot_configs ADD COLUMN min_confidence_score numeric DEFAULT 0.6;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='component_weights') THEN
    ALTER TABLE bot_configs ADD COLUMN component_weights jsonb;
  END IF;
  -- Scheduling config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='market_data_interval') THEN
    ALTER TABLE bot_configs ADD COLUMN market_data_interval integer DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='analysis_interval') THEN
    ALTER TABLE bot_configs ADD COLUMN analysis_interval integer DEFAULT 15;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='signal_generation_interval') THEN
    ALTER TABLE bot_configs ADD COLUMN signal_generation_interval integer DEFAULT 15;
  END IF;
  -- Additional config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='additional_config') THEN
    ALTER TABLE bot_configs ADD COLUMN additional_config jsonb;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- PART 2: Extend existing paper_trades with Python backend columns
-- ═══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='bot_name') THEN
    ALTER TABLE paper_trades ADD COLUMN bot_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='strategy') THEN
    ALTER TABLE paper_trades ADD COLUMN strategy text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='direction') THEN
    ALTER TABLE paper_trades ADD COLUMN direction text DEFAULT 'LONG';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='target_price') THEN
    ALTER TABLE paper_trades ADD COLUMN target_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='stop_price') THEN
    ALTER TABLE paper_trades ADD COLUMN stop_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='entry_date') THEN
    ALTER TABLE paper_trades ADD COLUMN entry_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='capital_allocated') THEN
    ALTER TABLE paper_trades ADD COLUMN capital_allocated numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='shares_qty') THEN
    ALTER TABLE paper_trades ADD COLUMN shares_qty integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='timeframe') THEN
    ALTER TABLE paper_trades ADD COLUMN timeframe text DEFAULT 'daily';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='close_price') THEN
    ALTER TABLE paper_trades ADD COLUMN close_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='close_date') THEN
    ALTER TABLE paper_trades ADD COLUMN close_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='outcome') THEN
    ALTER TABLE paper_trades ADD COLUMN outcome text DEFAULT 'OPEN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='pnl_pct') THEN
    ALTER TABLE paper_trades ADD COLUMN pnl_pct numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='pnl_nrs') THEN
    ALTER TABLE paper_trades ADD COLUMN pnl_nrs numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='is_open') THEN
    ALTER TABLE paper_trades ADD COLUMN is_open boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='signal_score') THEN
    ALTER TABLE paper_trades ADD COLUMN signal_score numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='signal_context') THEN
    ALTER TABLE paper_trades ADD COLUMN signal_context jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='mistake_analysis') THEN
    ALTER TABLE paper_trades ADD COLUMN mistake_analysis text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='regime_at_entry') THEN
    ALTER TABLE paper_trades ADD COLUMN regime_at_entry text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='sector') THEN
    ALTER TABLE paper_trades ADD COLUMN sector text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='max_hold_days') THEN
    ALTER TABLE paper_trades ADD COLUMN max_hold_days integer DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_trades' AND column_name='updated_at') THEN
    ALTER TABLE paper_trades ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- PART 3: Create new tables for Python backend
-- ═══════════════════════════════════════════════════════════════════

-- Sectors
CREATE TABLE IF NOT EXISTS sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  description text,
  current_index numeric,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  day_high numeric, day_low numeric,
  week_high numeric, week_low numeric,
  month_high numeric, month_low numeric,
  year_high numeric, year_low numeric,
  momentum_1d numeric, momentum_5d numeric, momentum_10d numeric, momentum_20d numeric, momentum_30d numeric,
  relative_strength_1d numeric, relative_strength_5d numeric, relative_strength_10d numeric, relative_strength_20d numeric, relative_strength_30d numeric,
  total_volume numeric, total_turnover numeric, avg_volume_10d numeric, avg_volume_30d numeric,
  total_stocks integer, advancing_stocks integer, declining_stocks integer, unchanged_stocks integer,
  rank integer, rank_change integer,
  last_updated timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sectors_name ON sectors(name);
CREATE INDEX IF NOT EXISTS idx_sectors_code ON sectors(code);
CREATE INDEX IF NOT EXISTS idx_sectors_rank ON sectors(rank);
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_sectors" ON sectors;
CREATE POLICY "anon_select_sectors" ON sectors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_sectors" ON sectors FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_sectors" ON sectors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_sectors" ON sectors FOR DELETE TO anon, authenticated USING (true);

-- Stocks
CREATE TABLE IF NOT EXISTS stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  sector_id uuid REFERENCES sectors(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  is_tradeable boolean DEFAULT true,
  listing_date timestamptz,
  ltp numeric, previous_close numeric, open_price numeric, high_price numeric, low_price numeric,
  change numeric, change_percent numeric,
  volume numeric, turnover numeric, total_trades integer,
  week_52_high numeric, week_52_low numeric, week_52_high_date timestamptz, week_52_low_date timestamptz,
  market_cap numeric, outstanding_shares numeric, free_float numeric,
  eps numeric, pe_ratio numeric, book_value numeric, pb_ratio numeric, roe numeric, dividend_yield numeric,
  beta numeric, volatility numeric, avg_volume_10d numeric, avg_volume_30d numeric,
  sma_20 numeric, sma_50 numeric, sma_200 numeric, ema_9 numeric, ema_21 numeric,
  rsi_14 numeric, macd numeric, macd_signal numeric, macd_histogram numeric,
  atr_14 numeric, bollinger_upper numeric, bollinger_middle numeric, bollinger_lower numeric,
  support_1 numeric, support_2 numeric, support_3 numeric,
  resistance_1 numeric, resistance_2 numeric, resistance_3 numeric,
  passes_volume_filter boolean DEFAULT false,
  passes_beta_filter boolean DEFAULT false,
  passes_volatility_filter boolean DEFAULT false,
  in_bullish_sector boolean DEFAULT false,
  last_traded_date timestamptz, indicators_updated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_sector ON stocks(sector_id);
CREATE INDEX IF NOT EXISTS idx_stocks_active ON stocks(is_active);
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_stocks" ON stocks;
CREATE POLICY "anon_select_stocks" ON stocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_stocks" ON stocks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_stocks" ON stocks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_stocks" ON stocks FOR DELETE TO anon, authenticated USING (true);

-- Stock OHLCV (Python backend's historical data, separate from stock_price_history)
CREATE TABLE IF NOT EXISTS stock_ohlcv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stocks(id) ON DELETE CASCADE,
  date date NOT NULL,
  open numeric NOT NULL, high numeric NOT NULL, low numeric NOT NULL, close numeric NOT NULL,
  volume numeric NOT NULL,
  turnover numeric, total_trades integer, adjusted_close numeric,
  change numeric, change_percent numeric, volume_ratio numeric,
  body_size numeric, upper_shadow numeric, lower_shadow numeric, candle_range numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(stock_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ohlcv_stock_id ON stock_ohlcv(stock_id);
CREATE INDEX IF NOT EXISTS idx_ohlcv_date ON stock_ohlcv(date);
ALTER TABLE stock_ohlcv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ohlcv" ON stock_ohlcv;
CREATE POLICY "anon_select_ohlcv" ON stock_ohlcv FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_ohlcv" ON stock_ohlcv FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_ohlcv" ON stock_ohlcv FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_ohlcv" ON stock_ohlcv FOR DELETE TO anon, authenticated USING (true);

-- Signals
CREATE TABLE IF NOT EXISTS signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stocks(id) ON DELETE CASCADE,
  bot_config_id uuid REFERENCES bot_configs(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  status text DEFAULT 'ACTIVE',
  entry_price numeric NOT NULL,
  stop_loss numeric NOT NULL,
  take_profit_1 numeric, take_profit_2 numeric, take_profit_3 numeric,
  risk_amount numeric, reward_amount numeric, risk_reward_ratio numeric, position_size numeric,
  confidence_score numeric NOT NULL,
  sector_score numeric, liquidity_score numeric, depth_score numeric, floorsheet_score numeric, technical_score numeric,
  sector_bullish integer DEFAULT 0, in_demand_zone integer DEFAULT 0,
  has_volume_spike integer DEFAULT 0, has_breakout integer DEFAULT 0,
  has_bid_wall integer DEFAULT 0, has_accumulation integer DEFAULT 0,
  rsi numeric, macd numeric, ema_9 numeric, ema_21 numeric,
  detected_patterns jsonb, signal_reason text, component_details jsonb,
  executed_at timestamptz, executed_price numeric, exit_price numeric, exit_at timestamptz,
  profit_loss numeric, profit_loss_percent numeric,
  valid_until timestamptz,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signals_stock ON signals(stock_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_confidence ON signals(confidence_score);
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_signals" ON signals;
CREATE POLICY "anon_select_signals" ON signals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_signals" ON signals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_signals" ON signals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_signals" ON signals FOR DELETE TO anon, authenticated USING (true);

-- Patterns
CREATE TABLE IF NOT EXISTS patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stocks(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  status text DEFAULT 'FORMING',
  pattern_name text NOT NULL,
  description text,
  level_1 numeric, level_2 numeric, level_3 numeric,
  strength numeric, touches integer, duration_days integer,
  breakout_price numeric, breakout_date date, breakout_volume numeric, volume_confirmation integer DEFAULT 0,
  target_1 numeric, target_2 numeric, target_3 numeric,
  invalidation_level numeric, timeframe text,
  first_detected date NOT NULL,
  last_updated date, confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patterns_stock ON patterns(stock_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON patterns(status);
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_patterns" ON patterns;
CREATE POLICY "anon_select_patterns" ON patterns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_patterns" ON patterns FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_patterns" ON patterns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_patterns" ON patterns FOR DELETE TO anon, authenticated USING (true);

-- Market Depth
CREATE TABLE IF NOT EXISTS market_depth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stocks(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  ltp numeric,
  buy_price_1 numeric, buy_quantity_1 numeric, buy_orders_1 integer,
  buy_price_2 numeric, buy_quantity_2 numeric, buy_orders_2 integer,
  buy_price_3 numeric, buy_quantity_3 numeric, buy_orders_3 integer,
  buy_price_4 numeric, buy_quantity_4 numeric, buy_orders_4 integer,
  buy_price_5 numeric, buy_quantity_5 numeric, buy_orders_5 integer,
  sell_price_1 numeric, sell_quantity_1 numeric, sell_orders_1 integer,
  sell_price_2 numeric, sell_quantity_2 numeric, sell_orders_2 integer,
  sell_price_3 numeric, sell_quantity_3 numeric, sell_orders_3 integer,
  sell_price_4 numeric, sell_quantity_4 numeric, sell_orders_4 integer,
  sell_price_5 numeric, sell_quantity_5 numeric, sell_orders_5 integer,
  total_buy_quantity numeric, total_sell_quantity numeric,
  total_buy_orders integer, total_sell_orders integer,
  order_imbalance numeric, bid_ask_spread numeric, bid_ask_spread_percent numeric,
  liquidity_score numeric, depth_ratio numeric,
  has_bid_wall integer DEFAULT 0, has_ask_wall integer DEFAULT 0,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_depth_stock ON market_depth(stock_id);
CREATE INDEX IF NOT EXISTS idx_depth_timestamp ON market_depth(timestamp);
ALTER TABLE market_depth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_depth" ON market_depth;
CREATE POLICY "anon_select_depth" ON market_depth FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_depth" ON market_depth FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_depth" ON market_depth FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_depth" ON market_depth FOR DELETE TO anon, authenticated USING (true);

-- Floorsheet
CREATE TABLE IF NOT EXISTS floorsheet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stocks(id) ON DELETE CASCADE,
  trade_date date NOT NULL,
  trade_time timestamptz,
  contract_id text UNIQUE,
  buyer_broker_id text NOT NULL,
  buyer_broker_name text,
  seller_broker_id text NOT NULL,
  seller_broker_name text,
  quantity numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  is_institutional integer DEFAULT 0,
  is_cross_trade integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_floorsheet_stock ON floorsheet(stock_id);
CREATE INDEX IF NOT EXISTS idx_floorsheet_date ON floorsheet(trade_date);
CREATE INDEX IF NOT EXISTS idx_floorsheet_buyer ON floorsheet(buyer_broker_id);
CREATE INDEX IF NOT EXISTS idx_floorsheet_seller ON floorsheet(seller_broker_id);
ALTER TABLE floorsheet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_floorsheet" ON floorsheet;
CREATE POLICY "anon_select_floorsheet" ON floorsheet FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_floorsheet" ON floorsheet FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_floorsheet" ON floorsheet FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_floorsheet" ON floorsheet FOR DELETE TO anon, authenticated USING (true);

-- Bot Learning States (RL state per bot)
CREATE TABLE IF NOT EXISTS bot_learning_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id text NOT NULL UNIQUE,
  bot_name text NOT NULL,
  strategy text NOT NULL,
  total_trades integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  timeouts integer DEFAULT 0,
  rolling_accuracy numeric DEFAULT 1.0,
  current_threshold numeric DEFAULT 80.0,
  signal_weights jsonb,
  sector_accuracy jsonb,
  regime_accuracy jsonb,
  sector_counts jsonb,
  regime_counts jsonb,
  mistakes_log jsonb,
  last_lesson text,
  capital_nrs numeric DEFAULT 1000000.0,
  capital_deployed numeric DEFAULT 0.0,
  total_pnl_nrs numeric DEFAULT 0.0,
  peak_capital_nrs numeric DEFAULT 1000000.0,
  max_drawdown_pct numeric DEFAULT 0.0,
  last_trade_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bls_bot_id ON bot_learning_states(bot_id);
ALTER TABLE bot_learning_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_bls" ON bot_learning_states;
CREATE POLICY "anon_select_bls" ON bot_learning_states FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_bls" ON bot_learning_states FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_bls" ON bot_learning_states FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_bls" ON bot_learning_states FOR DELETE TO anon, authenticated USING (true);

-- Live Market Cache
CREATE TABLE IF NOT EXISTS live_market_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  ltp numeric, open_price numeric, high_price numeric, low_price numeric,
  previous_close numeric, percent_change numeric, volume numeric, turnover numeric,
  source text,
  scraped_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lmc_symbol ON live_market_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_lmc_scraped_at ON live_market_cache(scraped_at);
ALTER TABLE live_market_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_lmc" ON live_market_cache;
CREATE POLICY "anon_select_lmc" ON live_market_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_lmc" ON live_market_cache FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_lmc" ON live_market_cache FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_lmc" ON live_market_cache FOR DELETE TO anon, authenticated USING (true);