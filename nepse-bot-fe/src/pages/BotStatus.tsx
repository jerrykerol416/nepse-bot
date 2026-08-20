import { useQuery } from "@tanstack/react-query";
import { fetchBotStatus, fetchBotTrades } from "../api/market";
import { cn, formatNumber } from "../lib/utils";

export default function BotStatus() {
  const status = useQuery({ queryKey: ["bot-status"], queryFn: fetchBotStatus });
  const trades = useQuery({ queryKey: ["bot-trades"], queryFn: fetchBotTrades });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Bot Status</h2>

      {/* Status Cards */}
      {status.isLoading ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">Loading bot status...</div>
      ) : status.isError ? (
        <div className="bg-white rounded-lg border p-8 text-center text-red-500">
          Backend not reachable: {status.error.message}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {status.data?.bots?.map((bot: any, i: number) => (
            <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-800">{bot.name || bot.bot_name}</h3>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    bot.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  )}
                >
                  {bot.active ? "Active" : "Idle"}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Timeframe: {bot.timeframe || "daily"}</p>
                <p>Last run: {bot.last_run || "Never"}</p>
                {bot.total_signals != null && <p>Signals: {bot.total_signals}</p>}
              </div>
            </div>
          )) || (
            <div className="col-span-full bg-white rounded-lg border p-6 text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-2">Scheduler Status</p>
              <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto">
                {JSON.stringify(status.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Paper Trades */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Paper Trades</h3>
        {trades.isLoading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : trades.isError ? (
          <div className="text-red-500 text-sm">Could not load trades</div>
        ) : trades.data && trades.data.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Bot</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trades.data.slice(0, 20).map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-teal-700">{t.symbol}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          t.action === "BUY" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}
                      >
                        {t.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatNumber(t.price)}</td>
                    <td className="px-4 py-2 text-right font-mono">{t.quantity}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{t.bot_name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{t.created_at?.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-6 text-sm text-gray-500">
            No paper trades yet. Bots will generate trades during NEPSE market hours.
          </div>
        )}
      </div>
    </div>
  );
}
