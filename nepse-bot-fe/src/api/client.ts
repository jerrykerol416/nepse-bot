const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const BASE_URL = `${SUPABASE_URL}/functions/v1/nepse-data`;

console.log("[NEPSE API] Config:", {
  SUPABASE_URL: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 30)}...` : "EMPTY",
  BASE_URL,
  hasKey: !!SUPABASE_ANON_KEY,
});

export async function apiGet<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  console.log(`[NEPSE API] GET ${path} → ${url.toString()}`);
  const start = performance.now();

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const elapsed = Math.round(performance.now() - start);

  if (!resp.ok) {
    console.error(`[NEPSE API] FAILED ${path}: ${resp.status} (${elapsed}ms)`);
    throw new Error(`API ${resp.status}`);
  }

  const data = await resp.json();
  console.log(`[NEPSE API] OK ${path}: ${elapsed}ms`, Array.isArray(data?.data) ? `${data.data.length} items` : data);
  return data;
}