'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (subscribing) return;
    setSubscribing(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        setSubscribing(false);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.warn('[PWA] VAPID public key not configured');
        setSubscribing(false);
        return;
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey.buffer as ArrayBuffer,
      });

      const subJSON = subscription.toJSON();
      if (!subJSON.endpoint || !subJSON.keys) {
        console.warn('[PWA] Invalid subscription object');
        setSubscribing(false);
        return;
      }

      await apiFetch('/api/push-subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          auth: subJSON.keys.auth,
          p256dh: subJSON.keys.p256dh,
        }),
      });
    } catch (err) {
      console.error('[PWA] Failed to subscribe to push notifications:', err);
    }
    setSubscribing(false);
  }, [subscribing]);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const hideBanner = useCallback(() => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }, []);

  // Register service worker as early as possible
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Worker not supported');
      return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    let cancelled = false;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        if (cancelled) return;
        console.log('[PWA] Service Worker registered successfully');
        setSwRegistered(true);

        // Auto-subscribe to push if permission is already granted
        const isPushSupported =
          'PushManager' in window && 'Notification' in window;
        if (isPushSupported && Notification.permission === 'granted') {
          await subscribeToPush();
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[PWA] Service Worker registration failed:', err);
          // Retry after a delay
          setTimeout(registerSW, 5000);
        }
      }
    };

    registerSW();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up PWA event listeners and check state after SW is registered
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check localStorage for dismissal
    if (localStorage.getItem('pwa-install-dismissed') === 'true') {
      return;
    }

    // Check push notification support
    const isPushSupported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setPushSupported(isPushSupported);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt fired');
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for installed app
    const installedHandler = () => {
      console.log('[PWA] App installed');
      setIsInstalled(true);
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    // Listen for display mode changes (user can add to home screen manually)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const displayModeHandler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setShowInstallBanner(false);
      }
    };
    mediaQuery.addEventListener('change', displayModeHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      mediaQuery.removeEventListener('change', displayModeHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swRegistered]);

  // Detect if user is on mobile
  const isMobile = typeof window !== 'undefined' && (
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0 && window.innerWidth < 768)
  );

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;

    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      await subscribeToPush();
    }
  };

  if (isInstalled && pushSupported && Notification.permission === 'default') {
    // Show a small prompt to enable notifications for installed PWA
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto bg-white rounded-lg shadow-2xl border border-gray-200 p-4 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
            <img
              src="/icons/icon-192x192.png"
              alt="Unique Arts PMS"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Enable Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Get instant alerts for tasks, mentions, and updates.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnableNotifications}
                disabled={subscribing}
                className="px-4 py-1.5 text-xs font-semibold bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {subscribing ? 'Enabling...' : 'Enable'}
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('pwa-notif-dismissed', 'true');
                }}
                className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('pwa-notif-dismissed', 'true');
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (isInstalled || !showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto bg-white rounded-lg shadow-2xl border border-gray-200 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
          <img
            src="/icons/icon-192x192.png"
              alt="Unique Arts PMS"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {isMobile ? 'Add to Home Screen' : 'Install Unique Arts PMS'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isMobile
              ? 'Add this app to your home screen for quick access and offline support.'
              : 'Install this app on your device for quick access and offline support.'
            }
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 text-xs font-semibold bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              {isMobile ? 'Add' : 'Install'}
            </button>
            <button
              onClick={hideBanner}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Not now
            </button>
          </div>
          {pushSupported && Notification.permission === 'default' && (
            <button
              onClick={handleEnableNotifications}
              disabled={subscribing}
              className="mt-2 text-[10px] font-mono text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
            >
              {subscribing ? 'Subscribing...' : 'Also enable push notifications'}
            </button>
          )}
        </div>
        <button
          onClick={hideBanner}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Convert a base64 encoded string to a Uint8Array.
 * Required for the applicationServerKey parameter.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}