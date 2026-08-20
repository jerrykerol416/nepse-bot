import { useState } from "react";
import { apiGet } from "../api/client";
import { formatNumber } from "../lib/utils";

interface FloorsheetEntry {
  contract_no: string;
  symbol: string;
  buyer: string;
  seller: string;
  quantity: number;
  rate: number;
  amount: number;
}

export default function Floorsheet() {
  const [symbol, setSymbol] = useState("");
  const [entries, setEntries] = useState<FloorsheetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = symbol.trim() ? { symbol: symbol.trim().toUpperCase() } : undefined;
      const d = await apiGet<{ data: FloorsheetEntry[] }>("/market/floorsheet", params);
      setEntries(d.data || []);
    } catch {
      setError("Floorsheet data not available");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Floorsheet</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Filter by symbol (optional)"
          className="border rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        <button
          onClick={load}
          className="bg-teal-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-700"
        >
          Load
        </button>
      </div>

      {error && <p className="text-sm text-amber-600 mb-4">{error}</p>}

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading floorsheet...</div>
      ) : entries.length > 0 ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">Contract</th>
                  <th className="px-2 py-1.5 text-left">Symbol</th>
                  <th className="px-2 py-1.5 text-left">Buyer</th>
                  <th className="px-2 py-1.5 text-left">Seller</th>
                  <th className="px-2 py-1.5 text-right">Qty</th>
                  <th className="px-2 py-1.5 text-right">Rate</th>
                  <th className="px-2 py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-2 py-1">{e.contract_no}</td>
                    <td className="px-2 py-1 font-medium text-teal-700">{e.symbol}</td>
                    <td className="px-2 py-1">{e.buyer}</td>
                    <td className="px-2 py-1">{e.seller}</td>
                    <td className="px-2 py-1 text-right">{formatNumber(e.quantity)}</td>
                    <td className="px-2 py-1 text-right">{formatNumber(e.rate)}</td>
                    <td className="px-2 py-1 text-right">{formatNumber(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-gray-400 py-8 text-center text-sm">
          Click Load to fetch today's floorsheet data
        </div>
      )}
    </div>
  );
}
