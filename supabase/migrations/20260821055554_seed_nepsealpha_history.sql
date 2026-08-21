/*
# Seed stock price history from NepseAlpha API
# Uses pg_net to fetch OHLCV data and insert into stock_price_history
# This gives the bot strategies enough historical data to fire
*/

-- Create a function that fetches and stores history for a symbol
CREATE OR REPLACE FUNCTION seed_stock_history(p_symbol TEXT, p_days INT DEFAULT 365)
RETURNS TABLE(symbol TEXT, bars_inserted INT, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_response JSONB;
  v_t BIGINT[];
  v_o NUMERIC[];
  v_h NUMERIC[];
  v_l NUMERIC[];
  v_c NUMERIC[];
  v_v BIGINT[];
  v_now BIGINT;
  v_from BIGINT;
  v_count INT DEFAULT 0;
  v_i INT;
  v_date DATE;
BEGIN
  v_now := EXTRACT(EPOCH FROM NOW())::BIGINT;
  v_from := v_now - (p_days * 86400);
  v_url := 'https://nepsealpha.com/trading/1/history?symbol=' || upper(p_symbol) || '&resolution=1D&from=' || v_from || '&to=' || v_now;

  BEGIN
    SELECT content INTO v_response FROM http_get(v_url);
    
    IF v_response->>'s' = 'ok' THEN
      v_t := ARRAY(SELECT (jsonb_array_elements(v_response->'t'))::text::BIGINT);
      v_o := ARRAY(SELECT (jsonb_array_elements(v_response->'o'))::text::NUMERIC);
      v_h := ARRAY(SELECT (jsonb_array_elements(v_response->'h'))::text::NUMERIC);
      v_l := ARRAY(SELECT (jsonb_array_elements(v_response->'l'))::text::NUMERIC);
      v_c := ARRAY(SELECT (jsonb_array_elements(v_response->'c'))::text::NUMERIC);
      
      IF jsonb_array_length(v_response->'v') > 0 THEN
        v_v := ARRAY(SELECT COALESCE((jsonb_array_elements(v_response->'v'))::text::BIGINT, 0));
      ELSE
        v_v := ARRAY(SELECT 0 FROM generate_series(1, array_length(v_t, 1)));
      END IF;

      FOR v_i IN 1..array_length(v_t, 1) LOOP
        v_date := to_timestamp(v_t[v_i])::DATE;
        BEGIN
          INSERT INTO stock_price_history (symbol, date, open, high, low, close, volume, percent_change)
          VALUES (upper(p_symbol), v_date, v_o[v_i], v_h[v_i], v_l[v_i], v_c[v_i], v_v[v_i], 0)
          ON CONFLICT (symbol, date) DO UPDATE SET
            open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
            close = EXCLUDED.close, volume = EXCLUDED.volume;
          v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
          -- Skip bad rows
        END;
      END LOOP;
      
      RETURN QUERY SELECT upper(p_symbol), v_count, 'ok';
    ELSE
      RETURN QUERY SELECT upper(p_symbol), 0, 'no_data';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT upper(p_symbol), 0, 'error: ' || SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_stock_history(TEXT, INT) TO authenticated, anon;
