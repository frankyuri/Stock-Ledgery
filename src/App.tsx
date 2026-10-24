import { lazy, Suspense, useEffect, type ReactNode, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * 具有自動重試與發布版本自癒機制的 lazy 載入器
 * 當用戶端因伺服器重新部署而遇到舊 hash 模組 404 時，自動重新整理頁面獲取最新 chunk 檔案
 */
function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name: string,
) {
  return lazy(async () => {
    const key = `chunk_retry_${name}`;
    const hasRetried = sessionStorage.getItem(key);
    try {
      const module = await factory();
      sessionStorage.removeItem(key);
      return module;
    } catch (error) {
      if (!hasRetried) {
        sessionStorage.setItem(key, 'true');
        console.warn(`[LazyRetry] Failed to load chunk for ${name}, auto reloading...`, error);
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      sessionStorage.removeItem(key);
      throw error;
    }
  });
}

const Dashboard = lazyRetry(
  () => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })),
  'Dashboard',
);
const Overview = lazyRetry(
  () => import('@/pages/Overview').then((m) => ({ default: m.Overview })),
  'Overview',
);
const Portfolio = lazyRetry(
  () => import('@/pages/Portfolio').then((m) => ({ default: m.Portfolio })),
  'Portfolio',
);
const Dividends = lazyRetry(
  () => import('@/pages/Dividends').then((m) => ({ default: m.Dividends })),
  'Dividends',
);
const Analytics = lazyRetry(
  () => import('@/pages/Analytics').then((m) => ({ default: m.Analytics })),
  'Analytics',
);
const FireTracker = lazyRetry(
  () => import('@/pages/FireTracker').then((m) => ({ default: m.FireTracker })),
  'FireTracker',
);
const Rebalance = lazyRetry(
  () => import('@/pages/Rebalance').then((m) => ({ default: m.Rebalance })),
  'Rebalance',
);
const TaxCenter = lazyRetry(
  () => import('@/pages/TaxCenter').then((m) => ({ default: m.TaxCenter })),
  'TaxCenter',
);
const StockDetail = lazyRetry(
  () => import('@/pages/StockDetail').then((m) => ({ default: m.StockDetail })),
  'StockDetail',
);
const Transactions = lazyRetry(
  () => import('@/pages/Transactions').then((m) => ({ default: m.Transactions })),
  'Transactions',
);
const Assets = lazyRetry(
  () => import('@/pages/Assets').then((m) => ({ default: m.Assets })),
  'Assets',
);
const LineSettings = lazyRetry(
  () => import('@/pages/LineSettings').then((m) => ({ default: m.LineSettings })),
  'LineSettings',
);
const DataSettings = lazyRetry(
  () => import('@/pages/DataSettings').then((m) => ({ default: m.DataSettings })),
  'DataSettings',
);
const Login = lazyRetry(
  () => import('@/pages/Login').then((m) => ({ default: m.Login })),
  'Login',
);
const Register = lazyRetry(
  () => import('@/pages/Register').then((m) => ({ default: m.Register })),
  'Register',
);
const NotFound = lazyRetry(
  () => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })),
  'NotFound',
);

function PageFallback() {
  return (
    <div className="space-y-4 py-8">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  useEffect(() => {
    void useAuthStore.getState().bootstrap();
  }, []);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LazyPage>
            <Login />
          </LazyPage>
        }
      />
      <Route
        path="/register"
        element={
          <LazyPage>
            <Register />
          </LazyPage>
        }
      />
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <LazyPage>
              <Dashboard />
            </LazyPage>
          }
        />
        <Route
          path="stock/:symbol"
          element={
            <LazyPage>
              <StockDetail />
            </LazyPage>
          }
        />

        <Route
          path="overview"
          element={
            <LazyPage>
              <Overview />
            </LazyPage>
          }
        />
        <Route
          path="portfolio"
          element={
            <LazyPage>
              <Portfolio />
            </LazyPage>
          }
        />
        <Route
          path="dividends"
          element={
            <LazyPage>
              <Dividends />
            </LazyPage>
          }
        />
        <Route
          path="analytics"
          element={
            <LazyPage>
              <Analytics />
            </LazyPage>
          }
        />
        <Route
          path="fire"
          element={
            <LazyPage>
              <FireTracker />
            </LazyPage>
          }
        />
        <Route
          path="rebalance"
          element={
            <LazyPage>
              <Rebalance />
            </LazyPage>
          }
        />
        <Route
          path="tax"
          element={
            <LazyPage>
              <TaxCenter />
            </LazyPage>
          }
        />
        <Route
          path="transactions"
          element={
            <LazyPage>
              <Transactions />
            </LazyPage>
          }
        />
        <Route
          path="assets"
          element={
            <LazyPage>
              <Assets />
            </LazyPage>
          }
        />
        <Route
          path="settings/line"
          element={
            <RequireAuth>
              <LazyPage>
                <LineSettings />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="settings/data"
          element={
            <LazyPage>
              <DataSettings />
            </LazyPage>
          }
        />

        <Route
          path="*"
          element={
            <LazyPage>
              <NotFound />
            </LazyPage>
          }
        />
      </Route>
    </Routes>
  );
}
