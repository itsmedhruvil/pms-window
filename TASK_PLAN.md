# OneSignal → Firebase Migration Plan

## Files to create:
1. `src/lib/firebase.ts` — Firebase client SDK config + FCM token management
2. `src/lib/firebase-admin.ts` — Firebase Admin SDK (server-side) for FCM sends
3. `src/components/FCMProvider.tsx` — Client-side FCM token registration + foreground message handler

## Files to modify:
4. `src/lib/onesignal.ts` → Replace with FCM-based `src/lib/fcm.ts` (server-side push via FCM)
5. `src/lib/notifications.ts` — Replace OneSignal import with FCM
6. `src/app/layout.tsx` — Remove OneSignal script, replace OneSignalProvider with FCMProvider
7. `public/sw.js` — Add FCM background message listener, remove OneSignal handling
8. `src/app/api/test-push/route.ts` — Use FCM instead of OneSignal
9. `.env` — Remove OneSignal vars, add Firebase vars
10. `package.json` — Remove `onesignal-node`, `react-onesignal`; add `firebase-admin`

## Files to delete:
11. `public/OneSignalSDKWorker.js`
12. `src/components/OneSignalProvider.tsx`