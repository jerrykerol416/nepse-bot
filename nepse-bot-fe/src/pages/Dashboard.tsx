import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchLiveMarket, fetchHealth, fetchIndices, type Stock } from "../api/market";
import { cn, formatNumber, formatCompact, percentColor } from "../lib/utils";

function MarketTable({ stocks }: { stocks: Stock[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3 text-right">LTP</th>
            <th className="px-4 py-3 text-right">Change</th>
            <th className="px-4 py-3 text-right">%</th>
            <th className="px-4 py-3 text-right hidden sm:table-cell">Volume</th>
            <th className="px-4 py-3 text-right hidden md:table-cell">Turnover</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {stocks.map((s) => (
            <tr key={s.symbol} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5">
                <Link
                  to={`/stock/${s.symbol}`}
                  className="font-medium text-teal-700 hover:underline"
                >
                  {s.symbol}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-right font-mono">
                {formatNumber(s.ltp)}
              </td>
              <td className={cn("px-4 py-2.5 text-right font-mono", percentColor(s.change))}>
                {s.change > 0 ? "+" : ""}
                {formatNumber(s.change)}
              </td>
              <td className={cn("px-4 py-2.5 text-right font-mono", percentColor(s.percent_change))}>
                {s.percent_change > 0 ? "+" : ""}
                {formatNumber(s.percent_change)}%
              </td>
              <td className="px-4 py-2.5 text-right font-mono hidden sm:table-cell">
                {formatCompact(s.volume)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono hidden md:table-cell">
                {formatCompact(s.turnover)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthPanel({ sources }: { sources: any[] }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Sources</h3>
      <div className="space-y-2">
        {sources.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">{s.source || s.name}</span>
            <div className="flex items-center gap-2">
              {s.latency_ms != null && (
                <span className="text-gray-500">{s.latency_ms}ms</span>
              )}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full font-medium",
                  s.status === "ok" || s.status === "healthy"
                    ? "bg-green-100 text-green-700"
                    : s.status === "degraded"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                )}
              >
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const market = useQuery({ queryKey: ["market"], queryFn: fetchLiveMarket });
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth });
  const indices = useQuery({ queryKey: ["indices"], queryFn: fetchIndices });

  const stocks = market.data || [];
  const gainers = [...stocks].sort((a, b) => (b.percent_change || 0) - (a.percent_change || 0)).slice(0, 5);
  const losers = [...stocks].sort((a, b) => (a.percent_change || 0) - (b.percent_change || 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Live Market</h2>
        <span className="text-xs text-gray-500">
          {market.isFetching ? "Refreshing..." : `${stocks.length} stocks`}
        </span>
      </div>

      {/* Indices */}
      {indices.data && indices.data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {indices.data.slice(0, 5).map((idx: any, i: number) => (
            <div key={i} className="bg-white rounded-lg border p-3 shadow-sm">
              <p className="text-xs text-gray-500 truncate">{idx.name || idx.index}</p>
              <p className="text-lg font-bold font-mono">{formatNumber(idx.value || idx.current, 1)}</p>
              <p className={cn("text-xs font-mono", percentColor(idx.change || idx.percent_change))}>
                {(idx.change || idx.percent_change) > 0 ? "+" : ""}
                {formatNumber(idx.change || idx.percent_change)}%
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main table */}
        <div className="lg:col-span-3">
          {market.isLoading ? (
            <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
              Loading market data...
            </div>
          ) : market.isError ? (
            <div className="bg-white rounded-lg border p-12 text-center text-red-500">
              Failed to load: {market.error.message}
            </div>
          ) : (
            <MarketTable stocks={stocks} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Top Gainers */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-green-700 mb-2">Top Gainers</h3>
            <div className="space-y-1.5">
              {gainers.map((s) => (
                <div key={s.symbol} className="flex justify-between text-xs">
                  <Link to={`/stock/${s.symbol}`} className="font-medium text-gray-800 hover:text-teal-700">
                    {s.symbol}
                  </Link>
                  <span className="text-green-600 font-mono">+{formatNumber(s.percent_change)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-red-700 mb-2">Top Losers</h3>
            <div className="space-y-1.5">
              {losers.map((s) => (
                <div key={s.symbol} className="flex justify-between text-xs">
                  <Link to={`/stock/${s.symbol}`} className="font-medium text-gray-800 hover:text-teal-700">
                    {s.symbol}
                  </Link>
                  <span className="text-red-600 font-mono">{formatNumber(s.percent_change)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Health */}
          {health.data && <HealthPanel sources={health.data} />}
        </div>
      </div>
    </div>
  );
}
