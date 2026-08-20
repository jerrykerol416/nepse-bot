import { apiGet } from "./client";

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

export async function fetchLiveMarket(): Promise<Stock[]> {
  const d = await apiGet<{ data: Stock[] }>("/market/live");
  return d.data || [];
}

export async function fetchMarketStatus() {
  return apiGet<{ is_open: boolean; nepal_time: string }>("/market/status");
}

export async function fetchTopStocks() {
  return apiGet<{ gainers: Stock[]; losers: Stock[]; turnover: Stock[] }>("/market/top");
}

export async function fetchIndices() {
  const d = await apiGet<{ data: any[] }>("/indices");
  return d.data || [];
}

export async function fetchRecommendations() {
  const d = await apiGet<{ data: any[] }>("/recommendations");
  return d.data || [];
}

export async function fetchOhlcv(symbol: string, period = "1y") {
  const d = await apiGet<{ data: any[] }>(`/stocks/${symbol}/prices`, { period });
  return d.data || [];
}

export async function fetchHealth() {
  const d = await apiGet<{ sources: any[] }>("/health");
  return d.sources || [];
}

export async function fetchBotStatus() {
  return apiGet("/bot/status");
}

export async function fetchBotTrades() {
  const d = await apiGet<{ data: any[] }>("/bot/paper-trades");
  return d.data || [];
}
