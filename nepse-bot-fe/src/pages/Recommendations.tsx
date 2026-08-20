import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRecommendations } from "../api/market";
import { percentColor } from "../lib/utils";

interface Rec {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reason: string;
  target_price?: number;
  current_price?: number;
}

export default function Recommendations() {
  const navigate = useNavigate();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL" | "HOLD">("ALL");

  useEffect(() => {
    fetchRecommendations()
      .then((d: any) => setRecs(Array.isArray(d) ? d : d.data || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "ALL" ? recs : recs.filter((r) => r.action === filter);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Recommendations</h1>

      <div className="flex gap-1 mb-4">
        {(["ALL", "BUY", "SELL", "HOLD"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              filter === f
                ? f === "BUY"
                  ? "bg-green-100 text-green-700"
                  : f === "SELL"
                    ? "bg-red-100 text-red-700"
                    : f === "HOLD"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-teal-100 text-teal-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Generating recommendations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-400 py-8 text-center">
          No recommendations available. Market data needed to generate signals.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.symbol}
              onClick={() => navigate(`/analysis/${r.symbol}`)}
              className="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">{r.symbol}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.action === "BUY"
                      ? "bg-green-100 text-green-700"
                      : r.action === "SELL"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.action}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">{r.reason}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${r.confidence}%` }}
                    />
                  </div>
                  <span className="text-gray-600">{r.confidence}%</span>
                </div>
              </div>
              {r.target_price && (
                <div className="mt-2 text-xs text-gray-500">
                  Target: Rs. {r.target_price.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
