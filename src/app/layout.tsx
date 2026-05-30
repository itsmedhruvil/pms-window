import type { Metadata, Viewport } from 'next';
import ClerkAppProvider from '@/components/ClerkAppProvider';
import { SWRProvider } from '@/components/SWRProvider';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'Unique Arts PMS — Production Management System',
  description: 'Production Management System for Unique Arts — manufacturing operations',
  appleWebApp: {
    capable: true,
    title: 'Unique Arts PMS',
    statusBarStyle: 'black',
    startupImage: [
      '/icons/icon-512x512.png',
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS Splash Screen for iPhone SE / 5 / 6 / 7 / 8 */}
        <link href="/icons/icon-512x512.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" rel="apple-touch-startup-image" />
        {/* iOS Splash Screen for iPhone 6 / 7 / 8 Plus */}
        <link href="/icons/icon-512x512.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" rel="apple-touch-startup-image" />
        {/* iOS Splash Screen for iPhone X */}
        <link href="/icons/icon-512x512.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" rel="apple-touch-startup-image" />
      </head>
      <body className="antialiased">
        <ClerkAppProvider>
          <SWRProvider>
            <PwaRegister />
            {children}
          </SWRProvider>
        </ClerkAppProvider>
      </body>
    </html>
  );
}