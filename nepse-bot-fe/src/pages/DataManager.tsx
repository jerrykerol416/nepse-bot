import { useEffect, useState } from "react";
import { fetchHealth } from "../api/market";
import { apiGet } from "../api/client";

interface Source {
  name: string;
  status: string;
  latency_ms?: number;
  last_checked?: string;
}

export default function DataManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    fetchHealth()
      .then((d) => setSources(d))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await apiGet("/health");
      load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Data Manager</h1>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="bg-teal-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {refreshing ? "Checking..." : "Refresh Sources"}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Checking data sources...</div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s.name} className="bg-white rounded-lg border p-4 flex items-center gap-4">
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  s.status === "ok" ? "bg-green-500" : "bg-red-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                {s.last_checked && (
                  <div className="text-xs text-gray-400">Last checked: {s.last_checked}</div>
                )}
              </div>
              <div className="text-right">
                <div
                  className={`text-xs font-medium ${
                    s.status === "ok" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {s.status === "ok" ? "Online" : "Offline"}
                </div>
                {s.latency_ms != null && (
                  <div className="text-xs text-gray-400">{s.latency_ms}ms</div>
                )}
              </div>
            </div>
          ))}

          {sources.length === 0 && (
            <div className="text-gray-400 py-8 text-center text-sm">
              No source status available
            </div>
          )}
        </div>
      )}

      <div className="mt-6 bg-white rounded-lg border p-4">
        <h2 className="font-semibold text-sm text-gray-700 mb-3">Data Source Priority</h2>
        <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
          <li>Merolagani (primary)</li>
          <li>ShareSansar</li>
          <li>ShareHub</li>
          <li>NepaliPaisa</li>
          <li>NEPSE Trading</li>
          <li>NepseAlpha</li>
          <li>YoNepse</li>
          <li>Samir Wagle API</li>
        </ol>
        <p className="text-xs text-gray-400 mt-2">
          Sources are tried in order. First successful response is used.
        </p>
      </div>
    </div>
  );
}
