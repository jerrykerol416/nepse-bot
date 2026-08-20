import { useState } from "react";

interface CalendarEvent {
  date: string;
  type: "dividend" | "agm" | "ipo" | "rights" | "holiday";
  symbol?: string;
  description: string;
}

const sampleEvents: CalendarEvent[] = [
  { date: "2024-01-14", type: "holiday", description: "Makar Sankranti - Market Closed" },
  { date: "2024-01-26", type: "holiday", description: "Republic Day - Market Closed" },
  { date: "2024-02-19", type: "holiday", description: "Maha Shivaratri - Market Closed" },
];

const typeColors: Record<string, string> = {
  dividend: "bg-green-100 text-green-700",
  agm: "bg-blue-100 text-blue-700",
  ipo: "bg-purple-100 text-purple-700",
  rights: "bg-amber-100 text-amber-700",
  holiday: "bg-red-100 text-red-700",
};

export default function Calendar() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [year, monthNum] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNum - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const getEvents = (day: number) => {
    const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return sampleEvents.filter((e) => e.date === dateStr);
  };

  const prevMonth = () => {
    const d = new Date(year, monthNum - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const d = new Date(year, monthNum, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthName = new Date(year, monthNum - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const isTradingDay = (day: number) => {
    const d = new Date(year, monthNum - 1, day).getDay();
    return d >= 0 && d <= 4; // Sun-Thu for NEPSE
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Trading Calendar</h1>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600">
            &larr;
          </button>
          <h2 className="font-semibold text-gray-800">{monthName}</h2>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600">
            &rarr;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">
              {d}
            </div>
          ))}
          {days.map((day, i) => (
            <div
              key={i}
              className={`bg-white min-h-[60px] p-1 ${
                day && !isTradingDay(day) ? "bg-gray-50" : ""
              }`}
            >
              {day && (
                <>
                  <span
                    className={`text-xs ${
                      isTradingDay(day) ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {day}
                  </span>
                  {getEvents(day).map((ev, j) => (
                    <div
                      key={j}
                      className={`mt-0.5 px-1 py-0.5 rounded text-[10px] truncate ${typeColors[ev.type]}`}
                      title={ev.description}
                    >
                      {ev.symbol || ev.type}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3 flex-wrap">
          {Object.entries(typeColors).map(([type, cls]) => (
            <span key={type} className={`px-2 py-0.5 rounded text-xs ${cls}`}>
              {type}
            </span>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          NEPSE trading days: Sunday - Thursday. Fri/Sat highlighted as non-trading.
        </p>
      </div>
    </div>
  );
}
