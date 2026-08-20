import { useEffect, useState } from "react";
import { fetchBotStatus, fetchBotTrades } from "@/api/market";
import { cn, formatCompact } from "@/lib/utils";

interface BotStats {
  total_trades: number;
  open_positions: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  budget_used: number;
}

interface Learning {
  id: string;
  pattern: string;
  adjustment: string;
  created_at: string;
}

interface OpenTrade {
  id: string;
  symbol: string;
  entry_price: number;
  quantity: number;
  stoploss: number;
  target: number;
  created_at: string;
}

interface Bot {
  id: string;
  name: string;
  strategy: string;
  status: string;
  budget: number;
  risk_per_trade: number;
  max_positions: number;
  last_run: string | null;
  stats: BotStats;
  recent_learning: Learning[];
  open_trades: OpenTrade[];
}

interface Trade {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  stoploss: number;
  target: number;
  status: string;
  pnl: number | null;
  lesson_learned: string | null;
  created_at: string;
  bot_configs?: { name: string };
}

export default function BotStatus() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "trades" | "learning">("overview");

  useEffect(() => {
    async function load() {
      try {
        const [statusRes, tradesRes] = await Promise.all([
          fetchBotStatus(),
          fetchBotTrades(),
        ]);
        if (statusRes?.bots) setBots(statusRes.bots);
        if (Array.isArray(tradesRes)) setTrades(tradesRes);
      } catch (e) {
        console.error("Bot status load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalBudget = bots.reduce((s, b) => s + (b.budget || 0), 0);
  const totalPnl = bots.reduce((s, b) => s + (b.stats?.total_pnl || 0), 0);
  const totalTrades = bots.reduce((s, b) => s + (b.stats?.total_trades || 0), 0);
  const totalOpen = bots.reduce((s, b) => s + (b.stats?.open_positions || 0), 0);
  const avgWinRate = bots.length > 0 ? Math.round(bots.reduce((s, b) => s + (b.stats?.win_rate || 0), 0) / bots.length) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trading Bots</h1>
          <p className="text-sm text-gray-500 mt-1">Automated paper trading with adaptive learning</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-green-700">Scheduler Active</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total Budget" value={`NPR ${formatCompact(totalBudget)}`} />
        <SummaryCard label="Total P&L" value={`NPR ${formatCompact(totalPnl)}`} valueClass={totalPnl >= 0 ? "text-green-600" : "text-red-600"} />
        <SummaryCard label="Total Trades" value={String(totalTrades)} />
        <SummaryCard label="Open Positions" value={String(totalOpen)} />
        <SummaryCard label="Avg Win Rate" value={`${avgWinRate}%`} valueClass={avgWinRate >= 50 ? "text-green-600" : "text-amber-600"} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {(["overview", "trades", "learning"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors capitalize",
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab bots={bots} />}
      {activeTab === "trades" && <TradesTab trades={trades} />}
      {activeTab === "learning" && <LearningTab bots={bots} />}
    </div>
  );
}

function SummaryCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={cn("text-lg font-bold mt-1", valueClass || "text-gray-900")}>{value}</p>
    </div>
  );
}

function OverviewTab({ bots }: { bots: Bot[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {bots.map((bot) => (
        <BotCard key={bot.id} bot={bot} />
      ))}
      {bots.length === 0 && (
        <div className="col-span-full text-center py-12 text-gray-400">
          No bots configured yet. The scheduler will create trades once market opens.
        </div>
      )}
    </div>
  );
}

function BotCard({ bot }: { bot: Bot }) {
  const pnl = bot.stats?.total_pnl || 0;
  const budgetUsedPct = bot.budget > 0 ? Math.round(((bot.stats?.budget_used || 0) / bot.budget) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{bot.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{bot.strategy}</p>
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs font-medium",
          bot.status === "running" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
        )}>
          {bot.status}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-400">Budget</p>
          <p className="text-sm font-semibold">NPR {formatCompact(bot.budget)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">P&L</p>
          <p className={cn("text-sm font-semibold", pnl >= 0 ? "text-green-600" : "text-red-600")}>
            {pnl >= 0 ? "+" : ""}{formatCompact(pnl)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Win Rate</p>
          <p className="text-sm font-semibold">{bot.stats?.win_rate || 0}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Open</p>
          <p className="text-sm font-semibold">{bot.stats?.open_positions || 0} / {bot.max_positions}</p>
        </div>
      </div>

      {/* Budget Usage Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Budget Used</span>
          <span>{budgetUsedPct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Open Positions */}
      {bot.open_trades && bot.open_trades.length > 0 && (
        <div className="border-t border-gray-50 pt-3 mt-1">
          <p className="text-xs font-medium text-gray-500 mb-2">Open Positions</p>
          <div className="space-y-1.5">
            {bot.open_trades.map((t) => (
              <div key={t.id} className="flex justify-between text-xs">
                <span className="font-medium text-gray-700">{t.symbol}</span>
                <span className="text-gray-500">{t.quantity} @ {t.entry_price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Run */}
      {bot.last_run && (
        <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-50">
          Last run: {new Date(bot.last_run).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}

function TradesTab({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No trades yet. Bots will start trading when market conditions match their strategies.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Bot</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Symbol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Side</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Entry</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Exit</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Qty</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">P&L</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Lesson</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {trades.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-600 text-xs">{t.bot_configs?.name || "-"}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{t.symbol}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    t.side === "BUY" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}>
                    {t.side}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{t.entry_price}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.exit_price || "-"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.quantity}</td>
                <td className={cn("px-4 py-3 text-right font-medium tabular-nums", t.pnl && t.pnl > 0 ? "text-green-600" : t.pnl && t.pnl < 0 ? "text-red-600" : "text-gray-500")}>
                  {t.pnl != null ? `${t.pnl > 0 ? "+" : ""}${t.pnl.toFixed(0)}` : "-"}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    t.status === "open" ? "bg-blue-50 text-blue-700" : t.status === "closed" ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-700"
                  )}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{t.lesson_learned || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LearningTab({ bots }: { bots: Bot[] }) {
  const allLearning = bots.flatMap((b) =>
    (b.recent_learning || []).map((l) => ({ ...l, botName: b.name }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allLearning.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No learning events yet. Bots will record insights after stoploss hits or losing streaks.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allLearning.map((l) => (
        <div key={l.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-sm font-medium text-gray-900">{l.botName}</span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(l.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </span>
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium text-amber-700">Pattern:</span> {l.pattern.replace(/_/g, " ")}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium text-blue-700">Adjustment:</span> {l.adjustment}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
