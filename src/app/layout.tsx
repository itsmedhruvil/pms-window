import type { Metadata, Viewport } from 'next';
import type React from 'react';
import ClerkAppProvider from '@/components/ClerkAppProvider';
import { SWRProvider } from '@/components/SWRProvider';
import './globals.css';
import OneSignalProvider from '@/components/OneSignalProvider';

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

const onesignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '';

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
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer />
        {onesignalAppId && (
          <script
            dangerouslySetInnerHTML={{
              __html: 'window.OneSignalDeferred=window.OneSignalDeferred||[];OneSignalDeferred.push(async function(OneSignal){await OneSignal.init({appId:"' + onesignalAppId + '",safari_web_id:"",notifyButton:{enable:false},allowLocalhostAsSecureOrigin:true});console.log("[OneSignal] SDK initialized");});',
            }}
          />
        )}
      </head>
      <body className="antialiased">
        <ClerkAppProvider>
          <SWRProvider>
            <OneSignalProvider />
            {children}
          </SWRProvider>
        </ClerkAppProvider>
      </body>
    </html>
  );
}