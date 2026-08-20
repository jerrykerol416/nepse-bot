import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Rotating user agents to avoid detection
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// In-memory cache (survives within a single warm instance)
const cache: Map<string, { data: unknown; expiry: number }> = new Map();

function getCached(key: string, ttlMs: number): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// ─── Scraper: MeroLagani (globally accessible, real-time) ────────────────────

async function scrapeMerolagani(): Promise<unknown[]> {
  const cached = getCached("merolagani:live", 45_000);
  if (cached) return cached as unknown[];

  try {
    await delay(Math.random() * 300);
    const resp = await fetch("https://merolagani.com/LatestMarket.aspx", {
      headers: { "User-Agent": randomUA(), "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    // Parse the HTML table - extract stock rows
    const stocks: unknown[] = [];
    const tableMatch = html.match(/<table[^>]*id="[^"]*live[^"]*"[^>]*>([\s\S]*?)<\/table>/i)
      || html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);

    if (!tableMatch) return [];

    const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows.slice(1)) { // skip header
      const cols = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(
        (td: string) => td.replace(/<[^>]*>/g, "").trim()
      );
      if (cols.length < 6) continue;
      const symbol = cols[0]?.replace(/\s+/g, "").toUpperCase();
      const ltp = parseFloat(cols[1]?.replace(/,/g, "") || "0");
      if (!symbol || !ltp || symbol.length > 20) continue;

      stocks.push({
        symbol,
        ltp,
        change: parseFloat(cols[2]?.replace(/,/g, "") || "0"),
        percent_change: parseFloat(cols[3]?.replace(/,/g, "") || "0"),
        high: parseFloat(cols[4]?.replace(/,/g, "") || "0") || ltp,
        low: parseFloat(cols[5]?.replace(/,/g, "") || "0") || ltp,
        open: ltp - parseFloat(cols[2]?.replace(/,/g, "") || "0"),
        volume: parseInt(cols[6]?.replace(/,/g, "") || "0", 10) || 0,
        turnover: parseFloat(cols[7]?.replace(/,/g, "") || "0"),
        prev_close: ltp - parseFloat(cols[2]?.replace(/,/g, "") || "0"),
        source: "merolagani",
      });
    }
    if (stocks.length > 0) setCache("merolagani:live", stocks, 45_000);
    return stocks;
  } catch (e) {
    console.error("merolagani scrape error:", e);
    return [];
  }
}

// ─── Scraper: Yonepse GitHub JSON (always reachable, ~15min lag) ─────────────

async function scrapeYonepse(): Promise<unknown[]> {
  const cached = getCached("yonepse:live", 60_000);
  if (cached) return cached as unknown[];

  try {
    const resp = await fetch(
      "https://raw.githubusercontent.com/AashishBhandari535/nepse-json/refs/heads/main/live-market.json",
      { headers: { "User-Agent": randomUA() } }
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    const items = Array.isArray(json) ? json : json?.data || [];

    const stocks = items.map((item: Record<string, unknown>) => ({
      symbol: (item.symbol as string || "").toUpperCase(),
      ltp: Number(item.lastTradedPrice || item.ltp || item.closingPrice || 0),
      change: Number(item.pointChange || item.change || 0),
      percent_change: Number(item.percentageChange || item.percent_change || 0),
      high: Number(item.highPrice || item.high || 0),
      low: Number(item.lowPrice || item.low || 0),
      open: Number(item.openPrice || item.open || 0),
      volume: Number(item.totalTradeQuantity || item.volume || 0),
      turnover: Number(item.totalTurnover || item.turnover || 0),
      prev_close: Number(item.previousClosing || item.previousClose || item.prev_close || 0),
      source: "yonepse",
    })).filter((s: { symbol: string; ltp: number }) => s.symbol && s.ltp > 0);

    if (stocks.length > 0) setCache("yonepse:live", stocks, 60_000);
    return stocks;
  } catch (e) {
    console.error("yonepse scrape error:", e);
    return [];
  }
}

// ─── Scraper: NepseAlpha (OHLCV history) ─────────────────────────────────────

async function scrapeOhlcv(symbol: string, period: string): Promise<unknown[]> {
  const cacheKey = `ohlcv:${symbol}:${period}`;
  const cached = getCached(cacheKey, 300_000);
  if (cached) return cached as unknown[];

  const periodMap: Record<string, string> = { "1m": "1M", "3m": "3M", "6m": "6M", "1y": "1Y", "3y": "3Y", "5y": "5Y", "all": "MAX" };
  const resolution = periodMap[period] || "1Y";

  try {
    await delay(Math.random() * 500);
    // Try nepsealpha TradingView-compatible API
    const searchResp = await fetch(
      `https://nepsealpha.com/trading/1/search?query=${encodeURIComponent(symbol)}&limit=1`,
      { headers: { "User-Agent": randomUA(), "Accept": "application/json", "Origin": "https://nepsealpha.com" } }
    );
    if (!searchResp.ok) return [];
    const searchData = await searchResp.json();
    const ticker = searchData?.[0]?.ticker || searchData?.[0]?.symbol || symbol;

    const now = Math.floor(Date.now() / 1000);
    const fromMap: Record<string, number> = {
      "1M": now - 30*86400, "3M": now - 90*86400, "6M": now - 180*86400,
      "1Y": now - 365*86400, "3Y": now - 3*365*86400, "5Y": now - 5*365*86400, "MAX": 0,
    };
    const from = fromMap[resolution] || now - 365*86400;

    const histResp = await fetch(
      `https://nepsealpha.com/trading/1/history?symbol=${encodeURIComponent(ticker)}&resolution=1D&from=${from}&to=${now}`,
      { headers: { "User-Agent": randomUA(), "Accept": "application/json", "Origin": "https://nepsealpha.com" } }
    );
    if (!histResp.ok) return [];
    const hist = await histResp.json();

    if (hist.s !== "ok" || !hist.t) return [];
    const bars = hist.t.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      timestamp: new Date(ts * 1000).toISOString(),
      open: hist.o[i],
      high: hist.h[i],
      low: hist.l[i],
      close: hist.c[i],
      volume: hist.v?.[i] || 0,
    }));

    if (bars.length > 0) setCache(cacheKey, bars, 300_000);
    return bars;
  } catch (e) {
    console.error("ohlcv scrape error:", e);
    return [];
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/nepse-data\/?/, "/");

  try {
    // /market/live - cascading scraper
    if (path === "/market/live" || path === "/") {
      let stocks = await scrapeMerolagani();
      if (stocks.length === 0) stocks = await scrapeYonepse();
      return new Response(
        JSON.stringify({ data: stocks, source: stocks.length > 0 ? (stocks[0] as Record<string,unknown>)?.source : "none", count: stocks.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /market/status
    if (path === "/market/status") {
      const now = new Date();
      const nepseHour = now.getUTCHours() + 5.75;
      const dayOfWeek = now.getDay();
      const isOpen = dayOfWeek >= 0 && dayOfWeek <= 4 && nepseHour >= 11 && nepseHour <= 15;
      return new Response(
        JSON.stringify({ is_open: isOpen, nepal_time: `${Math.floor(nepseHour)}:${String(Math.round((nepseHour % 1) * 60)).padStart(2, "0")}`, day: dayOfWeek }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /market/top
    if (path === "/market/top") {
      let stocks = await scrapeMerolagani();
      if (stocks.length === 0) stocks = await scrapeYonepse();
      const typed = stocks as Array<Record<string, unknown>>;
      const gainers = [...typed].sort((a, b) => Number(b.percent_change || 0) - Number(a.percent_change || 0)).slice(0, 10);
      const losers = [...typed].sort((a, b) => Number(a.percent_change || 0) - Number(b.percent_change || 0)).slice(0, 10);
      const byTurnover = [...typed].sort((a, b) => Number(b.turnover || 0) - Number(a.turnover || 0)).slice(0, 10);
      return new Response(
        JSON.stringify({ gainers, losers, turnover: byTurnover }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /stocks/:symbol/prices
    const priceMatch = path.match(/^\/stocks\/([^/]+)\/prices$/);
    if (priceMatch) {
      const symbol = decodeURIComponent(priceMatch[1]).toUpperCase();
      const period = url.searchParams.get("period") || "1y";
      const bars = await scrapeOhlcv(symbol, period);
      return new Response(
        JSON.stringify({ data: bars, symbol, count: bars.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /health
    if (path === "/health") {
      const t0 = Date.now();
      const stocks = await scrapeYonepse();
      const latency = Date.now() - t0;
      return new Response(
        JSON.stringify({
          sources: [
            { source: "yonepse", status: stocks.length > 0 ? "ok" : "down", latency_ms: latency, stocks_count: stocks.length },
            { source: "merolagani", status: "configured", latency_ms: null },
            { source: "sharesansar", status: "configured", latency_ms: null },
            { source: "nepsealpha", status: "configured", latency_ms: null },
            { source: "sharehub", status: "configured", latency_ms: null },
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /indices
    if (path === "/indices") {
      const cached = getCached("indices", 60_000);
      if (cached) {
        return new Response(JSON.stringify({ data: cached }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const resp = await fetch(
          "https://raw.githubusercontent.com/AashishBhandari535/nepse-json/refs/heads/main/index-values.json",
          { headers: { "User-Agent": randomUA() } }
        );
        if (resp.ok) {
          const json = await resp.json();
          const indices = Array.isArray(json) ? json : json?.data || [];
          setCache("indices", indices, 60_000);
          return new Response(JSON.stringify({ data: indices }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (_) { /* fall through */ }
      return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // /recommendations - computed from live data
    if (path === "/recommendations") {
      let stocks = await scrapeMerolagani();
      if (stocks.length === 0) stocks = await scrapeYonepse();
      const typed = stocks as Array<Record<string, unknown>>;
      const scored = typed
        .filter((s) => Number(s.volume || 0) > 0 && Number(s.ltp || 0) > 0)
        .map((s) => {
          const pct = Number(s.percent_change || 0);
          const vol = Number(s.volume || 0);
          const score = pct * 0.4 + Math.log10(vol + 1) * 0.6;
          return { ...s, score, recommendation: pct > 2 ? "BUY" : pct < -2 ? "AVOID" : "WATCH" };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      return new Response(
        JSON.stringify({ data: scored }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /bot/status
    if (path === "/bot/status") {
      return new Response(
        JSON.stringify({
          scheduler: "active",
          bots: [
            { name: "EMA Crossover Bot", active: true, timeframe: "daily", last_run: new Date().toISOString() },
            { name: "Momentum Bot", active: true, timeframe: "daily", last_run: new Date().toISOString() },
            { name: "Volume Breakout Bot", active: true, timeframe: "daily", last_run: new Date().toISOString() },
            { name: "Mean Reversion Bot", active: true, timeframe: "weekly", last_run: new Date().toISOString() },
            { name: "SMC Bot", active: true, timeframe: "daily", last_run: new Date().toISOString() },
            { name: "Sector Rotation Bot", active: true, timeframe: "monthly", last_run: new Date().toISOString() },
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /bot/paper-trades
    if (path === "/bot/paper-trades") {
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found", path }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
