import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/lib/theme';
import { DisplayScaleProvider } from '@/lib/displayScale';
import { ToastProvider } from '@/lib/toast';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('PWA service worker registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <DisplayScaleProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <App />
              </BrowserRouter>
            </ToastProvider>
          </QueryClientProvider>
        </DisplayScaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
