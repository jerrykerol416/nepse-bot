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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await delay(Math.random() * 300 + attempt * 500);
      const resp = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "User-Agent": randomUA(),
          Accept: "text/html,application/xhtml+xml,application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          ...(attempt > 0 ? { "X-Forwarded-For": `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` } : {}),
        },
      });
      if (resp.ok) return resp;
      if (resp.status === 429 || resp.status === 403) {
        console.log(`Rate limited on ${url}, retry ${attempt + 1}/${maxRetries}`);
        await delay(1000 * (attempt + 1));
        continue;
      }
      return resp;
    } catch (e) {
      console.error(`Fetch error attempt ${attempt + 1}:`, e);
      await delay(1000 * (attempt + 1));
    }
  }
  return null;
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
    const resp = await fetchWithRetry("https://merolagani.com/LatestMarket.aspx", {});
    if (!resp) return [];
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
    const resp = await fetchWithRetry("https://www.sharesansar.com/today-share-price", {});
    if (!resp) return [];
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

// ─── Scraper: NepseAlpha Live Market ─────────────────────────────────────────
// NepseAlpha's symbol_list is Cloudflare-protected, so we use their OHLCV
// history API to get the latest close price for a list of known NEPSE symbols.
// This is a fallback when ShareSansar and MeroLagani both fail.

const NEPSE_SYMBOLS = [
  "NABIL","NICA","SBI","HBL","EBL","MBL","SANIMA","KBL","NMB","ADBL","PRVU","SBL",
  "CZBIL","BOKL","PCBL","MEGA","LAXMI","GBIME","CCBL","JBNL","LBL","SRBL","SINB",
  "NHPC","BPCL","CHCL","API","AKPL","HDHPC","SHPC","SJCL","KPCL","UPPER","UMHL",
  "RADHI","RIDI","GHL","GLH","MHNL","SPDL","NGPL","AHPC","AKJCL","ALBSL","ALICL",
  "ANLB","APHL","BARUN","BGWT","BJHL","CBBL","DDBL","FMDBL","FOWAD","KLBSL",
  "LLBS","MLBSL","MSLB","NMFBS","RSDC","SDESI","SLBS","SMFDB","SWBBL","UNLB",
  "MNBBL","SADBL","SHINE","GBBL","EDBL","KSBBL","MLBL","JSLBB","SAPDBL","GRDBL",
  "CORBL","NABBC","GUFL","ICFC","CFCL","GFCL","MFIL","SFCL","SIFC","PFL","RLFL",
  "MPFL","CMB","NSLB","NLIC","PLIC","SICL","NLICL","HGI","IGI","LGIL","NIL",
  "RBCL","PRIN","SIGS","SGIC","PICL","AIL","NECO",
];

