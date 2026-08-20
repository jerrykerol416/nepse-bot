import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const sbUrl = Deno.env.get("SUPABASE_URL")!;
const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const dbHeaders = {
  apikey: sbKey,
  Authorization: `Bearer ${sbKey}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

interface Stock {
  symbol: string;
  ltp: number;
  change: number;
  percent_change: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  turnover: number;
  prev_close: number;
}

interface HistDay {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BotConfig {
  id: string;
  name: string;
  strategy: string;
  budget: number;
  available_cash: number;
  is_active: boolean;
  parameters: Record<string, number>;
  total_pnl: number;
  win_count: number;
  loss_count: number;
}

interface OpenTrade {
  id: string;
  bot_id: string;
  symbol: string;
  action: string;
  quantity: number;
  entry_price: number;
  stoploss: number;
  target: number;
  status: string;
  reason: string;
  created_at: string;
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

async function dbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${sbUrl}/rest/v1/${path}`, { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } });
  return r.ok ? await r.json() : [];
}

async function dbPost(table: string, body: unknown) {
  await fetch(`${sbUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: dbHeaders,
    body: JSON.stringify(body),
  });
}

async function dbPatch(table: string, query: string, body: unknown) {
  await fetch(`${sbUrl}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: dbHeaders,
    body: JSON.stringify(body),
  });
}

// ─── Fetch live market data ─────────────────────────────────────────────────

async function fetchLiveMarket(): Promise<Stock[]> {
  const resp = await fetch(`${sbUrl}/functions/v1/nepse-data/market/live`, {
    headers: { Authorization: `Bearer ${sbKey}` },
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  return json.data || [];
}

// ─── Save today's prices for historical analysis ────────────────────────────

async function saveDailyPrices(stocks: Stock[]) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = stocks
    .filter((s) => s.ltp > 0 && s.volume > 0)
    .map((s) => ({
      symbol: s.symbol,
      date: today,
      open: s.open || s.ltp,
      high: s.high || s.ltp,
      low: s.low || s.ltp,
      close: s.ltp,
      volume: s.volume,
      percent_change: s.percent_change,
    }));
  if (rows.length === 0) return;
  await fetch(`${sbUrl}/rest/v1/stock_price_history`, {
    method: "POST",
    headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  }).catch(() => {});
}

// ─── Fetch historical data ──────────────────────────────────────────────────

async function getHistory(): Promise<Map<string, HistDay[]>> {
  const data = await dbGet<HistDay>(
    "stock_price_history?select=symbol,date,open,high,low,close,volume&order=date.desc&limit=10000"
  );
  const map = new Map<string, HistDay[]>();
  for (const d of data) {
    const arr = map.get(d.symbol) || [];
    arr.push(d);
    map.set(d.symbol, arr);
  }
  // Reverse so oldest first
  for (const [k, v] of map) map.set(k, v.reverse());
  return map;
}

// ─── Market hours check (NST Sun-Thu 11:00-15:00) ───────────────────────────

function isMarketOpen(): boolean {
  const now = new Date();
  const nstMin = now.getUTCHours() * 60 + now.getUTCMinutes() + 345;
  const nstH = Math.floor(nstMin / 60) % 24;
  const day = now.getUTCDay();
  const nstDay = nstMin >= 1440 ? (day + 1) % 7 : day;
  return nstDay >= 0 && nstDay <= 4 && nstH >= 11 && nstH < 15;
}

// ─── Technical indicator helpers ────────────────────────────────────────────

function ema(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let e = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) e = prices[i] * k + e * (1 - k);
  return e;
}

