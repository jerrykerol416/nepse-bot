import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import BotStatus from "./pages/BotStatus";
import StockDetail from "./pages/StockDetail";
import LoadTest from "./pages/LoadTest";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bots" element={<BotStatus />} />
        <Route path="/stock/:symbol" element={<StockDetail />} />
        <Route path="/load-test" element={<LoadTest />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
