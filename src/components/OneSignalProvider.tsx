'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { NotificationType } from '@/types/notifications';

/**
 * OneSignal push notification provider with design-rich notification handling.
 *
 * Responsibilities:
 * 1. Log the current user into OneSignal so they receive targeted pushes.
 * 2. Listen for foreground notifications and forward them to the in-app system
 *    with proper type metadata, colors, and icons.
 * 3. Handle notification clicks to navigate to the correct URL.
 * 4. Consume pending notifications from API responses and dispatch them.
 */
export default function OneSignalProvider() {
  const { isSignedIn, user } = useUser();
  const setupDone = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user || setupDone.current) return;
    setupDone.current = true;

    const tryLogin = () => {
      try {
        const os = (window as any).OneSignal;
        if (os?.initialized) {
          os.login(user.id);
          console.log('[OneSignal] User subscribed:', user.id);

          // ── Listen for foreground notification received events ──
          os.Notifications?.addEventListener('foregroundWillDisplay', (event: any) => {
            const notification = event.getNotification();
            if (notification) {
              const title = notification.title || 'New Notification';
              const body = notification.body || '';
              const data = notification.additionalData || {};

              // Extract structured data from the rich payload
              const notificationType = data.type || NotificationType.ALERT_CREATED;
              const icon = data.icon || '🔔';
              const link = data.url || data.route || data.click_action || '/';
              const color = data.color || '#6B7280';

              // Build the notification title with the emoji icon
              const richTitle = `${icon} ${title}`;

              // Dispatch as in-app notification with rich metadata
              const inAppEvent = new CustomEvent('pms-notification', {
                detail: {
                  type: notificationType,
                  title: richTitle,
                  body,
                  link,
                  metadata: {
                    ...data,
                    icon,
                    color,
                    onesignalId: notification.notificationId,
                  },
                },
                bubbles: true,
              });
              window.dispatchEvent(inAppEvent);

              // Prevent OneSignal from displaying its own notification
              // (since we're showing it in-app)
              event.preventDefault();
            }
          });

          // ── Listen for notification clicks to navigate ──
          os.Notifications?.addEventListener('click', (event: any) => {
            const notification = event.getNotification();
            if (notification) {
              const data = notification.additionalData || {};
              const url = data.url || data.route || data.click_action || '/';

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
    intervalRef.current = setInterval(() => {
      attempts++;
      if (tryLogin() || attempts > 30) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSignedIn, user]);

  return null;
}