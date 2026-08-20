import api from "./client";

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
}

export interface HealthSource {
  source: string;
  status: string;
  last_updated?: string;
  latency_ms?: number;
}

export async function fetchLiveMarket(): Promise<Stock[]> {
  const { data } = await api.get("/free/market/live");
  return data.data || data || [];
}

export async function fetchHealth(): Promise<HealthSource[]> {
  const { data } = await api.get("/free/health");
  return data.sources || data || [];
}

export async function fetchMarketStatus(): Promise<any> {
  const { data } = await api.get("/free/market/status");
  return data;
}

export async function fetchIndices(): Promise<any[]> {
  const { data } = await api.get("/free/indices");
  return data.data || data || [];
}

export async function fetchTopStocks(): Promise<any> {
  const { data } = await api.get("/free/market/top");
  return data;
}

export async function fetchRecommendations(): Promise<any[]> {
  const { data } = await api.get("/free/recommendations");
  return data.data || data || [];
}

export async function fetchOhlcv(symbol: string, period = "1y"): Promise<any[]> {
  const { data } = await api.get(`/free/stocks/${symbol}/prices`, { params: { period } });
  return data.data || data || [];
}

export async function fetchBotStatus(): Promise<any> {
  const { data } = await api.get("/bot/status");
  return data;
}

export async function fetchBotTrades(): Promise<any[]> {
  const { data } = await api.get("/bot/paper-trades");
  return data.data || data || [];
}
