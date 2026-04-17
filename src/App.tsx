import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Portfolio } from '@/pages/Portfolio';
import { StockDetail } from '@/pages/StockDetail';
import { Transactions } from '@/pages/Transactions';
import { Assets } from '@/pages/Assets';
import { LineSettings } from '@/pages/LineSettings';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { NotFound } from '@/pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="assets" element={<Assets />} />
        <Route path="stock/:symbol" element={<StockDetail />} />
        <Route path="settings/line" element={<LineSettings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
