import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DemoNoticeBanner } from '@/components/ui/DemoNoticeBanner';
import { InstallBanner } from '@/components/pwa/InstallBanner';

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // 切換頁面時自動關掉行動版抽屜
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-4 sm:p-5 md:p-8 pb-24 md:pb-8">
          <InstallBanner />
          <DemoNoticeBanner />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <BottomNav onOpenMenu={() => setDrawerOpen(true)} />
      </div>
    </div>
  );
}