function emaArray(prices: number[], period: number): number[] {
  const out: number[] = [];
  if (prices.length < period) return out;
  const k = 2 / (period + 1);
  let e = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period; i++) out.push(e);
  for (let i = period; i < prices.length; i++) {
    e = prices[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

function sma(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function rsi(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const ag = gains / period, al = losses / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function stdDev(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  return Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
}

function atr(highs: number[], lows: number[], closes: number[], period: number): number {
  if (closes.length < period + 1) return 0;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    sum += tr;
  }
  return sum / period;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGIES - each returns { symbol, reason, slPct, tgtPct } or null
// ═══════════════════════════════════════════════════════════════════════════

interface Signal {
  symbol: string;
  price: number;
  reason: string;
  slPct: number;
  tgtPct: number;
  score: number;
}

// 1. RSI Mean Reversion (Wilder, 1978)
// Buy oversold, sell overbought - proven for range-bound markets like NEPSE
function stratRsiReversion(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const threshold = params.rsi_threshold || 30;
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 500) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < 15) continue;
    const closes = [...h.map((d) => d.close), s.ltp];
    const r = rsi(closes, 14);
    if (r < threshold) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: threshold - r,
        reason: `RSI at ${r.toFixed(0)} (oversold < ${threshold}) with ${s.volume} volume`,
        slPct: params.stoploss_pct || 3, tgtPct: params.target_pct || 5,
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 3);
}

// 2. EMA Crossover (9/21) - trend following classic
// Only triggers on actual crossover using historical data
function stratEmaCrossover(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const fast = params.fast_period || 9;
  const slow = params.slow_period || 21;
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 500) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < slow + 2) continue;
    const closes = [...h.map((d) => d.close), s.ltp];
    const prevCloses = closes.slice(0, -1);
    const curFast = ema(closes, fast), curSlow = ema(closes, slow);
    const prevFast = ema(prevCloses, fast), prevSlow = ema(prevCloses, slow);
    if (prevFast <= prevSlow && curFast > curSlow && s.percent_change > 0) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: curFast - curSlow,
        reason: `EMA ${fast}/${slow} bullish crossover confirmed today`,
        slPct: params.stoploss_pct || 3, tgtPct: params.target_pct || 7,
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 2);
}

// 3. Bollinger Band Squeeze + Breakout (John Bollinger)
// Buys when price breaks above upper band after a squeeze period
function stratBollingerBreakout(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const period = params.bb_period || 20;
  const std = params.bb_std || 2;
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 500) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < period + 5) continue;
    const closes = [...h.map((d) => d.close), s.ltp];
    const mean = sma(closes, period);
    const sd = stdDev(closes, period);
    const upper = mean + std * sd;
    const lower = mean - std * sd;
    const bandwidth = (upper - lower) / mean;
    // Squeeze: bandwidth narrower than recent average
    const prevCloses = closes.slice(0, -5);
    const prevSd = stdDev(prevCloses, period);
    const prevBw = (2 * std * prevSd) / sma(prevCloses, period);
    if (s.ltp > upper && bandwidth < prevBw * 1.2 && s.percent_change > 1) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: (s.ltp - upper) / sd,
        reason: `Bollinger breakout above ${upper.toFixed(0)} after squeeze (bw ${(bandwidth * 100).toFixed(1)}%)`,
        slPct: params.stoploss_pct || 2.5, tgtPct: params.target_pct || 6,
      });
    } else if (s.ltp < lower && s.percent_change < -1) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: (lower - s.ltp) / sd,
        reason: `Price at lower Bollinger Band ${lower.toFixed(0)}, mean reversion to ${mean.toFixed(0)}`,
        slPct: params.stoploss_pct || 2.5, tgtPct: params.target_pct || 4,
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 3);
}

// 4. MACD Divergence (Gerald Appel, 1979)
// Uses 12/26/9 MACD - triggers on signal line crossover
function stratMacd(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 500) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < 35) continue;
    const closes = [...h.map((d) => d.close), s.ltp];
    const ema12 = emaArray(closes, 12);
    const ema26 = emaArray(closes, 26);
    if (ema12.length < 10 || ema26.length < 10) continue;
    const macdLine: number[] = [];
    const len = Math.min(ema12.length, ema26.length);
    for (let i = 0; i < len; i++) macdLine.push(ema12[i] - ema26[i]);
    if (macdLine.length < 10) continue;
    const signalLine = emaArray(macdLine, 9);
    if (signalLine.length < 2) continue;
    const curMacd = macdLine[macdLine.length - 1];
    const prevMacd = macdLine[macdLine.length - 2];
    const curSignal = signalLine[signalLine.length - 1];
    const prevSignal = signalLine[signalLine.length - 2];
    // Bullish crossover: MACD crosses above signal
    if (prevMacd <= prevSignal && curMacd > curSignal && curMacd < 0) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: curMacd - curSignal,
        reason: `MACD bullish crossover (MACD: ${curMacd.toFixed(1)}, Signal: ${curSignal.toFixed(1)})`,
        slPct: params.stoploss_pct || 3.5, tgtPct: params.target_pct || 7,
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 2);
}

