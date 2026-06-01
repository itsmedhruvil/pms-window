const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;
const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

export interface OneSignalPayload {
  headings?: { en: string };
  contents?: { en: string };
  subtitle?: { en: string };
  url?: string;
  icon?: string;
  app_id: string;
  include_external_user_ids?: string[];
  include_segments?: string[];
  isAnyWeb?: boolean;
  web_url?: string;
  web_buttons?: Array<{
    id: string;
    text: string;
    icon?: string;
    url?: string;
  }>;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to a specific user via OneSignal
 */
export async function sendPushToOneSignalUser(
  userId: string,
  title: string,
  body: string,
  link?: string
): Promise<boolean> {
  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.warn('[OneSignal] Missing config - check env vars');
      return false;
    }

    const payload: OneSignalPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: [userId],
      headings: { en: title },
      contents: { en: body },
      url: link || undefined,
      icon: '/icons/icon-192x192.png',
      web_url: link || undefined,
      isAnyWeb: true,
      data: {
        url: link || '/',
        click_action: link || '/',
      },
    };

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('[OneSignal] API error:', result);
      return false;
    }

    console.log('[OneSignal] Notification sent:', result.id);
    return true;
  } catch (error) {
    console.error('[OneSignal] Send error:', error);
    return false;
  }
}

/**
 * Send a push notification to multiple users via OneSignal
 */
export async function sendPushToOneSignalUsers(
  userIds: string[],
  title: string,
  body: string,
  link?: string
): Promise<boolean> {
  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.warn('[OneSignal] Missing config - check env vars');
      return false;
    }

    if (userIds.length === 0) return false;

    const payload: OneSignalPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: userIds,
      headings: { en: title },
      contents: { en: body },
      url: link || undefined,
      icon: '/icons/icon-192x192.png',
      web_url: link || undefined,
      isAnyWeb: true,
      data: {
        url: link || '/',
        click_action: link || '/',
      },
    };

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('[OneSignal] API error:', result);
      return false;
    }

    console.log('[OneSignal] Notification sent to', userIds.length, 'users:', result.id);
    return true;
  } catch (error) {
    console.error('[OneSignal] Send error:', error);
    return false;
  }
}