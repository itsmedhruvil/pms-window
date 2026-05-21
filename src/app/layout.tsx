import type { Metadata } from 'next';
import ClerkAppProvider from '@/components/ClerkAppProvider';
import { SWRProvider } from '@/components/SWRProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Window ERP — Manufacturing Operations',
  description: 'Production-grade ERP system for window manufacturing operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="https://progressier.app/Ko1ajWkNu7OtNVumtGzu/progressier.json"/>
        <script defer src="https://progressier.app/Ko1ajWkNu7OtNVumtGzu/script.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/progressier.js');
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ClerkAppProvider>
          <SWRProvider>
            {children}
          </SWRProvider>
        </ClerkAppProvider>
      </body>
    </html>
  );
}
