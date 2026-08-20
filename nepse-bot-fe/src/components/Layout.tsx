import { Outlet, NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/screener", label: "Screener" },
  { to: "/sectors", label: "Sectors" },
  { to: "/depth", label: "Depth" },
  { to: "/floorsheet", label: "Floorsheet" },
  { to: "/calendar", label: "Calendar" },
  { to: "/bots", label: "Bots" },
  { to: "/data", label: "Data" },
  { to: "/load-test", label: "Stress Test" },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-6">
          <h1 className="text-lg font-bold text-teal-700 tracking-tight whitespace-nowrap">
            NEPSE Bot
          </h1>
          <nav className="flex gap-0.5 overflow-x-auto hide-scrollbar">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-teal-50 text-teal-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
