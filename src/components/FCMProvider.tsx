'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { requestFcmToken, registerFcmTokenOnServer, removeFcmToken, onForegroundMessage } from '@/lib/firebase';
import { NotificationType } from '@/types/notifications';

/**
 * FCM (Firebase Cloud Messaging) provider.
 *
 * Responsibilities:
 * 1. Request notification permission and obtain FCM token on sign-in.
 * 2. Register the token on the server for targeted push notifications.
 * 3. Listen for foreground messages and dispatch them as in-app notifications.
 * 4. Clean up token on sign-out.
 */
export default function FCMProvider() {
  const { isSignedIn, user } = useUser();
  const setupDone = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user || setupDone.current) return;
    setupDone.current = true;

    const setupFcm = async () => {
      // Request permission and get token
      const token = await requestFcmToken();
      if (token) {
        // Register token on server
        await registerFcmTokenOnServer(token);
        console.log('[FCM] Token registered for user:', user.id);
      }

      // Listen for foreground messages
      const unsubscribe = onForegroundMessage((payload) => {
        const notification = payload.notification;
        const data = payload.data || {};

        if (!notification) return;

        const title = notification.title || 'New Notification';
        const body = notification.body || '';
        const link = data.url || data.click_action || '/';
        const notificationType = data.type || NotificationType.ALERT_CREATED;
        const icon = data.icon || '🔔';
        const color = data.color || '#6B7280';

        // Dispatch as in-app notification
        const inAppEvent = new CustomEvent('pms-notification', {
          detail: {
            type: notificationType,
            title: `${icon} ${title}`,
            body,
            link,
            metadata: {
              ...data,
              icon,
              color,
            },
          },
          bubbles: true,
        });
        window.dispatchEvent(inAppEvent);
      });

      return unsubscribe;
    };

    let unsubscribe: (() => void) | null = null;
    setupFcm().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      setupDone.current = false;
      if (unsubscribe) unsubscribe();
    };
  }, [isSignedIn, user]);

  // Clean up token on sign-out
  useEffect(() => {
    if (!isSignedIn && setupDone.current) {
      removeFcmToken().catch(() => {});
      setupDone.current = false;
    }
  }, [isSignedIn]);

  return null;
}