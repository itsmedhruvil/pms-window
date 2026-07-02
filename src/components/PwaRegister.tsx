'use client';

import { useEffect, useState } from 'react';

/**
 * Legacy PWA install banner (kept for adding to home screen).
 * Push notifications are now handled by OneSignalProvider.
 */
export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      return;
    }

    if (localStorage.getItem('pwa-install-dismissed') === 'true') return;

    // Listen for install prompt (Chrome/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto bg-white rounded-lg shadow-2xl border border-primary-200 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-dark-500 flex-shrink-0 flex items-center justify-center">
          <img src="/icons/icon-192x192.png" alt="Unique Arts PMS" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-dark-500">Install App</h3>
          <p className="text-xs text-primary-500 mt-0.5">Install for quick access and push notifications.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={handleInstall} className="px-4 py-1.5 text-xs font-semibold bg-dark-500 text-white rounded-md hover:bg-dark-600 transition-colors">
              Install
            </button>
            <button onClick={() => { setShowInstallBanner(false); localStorage.setItem('pwa-install-dismissed', 'true'); }} className="px-4 py-1.5 text-xs font-semibold text-dark-400 hover:text-dark-500 transition-colors">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}