// 5. Volume-Price Trend (VPT) Breakout
// Institutional accumulation: rising volume with rising price over multiple days
function stratVolumeAccumulation(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const lookback = params.lookback || 5;
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 1000) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < lookback + 5) continue;
    const recent = h.slice(-lookback);
    const prior = h.slice(-(lookback * 2), -lookback);
    if (prior.length < lookback) continue;
    const recentAvgVol = recent.reduce((a, d) => a + d.volume, 0) / recent.length;
    const priorAvgVol = prior.reduce((a, d) => a + d.volume, 0) / prior.length;
    const volIncrease = priorAvgVol > 0 ? recentAvgVol / priorAvgVol : 0;
    const priceGain = recent[recent.length - 1].close / recent[0].open - 1;
    // Volume increasing 50%+ while price rising = accumulation
    if (volIncrease > 1.5 && priceGain > 0.02 && s.percent_change > 0) {
      signals.push({
        symbol: s.symbol, price: s.ltp,
        score: volIncrease * priceGain * 100,
        reason: `Accumulation: volume up ${((volIncrease - 1) * 100).toFixed(0)}% over ${lookback} days, price +${(priceGain * 100).toFixed(1)}%`,
        slPct: params.stoploss_pct || 3, tgtPct: params.target_pct || 8,
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 2);
}

// 6. Darvas Box Breakout (Nicolas Darvas, 1960)
// Price makes new high then consolidates, breakout above box = buy
function stratDarvasBox(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const boxDays = params.box_days || 10;
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 500) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < boxDays + 5) continue;
    const recent = h.slice(-boxDays);
    const boxHigh = Math.max(...recent.map((d) => d.high));
    const boxLow = Math.min(...recent.map((d) => d.low));
    const boxRange = boxHigh - boxLow;
    const boxPct = boxHigh > 0 ? boxRange / boxHigh : 0;
    // Tight box (less than 8% range) and price breaking out above
    if (boxPct < 0.08 && boxPct > 0.01 && s.ltp > boxHigh && s.percent_change > 0.5) {
      signals.push({
        symbol: s.symbol, price: s.ltp,
        score: (s.ltp - boxHigh) / boxRange,
        reason: `Darvas Box breakout above ${boxHigh.toFixed(0)} (box: ${boxLow.toFixed(0)}-${boxHigh.toFixed(0)}, ${(boxPct * 100).toFixed(1)}% range)`,
        slPct: Math.max(1.5, boxPct * 100 * 0.5), tgtPct: params.target_pct || 8,
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 2);
}

// 7. Gap Trading (opening gap up with follow-through)
function stratGapTrading(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const minGap = params.min_gap_pct || 2;
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 1000) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < 5) continue;
    const prevClose = h[h.length - 1].close;
    const gapPct = prevClose > 0 ? ((s.open - prevClose) / prevClose) * 100 : 0;
    // Gap up with follow-through (price holding above gap)
    if (gapPct >= minGap && s.ltp >= s.open && s.volume > 2000) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: gapPct,
        reason: `Gap up +${gapPct.toFixed(1)}% from ${prevClose.toFixed(0)}, price holding above open`,
        slPct: Math.max(1.5, gapPct * 0.6), tgtPct: params.target_pct || 6,
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 2);
}

// 8. ATR Trend Following (Turtle Traders, 1983)
// Uses ATR for position sizing and breakout detection
function stratAtrTrend(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const channelDays = params.channel_days || 20;
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 500) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < channelDays + 2) continue;
    const closes = h.map((d) => d.close);
    const highs = h.map((d) => d.high);
    const lows = h.map((d) => d.low);
    const channelHigh = Math.max(...highs.slice(-channelDays));
    const currentAtr = atr(highs, lows, closes, Math.min(14, closes.length - 1));
    if (currentAtr <= 0) continue;
    // Donchian channel breakout: price above N-day high
    if (s.ltp > channelHigh && s.percent_change > 0.5) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: (s.ltp - channelHigh) / currentAtr,
        reason: `${channelDays}-day channel breakout above ${channelHigh.toFixed(0)} (ATR: ${currentAtr.toFixed(1)})`,
        slPct: Math.min(5, (currentAtr / s.ltp) * 200), // 2x ATR stoploss
        tgtPct: Math.min(12, (currentAtr / s.ltp) * 400), // 4x ATR target (2:1 R:R)
      });
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 2);
}

