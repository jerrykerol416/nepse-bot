import { useEffect, useState } from "react";
import { fetchHealth } from "../api/market";

export default function FreshnessBanner() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const healthy = sources.filter((s) => s.status === "ok").length;
  const total = sources.length;
  const allDown = healthy === 0 && total > 0;

  return (
    <div
      className={cn(
        "rounded-lg px-4 py-2 text-sm flex items-center gap-2 mb-4",
        allDown
          ? "bg-red-50 text-red-700 border border-red-200"
          : healthy < total
            ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-green-50 text-green-700 border border-green-200"
      )}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          allDown ? "bg-red-500" : healthy < total ? "bg-amber-500" : "bg-green-500"
        )}
      />
      <span>
        {allDown
          ? "All data sources offline"
          : `${healthy}/${total} sources active`}
      </span>
      {sources.length > 0 && (
        <span className="ml-auto text-xs opacity-70">
          {sources
            .filter((s) => s.status === "ok")
            .map((s) => s.name)
            .join(", ")}
        </span>
      )}
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
