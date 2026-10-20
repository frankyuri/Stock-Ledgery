import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Global variable so prompt event captured before React mount is preserved
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((listener) => listener());
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((listener) => listener());
  });
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  // Check if currently running in standalone (installed) mode
  const isInstalled =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://'));

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isInAppBrowser = /Line|FBAN|FBAV|Instagram|MicroMessenger/i.test(ua);
  const isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua) && !isInAppBrowser;
  const isMobile = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  const canPromptDirectly = !!deferredPrompt;

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          deferredPrompt = null;
          listeners.forEach((l) => l());
        }
        return choice.outcome;
      } catch (err) {
        console.warn('Native install prompt failed:', err);
        setModalOpen(true);
      }
    } else {
      // iOS Safari or browsers without beforeinstallprompt -> show step-by-step visual guide
      setModalOpen(true);
    }
  }, []);

  return {
    isInstalled,
    isInstallable: !isInstalled && (canPromptDirectly || isMobile),
    canPromptDirectly,
    isIOS,
    isSafari,
    isInAppBrowser,
    isMobile,
    modalOpen,
    setModalOpen,
    triggerInstall,
  };
}