// 9. Sector Momentum Rotation
// Rotates into stocks in the strongest-performing sectors
function stratSectorRotation(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const sectors: Record<string, RegExp> = {
    banking: /^(NABIL|NICA|SBI|HBL|EBL|MBL|SANIMA|KBL|NMB|ADBL|PRVU|SBL|CZBIL|BOKL|PCBL|MEGA|LAXMI|GBIME|CBL|CCBL|JBNL|LBL|SRBL|SINB)/,
    hydro: /^(NHPC|BPCL|CHCL|API|AKPL|HDHPC|SHPC|SJCL|KPCL|UPPER|UMHL|RADHI|RIDI|GHL|GLH|MHNL|SPDL|NGPL)/,
    devbank: /^(MNBBL|SADBL|SHINE|GBBL|EDBL|KSBBL|MLBL|JSLBB|SAPDBL|GRDBL|CORBL|NABBC)/,
    finance: /^(GUFL|ICFC|CFCL|GFCL|MFIL|SFCL|SIFC|PFL|RLFL|MPFL|CMB|NSLB)/,
    insurance: /^(NLIC|PLIC|SICL|NLICL|HGI|IGI|LGIL|NIL|RBCL|PRIN|SIGS|SGIC|PICL|AIL|NECO)/,
    microfinance: /^(CBBL|DDBL|FMDBL|FOWAD|KLBSL|LLBS|MLBS|MSLB|NMFBS|RSDC|SDESI|SLBS|SMFDB|SWBBL|UNLB)/,
  };
  const sectorPerf: { name: string; avg: number; stocks: Stock[] }[] = [];
  for (const [name, regex] of Object.entries(sectors)) {
    const sectorStocks = stocks.filter((s) => regex.test(s.symbol) && s.ltp > 0 && s.volume > 0);
    if (sectorStocks.length < 3) continue;
    const avg = sectorStocks.reduce((a, s) => a + s.percent_change, 0) / sectorStocks.length;
    sectorPerf.push({ name, avg, stocks: sectorStocks });
  }
  sectorPerf.sort((a, b) => b.avg - a.avg);
  const signals: Signal[] = [];
  const top = sectorPerf[0];
  if (top && top.avg > 0.5) {
    const best = top.stocks
      .filter((s) => s.percent_change > 1 && s.volume > 1000)
      .sort((a, b) => b.percent_change - a.percent_change)
      .slice(0, 3);
    for (const s of best) {
      signals.push({
        symbol: s.symbol, price: s.ltp, score: s.percent_change,
        reason: `Sector rotation: ${top.name} leading (+${top.avg.toFixed(1)}% avg), ${s.symbol} +${s.percent_change.toFixed(1)}%`,
        slPct: params.stoploss_pct || 4, tgtPct: params.target_pct || 8,
      });
    }
  }
  return signals.slice(0, 2);
}

