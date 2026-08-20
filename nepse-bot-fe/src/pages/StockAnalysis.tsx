import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchOhlcv } from "../api/market";
import { formatNumber, formatDate, percentColor } from "../lib/utils";
import { computeSMA, computeRSI, computeMACD, computeBollingerBands } from "../analytics/indicators";

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function StockAnalysis() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("1y");

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetchOhlcv(symbol, period)
      .then((d) => setCandles(d))
      .catch(() => setCandles([]))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  const closes = candles.map((c) => c.close);
  const sma20 = computeSMA(closes, 20);
  const sma50 = computeSMA(closes, 50);
  const rsi = computeRSI(closes, 14);
  const macd = computeMACD(closes);
  const bb = computeBollingerBands(closes, 20);

  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const changePct = latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : 0;
  const currentRSI = rsi.length > 0 ? rsi[rsi.length - 1] : null;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-teal-600 hover:underline mb-4 inline-block"
      >
        &larr; Back
      </button>

      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{symbol}</h1>
        {latest && (
          <>
            <span className="text-xl font-semibold">{formatNumber(latest.close)}</span>
            <span className={`text-sm font-medium ${percentColor(changePct)}`}>
              {changePct > 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          </>
        )}
      </div>

      {/* Period selector */}
      <div className="flex gap-1 mb-4">
        {["1m", "3m", "6m", "1y", "3y"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${
              period === p ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading...</div>
      ) : candles.length === 0 ? (
        <div className="text-gray-400 py-8 text-center">No price data available for {symbol}</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Price table */}
          <div className="md:col-span-2 bg-white rounded-lg border overflow-hidden">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-sm text-gray-700">Price History</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-right">Open</th>
                    <th className="px-2 py-1.5 text-right">High</th>
                    <th className="px-2 py-1.5 text-right">Low</th>
                    <th className="px-2 py-1.5 text-right">Close</th>
                    <th className="px-2 py-1.5 text-right">Vol</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {candles
                    .slice()
                    .reverse()
                    .slice(0, 50)
                    .map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1">{formatDate(c.date)}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(c.open)}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(c.high)}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(c.low)}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(c.close)}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(c.volume)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Indicators panel */}
          <div className="space-y-3">
            <div className="bg-white rounded-lg border p-3">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Technical Indicators</h3>
              <dl className="space-y-2 text-sm">
                <Indicator label="SMA 20" value={sma20[sma20.length - 1]} />
                <Indicator label="SMA 50" value={sma50[sma50.length - 1]} />
                <Indicator
                  label="RSI (14)"
                  value={currentRSI}
                  color={
                    currentRSI != null
                      ? currentRSI > 70
                        ? "text-red-600"
                        : currentRSI < 30
                          ? "text-green-600"
                          : undefined
                      : undefined
                  }
                />
                <Indicator label="MACD" value={macd.macd[macd.macd.length - 1]} />
                <Indicator label="Signal" value={macd.signal[macd.signal.length - 1]} />
                {bb.upper.length > 0 && (
                  <>
                    <Indicator label="BB Upper" value={bb.upper[bb.upper.length - 1]} />
                    <Indicator label="BB Lower" value={bb.lower[bb.lower.length - 1]} />
                  </>
                )}
              </dl>
            </div>

            {/* Signal summary */}
            <div className="bg-white rounded-lg border p-3">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Signal</h3>
              {currentRSI != null && (
                <p className="text-xs text-gray-600">
                  {currentRSI > 70
                    ? "Overbought - consider taking profits"
                    : currentRSI < 30
                      ? "Oversold - potential buying opportunity"
                      : "Neutral zone"}
                </p>
              )}
              {latest && sma20.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  Price is{" "}
                  {latest.close > sma20[sma20.length - 1] ? "above" : "below"} SMA 20
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Indicator({
  label,
  value,
  color,
}: {
  label: string;
  value: number | undefined | null;
  color?: string;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium ${color || "text-gray-800"}`}>
        {value != null ? value.toFixed(2) : "-"}
      </dd>
    </div>
  );
}
