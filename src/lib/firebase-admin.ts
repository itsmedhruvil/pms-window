/**
 * firebase-admin.ts
 *
 * Firebase Admin SDK initialisation for server-side operations.
 * Used to send FCM push notifications from API routes.
 *
 * IMPORTANT: All imports from firebase-admin are dynamic — they only
 * happen when a function like `sendFcmPush` is actually called.
 * This prevents build-time errors when env vars are not yet configured.
 */

/** Check if Firebase Admin credentials are configured */
function hasAdminConfig(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

/**
 * Send an FCM push notification to a single user by their FCM token.
 */
export async function sendFcmPush(
  token: string,
  title: string,
  body: string,
  link?: string,
  data?: Record<string, string>,
): Promise<boolean> {
  try {
    if (!hasAdminConfig()) {
      console.warn('[FCM] Firebase Admin not configured — skipping push');
      return false;
    }

    // Dynamic import to avoid build-time module resolution errors
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const messaging = getMessaging();

    const message: Record<string, unknown> = {
      token,
      notification: { title, body },
      webpush: {
        fcmOptions: {
          link: link || '/',
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          click_action: link || '/',
          requireInteraction: true,
        },
      },
      data: {
        url: link || '/',
        click_action: link || '/',
        ...(data || {}),
      },
    };

    const response = await messaging.send(message as any);
    console.log('[FCM] Notification sent:', response);
    return true;
  } catch (error) {
    console.error('[FCM] Send error:', error);
    return false;
  }
}

/**
 * Send FCM push notifications to multiple users by their FCM tokens.
 * Filters out empty/invalid tokens.
 */
export async function sendFcmPushToUsers(
  tokens: string[],
  title: string,
  body: string,
  link?: string,
  data?: Record<string, string>,
): Promise<{ success: number; failed: number }> {
  const validTokens = tokens.filter(Boolean);
  if (validTokens.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    validTokens.map((token) =>
      sendFcmPush(token, title, body, link, data)
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`[FCM] Sent to ${success}/${validTokens.length} users (${failed} failed)`);
  return { success, failed };
}