'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { NotificationType } from '@/types/notifications';

/**
 * OneSignal push notification provider.
 * SDK is loaded in layout.tsx - this component handles user identity.
 * Also forwards OneSignal notification events to the in-app notification system.
 */
export default function OneSignalProvider() {
  const { isSignedIn, user } = useUser();
  const setupDone = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user || setupDone.current) return;
    setupDone.current = true;

    const tryLogin = () => {
      try {
        const os = (window as any).OneSignal;
        if (os?.initialized) {
          os.login(user.id);
          console.log('[OneSignal] User subscribed:', user.id);

          // Listen for OneSignal notification received events
          // and forward them to the in-app notification system
          os.Notifications?.addEventListener('foregroundWillDisplay', (event: any) => {
            // Notification received while app is in foreground
            const notification = event.getNotification();
            if (notification) {
              const title = notification.title || 'New Notification';
              const body = notification.body || '';
              const data = notification.additionalData || {};
              const link = data.url || data.route || '/';

              // Dispatch as in-app notification
              const inAppEvent = new CustomEvent('pms-notification', {
                detail: {
                  type: data.type || NotificationType.ALERT_CREATED,
                  title,
                  body,
                  link,
                  metadata: { ...data, onesignalId: notification.notificationId },
                },
                bubbles: true,
              });
              window.dispatchEvent(inAppEvent);
            }
          });

          // Also listen for click events to mark as read when coming from push
          os.Notifications?.addEventListener('click', (event: any) => {
            const notification = event.getNotification();
            if (notification) {
              const data = notification.additionalData || {};
              const url = data.url || data.route || '/';

              // Navigate to the URL
              if (url && typeof window !== 'undefined') {
                window.location.href = url.startsWith('/') 
                  ? `${window.location.origin}${url}`
                  : url;
              }
            }
          });

          return true;
        }
      } catch (e) {
        // ignore
      }
      return false;
    };

    // Retry until OneSignal is initialized
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (tryLogin() || attempts > 30) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSignedIn, user]);

  return null;
}