// API client — supports both Supabase Edge Functions and Python FastAPI backend.
// Set VITE_PYTHON_API_URL in .env to switch to the Python backend.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const PYTHON_API_URL = import.meta.env.VITE_PYTHON_API_URL || "";

// If VITE_PYTHON_API_URL is set, use the Python FastAPI backend.
// Otherwise fall back to the Supabase edge function.
const USE_PYTHON = !!PYTHON_API_URL;
const BASE_URL = USE_PYTHON
  ? `${PYTHON_API_URL}/api/v1`
  : `${SUPABASE_URL}/functions/v1/nepse-data`;

const headers: Record<string, string> = USE_PYTHON
  ? { "Content-Type": "application/json" }
  : { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" };

console.log("[NEPSE API] Config:", {
  backend: USE_PYTHON ? "python" : "edge-function",
  BASE_URL: BASE_URL.slice(0, 50) + "...",
});

export async function apiGet<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  console.log(`[NEPSE API] GET ${path}`);
  const start = performance.now();

  const resp = await fetch(url.toString(), { headers });

  const elapsed = Math.round(performance.now() - start);

  if (!resp.ok) {
    console.error(`[NEPSE API] FAILED ${path}: ${resp.status} (${elapsed}ms)`);
    throw new Error(`API ${resp.status}`);
  }

  const data = await resp.json();
  console.log(`[NEPSE API] OK ${path}: ${elapsed}ms`, Array.isArray(data?.data) ? `${data.data.length} items` : data);
  return data;
}
