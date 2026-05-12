'use client';

import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';

interface ClerkAppProviderProps {
  children: ReactNode;
}

export default function ClerkAppProvider({ children }: ClerkAppProviderProps) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
