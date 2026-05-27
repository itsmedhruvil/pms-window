import type { Metadata } from 'next';
import ClerkAppProvider from '@/components/ClerkAppProvider';
import { SWRProvider } from '@/components/SWRProvider';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'Window ERP — Manufacturing Operations',
  description: 'Production-grade ERP system for window manufacturing operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Window ERP" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
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
