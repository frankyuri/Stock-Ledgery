import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/useAuthStore';

const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const Overview = lazy(() =>
  import('@/pages/Overview').then((m) => ({ default: m.Overview })),
);
const Portfolio = lazy(() =>
  import('@/pages/Portfolio').then((m) => ({ default: m.Portfolio })),
);
const Dividends = lazy(() =>
  import('@/pages/Dividends').then((m) => ({ default: m.Dividends })),
);
const Analytics = lazy(() =>
  import('@/pages/Analytics').then((m) => ({ default: m.Analytics })),
);
const FireTracker = lazy(() =>
  import('@/pages/FireTracker').then((m) => ({ default: m.FireTracker })),
);
const Rebalance = lazy(() =>
  import('@/pages/Rebalance').then((m) => ({ default: m.Rebalance })),
);
const StockDetail = lazy(() =>
  import('@/pages/StockDetail').then((m) => ({ default: m.StockDetail })),
);
const Transactions = lazy(() =>
  import('@/pages/Transactions').then((m) => ({ default: m.Transactions })),
);
const Assets = lazy(() =>
  import('@/pages/Assets').then((m) => ({ default: m.Assets })),
);
const LineSettings = lazy(() =>
  import('@/pages/LineSettings').then((m) => ({ default: m.LineSettings })),
);
const DataSettings = lazy(() =>
  import('@/pages/DataSettings').then((m) => ({ default: m.DataSettings })),
);
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() =>
  import('@/pages/Register').then((m) => ({ default: m.Register })),
);
const NotFound = lazy(() =>
  import('@/pages/NotFound').then((m) => ({ default: m.NotFound })),
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
            <RequireAuth>
              <LazyPage>
                <Overview />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="portfolio"
          element={
            <RequireAuth>
              <LazyPage>
                <Portfolio />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="dividends"
          element={
            <RequireAuth>
              <LazyPage>
                <Dividends />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="analytics"
          element={
            <RequireAuth>
              <LazyPage>
                <Analytics />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="fire"
          element={
            <RequireAuth>
              <LazyPage>
                <FireTracker />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="rebalance"
          element={
            <RequireAuth>
              <LazyPage>
                <Rebalance />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="transactions"
          element={
            <RequireAuth>
              <LazyPage>
                <Transactions />
              </LazyPage>
            </RequireAuth>
          }
        />
        <Route
          path="assets"
          element={
            <RequireAuth>
              <LazyPage>
                <Assets />
              </LazyPage>
            </RequireAuth>
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
            <RequireAuth>
              <LazyPage>
                <DataSettings />
              </LazyPage>
            </RequireAuth>
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
