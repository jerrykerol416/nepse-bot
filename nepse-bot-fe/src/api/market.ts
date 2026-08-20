import request from "./client";

export interface Stock {
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
  source?: string;
}

export interface HealthSource {
  source: string;
  status: string;
  last_updated?: string;
  latency_ms?: number;
}

export async function fetchLiveMarket(): Promise<Stock[]> {
  const data = await request<{ data: Stock[] }>("/market/live");
  return data.data || [];
}

export async function fetchHealth(): Promise<HealthSource[]> {
  const data = await request<{ sources: HealthSource[] }>("/health");
  return data.sources || [];
}

export async function fetchMarketStatus(): Promise<{ is_open: boolean; nepal_time: string }> {
  return request("/market/status");
}

export async function fetchIndices(): Promise<any[]> {
  const data = await request<{ data: any[] }>("/indices");
  return data.data || [];
}

export async function fetchTopStocks(): Promise<{ gainers: Stock[]; losers: Stock[]; turnover: Stock[] }> {
  return request("/market/top");
}

export async function fetchRecommendations(): Promise<any[]> {
  const data = await request<{ data: any[] }>("/recommendations");
  return data.data || [];
}

export async function fetchOhlcv(symbol: string, period = "1y"): Promise<any[]> {
  const data = await request<{ data: any[] }>(`/stocks/${symbol}/prices`, { period });
  return data.data || [];
}

export async function fetchBotStatus(): Promise<any> {
  return request("/bot/status");
}

export async function fetchBotTrades(): Promise<any[]> {
  const data = await request<{ data: any[] }>("/bot/paper-trades");
  return data.data || [];
}
