import { cn } from '@/lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const SPINNER_SIZES: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

/**
 * Simple monochrome spinning circle. Single source of truth for every loading
 * indicator so all screens animate identically instead of mixing ad-hoc
 * `border-t-*` spans and lucide `Loader2` icons.
 *
 * `rounded-full` is intentional here — it is the one exception to the app's
 * zero-border-radius rule.
 */
export function Spinner({
  size = 'md',
  className,
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-primary-200 border-t-dark-500',
        SPINNER_SIZES[size],
        className
      )}
    />
  );
}

/**
 * Centred spinner used while a screen's data is being fetched. Renders
 * immediately so navigation never shows a blank pane.
 */
export function PageLoader({
  label = 'Loading',
  className,
}: {
  label?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-24',
        className
      )}
    >
      <Spinner size="lg" />
      {label ? (
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary-400">
          {label}
        </p>
      ) : null}
    </div>
  );
}
