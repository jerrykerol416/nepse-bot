import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import StockAnalysis from "./pages/StockAnalysis";
import Recommendations from "./pages/Recommendations";
import MarketDepth from "./pages/MarketDepth";
import Floorsheet from "./pages/Floorsheet";
import SectorAnalysis from "./pages/SectorAnalysis";
import StockScreener from "./pages/StockScreener";
import Calendar from "./pages/Calendar";
import DataManager from "./pages/DataManager";
import BotStatus from "./pages/BotStatus";
import LoadTest from "./pages/LoadTest";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analysis/:symbol" element={<StockAnalysis />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/depth" element={<MarketDepth />} />
        <Route path="/floorsheet" element={<Floorsheet />} />
        <Route path="/sectors" element={<SectorAnalysis />} />
        <Route path="/screener" element={<StockScreener />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/data" element={<DataManager />} />
        <Route path="/bots" element={<BotStatus />} />
        <Route path="/load-test" element={<LoadTest />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
