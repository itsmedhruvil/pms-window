/**
 * firebase.ts
 *
 * Client-side Firebase initialisation and FCM (Firebase Cloud Messaging) utilities.
 * Provides token management, foreground message handling, and permission helpers.
 */
'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken, type Messaging, type MessagePayload } from 'firebase/messaging';
import { apiFetch } from '@/lib/utils';

// ─── Firebase Web Config ─────────────────────────────────────────────────────
// Populate these from Firebase Console → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

/** Vapid key for FCM web push — from Firebase Console → Cloud Messaging → Web Configuration */
const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || '';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/** Initialise Firebase (singleton) */
export function initFirebase(): FirebaseApp | null {
  if (typeof window === 'undefined') return null; // server-side guard
  if (getApps().length > 0) return getApp();
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('[FCM] Firebase config missing — check env vars');
    return null;
  }
  app = initializeApp(firebaseConfig);
  return app;
}

/** Get the FCM Messaging instance (singleton) */
export function getFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;
  const fb = initFirebase();
  if (!fb) return null;
  try {
    messaging = getMessaging(fb);
  } catch {
    return null;
  }
  return messaging;
}

/**
 * Request notification permission and register the device's FCM token.
 * Sends the token to the server so it can be used for targeted push notifications.
 *
 * Returns the FCM token string, or null if permission denied / error.
 */
export async function requestFcmToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('[FCM] Notifications not supported in this browser');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }

    const msg = getFirebaseMessaging();
    if (!msg) {
      console.warn('[FCM] Messaging not available');
      return null;
    }

    const token = await getToken(msg, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn('[FCM] No token returned');
      return null;
    }

    console.log('[FCM] Token obtained');
    return token;
  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    return null;
  }
}

/**
 * Register (or update) the FCM token on the server for the current user.
 * Should be called after obtaining a fresh token.
 */
export async function registerFcmTokenOnServer(token: string): Promise<boolean> {
  try {
    const result = await apiFetch('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fcmToken: token }),
    });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Remove a stored FCM token (e.g. on logout or when token is invalidated).
 */
export async function removeFcmToken(): Promise<boolean> {
  try {
    const msg = getFirebaseMessaging();
    if (msg) {
      const currentToken = await getToken(msg, { vapidKey: VAPID_KEY }).catch(() => null);
      if (currentToken) {
        await deleteToken(msg);
      }
    }
    // Tell the server to clear the token
    const result = await apiFetch('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fcmToken: '' }),
    });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Listen for foreground messages (when the app is open).
 * Calls the provided callback with each incoming message payload.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  const msg = getFirebaseMessaging();
  if (!msg) return () => {};

  return onMessage(msg, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    callback(payload);
  });
}

export type { MessagePayload };