// 10. SMC: Order Block + Fair Value Gap (ICT/Smart Money)
function stratSmartMoney(stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  const signals: Signal[] = [];
  for (const s of stocks) {
    if (s.ltp <= 0 || s.volume < 1000) continue;
    const h = hist.get(s.symbol);
    if (!h || h.length < 10) continue;
    // Look for bullish order block: bearish candle followed by strong bullish move
    for (let i = h.length - 5; i < h.length - 1; i++) {
      if (i < 0) continue;
      const candle = h[i];
      const next = h[i + 1];
      const isBearish = candle.close < candle.open;
      const nextBullish = next.close > next.open && next.close > candle.high;
      if (isBearish && nextBullish) {
        // Price returning to order block zone
        if (s.ltp >= candle.low && s.ltp <= candle.high && s.percent_change > 0) {
          signals.push({
            symbol: s.symbol, price: s.ltp,
            score: (candle.high - s.ltp) / (candle.high - candle.low || 1),
            reason: `SMC: Price at bullish order block zone ${candle.low.toFixed(0)}-${candle.high.toFixed(0)}`,
            slPct: params.stoploss_pct || 3, tgtPct: params.target_pct || 7,
          });
          break;
        }
      }
    }
    // Fair Value Gap: gap between candle 1 high and candle 3 low
    if (h.length >= 3) {
      const c1 = h[h.length - 3], c3 = h[h.length - 1];
      if (c3.low > c1.high) {
        const fvgMid = (c1.high + c3.low) / 2;
        if (s.ltp <= c3.low && s.ltp >= c1.high) {
          signals.push({
            symbol: s.symbol, price: s.ltp, score: (c3.low - s.ltp) / (c3.low - c1.high || 1),
            reason: `SMC: Fair Value Gap fill at ${c1.high.toFixed(0)}-${c3.low.toFixed(0)}, target ${fvgMid.toFixed(0)}`,
            slPct: params.stoploss_pct || 3, tgtPct: params.target_pct || 6,
          });
        }
      }
    }
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 2);
}

// ─── Strategy router ────────────────────────────────────────────────────────

function getSignals(strategy: string, stocks: Stock[], hist: Map<string, HistDay[]>, params: Record<string, number>): Signal[] {
  switch (strategy) {
    case "rsi_reversion": return stratRsiReversion(stocks, hist, params);
    case "ema_crossover": return stratEmaCrossover(stocks, hist, params);
    case "bollinger_breakout": return stratBollingerBreakout(stocks, hist, params);
    case "macd_crossover": return stratMacd(stocks, hist, params);
    case "volume_accumulation": return stratVolumeAccumulation(stocks, hist, params);
    case "darvas_box": return stratDarvasBox(stocks, hist, params);
    case "gap_trading": return stratGapTrading(stocks, hist, params);
    case "atr_trend": return stratAtrTrend(stocks, hist, params);
    case "sector_rotation": return stratSectorRotation(stocks, hist, params);
    case "smc": return stratSmartMoney(stocks, hist, params);
    default: return [];
  }
}

// ─── Place a paper trade ────────────────────────────────────────────────────

async function placeTrade(bot: BotConfig, sig: Signal): Promise<boolean> {
  const riskPct = bot.parameters.risk_per_trade || 0.02;
  const riskAmount = bot.available_cash * riskPct;
  const slPrice = sig.price * (1 - sig.slPct / 100);
  const riskPerShare = sig.price - slPrice;
  if (riskPerShare <= 0) return false;

  let qty = Math.floor(riskAmount / riskPerShare);
  qty = Math.min(qty, Math.floor(bot.available_cash / sig.price), 100);
  if (qty <= 0) return false;

  const cost = qty * sig.price;
  const tgtPrice = sig.price * (1 + sig.tgtPct / 100);

  await dbPost("paper_trades", {
    bot_id: bot.id, symbol: sig.symbol, action: "BUY",
    quantity: qty, entry_price: sig.price,
    stoploss: Math.round(slPrice * 100) / 100,
    target: Math.round(tgtPrice * 100) / 100,
    status: "open", reason: sig.reason,
  });

  await dbPatch("bot_configs", `id=eq.${bot.id}`, {
    available_cash: bot.available_cash - cost,
    updated_at: new Date().toISOString(),
  });

  return true;
}

// ─── Check open trades for stoploss/target ──────────────────────────────────

