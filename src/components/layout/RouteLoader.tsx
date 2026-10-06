import { AppLayout } from '@/components/layout/AppLayout';
import { PageLoader } from '@/components/ui/spinner';

/**
 * Route-level `loading.tsx` fallback.
 *
 * Every page renders `<AppLayout>` itself rather than a shared route-group
 * layout, so a bare loader would unmount the sidebar and top bar while the new
 * page resolves and remount them afterwards — that flash reads as a delay.
 * Keeping the shell in the fallback means the chrome stays put and only the
 * content area spins.
 */
export function RouteLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <AppLayout>
      <PageLoader label={label} className="min-h-[60vh]" />
    </AppLayout>
  );
}
