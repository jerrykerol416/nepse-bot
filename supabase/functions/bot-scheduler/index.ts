import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BACKEND_URL = Deno.env.get("NEPSE_BACKEND_URL") || "https://nepse-bot-be.vercel.app";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("BOT_CRON_SECRET");
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const nepseHour = now.getUTCHours() + 5.75;
    const isMarketHours = nepseHour >= 11 && nepseHour <= 15;
    const dayOfWeek = now.getDay();
    const isWeekday = dayOfWeek >= 0 && dayOfWeek <= 4;

    const results: Record<string, unknown> = {
      triggered_at: now.toISOString(),
      nepal_time_approx: `${Math.floor(nepseHour)}:${Math.round((nepseHour % 1) * 60)}`,
      is_market_hours: isMarketHours,
      is_trading_day: isWeekday,
    };

    if (isWeekday) {
      const endpoints = [
        "/api/v1/free/market/live",
        "/api/v1/bot/run-all",
      ];

      for (const ep of endpoints) {
        const start = Date.now();
        try {
          const resp = await fetch(`${BACKEND_URL}${ep}`, {
            method: ep.includes("run-cycle") ? "POST" : "GET",
            headers: { "Content-Type": "application/json" },
          });
          results[ep] = {
            status: resp.status,
            latency_ms: Date.now() - start,
            ok: resp.ok,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          results[ep] = { error: message, latency_ms: Date.now() - start };
        }
      }
    } else {
      results.skipped = "Not a NEPSE trading day (Sat-Thu active, Fri-Sat off)";
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