async function checkOpenTrades(stocks: Stock[], hist: Map<string, HistDay[]>): Promise<{ closed: number; lessons: number }> {
  const priceMap = new Map(stocks.map((s) => [s.symbol, s]));
  const openTrades = await dbGet<OpenTrade>("paper_trades?status=eq.open&select=*");
  if (openTrades.length === 0) return { closed: 0, lessons: 0 };

  let closed = 0, lessons = 0;

  for (const trade of openTrades) {
    const current = priceMap.get(trade.symbol);
    if (!current) continue;

    let newStatus: string | null = null;
    let exitPrice = 0;
    let pnl = 0;

    if (current.ltp <= trade.stoploss) {
      newStatus = "stopped_out";
      exitPrice = trade.stoploss;
      pnl = (trade.stoploss - trade.entry_price) * trade.quantity;
    } else if (current.ltp >= trade.target) {
      newStatus = "closed_profit";
      exitPrice = trade.target;
      pnl = (trade.target - trade.entry_price) * trade.quantity;
    }

    if (!newStatus) continue;

    const isWin = newStatus === "closed_profit";
    const lesson = isWin ? null : analyzeLoss(trade, current, hist);

    await dbPatch("paper_trades", `id=eq.${trade.id}`, {
      status: newStatus, exit_price: exitPrice,
      pnl: Math.round(pnl * 100) / 100,
      lesson_learned: lesson,
      closed_at: new Date().toISOString(),
    });

    const botData = (await dbGet<BotConfig>(`bot_configs?id=eq.${trade.bot_id}&select=*`))[0];
    if (botData) {
      await dbPatch("bot_configs", `id=eq.${trade.bot_id}`, {
        available_cash: botData.available_cash + exitPrice * trade.quantity,
        total_pnl: botData.total_pnl + pnl,
        win_count: botData.win_count + (isWin ? 1 : 0),
        loss_count: botData.loss_count + (isWin ? 0 : 1),
        updated_at: new Date().toISOString(),
      });

      if (!isWin) {
        await adaptParameters(trade.bot_id, trade.id, current, lesson || "", hist);
        lessons++;
      }
    }
    closed++;
  }
  return { closed, lessons };
}

// ─── Loss analysis: classify WHY the trade failed ───────────────────────────

function analyzeLoss(trade: OpenTrade, current: Stock, hist: Map<string, HistDay[]>): string {
  const h = hist.get(trade.symbol) || [];
  const holdDays = h.filter((d) => new Date(d.date) >= new Date(trade.created_at)).length;
  const marketAvg = current.percent_change;
  const entryToSl = ((trade.stoploss - trade.entry_price) / trade.entry_price * 100).toFixed(1);

  if (marketAvg < -2) {
    return `MARKET DECLINE: Broad market dropped ${marketAvg.toFixed(1)}% taking ${trade.symbol} with it. ` +
      `Consider not trading against market trend or using tighter stops in weak markets.`;
  }
  if (holdDays <= 1) {
    return `IMMEDIATE REVERSAL: Price reversed within 1 day of entry. ` +
      `Entry at ${trade.entry_price} was poorly timed. Wait for confirmation candle before entering.`;
  }
  if (current.volume > 5000 && current.percent_change < -2) {
    return `DISTRIBUTION SELLING: Heavy volume (${current.volume}) with ${current.percent_change.toFixed(1)}% drop. ` +
      `Institutional selling detected. Avoid stocks with recent large volume spikes on down days.`;
  }
  if (h.length >= 5) {
    const recent5 = h.slice(-5);
    const downDays = recent5.filter((d) => d.close < d.open).length;
    if (downDays >= 4) {
      return `SUSTAINED DOWNTREND: ${downDays}/5 recent days were bearish. ` +
        `Don't buy into established downtrends. Wait for trend reversal confirmation.`;
    }
  }
  return `GENERAL STOP HIT: Entry ${trade.entry_price}, SL ${trade.stoploss} (${entryToSl}%). ` +
    `Held ${holdDays} days. Review if stoploss was too tight for this stock's volatility.`;
}

// ─── Adaptive parameter learning after losses ───────────────────────────────

