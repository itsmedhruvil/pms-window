'use client';

import { useState } from 'react';
import { BellRing, BellOff, CheckCircle2, AlertTriangle, Loader2, Send } from 'lucide-react';
import { apiFetch, cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface TestPushResponse {
  sent: number;
  failed: number;
  totalUsers: number;
  message: string;
}

type Result = { ok: boolean; message: string } | null;

/**
 * Admin-only push diagnostic card (Settings page).
 *
 * Enables push on this device when needed, then sends a test notification to
 * the current user only so testing does not spam the whole team.
 */
export function PushNotificationTester() {
  const push = usePushNotifications();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [title, setTitle] = useState('🔔 Test Notification');
  const [body, setBody] = useState('Push notifications are working. This is a test from Unique Arts PMS.');

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setResult(null);

    try {
      // Always (re)register the current device token before testing. When
      // permission is already granted this is silent; when not, it prompts.
      const enabled = await push.enable();
      if (!enabled) {
        setResult({
          ok: false,
          message: push.denied
            ? 'Notifications are blocked. Allow them for this site in your browser settings, then retry.'
            : 'Push could not be enabled. Allow notifications when prompted and verify the Firebase web config (including NEXT_PUBLIC_FCM_VAPID_KEY) on the deployment.',
        });
        return;
      }

      const res = await apiFetch<TestPushResponse>('/api/test-push', {
        method: 'POST',
        body: JSON.stringify({
          onlyMe: true,
          title: title.trim() || '🔔 Test Notification',
          body: body.trim() || 'Push notifications are working.',
          link: '/dashboard',
        }),
      });

      if (!res.success || !res.data) {
        setResult({ ok: false, message: res.error || 'Test push failed.' });
        return;
      }

      setResult({
        ok: res.data.sent > 0,
        message:
          res.data.sent > 0
            ? `Test push sent to ${res.data.sent} device${res.data.sent === 1 ? '' : 's'}. Check your notifications.`
            : `Push was accepted but failed for ${res.data.failed} device(s).`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Test push failed.',
      });
    } finally {
      setSending(false);
    }
  };

  const statusLabel = !push.supported
    ? 'Push is not supported in this browser'
    : push.denied
    ? 'Notifications are blocked in browser settings'
    : push.enabled
    ? 'Push is enabled on this device'
    : 'Push is not enabled on this device';

  return (
    <div className="px-6 pb-6">
      <div className="border border-primary-200">
        <div className="px-4 py-3 border-b border-primary-200 bg-primary-50 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-600">
              Push Notifications
            </h2>
            <p className="text-[10px] text-primary-500 font-mono mt-0.5">
              Enable push on this device and send yourself a test notification.
            </p>
          </div>
          <div className={cn('flex items-center gap-1.5 text-[10px] font-mono', push.enabled ? 'text-emerald-600' : 'text-primary-500')}>
            {push.enabled ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{statusLabel}</span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-primary-500">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                className="mt-1 w-full text-xs border border-primary-200 px-3 py-2 focus:outline-none focus:border-dark-500"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-primary-500">Message</span>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={160}
                className="mt-1 w-full text-xs border border-primary-200 px-3 py-2 focus:outline-none focus:border-dark-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !push.supported}
              className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide bg-dark-500 text-white hover:bg-dark-600 disabled:opacity-40 transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Sending…' : push.enabled ? 'Send test push' : 'Enable & send test'}
            </button>

            {!push.enabled && !push.denied && push.supported && (
              <button
                type="button"
                onClick={() => void push.enable()}
                disabled={push.busy}
                className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-primary-200 hover:border-dark-500 disabled:opacity-40 transition-colors"
              >
                {push.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
                Enable push only
              </button>
            )}

            {push.enabled && (
              <button
                type="button"
                onClick={() => void push.disable()}
                disabled={push.busy}
                className="text-[10px] font-mono text-primary-500 hover:text-red-600 disabled:opacity-40"
              >
                Turn off on this device
              </button>
            )}
          </div>

          {result && (
            <p
              className={cn(
                'flex items-start gap-1.5 text-[11px] border px-3 py-2',
                result.ok
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-red-700 bg-red-50 border-red-200'
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              )}
              {result.message}
            </p>
          )}

          <p className="text-[10px] text-primary-400 font-mono leading-relaxed">
            Test sends only to your account. Server push requires the Firebase Admin
            environment variables; without them the API will report that push is disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
