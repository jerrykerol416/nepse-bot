import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLiveMarket, fetchTopStocks, fetchIndices, fetchMarketStatus, type Stock } from "../api/market";
import { formatNumber, formatCompact, percentColor } from "../lib/utils";
import FreshnessBanner from "../components/FreshnessBanner";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [status, setStatus] = useState<{ is_open: boolean; nepal_time: string } | null>(null);
  const [top, setTop] = useState<{ gainers: Stock[]; losers: Stock[]; turnover: Stock[] } | null>(null);
  const [indices, setIndices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.allSettled([
      fetchLiveMarket(),
      fetchMarketStatus(),
      fetchTopStocks(),
      fetchIndices(),
    ]).then(([mkt, st, tp, idx]) => {
      if (mkt.status === "fulfilled") setStocks(mkt.value);
      if (st.status === "fulfilled") setStatus(st.value);
      if (tp.status === "fulfilled") setTop(tp.value);
      if (idx.status === "fulfilled") setIndices(idx.value);
      setLoading(false);
    });
  }, []);

  const filtered = stocks.filter(
    (s) =>
      !search ||
      s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <FreshnessBanner />

      {/* Market status */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`w-3 h-3 rounded-full ${status?.is_open ? "bg-green-500 animate-pulse" : "bg-red-400"}`}
        />
        <span className="text-sm font-medium text-gray-700">
          Market {status?.is_open ? "Open" : "Closed"}
        </span>
        {status?.nepal_time && (
          <span className="text-xs text-gray-400">{status.nepal_time} NST</span>
        )}
      </div>

      {/* Indices row */}
      {indices.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {indices.slice(0, 4).map((idx: any) => (
            <div key={idx.name} className="bg-white rounded-lg border p-3">
              <div className="text-xs text-gray-500 truncate">{idx.name}</div>
              <div className="text-lg font-semibold">{formatNumber(idx.value)}</div>
              <div className={`text-xs ${percentColor(idx.change_pct || 0)}`}>
                {idx.change_pct > 0 ? "+" : ""}
                {idx.change_pct?.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top movers */}
      {top && (
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <MoverCard title="Top Gainers" items={top.gainers} navigate={navigate} />
          <MoverCard title="Top Losers" items={top.losers} navigate={navigate} />
          <MoverCard title="Top Turnover" items={top.turnover} navigate={navigate} />
        </div>
      )}

      {/* Market table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-3 border-b flex items-center gap-3">
          <h2 className="font-semibold text-gray-800">Live Market</h2>
          <input
            type="text"
            placeholder="Search symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto border rounded-md px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-400">Loading market data...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-400">No data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Symbol</th>
                  <th className="text-right px-3 py-2">LTP</th>
                  <th className="text-right px-3 py-2">Chg%</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">High</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Low</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Volume</th>
                  <th className="text-right px-3 py-2 hidden lg:table-cell">Turnover</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
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
                    <td className="px-3 py-2 text-right hidden md:table-cell">{formatNumber(s.high)}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">{formatNumber(s.low)}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">{formatCompact(s.volume)}</td>
                    <td className="px-3 py-2 text-right hidden lg:table-cell">{formatCompact(s.turnover)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MoverCard({
  title,
  items,
  navigate,
}: {
  title: string;
  items: Stock[];
  navigate: (p: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <h3 className="text-xs font-semibold text-gray-500 mb-2">{title}</h3>
      <div className="space-y-1">
        {items.slice(0, 5).map((s) => (
          <div
            key={s.symbol}
            onClick={() => navigate(`/analysis/${s.symbol}`)}
            className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
          >
            <span className="font-medium text-gray-800">{s.symbol}</span>
            <span className={percentColor(s.percent_change)}>
              {s.percent_change > 0 ? "+" : ""}
              {s.percent_change?.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