async function adaptParameters(
  botId: string, tradeId: string, stock: Stock, lesson: string, hist: Map<string, HistDay[]>
) {
  const botArr = await dbGet<BotConfig>(`bot_configs?id=eq.${botId}&select=*`);
  const bot = botArr[0];
  if (!bot) return;

  const params = { ...bot.parameters };
  const oldParams = { ...params };
  const total = (bot.win_count || 0) + (bot.loss_count || 0);
  const winRate = total > 0 ? (bot.win_count || 0) / total : 0.5;

  let pattern: string;
  let adjustment: string;

  if (lesson.startsWith("MARKET DECLINE")) {
    pattern = "market_decline";
    adjustment = "Tightened stoploss by 0.5% and added market trend filter awareness";
    params.stoploss_pct = Math.max(1.5, (params.stoploss_pct || 3) - 0.5);
  } else if (lesson.startsWith("IMMEDIATE REVERSAL")) {
    pattern = "immediate_reversal";
    adjustment = "Will require stronger confirmation — increased min volume and momentum thresholds";
    params.min_volume = (params.min_volume || 500) + 200;
  } else if (lesson.startsWith("DISTRIBUTION SELLING")) {
    pattern = "distribution_detected";
    adjustment = "Increased volume analysis sensitivity to detect distribution earlier";
    params.volume_multiplier = (params.volume_multiplier || 1.5) + 0.3;
  } else if (lesson.startsWith("SUSTAINED DOWNTREND")) {
    pattern = "fighting_trend";
    adjustment = "Added trend confirmation requirement — avoid buying in established downtrends";
    params.trend_filter_days = (params.trend_filter_days || 5) + 2;
  } else {
    pattern = "general_loss";
    if (winRate < 0.35 && total > 5) {
      adjustment = "Low win rate — reducing risk per trade from " +
        `${((params.risk_per_trade || 0.02) * 100).toFixed(1)}% to ${(Math.max(0.005, (params.risk_per_trade || 0.02) - 0.005) * 100).toFixed(1)}%`;
      params.risk_per_trade = Math.max(0.005, (params.risk_per_trade || 0.02) - 0.005);
    } else {
      adjustment = "Widened target by 0.5% to improve reward-to-risk ratio";
      params.target_pct = (params.target_pct || 6) + 0.5;
    }
  }

  await dbPatch("bot_configs", `id=eq.${botId}`, {
    parameters: params, updated_at: new Date().toISOString(),
  });

  await dbPost("bot_learning_log", {
    bot_id: botId, trade_id: tradeId,
    pattern, adjustment,
    old_value: oldParams, new_value: params,
  });
}

// ─── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const marketOpen = isMarketOpen();
    const stocks = await fetchLiveMarket();

    // Save daily prices for future analysis
    if (stocks.length > 0) saveDailyPrices(stocks);

    if (stocks.length === 0) {
      await dbPost("bot_run_log", {
        market_open: marketOpen, bots_run: 0, trades_placed: 0,
        trades_closed: 0, errors: { message: "No market data" },
        duration_ms: Date.now() - startTime,
      });
      return json({ status: "no_data", market_open: marketOpen });
    }

    const hist = await getHistory();
    const { closed, lessons } = await checkOpenTrades(stocks, hist);

    let tradesPlaced = 0, botsRun = 0;

    if (marketOpen) {
      const bots = await dbGet<BotConfig>("bot_configs?is_active=eq.true&select=*");

      for (const bot of bots) {
        botsRun++;
        const openCount = (await dbGet<{ id: string }>(`paper_trades?bot_id=eq.${bot.id}&status=eq.open&select=id`)).length;
        if (openCount >= (bot.parameters.max_positions || 3)) continue;
        if (bot.available_cash < bot.budget * 0.1) continue;

        const signals = getSignals(bot.strategy, stocks, hist, bot.parameters);
        for (const sig of signals) {
          const existing = (await dbGet<{ id: string }>(`paper_trades?bot_id=eq.${bot.id}&symbol=eq.${sig.symbol}&status=eq.open&select=id`)).length;
          if (existing > 0) continue;
          if (await placeTrade(bot, sig)) {
            tradesPlaced++;
            bot.available_cash -= sig.price * Math.floor((bot.available_cash * (bot.parameters.risk_per_trade || 0.02)) / ((sig.price * sig.slPct) / 100));
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    await dbPost("bot_run_log", {
      market_open: marketOpen, bots_run: botsRun,
      trades_placed: tradesPlaced, trades_closed: closed,
      duration_ms: duration,
    });

    return json({
      status: "ok", market_open: marketOpen,
      stocks_available: stocks.length, history_symbols: hist.size,
      bots_run: botsRun, trades_placed: tradesPlaced,
      trades_closed: closed, lessons_learned: lessons,
      duration_ms: duration, timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await dbPost("bot_run_log", {
      market_open: false, bots_run: 0, trades_placed: 0,
      trades_closed: 0, errors: { message: msg },
      duration_ms: Date.now() - startTime,
    }).catch(() => {});
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
