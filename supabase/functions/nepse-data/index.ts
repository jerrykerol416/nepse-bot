import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const cache: Map<string, { data: unknown; expiry: number }> = new Map();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

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
  source: string;
}

// ─── Scraper: MeroLagani ─────────────────────────────────────────────────────
// Columns: Symbol(link) | LTP | %Change | Open | High | Low | Qty | (buttons)

async function scrapeMerolagani(): Promise<Stock[]> {
  const cached = getCached("merolagani:live");
  if (cached) return cached as Stock[];

  try {
    await delay(Math.random() * 200);
    const resp = await fetch("https://merolagani.com/LatestMarket.aspx", {
      headers: {
        "User-Agent": randomUA(),
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    const stocks: Stock[] = [];
    // Match the live-trading table
    const tableMatch = html.match(
      /<table[^>]*class=['"][^'"]*live-trading[^'"]*['"][^>]*>([\s\S]*?)<\/table>/i
    );
    if (!tableMatch) return [];

    const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows) {
      const cols = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(
        (td: string) => td.replace(/<[^>]*>/g, "").trim()
      );
      if (cols.length < 7) continue;

      // Extract symbol from the first <a> tag in first td
      const symbolMatch = row.match(
        /href='[^']*symbol=([^'&]+)'/i
      ) || row.match(/href="[^"]*symbol=([^"&]+)"/i);
      const symbol = symbolMatch
        ? symbolMatch[1].toUpperCase()
        : cols[0].replace(/\s+/g, "").toUpperCase();

      const ltp = parseFloat(cols[1]?.replace(/,/g, "") || "0");
      if (!symbol || !ltp || symbol.length > 20 || symbol.length < 2) continue;

      const pctChange = parseFloat(cols[2]?.replace(/,/g, "") || "0");
      const c3 = parseFloat(cols[3]?.replace(/,/g, "") || "0") || ltp;
      const c4 = parseFloat(cols[4]?.replace(/,/g, "") || "0") || ltp;
      const c5 = parseFloat(cols[5]?.replace(/,/g, "") || "0") || ltp;
      const high = Math.max(c3, c4, c5, ltp);
      const low = Math.min(c3, c4, c5, ltp);
      const openPrice = c3;
      const volume = parseInt(cols[6]?.replace(/,/g, "") || "0", 10) || 0;
      const prevClose = pctChange !== 0 ? ltp / (1 + pctChange / 100) : ltp;
      const change = ltp - prevClose;

      stocks.push({
        symbol,
        ltp,
        change: Math.round(change * 100) / 100,
        percent_change: pctChange,
        high,
        low,
        open: openPrice,
        volume,
        turnover: ltp * volume,
        prev_close: Math.round(prevClose * 100) / 100,
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

// ─── Scraper: ShareSansar ────────────────────────────────────────────────────
// Columns: SN | Symbol(link) | Conf | Open | High | Low | Close/LTP | Close | ... | Vol | PClose | Turnover | ... | Diff | ...

async function scrapeSharesansar(): Promise<Stock[]> {
  const cached = getCached("sharesansar:live");
  if (cached) return cached as Stock[];

  try {
    await delay(Math.random() * 300);
    const resp = await fetch("https://www.sharesansar.com/today-share-price", {
      headers: {
        "User-Agent": randomUA(),
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    const stocks: Stock[] = [];
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) return [];

    const rows = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows) {
      const cols = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(
        (td: string) => td.replace(/<[^>]*>/g, "").trim()
      );
      // sharesansar: 24 columns
      // 0=SN, 1=Symbol, 2=Conf, 3=Open, 4=High, 5=Low, 6=LTP, 7=Close,
      // 8=?, 9=?, 10=VWAP, 11=Vol, 12=PClose, 13=Turnover, 14=Transactions
      // 15=Diff, 16=Range, 17=DiffPct, 18=RangePct, 19=VWAP%
      // 20=120D, 21=180D, 22=52W High, 23=52W Low
      if (cols.length < 15) continue;

      const symbolMatch = row.match(
        /company\/([^"']+)/i
      );
      const symbol = symbolMatch
        ? symbolMatch[1].toUpperCase()
        : cols[1].replace(/\s+/g, "").toUpperCase();

      const ltp = parseFloat(cols[6]?.replace(/,/g, "") || "0");
      if (!symbol || !ltp || symbol.length > 20 || symbol.length < 2) continue;

      const open = parseFloat(cols[3]?.replace(/,/g, "") || "0") || ltp;
      const high = parseFloat(cols[4]?.replace(/,/g, "") || "0") || ltp;
      const low = parseFloat(cols[5]?.replace(/,/g, "") || "0") || ltp;
      const volume = parseFloat(cols[11]?.replace(/,/g, "") || "0") || 0;
      const prevClose = parseFloat(cols[12]?.replace(/,/g, "") || "0") || ltp;
      const turnover = parseFloat(cols[13]?.replace(/,/g, "") || "0") || 0;
      const diff = parseFloat(cols[15]?.replace(/,/g, "") || "0") || 0;
      const pctChange =
        prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0;

      stocks.push({
        symbol,
        ltp,
        change: diff || Math.round((ltp - prevClose) * 100) / 100,
        percent_change: Math.round(pctChange * 100) / 100,
        high,
        low,
        open,
        volume,
        turnover,
        prev_close: prevClose,
        source: "sharesansar",
      });
    }

    if (stocks.length > 0) setCache("sharesansar:live", stocks, 45_000);
    return stocks;
  } catch (e) {
    console.error("sharesansar scrape error:", e);
    return [];
  }
}

// ─── Scraper: NepseAlpha OHLCV ───────────────────────────────────────────────

async function scrapeOhlcv(
  symbol: string,
  period: string
): Promise<unknown[]> {
  const cacheKey = `ohlcv:${symbol}:${period}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as unknown[];

  const now = Math.floor(Date.now() / 1000);
  const fromMap: Record<string, number> = {
    "1m": now - 30 * 86400,
    "3m": now - 90 * 86400,
    "6m": now - 180 * 86400,
    "1y": now - 365 * 86400,
    "3y": now - 3 * 365 * 86400,
    "5y": now - 5 * 365 * 86400,
  };
  const from = fromMap[period] || now - 365 * 86400;

  try {
    await delay(Math.random() * 300);
    const histResp = await fetch(
      `https://nepsealpha.com/trading/1/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${now}`,
      {
        headers: {
          "User-Agent": randomUA(),
          Accept: "application/json",
          Origin: "https://nepsealpha.com",
          Referer: "https://nepsealpha.com/",
        },
      }
    );
    if (!histResp.ok) return [];
    const text = await histResp.text();
    if (text.includes("<!DOCTYPE") || text.includes("cloudflare")) return [];
    const hist = JSON.parse(text);

    if (hist.s !== "ok" || !hist.t) return [];
    const bars = hist.t.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: hist.o[i],
      high: hist.h[i],
      low: hist.l[i],
      close: hist.c[i],
      volume: hist.v?.[i] || 0,
    }));

    if (bars.length > 0) setCache(cacheKey, bars, 300_000);
    return bars;
  } catch (e) {
    console.error("ohlcv error:", e);
    return [];
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

async function getLiveStocks(): Promise<Stock[]> {
  let stocks = await scrapeSharesansar();
  if (stocks.length === 0) stocks = await scrapeMerolagani();
  return stocks;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/nepse-data\/?/, "/");

  try {
    // /market/live
    if (path === "/market/live" || path === "/") {
      const stocks = await getLiveStocks();
      return json({
        data: stocks,
        source: stocks.length > 0 ? stocks[0].source : "none",
        count: stocks.length,
        timestamp: new Date().toISOString(),
      });
    }

    // /market/status
    if (path === "/market/status") {
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcM = now.getUTCMinutes();
      const nstMinutes = utcH * 60 + utcM + 345; // UTC+5:45
      const nstH = Math.floor(nstMinutes / 60) % 24;
      const nstM = nstMinutes % 60;
      const dayOfWeek = ((now.getUTCDay() + (nstMinutes >= 1440 ? 1 : 0)) % 7);
      const isTradingDay = dayOfWeek >= 0 && dayOfWeek <= 4; // Sun-Thu
      const isOpen =
        isTradingDay && nstH >= 11 && (nstH < 15 || (nstH === 15 && nstM === 0));
      return json({
        is_open: isOpen,
        nepal_time: `${nstH}:${String(nstM).padStart(2, "0")}`,
        day: dayOfWeek,
        trading_day: isTradingDay,
      });
    }

    // /market/top
    if (path === "/market/top") {
      const stocks = await getLiveStocks();
      const gainers = [...stocks]
        .sort((a, b) => b.percent_change - a.percent_change)
        .slice(0, 10);
      const losers = [...stocks]
        .sort((a, b) => a.percent_change - b.percent_change)
        .slice(0, 10);
      const turnover = [...stocks]
        .sort((a, b) => b.turnover - a.turnover)
        .slice(0, 10);
      return json({ gainers, losers, turnover });
    }

    // /market/sectors
    if (path === "/market/sectors") {
      const stocks = await getLiveStocks();
      const sectorMap: Record<string, Stock[]> = {};
      // Categorize by common NEPSE sector prefixes
      const sectorRules: [string, RegExp][] = [
        ["Commercial Banks", /^(NABIL|NICA|SBI|HBL|EBL|MBL|SANIMA|KBL|NMB|ADBL|PRVU|SBL|CZBIL|NBL|BOKL|PCBL|MEGA|LAXMI|SRBL|NCCB|GBIME|JBBL|NBB)/],
        ["Development Banks", /^(MNBBL|SADBL|SHINE|MLBL|KSBBL|SAPDBL|CORBL|EDBL|GBBL|GRDBL|JBBL|KRBL|LBBL|MDB|NABBC)/],
        ["Hydropower", /^(NHPC|BPCL|CHCL|API|AKPL|HDHPC|SHPC|SJCL|KPCL|RURU|UMRH|GHL|GLH|MHNL|NGPL|NHDL|RADHI|RIDI|SSHL|UNHPL|UPPER|UMHL)/],
        ["Microfinance", /^(CBBL|DDBL|FOWAD|GILB|GBLBS|JSLB|KLBSL|LLBS|MLBSL|MSLB|NSLB|NLBBL|RMDC|RSDC|SABSL|SDLBSL|SKBBL|SLBSL|SMFDB|SWBBL|USLB|VLBS)/],
        ["Life Insurance", /^(ALICL|CLI|GLICL|HGI|ILI|JLIC|LICN|NLICL|NLIC|PLI|PLIC|RLICL|SLICL|SJLIC|SLI|SNLICL|ULI)/],
        ["Non-Life Insurance", /^(AIL|EIC|GIC|HEI|IGI|LGIL|NBIL|NEL|NIL|NICL|NLG|PICL|PRIN|RBCL|SAIL|SICL|SIL|SPIL|UIC)/],
        ["Hotels & Tourism", /^(CGH|OHL|SHL|TRH|YHL|KDL)/],
        ["Manufacturing", /^(BNT|BSM|FHL|HDL|JSM|NLO|RJM|SHIVM|UNL|NVG)/],
      ];

      for (const s of stocks) {
        let placed = false;
        for (const [sector, regex] of sectorRules) {
          if (regex.test(s.symbol)) {
            (sectorMap[sector] ||= []).push(s);
            placed = true;
            break;
          }
        }
        if (!placed) (sectorMap["Others"] ||= []).push(s);
      }

      const sectors = Object.entries(sectorMap).map(([name, items]) => ({
        name,
        stocks: items.length,
        turnover: items.reduce((sum, s) => sum + s.turnover, 0),
        volume: items.reduce((sum, s) => sum + s.volume, 0),
        change_pct:
          items.length > 0
            ? items.reduce((sum, s) => sum + s.percent_change, 0) / items.length
            : 0,
      }));

      return json({ data: sectors });
    }

    // /market/depth/:symbol
    const depthMatch = path.match(/^\/market\/depth\/([^/]+)$/);
    if (depthMatch) {
      return json({
        bids: [],
        asks: [],
        message: "Real-time depth requires WebSocket connection to NEPSE",
      });
    }

    // /market/floorsheet
    if (path === "/market/floorsheet") {
      return json({
        data: [],
        message: "Floorsheet available after market close from merolagani",
      });
    }

    // /stocks/:symbol/prices
    const priceMatch = path.match(/^\/stocks\/([^/]+)\/prices$/);
    if (priceMatch) {
      const symbol = decodeURIComponent(priceMatch[1]).toUpperCase();
      const period = url.searchParams.get("period") || "1y";
      const bars = await scrapeOhlcv(symbol, period);
      return json({ data: bars, symbol, count: bars.length });
    }

    // /health
    if (path === "/health") {
      const t0 = Date.now();
      const mero = await scrapeMerolagani();
      const meroLatency = Date.now() - t0;
      const t1 = Date.now();
      const ss = await scrapeSharesansar();
      const ssLatency = Date.now() - t1;

      return json({
        sources: [
          {
            name: "merolagani",
            status: mero.length > 0 ? "ok" : "down",
            latency_ms: meroLatency,
            stocks_count: mero.length,
          },
          {
            name: "sharesansar",
            status: ss.length > 0 ? "ok" : "down",
            latency_ms: ssLatency,
            stocks_count: ss.length,
          },
          { name: "nepsealpha", status: "configured", latency_ms: null },
          { name: "sharehub", status: "configured", latency_ms: null },
          { name: "nepalipaisa", status: "configured", latency_ms: null },
        ],
      });
    }

    // /indices
    if (path === "/indices") {
      const stocks = await getLiveStocks();
      if (stocks.length === 0) return json({ data: [] });

      const totalTurnover = stocks.reduce((s, st) => s + st.turnover, 0);
      const avgChange =
        stocks.reduce((s, st) => s + st.percent_change, 0) / stocks.length;

      return json({
        data: [
          {
            name: "NEPSE Index",
            value: null,
            change_pct: Math.round(avgChange * 100) / 100,
            description: "Approximate from live stocks",
          },
          {
            name: "Total Turnover",
            value: Math.round(totalTurnover),
            change_pct: 0,
          },
          { name: "Traded Stocks", value: stocks.length, change_pct: 0 },
          {
            name: "Advances",
            value: stocks.filter((s) => s.percent_change > 0).length,
            change_pct: 0,
          },
        ],
      });
    }

    // /recommendations
    if (path === "/recommendations") {
      const stocks = await getLiveStocks();
      const recs = stocks
        .filter((s) => s.volume > 0 && s.ltp > 0)
        .map((s) => {
          const pct = s.percent_change;
          let action: string;
          let reason: string;
          let confidence: number;

          if (pct > 4) {
            action = "BUY";
            reason = `Strong momentum: +${pct.toFixed(1)}% with ${s.volume.toLocaleString()} volume`;
            confidence = Math.min(85, 60 + pct * 3);
          } else if (pct > 2) {
            action = "BUY";
            reason = `Positive trend: +${pct.toFixed(1)}% gain today`;
            confidence = Math.min(70, 50 + pct * 5);
          } else if (pct < -4) {
            action = "SELL";
            reason = `Sharp decline: ${pct.toFixed(1)}% - potential support breakdown`;
            confidence = Math.min(80, 55 + Math.abs(pct) * 3);
          } else if (pct < -2) {
            action = "SELL";
            reason = `Weakening: ${pct.toFixed(1)}% decline with selling pressure`;
            confidence = Math.min(65, 45 + Math.abs(pct) * 4);
          } else {
            action = "HOLD";
            reason = `Sideways movement: ${pct.toFixed(1)}%`;
            confidence = 40;
          }

          return {
            symbol: s.symbol,
            action,
            confidence: Math.round(confidence),
            reason,
            current_price: s.ltp,
            target_price:
              action === "BUY"
                ? Math.round(s.ltp * 1.08)
                : action === "SELL"
                  ? Math.round(s.ltp * 0.95)
                  : s.ltp,
          };
        })
        .filter((r) => r.action !== "HOLD")
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 20);

      return json({ data: recs });
    }

    // /bot/status
    if (path === "/bot/status") {
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const headers = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" };

      const [botsRes, tradesRes, learningRes, runsRes] = await Promise.all([
        fetch(`${sbUrl}/rest/v1/bot_configs?select=*&order=created_at.asc`, { headers }),
        fetch(`${sbUrl}/rest/v1/paper_trades?select=*&order=created_at.desc&limit=100`, { headers }),
        fetch(`${sbUrl}/rest/v1/bot_learning_log?select=*&order=created_at.desc&limit=50`, { headers }),
        fetch(`${sbUrl}/rest/v1/bot_run_log?select=*&order=ran_at.desc&limit=20`, { headers }),
      ]);

      const bots = botsRes.ok ? await botsRes.json() : [];
      const trades = tradesRes.ok ? await tradesRes.json() : [];
      const learning = learningRes.ok ? await learningRes.json() : [];
      const runs = runsRes.ok ? await runsRes.json() : [];

      const botStatus = bots.map((bot: Record<string, unknown>) => {
        const botTrades = trades.filter((t: Record<string, unknown>) => t.bot_id === bot.id);
        const closedTrades = botTrades.filter((t: Record<string, unknown>) => t.status === "closed");
        const openTrades = botTrades.filter((t: Record<string, unknown>) => t.status === "open");
        const totalPnl = closedTrades.reduce((sum: number, t: Record<string, unknown>) => sum + ((t.pnl as number) || 0), 0);
        const wins = closedTrades.filter((t: Record<string, unknown>) => (t.pnl as number) > 0).length;
        const losses = closedTrades.filter((t: Record<string, unknown>) => (t.pnl as number) <= 0).length;
        const botLearning = learning.filter((l: Record<string, unknown>) => l.bot_id === bot.id);
        const lastRun = runs.find((r: Record<string, unknown>) => r.bot_id === bot.id);

        return {
          id: bot.id,
          name: bot.name,
          strategy: bot.strategy,
          status: bot.is_active ? "running" : "paused",
          budget: bot.budget,
          risk_per_trade: bot.risk_per_trade,
          max_positions: bot.max_positions,
          parameters: bot.parameters,
          last_run: lastRun ? lastRun.ran_at : null,
          stats: {
            total_trades: closedTrades.length,
            open_positions: openTrades.length,
            wins,
            losses,
            win_rate: closedTrades.length > 0 ? Math.round((wins / closedTrades.length) * 100) : 0,
            total_pnl: totalPnl,
            budget_used: openTrades.reduce((sum: number, t: Record<string, unknown>) => sum + ((t.entry_price as number) * (t.quantity as number) || 0), 0),
          },
          recent_learning: botLearning.slice(0, 3),
          open_trades: openTrades.slice(0, 5),
        };
      });

      return json({ scheduler: "active", bots: botStatus });
    }

    // /bot/paper-trades
    if (path === "/bot/paper-trades") {
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const headers = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" };

      const res = await fetch(`${sbUrl}/rest/v1/paper_trades?select=*,bot_configs(name)&order=created_at.desc&limit=50`, { headers });
      const trades = res.ok ? await res.json() : [];

      return json({ data: trades });
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

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
