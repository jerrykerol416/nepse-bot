/*
# Create stock price history table for technical analysis

1. New Tables
   - `stock_price_history`
     - `id` (uuid, primary key)
     - `symbol` (text, stock ticker)
     - `date` (date, trading day)
     - `open` (numeric)
     - `high` (numeric)
     - `low` (numeric)
     - `close` (numeric)
     - `volume` (bigint)
     - `percent_change` (numeric)
     - `created_at` (timestamptz)
   - Unique constraint on (symbol, date) to prevent duplicates

2. Security
   - RLS enabled
   - Read access for anon + authenticated (public market data)
   - Insert/update for service role only (via edge functions)

3. Notes
   - Data is collected by the bot-scheduler on each run
   - Used to compute RSI, MACD, moving averages, Bollinger Bands
   - Accumulates over time for better analysis
*/

CREATE TABLE IF NOT EXISTS stock_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  date date NOT NULL,
  open numeric NOT NULL DEFAULT 0,
  high numeric NOT NULL DEFAULT 0,
  low numeric NOT NULL DEFAULT 0,
  close numeric NOT NULL DEFAULT 0,
  volume bigint NOT NULL DEFAULT 0,
  percent_change numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_sph_symbol_date ON stock_price_history(symbol, date DESC);
CREATE INDEX IF NOT EXISTS idx_sph_date ON stock_price_history(date DESC);

ALTER TABLE stock_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sph" ON stock_price_history;
CREATE POLICY "anon_select_sph" ON stock_price_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "service_insert_sph" ON stock_price_history;
CREATE POLICY "service_insert_sph" ON stock_price_history FOR INSERT
  TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_sph" ON stock_price_history;
CREATE POLICY "service_update_sph" ON stock_price_history FOR UPDATE
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_delete_sph" ON stock_price_history;
CREATE POLICY "service_delete_sph" ON stock_price_history FOR DELETE
  TO service_role USING (true);
