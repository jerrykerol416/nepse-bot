import { useState, useCallback } from "react";
import api from "../api/client";
import { cn, formatNumber } from "../lib/utils";

interface TestResult {
  endpoint: string;
  status: "pending" | "success" | "error";
  latencyMs: number;
  responseSize: number;
  error?: string;
}

interface StressResult {
  totalRequests: number;
  successCount: number;
  failCount: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  requestsPerSecond: number;
  totalTimeMs: number;
}

const ENDPOINTS = [
  { path: "/free/market/live", label: "Live Market (all stocks)" },
  { path: "/free/market/status", label: "Market Status" },
  { path: "/free/indices", label: "Indices" },
  { path: "/free/market/top", label: "Top Stocks" },
  { path: "/free/recommendations", label: "Recommendations" },
  { path: "/free/health", label: "Health Check" },
  { path: "/free/stocks/NABIL/prices?period=3m", label: "OHLCV (NABIL 3m)" },
];

function percentile(sortedArr: number[], pct: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((pct / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

export default function LoadTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [stress, setStress] = useState<StressResult | null>(null);
  const [running, setRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(10);
  const [totalReqs, setTotalReqs] = useState(50);

  const runLatencyTest = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setStress(null);

    const newResults: TestResult[] = [];
    for (const ep of ENDPOINTS) {
      const start = performance.now();
      try {
        const res = await api.get(ep.path);
        const latency = performance.now() - start;
        newResults.push({
          endpoint: ep.label,
          status: "success",
          latencyMs: Math.round(latency),
          responseSize: JSON.stringify(res.data).length,
        });
      } catch (err: any) {
        const latency = performance.now() - start;
        newResults.push({
          endpoint: ep.label,
          status: "error",
          latencyMs: Math.round(latency),
          responseSize: 0,
          error: err.message,
        });
      }
      setResults([...newResults]);
    }
    setRunning(false);
  }, []);

  const runStressTest = useCallback(async () => {
    setRunning(true);
    setStress(null);
    setResults([]);

    const latencies: number[] = [];
    let successCount = 0;
    let failCount = 0;
    const startTime = performance.now();

    const queue = Array.from({ length: totalReqs }, (_, i) => i);
    let queueIdx = 0;

    const worker = async () => {
      while (queueIdx < queue.length) {
        const idx = queueIdx++;
        const ep = ENDPOINTS[idx % ENDPOINTS.length];
        const t0 = performance.now();
        try {
          await api.get(ep.path);
          latencies.push(performance.now() - t0);
          successCount++;
        } catch {
          latencies.push(performance.now() - t0);
          failCount++;
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, totalReqs) }, () => worker());
    await Promise.all(workers);

    const totalTime = performance.now() - startTime;
    const sorted = [...latencies].sort((a, b) => a - b);

    setStress({
      totalRequests: totalReqs,
      successCount,
      failCount,
      avgLatencyMs: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      p50Ms: Math.round(percentile(sorted, 50)),
      p95Ms: Math.round(percentile(sorted, 95)),
      p99Ms: Math.round(percentile(sorted, 99)),
      minMs: Math.round(sorted[0] || 0),
      maxMs: Math.round(sorted[sorted.length - 1] || 0),
      requestsPerSecond: Math.round((totalReqs / totalTime) * 1000 * 100) / 100,
      totalTimeMs: Math.round(totalTime),
    });
    setRunning(false);
  }, [concurrency, totalReqs]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Stress Test & Latency Benchmark</h2>

      {/* Controls */}
      <div className="bg-white rounded-lg border p-4 shadow-sm flex flex-wrap items-end gap-4">
        <button
          onClick={runLatencyTest}
          disabled={running}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          Run Latency Test
        </button>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Concurrent</label>
            <input
              type="number"
              min={1}
              max={100}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-20 px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Total Requests</label>
            <input
              type="number"
              min={1}
              max={500}
              value={totalReqs}
              onChange={(e) => setTotalReqs(Number(e.target.value))}
              className="w-20 px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <button
            onClick={runStressTest}
            disabled={running}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            Run Stress Test
          </button>
        </div>

        {running && <span className="text-sm text-gray-500 animate-pulse">Running...</span>}
      </div>

      {/* Latency Results */}
      {results.length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-sm font-semibold text-gray-700">Endpoint Latency</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b">
                <th className="px-4 py-2">Endpoint</th>
                <th className="px-4 py-2 text-right">Latency</th>
                <th className="px-4 py-2 text-right">Size</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{r.endpoint}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    <span
                      className={cn(
                        r.latencyMs < 500 ? "text-green-600" : r.latencyMs < 2000 ? "text-yellow-600" : "text-red-600"
                      )}
                    >
                      {r.latencyMs}ms
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">
                    {r.responseSize > 0 ? `${(r.responseSize / 1024).toFixed(1)}KB` : "-"}
                  </td>
                  <td className="px-4 py-2">
                    {r.status === "success" ? (
                      <span className="text-green-600 text-xs font-medium">OK</span>
                    ) : (
                      <span className="text-red-600 text-xs">{r.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stress Test Results */}
      {stress && (
        <div className="rounded-lg border bg-white shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Stress Test Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Requests", value: stress.totalRequests },
              { label: "Success", value: stress.successCount, color: "text-green-600" },
              { label: "Failed", value: stress.failCount, color: "text-red-600" },
              { label: "Req/sec", value: stress.requestsPerSecond },
              { label: "Avg Latency", value: `${stress.avgLatencyMs}ms` },
              { label: "P50", value: `${stress.p50Ms}ms` },
              { label: "P95", value: `${stress.p95Ms}ms` },
              { label: "P99", value: `${stress.p99Ms}ms` },
              { label: "Min", value: `${stress.minMs}ms` },
              { label: "Max", value: `${stress.maxMs}ms` },
              { label: "Total Time", value: `${(stress.totalTimeMs / 1000).toFixed(1)}s` },
              { label: "Error Rate", value: `${((stress.failCount / stress.totalRequests) * 100).toFixed(1)}%` },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className={cn("text-lg font-bold font-mono", (stat as any).color || "text-gray-900")}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
