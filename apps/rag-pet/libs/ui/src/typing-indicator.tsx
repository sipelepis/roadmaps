import { cn } from './utils';

const DELAYS = ['0s', '0.15s', '0.3s'];

export interface TypingIndicatorProps {
  className?: string;
  /** Label read to screen readers — the dots themselves are decorative. */
  label?: string;
}

/**
 * Three-dot bounce, the app's canonical "something's in progress" affordance
 * — replaces the spinner wherever the old one showed up. Color follows
 * `currentColor` so it reads correctly inside any button variant. Static
 * (no bounce) under reduced motion via `motion-safe:`, same convention as
 * the rest of the codebase's spin animations.
 */
export function TypingIndicator({ className, label = 'Loading' }: TypingIndicatorProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center gap-1', className)}>
      {DELAYS.map((delay) => (
        <span
          key={delay}
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current opacity-40 motion-safe:animate-typing-bounce"
          style={{ animationDelay: delay }}
        />
      ))}
    </span>
  );
}
