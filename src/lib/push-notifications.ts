import webpush from 'web-push';
import connectDB from '@/lib/db';
import PushSubscriptionModel from '@/models/PushSubscription';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@uniqueartspms.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn(
    '[push-notifications] VAPID keys not configured. Push notifications will be disabled.'
  );
}

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
  vibrate?: number[];
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Send a push notification to a specific user's all registered devices.
 * Returns the count of successful sends.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  try {
    await connectDB();
    const subscriptions = await PushSubscriptionModel.find({ userId }).lean();

    if (subscriptions.length === 0) return 0;

    let successCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          },
          JSON.stringify(payload)
        );
        successCount++;
      } catch (err: unknown) {
        // If subscription is expired/invalid, remove it
        if (err && typeof err === 'object' && 'statusCode' in err) {
          const statusCode = (err as { statusCode: number }).statusCode;
          if (statusCode === 410 || statusCode === 404) {
            await PushSubscriptionModel.deleteOne({ _id: sub._id }).catch(() => {});
          }
        }
      }
    }

    return successCount;
  } catch (error) {
    console.error('[sendPushToUser Error]', error);
    return 0;
  }
}

/**
 * Send a push notification to multiple users.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<number> {
  let total = 0;
  for (const uid of userIds) {
    total += await sendPushToUser(uid, payload);
  }
  return total;
}

/**
 * Build a standard push payload from notification fields.
 */
export function buildPushPayload(
  title: string,
  body: string,
  link?: string
): PushPayload {
  return {
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: `unique-arts-pms-${Date.now()}`,
    vibrate: [200, 100, 200],
    data: {
      url: link || '/',
      click_action: link || '/',
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
    ],
  };
}