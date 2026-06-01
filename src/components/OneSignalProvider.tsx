'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

/**
 * OneSignal push notification provider.
 * SDK is loaded in layout.tsx - this component handles user identity.
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