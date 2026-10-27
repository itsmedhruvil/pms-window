/**
 * firebase-admin.ts
 *
 * Firebase Admin SDK initialisation for server-side operations.
 * Used to send FCM push notifications from API routes.
 *
 * Credentials can be supplied either as:
 * - FIREBASE_SERVICE_ACCOUNT_JSON (recommended: paste the downloaded JSON), or
 * - FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (base64 of that JSON), or
 * - FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * IMPORTANT: All imports from firebase-admin are dynamic — they only
 * happen when a function like `sendFcmPush` is actually called.
 * This prevents build-time errors when env vars are not yet configured.
 */

/** Strip surrounding quotes/whitespace that some hosts leave on env values */
function cleanEnv(value: string | undefined): string {
  return (value || '').trim().replace(/^["']|["']$/g, '');
}

interface FirebaseServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

export interface FcmConfigStatus {
  configured: boolean;
  source: 'service-account-json' | 'service-account-base64' | 'individual' | 'none';
  /** Env var names that still need to be set. */
  missing: string[];
}

function parseServiceAccountJson(): {
  account: FirebaseServiceAccount;
  source: 'service-account-json' | 'service-account-base64';
} | null {
  const rawJson = cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (rawJson) {
    try {
      return { account: JSON.parse(rawJson) as FirebaseServiceAccount, source: 'service-account-json' };
    } catch {
      console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
      return null;
    }
  }

  const rawBase64 = cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64);
  if (rawBase64) {
    try {
      const decoded = Buffer.from(rawBase64, 'base64').toString('utf8');
      return {
        account: JSON.parse(decoded) as FirebaseServiceAccount,
        source: 'service-account-base64',
      };
    } catch {
      console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 could not be decoded/parsed');
      return null;
    }
  }

  return null;
}

/** Normalise a PEM key: hosts often store newlines as literal "\\n". */
function normalizePrivateKey(value: string | undefined): string {
  return cleanEnv(value).replace(/\\n/g, '\n');
}

function resolveAdminCredentials(): {
  status: FcmConfigStatus;
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  const serviceAccount = parseServiceAccountJson();

  if (serviceAccount) {
    const projectId = cleanEnv(serviceAccount.account.project_id || process.env.FIREBASE_PROJECT_ID);
    const clientEmail = cleanEnv(serviceAccount.account.client_email || process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = normalizePrivateKey(
      serviceAccount.account.private_key || process.env.FIREBASE_PRIVATE_KEY
    );

    const missing: string[] = [];
    if (!projectId) missing.push('project_id');
    if (!clientEmail) missing.push('client_email');
    if (!privateKey) missing.push('private_key');

    return {
      status: {
        configured: missing.length === 0,
        source: serviceAccount.source,
        missing,
      },
      projectId,
      clientEmail,
      privateKey,
    };
  }

  const projectId = cleanEnv(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = cleanEnv(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  const missing: string[] = [];
  if (!projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');

  return {
    status: {
      configured: missing.length === 0,
      source: missing.length === 0 ? 'individual' : 'none',
      missing,
    },
    projectId,
    clientEmail,
    privateKey,
  };
}

/**
 * Detailed server-side push configuration, used by the Settings test card so
 * admins can see exactly which env vars are missing.
 */
export function getFcmConfigStatus(): FcmConfigStatus {
  return resolveAdminCredentials().status;
}

/** Check if Firebase Admin credentials are configured */
function hasAdminConfig(): boolean {
  return resolveAdminCredentials().status.configured;
}

/**
 * Public helper so API routes can distinguish "push is disabled because the
 * server is not configured" from "push was attempted but the send failed".
 */
export function isFcmConfigured(): boolean {
  return hasAdminConfig();
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
    const credentials = resolveAdminCredentials();
    if (!credentials.status.configured) {
      console.warn(
        `[FCM] Firebase Admin not configured — skipping push (missing: ${credentials.status.missing.join(', ')})`
      );
      return false;
    }

    // Dynamic import to avoid build-time module resolution errors
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
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