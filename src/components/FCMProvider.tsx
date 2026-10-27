'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { NotificationType } from '@/types/notifications';

/**
 * FCM (Firebase Cloud Messaging) provider.
 *
 * The Firebase SDK (~100 KB) is loaded lazily after sign-in so it never blocks
 * the first paint or the dashboard bundle.
 *
 * 1. Silently refreshes the FCM token when the user already granted push
 *    permission (never prompts automatically — browsers block that).
 * 2. Re-registers instantly after the user enables push from the bell.
 * 3. Converts foreground push messages into in-app notification events.
 * 4. Clears the token on sign-out.
 */
export default function FCMProvider() {
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let unregisterPushEnabled: (() => void) | null = null;

    const setup = async () => {
      const { getPushPermission, onForegroundMessage, registerFcmTokenOnServer, requestFcmToken } =
        await import('@/lib/firebase');
      if (cancelled) return;

      const registerIfAllowed = async () => {
        if (getPushPermission() !== 'granted') return;
        if (window.localStorage.getItem('pms-push-disabled') === 'true') return;

        // requestPermission: false keeps this silent; the user already opted in.
        const token = await requestFcmToken({ requestPermission: false });
        if (cancelled || !token) return;
        await registerFcmTokenOnServer(token);
      };

      // Foreground messages: refresh the MongoDB-backed bell immediately.
      unsubscribe = onForegroundMessage((payload) => {
        const notification = payload.notification;
        const data = payload.data || {};
        if (!notification && !data.title) return;

        const title = notification?.title || data.title || 'New Notification';
        const body = notification?.body || data.body || '';
        const link = data.url || data.click_action || '/';

        // FCM does not render a system notification while the app is focused.
        // Show one explicitly so foreground pushes (and the Settings test)
        // are actually visible, then refresh the in-app bell.
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          'serviceWorker' in navigator
        ) {
          navigator.serviceWorker.ready
            .then((registration) =>
              registration.showNotification(title, {
                body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...data, url: link },
              })
            )
            .catch((error) => console.warn('[FCM] Foreground notification failed:', error));
        }

        window.dispatchEvent(
          new CustomEvent('pms-notification', {
            detail: {
              type: data.type || NotificationType.ALERT_CREATED,
              title,
              body,
              link,
              metadata: data,
            },
          })
        );
      });

      void registerIfAllowed();
      window.addEventListener('pms-push-enabled', registerIfAllowed);
      unregisterPushEnabled = () => window.removeEventListener('pms-push-enabled', registerIfAllowed);
    };

    void setup();

    return () => {
      cancelled = true;
      unsubscribe?.();
      unregisterPushEnabled?.();
    };
  }, [isLoaded, isSignedIn]);

  // Clear the server-side token when the user signs out.
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      void import('@/lib/firebase').then(({ removeFcmToken }) => removeFcmToken());
    }
  }, [isLoaded, isSignedIn]);

  return null;
}
