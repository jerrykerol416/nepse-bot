import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchOhlcv } from "../api/market";
import { formatNumber, percentColor, cn } from "../lib/utils";

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const ohlcv = useQuery({
    queryKey: ["ohlcv", symbol],
    queryFn: () => fetchOhlcv(symbol!, "1y"),
    enabled: !!symbol,
  });

  const bars = ohlcv.data || [];
  const latest = bars.length > 0 ? bars[bars.length - 1] : null;
  const prev = bars.length > 1 ? bars[bars.length - 2] : null;
  const change = latest && prev ? latest.close - prev.close : 0;
  const pctChange = prev ? (change / prev.close) * 100 : 0;

  const high52 = bars.length > 0 ? Math.max(...bars.slice(-252).map((b: any) => b.high)) : 0;
  const low52 = bars.length > 0 ? Math.min(...bars.slice(-252).map((b: any) => b.low)) : 0;
  const avgVol = bars.length > 20
    ? bars.slice(-20).reduce((s: number, b: any) => s + (b.volume || 0), 0) / 20
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{symbol}</h2>
        {latest && (
          <div className="flex items-baseline gap-4 mt-1">
            <span className="text-3xl font-bold font-mono">{formatNumber(latest.close)}</span>
            <span className={cn("text-lg font-mono font-semibold", percentColor(change))}>
              {change > 0 ? "+" : ""}{formatNumber(change)} ({pctChange > 0 ? "+" : ""}{formatNumber(pctChange)}%)
            </span>
          </div>
        )}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "52W High", value: formatNumber(high52) },
          { label: "52W Low", value: formatNumber(low52) },
          { label: "Avg Volume (20D)", value: Math.round(avgVol).toLocaleString() },
          { label: "Data Points", value: bars.length.toString() },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className="text-lg font-bold font-mono mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Price History Table */}
      {ohlcv.isLoading ? (
        <div className="text-gray-500">Loading price history...</div>
      ) : bars.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Open</th>
                <th className="px-4 py-3 text-right">High</th>
                <th className="px-4 py-3 text-right">Low</th>
                <th className="px-4 py-3 text-right">Close</th>
                <th className="px-4 py-3 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bars.slice(-30).reverse().map((b: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{b.date || b.timestamp?.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatNumber(b.open)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatNumber(b.high)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatNumber(b.low)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatNumber(b.close)}</td>
                  <td className="px-4 py-2 text-right font-mono">{(b.volume || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          No price data available for {symbol}
        </div>
      )}
    </div>
  );
}
