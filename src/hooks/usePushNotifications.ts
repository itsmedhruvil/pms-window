'use client';

import { useCallback, useEffect, useState } from 'react';

type PushStatus = NotificationPermission | 'unsupported';

const DISABLED_KEY = 'pms-push-disabled';

function supportsPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function readPermission(): PushStatus {
  return supportsPush() ? Notification.permission : 'unsupported';
}

function readMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISABLED_KEY) === 'true';
}

/**
 * Push-notification controls for the bell / settings UI.
 *
 * Permission is only requested from a user gesture (the "Enable" button) —
 * browsers block automatic prompts, which is why push previously never
 * activated on first load. Firebase is imported on demand so it stays out of
 * the initial bundle.
 */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('default');
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(readPermission());
    setMuted(readMuted());
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const { requestFcmToken, registerFcmTokenOnServer } = await import('@/lib/firebase');
      const token = await requestFcmToken();
      if (!token) {
        setStatus(readPermission());
        return false;
      }
      const registered = await registerFcmTokenOnServer(token);
      if (!registered) return false;

      window.localStorage.removeItem(DISABLED_KEY);
      setMuted(false);
      setStatus('granted');
      window.dispatchEvent(new CustomEvent('pms-push-enabled'));
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const { removeFcmToken } = await import('@/lib/firebase');
      await removeFcmToken();
      window.localStorage.setItem(DISABLED_KEY, 'true');
      setMuted(true);
      window.dispatchEvent(new CustomEvent('pms-push-disabled'));
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported: supportsPush(),
    status,
    /** True only when the browser granted permission and the user did not mute. */
    enabled: status === 'granted' && !muted,
    denied: status === 'denied',
    busy,
    enable,
    disable,
  };
}
