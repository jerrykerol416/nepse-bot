import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRecommendations } from "../api/market";
import { cn } from "../lib/utils";

interface Rec {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reason: string;
  strategy: string;
  target_price: number;
  current_price: number;
  stoploss: number;
  risk_reward: string;
}

const STRATEGY_COLORS: Record<string, string> = {
  "RSI Oversold": "bg-indigo-50 text-indigo-700",
  "RSI Overbought": "bg-indigo-50 text-indigo-700",
  "EMA Crossover": "bg-blue-50 text-blue-700",
  "Bollinger Band": "bg-cyan-50 text-cyan-700",
  "Volume Breakout": "bg-emerald-50 text-emerald-700",
  "MACD": "bg-amber-50 text-amber-700",
  "Breakout": "bg-rose-50 text-rose-700",
  "Momentum": "bg-orange-50 text-orange-700",
  "Momentum Reversal": "bg-teal-50 text-teal-700",
};

export default function Recommendations() {
  const navigate = useNavigate();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [strategyFilter, setStrategyFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchRecommendations()
      .then((d: any) => setRecs(Array.isArray(d) ? d : d.data || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, []);

  const strategies = ["ALL", ...Array.from(new Set(recs.map((r) => r.strategy)))];
  const filtered = recs.filter((r) => {
    if (filter !== "ALL" && r.action !== filter) return false;
    if (strategyFilter !== "ALL" && r.strategy !== strategyFilter) return false;
    return true;
  });

  const buyCount = recs.filter((r) => r.action === "BUY").length;
  const sellCount = recs.filter((r) => r.action === "SELL").length;

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Multi-strategy technical analysis using RSI, EMA, MACD, Bollinger Bands, Volume, and Breakout patterns
        </p>
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-gray-700">{buyCount} Buy signals</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-sm font-medium text-gray-700">{sellCount} Sell signals</span>
        </div>
        <div className="ml-auto text-xs text-gray-400">
          Top {filtered.length} signals sorted by confidence
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(["ALL", "BUY", "SELL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === f
                  ? f === "BUY"
                    ? "bg-green-100 text-green-700"
                    : f === "SELL"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-gray-200 self-center" />
        <div className="flex flex-wrap gap-1">
          {strategies.map((s) => (
            <button
              key={s}
              onClick={() => setStrategyFilter(s)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                strategyFilter === s
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-7 w-7 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No recommendations match your filters. Try broadening the criteria.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={`${r.symbol}-${r.strategy}`}
              onClick={() => navigate(`/analysis/${r.symbol}`)}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all hover:border-gray-200 group"
            >
              {/* Top Row */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                  {r.symbol}
                </span>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                    r.action === "BUY"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {r.action}
                </span>
              </div>

              {/* Strategy Badge */}
              <div className="mb-2">
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium", STRATEGY_COLORS[r.strategy] || "bg-gray-100 text-gray-600")}>
                  {r.strategy}
                </span>
              </div>

              {/* Reason */}
              <p className="text-xs text-gray-600 mb-3 leading-relaxed line-clamp-2">{r.reason}</p>

              {/* Price Info Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400 uppercase">Current</p>
                  <p className="text-xs font-semibold text-gray-800">{r.current_price?.toLocaleString()}</p>
                </div>
                <div className={cn("rounded-lg p-2", r.action === "BUY" ? "bg-green-50" : "bg-red-50")}>
                  <p className="text-[10px] text-gray-400 uppercase">Target</p>
                  <p className={cn("text-xs font-semibold", r.action === "BUY" ? "text-green-700" : "text-red-700")}>
                    {r.target_price?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400 uppercase">Stoploss</p>
                  <p className="text-xs font-semibold text-red-600">{r.stoploss?.toLocaleString()}</p>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase">Confidence</span>
                  <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        r.confidence >= 75 ? "bg-green-500" : r.confidence >= 60 ? "bg-blue-500" : "bg-amber-500"
                      )}
                      style={{ width: `${r.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{r.confidence}%</span>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">
                  R:R {r.risk_reward}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
