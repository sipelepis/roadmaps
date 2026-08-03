import type { JSX, ReactNode } from 'react';

import { cn } from './utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
}: PageHeaderProps): JSX.Element {
  return (
    <div data-slot="page-header" className={cn('mb-8', className)}>
      {/* Actions live on the TITLE row, not beside the whole block. Centring
          them against title+description made their vertical position depend on
          how long the description happened to be — a two-line description on
          plugin-detail pushed them ~44px below the title they belong to. The
          description now flows underneath at full width, so the buttons land on
          the title line on every page regardless of copy length. */}
      <div className={cn(actions && 'flex items-center justify-between gap-4')}>
        {/* The page title is the identity carrier — set large + confident
            (see /DESIGN.md). Uses BUILT-IN Tailwind sizes, never a
            custom `text-h*` token: tokens referenced only in libs/ui can fail to
            generate in Vite dev if Tailwind v4's `@source` scan misses the path,
            collapsing the <h1> to inherited body size. Built-ins always emit. */}
        <h1
          className={cn(
            'font-heading text-4xl font-semibold tracking-tight text-balance text-foreground',
            titleClassName,
          )}
        >
          {title}
        </h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
