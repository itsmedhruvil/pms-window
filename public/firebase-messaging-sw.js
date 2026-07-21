/**
 * firebase-messaging-sw.js
 *
 * Firebase Cloud Messaging service worker.
 * Firebase SDK automatically detects and registers this file when
 * getToken() is called with a vapidKey.
 *
 * This file uses the compat SDKs imported from CDN.
 */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Firebase config — these values are read from environment variables at build time.
// Since they are public (API key, project ID, etc.), they are safe to embed here.
// The VAPID key is also public and used for push subscription.
const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Config will be injected by the FCMProvider at runtime
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    image: payload.notification?.image,
    data: payload.data || {},
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});