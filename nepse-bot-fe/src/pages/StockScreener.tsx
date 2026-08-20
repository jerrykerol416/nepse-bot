import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLiveMarket, type Stock } from "../api/market";
import { computeSMA, computeRSI } from "../analytics/indicators";
import { formatNumber, percentColor } from "../lib/utils";

type ScreenFilter = "oversold" | "overbought" | "high_volume" | "breakout" | "all";

export default function StockScreener() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ScreenFilter>("all");

  useEffect(() => {
    fetchLiveMarket()
      .then(setStocks)
      .catch(() => setStocks([]))
      .finally(() => setLoading(false));
  }, []);

  const avgVolume = stocks.length > 0 ? stocks.reduce((s, st) => s + st.volume, 0) / stocks.length : 0;

  const filtered = stocks.filter((s) => {
    if (filter === "all") return true;
    if (filter === "high_volume") return s.volume > avgVolume * 2;
    if (filter === "overbought") return s.percent_change > 5;
    if (filter === "oversold") return s.percent_change < -5;
    if (filter === "breakout") return s.ltp > s.prev_close * 1.05 && s.volume > avgVolume * 1.5;
    return true;
  });

  const filters: { key: ScreenFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "high_volume", label: "High Volume" },
    { key: "oversold", label: "Oversold" },
    { key: "overbought", label: "Overbought" },
    { key: "breakout", label: "Breakout" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Stock Screener</h1>

      <div className="flex gap-1 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              filter === f.key ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Screening stocks...</div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{filtered.length} stocks matched</p>
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-right">LTP</th>
                    <th className="px-3 py-2 text-right">Change%</th>
                    <th className="px-3 py-2 text-right">Volume</th>
                    <th className="px-3 py-2 text-right hidden md:table-cell">Turnover</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.slice(0, 50).map((s) => (
                    <tr
                      key={s.symbol}
                      onClick={() => navigate(`/analysis/${s.symbol}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium text-teal-700">{s.symbol}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(s.ltp)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${percentColor(s.percent_change)}`}>
                        {s.percent_change > 0 ? "+" : ""}
                        {s.percent_change?.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right">{formatNumber(s.volume)}</td>
                      <td className="px-3 py-2 text-right hidden md:table-cell">
                        {formatNumber(s.turnover)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
