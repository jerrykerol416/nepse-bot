import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";
import { formatNumber, formatCompact, percentColor } from "../lib/utils";

interface Sector {
  name: string;
  turnover: number;
  volume: number;
  change_pct: number;
  stocks: number;
}

export default function SectorAnalysis() {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ data: Sector[] }>("/market/sectors")
      .then((d) => setSectors(d.data || []))
      .catch(() => setSectors([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Sector Analysis</h1>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading sectors...</div>
      ) : sectors.length === 0 ? (
        <div className="text-gray-400 py-8 text-center text-sm">
          Sector data not available at this time
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s) => (
            <div
              key={s.name}
              className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm text-gray-800 truncate">{s.name}</h3>
                <span className={`text-xs font-medium ${percentColor(s.change_pct)}`}>
                  {s.change_pct > 0 ? "+" : ""}
                  {s.change_pct?.toFixed(2)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                <div>
                  <div className="text-gray-400">Turnover</div>
                  <div className="font-medium text-gray-700">{formatCompact(s.turnover)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Volume</div>
                  <div className="font-medium text-gray-700">{formatCompact(s.volume)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Stocks</div>
                  <div className="font-medium text-gray-700">{s.stocks}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
