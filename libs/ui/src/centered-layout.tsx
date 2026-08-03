import type { JSX, ReactNode } from 'react';

import { cn } from './utils';

interface CenteredLayoutProps {
  children: ReactNode;
  /** Max width of the centered column. Defaults to `sm` (24rem). */
  maxWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}

const widthClasses: Record<NonNullable<CenteredLayoutProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/**
 * Full-viewport centered column layout for auth/login pages and other
 * standalone screens that sit outside the app shell. Pairs with `<Card>` for
 * the inner panel.
 *
 * Renders a `<main>`: these screens stand alone (no app shell around them), so
 * this is the page's main landmark for assistive tech.
 */
export function CenteredLayout({
  children,
  maxWidth = 'sm',
  className,
}: CenteredLayoutProps): JSX.Element {
  return (
    <main
      data-slot="centered-layout"
      className={cn(
        'flex min-h-screen flex-col items-center justify-center bg-background px-4',
        className,
      )}
    >
      <div className={cn('w-full', widthClasses[maxWidth])}>{children}</div>
    </main>
  );
}
