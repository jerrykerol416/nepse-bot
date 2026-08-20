import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
}

// ─── Fetch live market data from nepse-data function ─────────────────────────

async function fetchLiveMarket(): Promise<Stock[]> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/nepse-data/market/live`, {
    headers: { Authorization: `Bearer ${supabaseKey}` },
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  return json.data || [];
}

// ─── Check if market is open (NST Sun-Thu 11:00-15:00) ──────────────────────

function isMarketOpen(): boolean {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const nstMinutes = utcH * 60 + utcM + 345;
  const nstH = Math.floor(nstMinutes / 60) % 24;
  const day = now.getUTCDay();
  const nstDay = nstMinutes >= 1440 ? (day + 1) % 7 : day;
  const isTradingDay = nstDay >= 0 && nstDay <= 4;
  return isTradingDay && nstH >= 11 && nstH < 15;
}

// ─── Strategy: EMA Crossover ─────────────────────────────────────────────────
// Buys when short-term momentum (% change) crosses above threshold with volume

function emaCrossoverSignals(stocks: Stock[], params: Record<string, number>): Stock[] {
  return stocks.filter((s) => {
    const hasUpMomentum = s.percent_change > 1.5;
    const hasVolume = s.volume > 1000;
    const notOverextended = s.percent_change < 8;
    return hasUpMomentum && hasVolume && notOverextended && s.ltp > 50;
  });
}

// ─── Strategy: Momentum ──────────────────────────────────────────────────────
// Strong movers with high volume — RSI proxy via price position within range

function momentumSignals(stocks: Stock[], params: Record<string, number>): Stock[] {
  const volMult = params.volume_multiplier || 1.5;
  const avgVolume = stocks.reduce((s, st) => s + st.volume, 0) / (stocks.length || 1);
  return stocks.filter((s) => {
    const strongMove = s.percent_change > 2.5;
    const highVolume = s.volume > avgVolume * volMult;
    const priceRange = s.high - s.low;
    const closingStrength = priceRange > 0 ? (s.ltp - s.low) / priceRange : 0;
    return strongMove && highVolume && closingStrength > 0.6 && s.ltp > 100;
  });
}

// ─── Strategy: Volume Breakout ───────────────────────────────────────────────
// Detects sudden volume surges with price breakout

function volumeBreakoutSignals(stocks: Stock[], params: Record<string, number>): Stock[] {
  const surgeFactor = params.volume_surge || 2.0;
  const breakoutPct = params.price_breakout_pct || 2;
  const avgVolume = stocks.reduce((s, st) => s + st.volume, 0) / (stocks.length || 1);
  return stocks.filter((s) => {
    const volumeSurge = s.volume > avgVolume * surgeFactor;
    const priceBreakout = s.percent_change > breakoutPct;
    const notPump = s.percent_change < 10;
    return volumeSurge && priceBreakout && notPump && s.ltp > 50;
  });
}

// ─── Strategy: Mean Reversion ────────────────────────────────────────────────
// Buys oversold stocks (big drops that may bounce)

function meanReversionSignals(stocks: Stock[], params: Record<string, number>): Stock[] {
  return stocks.filter((s) => {
    const oversold = s.percent_change < -2.5 && s.percent_change > -8;
    const hasVolume = s.volume > 500;
    const stillAboveFloor = s.ltp > 20;
    const notFreeFall = s.low > 0 && (s.ltp - s.low) / s.low < 0.05;
    return oversold && hasVolume && stillAboveFloor && notFreeFall;
  });
}

// ─── Strategy: SMC (Smart Money Concepts) ────────────────────────────────────
// Looks for liquidity grabs: stocks that dipped below open then recovered

function smcSignals(stocks: Stock[], params: Record<string, number>): Stock[] {
  return stocks.filter((s) => {
    const liquidityGrab = s.low < s.open && s.ltp > s.open;
    const recovery = s.percent_change > 0.5;
    const hasVolume = s.volume > 1000;
    const spread = s.high - s.low;
    const bullishWick = spread > 0 ? (s.open - s.low) / spread > 0.4 : false;
    return liquidityGrab && recovery && hasVolume && bullishWick;
  });
}

// ─── Strategy: Sector Rotation ───────────────────────────────────────────────
// Picks top performers from leading sectors

function sectorRotationSignals(stocks: Stock[], params: Record<string, number>): Stock[] {
  const bankStocks = stocks.filter((s) =>
    /^(NABIL|NICA|SBI|HBL|EBL|MBL|SANIMA|KBL|NMB|ADBL|PRVU|SBL|CZBIL|BOKL|PCBL|MEGA|LAXMI|GBIME)/.test(s.symbol)
  );
  const hydroStocks = stocks.filter((s) =>
    /^(NHPC|BPCL|CHCL|API|AKPL|HDHPC|SHPC|SJCL|KPCL|UPPER|UMHL|RADHI|RIDI)/.test(s.symbol)
  );

  const bankAvg = bankStocks.length > 0
    ? bankStocks.reduce((s, st) => s + st.percent_change, 0) / bankStocks.length : 0;
  const hydroAvg = hydroStocks.length > 0
    ? hydroStocks.reduce((s, st) => s + st.percent_change, 0) / hydroStocks.length : 0;

  const leadingSector = bankAvg > hydroAvg ? bankStocks : hydroStocks;
  return leadingSector
    .filter((s) => s.percent_change > 1 && s.volume > 1000)
    .sort((a, b) => b.percent_change - a.percent_change)
    .slice(0, 3);
}

// ─── Execute strategy for a bot ──────────────────────────────────────────────

function getSignals(strategy: string, stocks: Stock[], params: Record<string, number>): Stock[] {
  switch (strategy) {
    case "ema_crossover": return emaCrossoverSignals(stocks, params);
    case "momentum": return momentumSignals(stocks, params);
    case "volume_breakout": return volumeBreakoutSignals(stocks, params);
    case "mean_reversion": return meanReversionSignals(stocks, params);
    case "smc": return smcSignals(stocks, params);
    case "sector_rotation": return sectorRotationSignals(stocks, params);
    default: return [];
  }
}

// ─── Place a paper trade ─────────────────────────────────────────────────────

async function placeTrade(
  bot: BotConfig,
  stock: Stock,
  reason: string
): Promise<boolean> {
  const riskPct = bot.parameters.risk_per_trade || 0.02;
  const slPct = bot.parameters.stoploss_pct || 3;
  const tgtPct = bot.parameters.target_pct || 6;

  const riskAmount = bot.available_cash * riskPct;
  const slPrice = stock.ltp * (1 - slPct / 100);
  const riskPerShare = stock.ltp - slPrice;
  if (riskPerShare <= 0) return false;

  let quantity = Math.floor(riskAmount / riskPerShare);
  const maxAffordable = Math.floor(bot.available_cash / stock.ltp);
  quantity = Math.min(quantity, maxAffordable, 100);
  if (quantity <= 0) return false;

  const cost = quantity * stock.ltp;
  const target = stock.ltp * (1 + tgtPct / 100);

  const { error } = await supabase.from("paper_trades").insert({
    bot_id: bot.id,
    symbol: stock.symbol,
    action: "BUY",
    quantity,
    entry_price: stock.ltp,
    stoploss: Math.round(slPrice * 100) / 100,
    target: Math.round(target * 100) / 100,
    status: "open",
    reason,
  });

  if (error) {
    console.error(`Trade insert error for ${bot.name}:`, error.message);
    return false;
  }

  await supabase
    .from("bot_configs")
    .update({ available_cash: bot.available_cash - cost, updated_at: new Date().toISOString() })
    .eq("id", bot.id);

  return true;
}

// ─── Check open trades for stoploss/target hits ──────────────────────────────

async function checkOpenTrades(stocks: Stock[]): Promise<{ closed: number; lessons: number }> {
  const priceMap = new Map(stocks.map((s) => [s.symbol, s]));

  const { data: openTrades } = await supabase
    .from("paper_trades")
    .select("*")
    .eq("status", "open");

  if (!openTrades || openTrades.length === 0) return { closed: 0, lessons: 0 };

  let closed = 0;
  let lessons = 0;

  for (const trade of openTrades as OpenTrade[]) {
    const current = priceMap.get(trade.symbol);
    if (!current) continue;

    const currentPrice = current.ltp;
    let newStatus: string | null = null;
    let pnl = 0;
    let lesson: string | null = null;

    if (currentPrice <= trade.stoploss) {
      newStatus = "stopped_out";
      pnl = (trade.stoploss - trade.entry_price) * trade.quantity;
      lesson = `Stopped out on ${trade.symbol}: entered at ${trade.entry_price}, SL hit at ${trade.stoploss}. ` +
        `Market moved ${current.percent_change.toFixed(1)}% today. ` +
        (current.percent_change < -3
          ? "Broad market weakness - consider tighter SL in downtrends."
          : current.volume > 5000
            ? "High volume sell-off - possible news-driven drop, avoid low-float stocks."
            : "Gradual decline - entry timing was poor, wait for confirmation.");
    } else if (currentPrice >= trade.target) {
      newStatus = "closed_profit";
      pnl = (trade.target - trade.entry_price) * trade.quantity;
    }

    if (newStatus) {
      await supabase
        .from("paper_trades")
        .update({
          status: newStatus,
          exit_price: newStatus === "stopped_out" ? trade.stoploss : trade.target,
          pnl: Math.round(pnl * 100) / 100,
          lesson_learned: lesson,
          closed_at: new Date().toISOString(),
        })
        .eq("id", trade.id);

      // Update bot stats
      const isWin = newStatus === "closed_profit";
      const returnedCash = trade.quantity * (newStatus === "stopped_out" ? trade.stoploss : trade.target);

      const { data: botData } = await supabase
        .from("bot_configs")
        .select("available_cash, total_pnl, win_count, loss_count")
        .eq("id", trade.bot_id)
        .maybeSingle();

      if (botData) {
        await supabase
          .from("bot_configs")
          .update({
            available_cash: botData.available_cash + returnedCash,
            total_pnl: botData.total_pnl + pnl,
            win_count: botData.win_count + (isWin ? 1 : 0),
            loss_count: botData.loss_count + (isWin ? 0 : 1),
            updated_at: new Date().toISOString(),
          })
          .eq("id", trade.bot_id);
      }

      // If stopped out, record learning and adjust parameters
      if (newStatus === "stopped_out" && lesson) {
        await recordLearning(trade.bot_id, trade.id, current, lesson);
        lessons++;
      }

      closed++;
    }
  }

  return { closed, lessons };
}

// ─── Learning: adjust bot parameters after a loss ────────────────────────────

async function recordLearning(
  botId: string,
  tradeId: string,
  stock: Stock,
  lesson: string
): Promise<void> {
  const { data: bot } = await supabase
    .from("bot_configs")
    .select("parameters, loss_count, win_count")
    .eq("id", botId)
    .maybeSingle();

  if (!bot) return;

  const params = bot.parameters as Record<string, number>;
  const totalTrades = (bot.win_count || 0) + (bot.loss_count || 0);
  const winRate = totalTrades > 0 ? (bot.win_count || 0) / totalTrades : 0.5;

  let pattern = "unknown";
  let adjustment = "";
  const oldValue = { ...params };
  const newParams = { ...params };

  // Adaptive learning rules
  if (stock.percent_change < -3) {
    pattern = "broad_market_weakness";
    adjustment = "Tightened stoploss by 0.5% due to market weakness pattern";
    newParams.stoploss_pct = Math.max(1.5, (params.stoploss_pct || 3) - 0.5);
  } else if (stock.volume > 10000 && stock.percent_change < -2) {
    pattern = "high_volume_selloff";
    adjustment = "Increased volume threshold to avoid catching falling knives";
    newParams.volume_multiplier = (params.volume_multiplier || 1.5) + 0.3;
  } else if (winRate < 0.4 && totalTrades > 5) {
    pattern = "low_win_rate";
    adjustment = "Reduced risk per trade due to low win rate";
    newParams.risk_per_trade = Math.max(0.01, (params.risk_per_trade || 0.02) - 0.005);
  } else {
    pattern = "general_loss";
    adjustment = "Widened target slightly to improve reward-to-risk ratio";
    newParams.target_pct = (params.target_pct || 6) + 0.5;
  }

  // Apply learning
  await supabase
    .from("bot_configs")
    .update({ parameters: newParams, updated_at: new Date().toISOString() })
    .eq("id", botId);

  await supabase.from("bot_learning_log").insert({
    bot_id: botId,
    trade_id: tradeId,
    pattern,
    adjustment,
    old_value: oldValue,
    new_value: newParams,
  });
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const marketOpen = isMarketOpen();
    const stocks = await fetchLiveMarket();

    if (stocks.length === 0) {
      const result = {
        status: "no_data",
        market_open: marketOpen,
        message: "Could not fetch live market data",
        timestamp: new Date().toISOString(),
      };
      await supabase.from("bot_run_log").insert({
        market_open: marketOpen,
        bots_run: 0,
        trades_placed: 0,
        trades_closed: 0,
        errors: { message: "No market data available" },
        duration_ms: Date.now() - startTime,
      });
      return json(result);
    }

    // Always check open trades (even outside market hours for after-hours data)
    const { closed, lessons } = await checkOpenTrades(stocks);

    let tradesPlaced = 0;
    let botsRun = 0;

    // Only place NEW trades during market hours
    if (marketOpen) {
      const { data: bots } = await supabase
        .from("bot_configs")
        .select("*")
        .eq("is_active", true);

      if (bots && bots.length > 0) {
        for (const bot of bots as BotConfig[]) {
          botsRun++;

          // Check how many open trades this bot has (max 3 concurrent)
          const { count } = await supabase
            .from("paper_trades")
            .select("*", { count: "exact", head: true })
            .eq("bot_id", bot.id)
            .eq("status", "open");

          if ((count || 0) >= 3) continue;
          if (bot.available_cash < bot.budget * 0.1) continue;

          const signals = getSignals(bot.strategy, stocks, bot.parameters);
          if (signals.length === 0) continue;

          // Pick top signal (highest percent change for momentum, lowest for mean reversion)
          const pick = bot.strategy === "mean_reversion"
            ? signals.sort((a, b) => a.percent_change - b.percent_change)[0]
            : signals.sort((a, b) => b.percent_change - a.percent_change)[0];

          // Don't trade same symbol if already in a position
          const { count: existing } = await supabase
            .from("paper_trades")
            .select("*", { count: "exact", head: true })
            .eq("bot_id", bot.id)
            .eq("symbol", pick.symbol)
            .eq("status", "open");

          if ((existing || 0) > 0) continue;

          const reason = `${bot.strategy}: ${pick.symbol} at ${pick.ltp} (${pick.percent_change > 0 ? "+" : ""}${pick.percent_change.toFixed(1)}%, vol: ${pick.volume.toLocaleString()})`;
          const placed = await placeTrade(bot, pick, reason);
          if (placed) tradesPlaced++;
        }
      }
    }

    const duration = Date.now() - startTime;

    await supabase.from("bot_run_log").insert({
      market_open: marketOpen,
      bots_run: botsRun,
      trades_placed: tradesPlaced,
      trades_closed: closed,
      duration_ms: duration,
    });

    return json({
      status: "ok",
      market_open: marketOpen,
      stocks_available: stocks.length,
      bots_run: botsRun,
      trades_placed: tradesPlaced,
      trades_closed: closed,
      lessons_learned: lessons,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - startTime;
    await supabase.from("bot_run_log").insert({
      market_open: false,
      bots_run: 0,
      trades_placed: 0,
      trades_closed: 0,
      errors: { message },
      duration_ms: duration,
    }).catch(() => {});
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
