import type { Metadata, Viewport } from 'next';
import type React from 'react';
import ClerkAppProvider from '@/components/ClerkAppProvider';
import { SWRProvider } from '@/components/SWRProvider';
import './globals.css';
import FCMProvider from '@/components/FCMProvider';

export const metadata: Metadata = {
  title: 'Unique Arts PMS — Production Management System',
  description: 'Production Management System for Unique Arts — manufacturing operations',
  appleWebApp: {
    capable: true,
    title: 'Unique Arts PMS',
    statusBarStyle: 'black-translucent',
    startupImage: [
      '/icons/icon-512x512.png',
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'application-name': 'Unique Arts PMS',
    'apple-mobile-web-app-title': 'UA PMS',
    'msapplication-tap-highlight': 'no',
  },
};

export const viewport: Viewport = {
  themeColor: '#43476F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link href="/icons/icon-512x512.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" rel="apple-touch-startup-image" />
        <link href="/icons/icon-512x512.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" rel="apple-touch-startup-image" />
        <link href="/icons/icon-512x512.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" rel="apple-touch-startup-image" />
        {/* FCM service worker is registered by the Firebase SDK automatically */}
      </head>
      <body className="antialiased">
        <ClerkAppProvider>
          <SWRProvider>
            <FCMProvider />
            {children}
          </SWRProvider>
        </ClerkAppProvider>
      </body>
    </html>
  );
}
