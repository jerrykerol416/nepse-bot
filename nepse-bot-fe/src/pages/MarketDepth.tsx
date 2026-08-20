import { useState } from "react";
import { apiGet } from "../api/client";
import { formatNumber } from "../lib/utils";

interface DepthEntry {
  price: number;
  quantity: number;
  orders: number;
}

export default function MarketDepth() {
  const [symbol, setSymbol] = useState("");
  const [bids, setBids] = useState<DepthEntry[]>([]);
  const [asks, setAsks] = useState<DepthEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDepth = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError("");
    try {
      const d = await apiGet<{ bids: DepthEntry[]; asks: DepthEntry[] }>(
        `/market/depth/${symbol.trim().toUpperCase()}`
      );
      setBids(d.bids || []);
      setAsks(d.asks || []);
    } catch {
      setError("Depth data not available for this symbol");
      setBids([]);
      setAsks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Market Depth</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && loadDepth()}
          placeholder="Enter symbol (e.g. NABIL)"
          className="border rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        <button
          onClick={loadDepth}
          className="bg-teal-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-700"
        >
          Load
        </button>
      </div>

      {error && <p className="text-sm text-amber-600 mb-4">{error}</p>}

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading depth...</div>
      ) : bids.length > 0 || asks.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          <DepthTable title="Bids (Buy)" entries={bids} color="green" />
          <DepthTable title="Asks (Sell)" entries={asks} color="red" />
        </div>
      ) : (
        <div className="text-gray-400 py-8 text-center text-sm">
          Enter a symbol and click Load to view market depth
        </div>
      )}
    </div>
  );
}

function DepthTable({
  title,
  entries,
  color,
}: {
  title: string;
  entries: DepthEntry[];
  color: "green" | "red";
}) {
  const maxQty = Math.max(...entries.map((e) => e.quantity), 1);
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-3 border-b">
        <h3 className={`text-sm font-semibold ${color === "green" ? "text-green-700" : "text-red-700"}`}>
          {title}
        </h3>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-1.5 text-left">Price</th>
            <th className="px-3 py-1.5 text-right">Qty</th>
            <th className="px-3 py-1.5 text-right">Orders</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((e, i) => (
            <tr key={i} className="relative">
              <td className="px-3 py-1.5 font-medium">{formatNumber(e.price)}</td>
              <td className="px-3 py-1.5 text-right">{formatNumber(e.quantity)}</td>
              <td className="px-3 py-1.5 text-right">{e.orders}</td>
              <td
                className={`absolute inset-y-0 right-0 opacity-10 ${color === "green" ? "bg-green-500" : "bg-red-500"}`}
                style={{ width: `${(e.quantity / maxQty) * 100}%` }}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
