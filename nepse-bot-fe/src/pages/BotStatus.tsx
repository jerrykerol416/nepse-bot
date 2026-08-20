import { useEffect, useState } from "react";
import { fetchBotStatus, fetchBotTrades } from "../api/market";
import { formatNumber, formatDate, percentColor } from "../lib/utils";

interface Bot {
  name: string;
  status: string;
  strategy: string;
  last_run?: string;
  trades_today?: number;
  pnl?: number;
}

interface Trade {
  id: string;
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  timestamp: string;
  bot_name: string;
  pnl?: number;
}

export default function BotStatus() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([fetchBotStatus(), fetchBotTrades()]).then(([b, t]) => {
      if (b.status === "fulfilled") {
        const d = b.value;
        setBots(Array.isArray(d) ? d : d.bots || []);
      }
      if (t.status === "fulfilled") setTrades(Array.isArray(t.value) ? t.value : []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Trading Bots</h1>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading bot status...</div>
      ) : (
        <>
          {/* Bot cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {bots.length > 0 ? (
              bots.map((bot) => (
                <div key={bot.name} className="bg-white rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        bot.status === "running" ? "bg-green-500 animate-pulse" : "bg-gray-400"
                      }`}
                    />
                    <h3 className="font-semibold text-sm text-gray-800">{bot.name}</h3>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Strategy: {bot.strategy}</div>
                    {bot.last_run && <div>Last run: {bot.last_run}</div>}
                    {bot.trades_today != null && <div>Trades today: {bot.trades_today}</div>}
                    {bot.pnl != null && (
                      <div className={percentColor(bot.pnl)}>
                        P&L: {bot.pnl > 0 ? "+" : ""}
                        {formatNumber(bot.pnl)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-white rounded-lg border p-4 text-center text-gray-400 text-sm">
                <p className="mb-1">No bots configured</p>
                <p className="text-xs">
                  Bots run during NEPSE hours (11:00-15:00 NST, Sun-Thu) via scheduler
                </p>
              </div>
            )}
          </div>

          {/* Paper trades */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-3 border-b">
              <h2 className="font-semibold text-sm text-gray-800">Paper Trades</h2>
            </div>
            {trades.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Time</th>
                      <th className="px-2 py-1.5 text-left">Bot</th>
                      <th className="px-2 py-1.5 text-left">Symbol</th>
                      <th className="px-2 py-1.5 text-center">Action</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5 text-right">Price</th>
                      <th className="px-2 py-1.5 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trades.map((t, i) => (
                      <tr key={t.id || i} className="hover:bg-gray-50">
                        <td className="px-2 py-1">{formatDate(t.timestamp)}</td>
                        <td className="px-2 py-1">{t.bot_name}</td>
                        <td className="px-2 py-1 font-medium text-teal-700">{t.symbol}</td>
                        <td className="px-2 py-1 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              t.action === "BUY"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {t.action}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right">{t.quantity}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(t.price)}</td>
                        <td className={`px-2 py-1 text-right ${percentColor(t.pnl || 0)}`}>
                          {t.pnl != null ? formatNumber(t.pnl) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 text-sm">
                No paper trades recorded yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
