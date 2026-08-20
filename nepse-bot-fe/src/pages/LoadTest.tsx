import { useState } from "react";
import { apiGet } from "../api/client";

interface TestResult {
  endpoint: string;
  status: "ok" | "error";
  latency_ms: number;
  response_size?: number;
  error?: string;
}

const endpoints = [
  { path: "/market/live", label: "Live Market" },
  { path: "/market/status", label: "Market Status" },
  { path: "/market/top", label: "Top Stocks" },
  { path: "/indices", label: "Indices" },
  { path: "/health", label: "Health Check" },
  { path: "/recommendations", label: "Recommendations" },
  { path: "/stocks/NABIL/prices", label: "OHLCV (NABIL)" },
  { path: "/market/sectors", label: "Sectors" },
];

export default function LoadTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(1);
  const [iterations, setIterations] = useState(3);

  const runTests = async () => {
    setRunning(true);
    setResults([]);
    const allResults: TestResult[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const batch = endpoints.map(async (ep) => {
        const start = performance.now();
        try {
          const resp = await apiGet(ep.path);
          const latency = Math.round(performance.now() - start);
          const size = JSON.stringify(resp).length;
          return { endpoint: ep.label, status: "ok" as const, latency_ms: latency, response_size: size };
        } catch (e: any) {
          const latency = Math.round(performance.now() - start);
          return { endpoint: ep.label, status: "error" as const, latency_ms: latency, error: e.message };
        }
      });

      if (concurrency === 1) {
        for (const p of batch) {
          const r = await p;
          allResults.push(r);
          setResults([...allResults]);
        }
      } else {
        const batchResults = await Promise.all(batch);
        allResults.push(...batchResults);
        setResults([...allResults]);
      }
    }

    setRunning(false);
  };

  const grouped = results.reduce<Record<string, TestResult[]>>((acc, r) => {
    (acc[r.endpoint] ||= []).push(r);
    return acc;
  }, {});

  const stats = Object.entries(grouped).map(([name, runs]) => {
    const latencies = runs.map((r) => r.latency_ms);
    const ok = runs.filter((r) => r.status === "ok").length;
    return {
      name,
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      p95: latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] || 0,
      success_rate: Math.round((ok / runs.length) * 100),
      count: runs.length,
    };
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Stress / Load Test</h1>

      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Iterations</label>
            <input
              type="number"
              min={1}
              max={20}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className="border rounded px-2 py-1.5 text-sm w-20"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Concurrency</label>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="border rounded px-2 py-1.5 text-sm"
            >
              <option value={1}>Sequential</option>
              <option value={0}>Parallel</option>
            </select>
          </div>
          <button
            onClick={runTests}
            disabled={running}
            className="bg-teal-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {running ? "Running..." : "Run Test"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Tests {endpoints.length} endpoints x {iterations} iterations ={" "}
          {endpoints.length * iterations} requests
        </p>
      </div>

      {stats.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-3 border-b">
            <h2 className="font-semibold text-sm text-gray-700">Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Endpoint</th>
                  <th className="px-3 py-2 text-right">Avg (ms)</th>
                  <th className="px-3 py-2 text-right">Min</th>
                  <th className="px-3 py-2 text-right">Max</th>
                  <th className="px-3 py-2 text-right">P95</th>
                  <th className="px-3 py-2 text-right">Success</th>
                  <th className="px-3 py-2 text-right">Calls</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.map((s) => (
                  <tr key={s.name}>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={
                          s.avg < 500
                            ? "text-green-600"
                            : s.avg < 2000
                              ? "text-amber-600"
                              : "text-red-600"
                        }
                      >
                        {s.avg}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{s.min}</td>
                    <td className="px-3 py-2 text-right">{s.max}</td>
                    <td className="px-3 py-2 text-right">{s.p95}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={s.success_rate === 100 ? "text-green-600" : "text-red-600"}>
                        {s.success_rate}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {running && results.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {results.length}/{endpoints.length * iterations} requests completed...
        </p>
      )}
    </div>
  );
}