async function scrapeNepseAlphaLive(): Promise<Stock[]> {
  const cached = getCached("nepsealpha:live");
  if (cached) return cached as Stock[];

  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 7 * 86400; // Last 7 days to get latest + prev close
    const stocks: Stock[] = [];

    // Fetch in batches of 10 to avoid rate limiting
    for (let i = 0; i < NEPSE_SYMBOLS.length; i += 10) {
      const batch = NEPSE_SYMBOLS.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (symbol) => {
          const resp = await fetchWithRetry(
            `https://nepsealpha.com/trading/1/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${now}`,
            { headers: { Accept: "application/json", Origin: "https://nepsealpha.com", Referer: "https://nepsealpha.com/" } },
            2
          );
          if (!resp) return null;
          const text = await resp.text();
          if (text.includes("<!DOCTYPE") || text.includes("cloudflare")) return null;
          const hist = JSON.parse(text);
          if (hist.s !== "ok" || !hist.t || hist.t.length === 0) return null;
          const lastIdx = hist.t.length - 1;
          const ltp = hist.c[lastIdx];
          const prevClose = hist.c.length > 1 ? hist.c[lastIdx - 1] : ltp;
          const pctChange = prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0;
          return {
            symbol,
            ltp,
            change: Math.round((ltp - prevClose) * 100) / 100,
            percent_change: Math.round(pctChange * 100) / 100,
            high: hist.h[lastIdx],
            low: hist.l[lastIdx],
            open: hist.o[lastIdx],
            volume: hist.v?.[lastIdx] || 0,
            turnover: ltp * (hist.v?.[lastIdx] || 0),
            prev_close: prevClose,
            source: "nepsealpha",
          } as Stock;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) stocks.push(r.value);
      }
      // Small delay between batches
      if (i + 10 < NEPSE_SYMBOLS.length) await delay(200);
    }

    if (stocks.length > 0) setCache("nepsealpha:live", stocks, 45_000);
    return stocks;
  } catch (e) {
    console.error("nepsealpha live error:", e);
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
    await delay(Math.random() * 200);
    const histResp = await fetch(
      `https://nepsealpha.com/trading/1/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${now}`,
      {
        headers: {
          "User-Agent": randomUA(),
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
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
  // Try ShareSansar first (most reliable), fall back to MeroLagani, then NepseAlpha
  let stocks = await scrapeSharesansar();
  if (stocks.length === 0) stocks = await scrapeMerolagani();
  if (stocks.length === 0) stocks = await scrapeNepseAlphaLive();
  if (stocks.length === 0) {
    // Last resort: retry ShareSansar after delay (sometimes rate limited on first attempt)
    await delay(2000);
    stocks = await scrapeSharesansar();
  }
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

    // /stocks/:symbol/prices  OR  /stock/:symbol/history
    const priceMatch = path.match(/^\/stocks?\/([^/]+)\/(?:prices|history)$/);
    if (priceMatch) {
      const symbol = decodeURIComponent(priceMatch[1]).toUpperCase();
      const period = url.searchParams.get("period") || "1y";
      const bars = await scrapeOhlcv(symbol, period);
      return json({ data: bars, symbol, count: bars.length });
    }

    // /seed-history - Fetch and save historical data from NepseAlpha for top stocks
    if (path === "/seed-history") {
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const dbH = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" };
      const period = url.searchParams.get("period") || "1y";
      const symbolsParam = url.searchParams.get("symbols");
      const symbols = symbolsParam
        ? symbolsParam.split(",").map((s) => s.trim().toUpperCase())
        : NEPSE_SYMBOLS;
      let saved = 0, failed = 0;
      const results: { symbol: string; bars: number; status: string }[] = [];

      for (let i = 0; i < symbols.length; i += 5) {
        const batch = symbols.slice(i, i + 5);
        const batchResults = await Promise.allSettled(
          batch.map(async (symbol) => {
            const bars = await scrapeOhlcv(symbol, period);
            if (bars.length === 0) return { symbol, bars: 0, status: "no_data" };
            const allRows = (bars as { date: string; open: number; high: number; low: number; close: number; volume: number }[]).map((b) => ({
              symbol, date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume, percent_change: 0,
            }));
            // Save in chunks of 500 to avoid payload limits
            let chunkSaved = 0;
            for (let j = 0; j < allRows.length; j += 500) {
              const chunk = allRows.slice(j, j + 500);
              const r = await fetch(`${sbUrl}/rest/v1/stock_price_history`, {
                method: "POST",
                headers: { ...dbH, Prefer: "resolution=merge-duplicates,return=minimal" },
                body: JSON.stringify(chunk),
              });
              if (r.ok) chunkSaved += chunk.length;
            }
            return { symbol, bars: bars.length, status: chunkSaved > 0 ? "saved" : "save_failed" };
          })
        );
        for (const r of batchResults) {
          if (r.status === "fulfilled") {
            results.push(r.value);
            if (r.value.status === "saved") saved++;
            else failed++;
          } else {
            failed++;
          }
        }
        if (i + 5 < symbols.length) await delay(300);
      }
      return json({ saved, failed, total: symbols.length, results: results.slice(0, 50) });
    }

    // /health
    if (path === "/health") {
      const t0 = Date.now();
      const mero = await scrapeMerolagani();
      const meroLatency = Date.now() - t0;
      const t1 = Date.now();
      const ss = await scrapeSharesansar();
      const ssLatency = Date.now() - t1;
      const t2 = Date.now();
      const na = await scrapeNepseAlphaLive();
      const naLatency = Date.now() - t2;

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
          {
            name: "nepsealpha",
            status: na.length > 0 ? "ok" : "down",
            latency_ms: naLatency,
            stocks_count: na.length,
          },
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

    // /recommendations - Multi-strategy proven technical analysis
    if (path === "/recommendations") {
      const stocks = await getLiveStocks();
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const dbHeaders = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" };

      // Fetch historical data for technical analysis (last 50 days)
      const histRes = await fetch(
        `${sbUrl}/rest/v1/stock_price_history?select=symbol,date,open,high,low,close,volume&order=date.desc&limit=5000`,
        { headers: dbHeaders }
      );
      const history: { symbol: string; date: string; open: number; high: number; low: number; close: number; volume: number }[] = histRes.ok ? await histRes.json() : [];

      // Group history by symbol
      const histBySymbol: Record<string, typeof history> = {};
      for (const h of history) {
        if (!histBySymbol[h.symbol]) histBySymbol[h.symbol] = [];
        histBySymbol[h.symbol].push(h);
      }

      // Also save today's prices for future analysis
      const today = new Date().toISOString().slice(0, 10);
      const todayPrices = stocks
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

      if (todayPrices.length > 0) {
        fetch(`${sbUrl}/rest/v1/stock_price_history`, {
          method: "POST",
          headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(todayPrices),
        }).catch(() => {});
      }

      const recs: {
        symbol: string;
        action: string;
        confidence: number;
        reason: string;
        strategy: string;
        current_price: number;
        target_price: number;
        stoploss: number;
        risk_reward: string;
      }[] = [];

      for (const stock of stocks.filter((s) => s.volume > 0 && s.ltp > 0)) {
        const hist = histBySymbol[stock.symbol] || [];
        const closes = hist.map((h) => h.close).reverse();
        const volumes = hist.map((h) => h.volume).reverse();
        const highs = hist.map((h) => h.high).reverse();
        const lows = hist.map((h) => h.low).reverse();

        // Add today's data
        closes.push(stock.ltp);
        volumes.push(stock.volume);
        highs.push(stock.high || stock.ltp);
        lows.push(stock.low || stock.ltp);

        const signals: { action: string; confidence: number; reason: string; strategy: string; target: number; stoploss: number }[] = [];

        // === STRATEGY 1: RSI (Relative Strength Index) ===
        if (closes.length >= 15) {
          const rsi = calcRSI(closes, 14);
          if (rsi < 30) {
            signals.push({
              action: "BUY",
              confidence: Math.min(85, 60 + (30 - rsi) * 1.5),
              reason: `RSI oversold at ${rsi.toFixed(0)} - historically rebounds from this level`,
              strategy: "RSI Oversold",
              target: Math.round(stock.ltp * 1.08),
              stoploss: Math.round(stock.ltp * 0.95),
            });
          } else if (rsi > 70) {
            signals.push({
              action: "SELL",
              confidence: Math.min(85, 55 + (rsi - 70) * 1.5),
              reason: `RSI overbought at ${rsi.toFixed(0)} - price likely to correct`,
              strategy: "RSI Overbought",
              target: Math.round(stock.ltp * 0.94),
              stoploss: Math.round(stock.ltp * 1.04),
            });
          }
        }

        // === STRATEGY 2: EMA Crossover (9/21) ===
        if (closes.length >= 22) {
          const ema9 = calcEMA(closes, 9);
          const ema21 = calcEMA(closes, 21);
          const prevEma9 = calcEMA(closes.slice(0, -1), 9);
          const prevEma21 = calcEMA(closes.slice(0, -1), 21);

          if (prevEma9 <= prevEma21 && ema9 > ema21) {
            signals.push({
              action: "BUY",
              confidence: 72,
              reason: `EMA 9 crossed above EMA 21 - bullish momentum shift confirmed`,
              strategy: "EMA Crossover",
              target: Math.round(stock.ltp * 1.10),
              stoploss: Math.round(stock.ltp * 0.96),
            });
          } else if (prevEma9 >= prevEma21 && ema9 < ema21) {
            signals.push({
              action: "SELL",
              confidence: 70,
              reason: `EMA 9 crossed below EMA 21 - bearish momentum shift`,
              strategy: "EMA Crossover",
              target: Math.round(stock.ltp * 0.92),
              stoploss: Math.round(stock.ltp * 1.04),
            });
          }
        }

        // === STRATEGY 3: Bollinger Band Mean Reversion ===
        if (closes.length >= 20) {
          const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const stdDev = Math.sqrt(closes.slice(-20).reduce((sum, c) => sum + Math.pow(c - sma20, 2), 0) / 20);
          const upperBand = sma20 + 2 * stdDev;
          const lowerBand = sma20 - 2 * stdDev;
          const currentPrice = stock.ltp;

          if (currentPrice <= lowerBand) {
            signals.push({
              action: "BUY",
              confidence: Math.min(80, 65 + ((lowerBand - currentPrice) / lowerBand) * 100),
              reason: `Price at lower Bollinger Band (${lowerBand.toFixed(0)}) - mean reversion expected to ${sma20.toFixed(0)}`,
              strategy: "Bollinger Band",
              target: Math.round(sma20),
              stoploss: Math.round(lowerBand * 0.97),
            });
          } else if (currentPrice >= upperBand) {
            signals.push({
              action: "SELL",
              confidence: Math.min(75, 60 + ((currentPrice - upperBand) / upperBand) * 100),
              reason: `Price at upper Bollinger Band (${upperBand.toFixed(0)}) - likely to revert to mean ${sma20.toFixed(0)}`,
              strategy: "Bollinger Band",
              target: Math.round(sma20),
              stoploss: Math.round(upperBand * 1.03),
            });
          }
        }

        // === STRATEGY 4: Volume Breakout ===
        if (volumes.length >= 10) {
          const avgVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
          const volRatio = stock.volume / Math.max(avgVol, 1);

          if (volRatio > 2.5 && stock.percent_change > 3) {
            signals.push({
              action: "BUY",
              confidence: Math.min(82, 60 + volRatio * 5),
              reason: `Volume breakout: ${volRatio.toFixed(1)}x average volume with +${stock.percent_change.toFixed(1)}% move - institutional buying`,
              strategy: "Volume Breakout",
              target: Math.round(stock.ltp * 1.12),
              stoploss: Math.round(stock.ltp * 0.95),
            });
          } else if (volRatio > 2.5 && stock.percent_change < -3) {
            signals.push({
              action: "SELL",
              confidence: Math.min(78, 55 + volRatio * 5),
              reason: `High volume selloff: ${volRatio.toFixed(1)}x average with ${stock.percent_change.toFixed(1)}% decline - distribution phase`,
              strategy: "Volume Breakout",
              target: Math.round(stock.ltp * 0.90),
              stoploss: Math.round(stock.ltp * 1.04),
            });
          }
        }

        // === STRATEGY 5: MACD ===
        if (closes.length >= 27) {
          const ema12 = calcEMA(closes, 12);
          const ema26 = calcEMA(closes, 26);
          const macd = ema12 - ema26;
          const prevEma12 = calcEMA(closes.slice(0, -1), 12);
          const prevEma26 = calcEMA(closes.slice(0, -1), 26);
          const prevMacd = prevEma12 - prevEma26;

          // Signal line approximation (9-period EMA of MACD)
          if (prevMacd < 0 && macd > 0) {
            signals.push({
              action: "BUY",
              confidence: 70,
              reason: `MACD crossed above zero line - momentum turning bullish`,
              strategy: "MACD",
              target: Math.round(stock.ltp * 1.08),
              stoploss: Math.round(stock.ltp * 0.96),
            });
          } else if (prevMacd > 0 && macd < 0) {
            signals.push({
              action: "SELL",
              confidence: 68,
              reason: `MACD crossed below zero - momentum turning bearish`,
              strategy: "MACD",
              target: Math.round(stock.ltp * 0.93),
              stoploss: Math.round(stock.ltp * 1.04),
            });
          }
        }

        // === STRATEGY 6: Support/Resistance Breakout ===
        if (highs.length >= 20 && lows.length >= 20) {
          const recent20High = Math.max(...highs.slice(-20));
          const recent20Low = Math.min(...lows.slice(-20));

          if (stock.ltp > recent20High * 0.99 && stock.percent_change > 1) {
            signals.push({
              action: "BUY",
              confidence: 75,
              reason: `Breaking 20-day high (${recent20High.toFixed(0)}) with momentum - resistance breakout`,
              strategy: "Breakout",
              target: Math.round(stock.ltp * 1.10),
              stoploss: Math.round(recent20High * 0.97),
            });
          } else if (stock.ltp < recent20Low * 1.01 && stock.percent_change < -1) {
            signals.push({
              action: "SELL",
              confidence: 72,
              reason: `Breaking 20-day low (${recent20Low.toFixed(0)}) - support breakdown`,
              strategy: "Breakout",
              target: Math.round(stock.ltp * 0.90),
              stoploss: Math.round(recent20Low * 1.03),
            });
          }
        }

        // === STRATEGY 7: Momentum (Rate of Change) ===
        if (closes.length >= 10) {
          const roc = ((stock.ltp - closes[closes.length - 10]) / closes[closes.length - 10]) * 100;
          if (roc > 15 && stock.percent_change > 2) {
            signals.push({
              action: "BUY",
              confidence: Math.min(78, 55 + roc * 0.8),
              reason: `Strong 10-day momentum: +${roc.toFixed(1)}% ROC with continued buying`,
              strategy: "Momentum",
              target: Math.round(stock.ltp * 1.08),
              stoploss: Math.round(stock.ltp * 0.94),
            });
          } else if (roc < -12) {
            signals.push({
              action: "BUY",
              confidence: Math.min(70, 50 + Math.abs(roc) * 0.5),
              reason: `Oversold on momentum: ${roc.toFixed(1)}% ROC in 10 days - potential reversal`,
              strategy: "Momentum Reversal",
              target: Math.round(stock.ltp * 1.06),
              stoploss: Math.round(stock.ltp * 0.94),
            });
          }
        }

        // === FALLBACK STRATEGIES (work with just 1 day of data) ===
        // These use today's live market data when history is insufficient

        // F1: Price-Volume Breakout (today's data only)
        if (signals.length === 0 && stock.volume > 5000 && stock.percent_change > 3) {
          const priceRange = (stock.high - stock.low) / (stock.low || 1);
          const closeStrength = stock.high > stock.low ? (stock.ltp - stock.low) / (stock.high - stock.low) : 0.5;
          if (closeStrength > 0.7 && priceRange > 0.03) {
            signals.push({
              action: "BUY",
              confidence: Math.min(75, 55 + stock.percent_change * 2),
              reason: `Price-volume breakout: +${stock.percent_change.toFixed(1)}% with ${stock.volume.toLocaleString()} volume, closing near high (${(closeStrength * 100).toFixed(0)}% of range)`,
              strategy: "Volume Breakout",
              target: Math.round(stock.ltp * 1.08),
              stoploss: Math.round(stock.ltp * 0.96),
            });
          }
        }

        // F2: Gap Trading (today's open vs prev_close)
        if (signals.length === 0 && stock.prev_close > 0 && stock.open > 0) {
          const gapPct = ((stock.open - stock.prev_close) / stock.prev_close) * 100;
          const heldGap = stock.ltp >= stock.open;
          if (gapPct > 2 && heldGap && stock.volume > 2000) {
            signals.push({
              action: "BUY",
              confidence: Math.min(72, 55 + gapPct * 2),
              reason: `Gap up +${gapPct.toFixed(1)}% from ${stock.prev_close.toFixed(0)}, price holding above open`,
              strategy: "Gap Trading",
              target: Math.round(stock.ltp * 1.06),
              stoploss: Math.round(stock.open * 0.98),
            });
          }
        }

        // F3: SMC Liquidity Grab (intraday pattern)
        if (signals.length === 0 && stock.open > 0 && stock.low > 0 && stock.high > 0) {
          const liquidityGrab = stock.low < stock.open && stock.ltp > stock.open;
          const spread = stock.high - stock.low;
          const bullishWick = spread > 0 ? (stock.open - stock.low) / spread > 0.4 : false;
          if (liquidityGrab && bullishWick && stock.volume > 1000) {
            signals.push({
              action: "BUY",
              confidence: 65,
              reason: `Smart money liquidity grab: price dipped below open then recovered, bullish wick`,
              strategy: "Smart Money (ICT)",
              target: Math.round(stock.ltp * 1.05),
              stoploss: Math.round(stock.low * 0.98),
            });
          }
        }

        // F4: Oversold Bounce (large decline with volume)
        if (signals.length === 0 && stock.percent_change < -4 && stock.volume > 3000) {
          const nearLow = stock.high > stock.low ? (stock.ltp - stock.low) / (stock.high - stock.low) > 0.3 : true;
          if (nearLow) {
            signals.push({
              action: "BUY",
              confidence: Math.min(70, 50 + Math.abs(stock.percent_change) * 2),
              reason: `Oversold: ${stock.percent_change.toFixed(1)}% decline with ${stock.volume.toLocaleString()} volume - potential bounce`,
              strategy: "Mean Reversion",
              target: Math.round(stock.ltp * 1.05),
              stoploss: Math.round(stock.ltp * 0.95),
            });
          }
        }

        // F5: Strong Momentum (simple but effective)
        if (signals.length === 0 && stock.percent_change > 5 && stock.volume > 5000) {
          signals.push({
            action: "BUY",
            confidence: Math.min(70, 50 + stock.percent_change * 2),
            reason: `Strong momentum: +${stock.percent_change.toFixed(1)}% with high volume ${stock.volume.toLocaleString()}`,
            strategy: "Momentum",
            target: Math.round(stock.ltp * 1.07),
            stoploss: Math.round(stock.ltp * 0.95),
          });
        }

        // F6: Distribution Warning (large drop with high volume)
        if (signals.length === 0 && stock.percent_change < -5 && stock.volume > 10000) {
          signals.push({
            action: "SELL",
            confidence: Math.min(75, 55 + Math.abs(stock.percent_change) * 2),
            reason: `Distribution: ${stock.percent_change.toFixed(1)}% drop on ${stock.volume.toLocaleString()} volume - institutional selling`,
            strategy: "Volume Analysis",
            target: Math.round(stock.ltp * 0.93),
            stoploss: Math.round(stock.ltp * 1.03),
          });
        }

        // Pick the strongest signal for this stock
        if (signals.length > 0) {
          const best = signals.sort((a, b) => b.confidence - a.confidence)[0];
          const target = best.target;
          const sl = best.stoploss;
          const reward = Math.abs(target - stock.ltp);
          const risk = Math.abs(stock.ltp - sl);
          const rr = risk > 0 ? (reward / risk).toFixed(1) : "N/A";

          recs.push({
            symbol: stock.symbol,
            action: best.action,
            confidence: Math.round(best.confidence),
            reason: best.reason,
            strategy: best.strategy,
            current_price: stock.ltp,
            target_price: target,
            stoploss: sl,
            risk_reward: `1:${rr}`,
          });
        }
      }

      // Sort by confidence, show top 30
      recs.sort((a, b) => b.confidence - a.confidence);
      return json({ data: recs.slice(0, 30) });
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
          risk_per_trade: (bot.parameters as Record<string, number>)?.risk_per_trade || 0.02,
          max_positions: (bot.parameters as Record<string, number>)?.max_positions || 3,
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

function calcEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

