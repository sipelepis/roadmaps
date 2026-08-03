import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils';

const chipVariants = cva(
  'inline-flex items-center rounded-full whitespace-nowrap font-medium',
  {
    variants: {
      variant: {
        // Status chips — soft tinted, used for statuses and tags
        success:
          'border bg-status-success-bg text-status-success border-status-success-border px-2 py-0.5 text-[11px]',
        warning:
          'border bg-status-warning-bg text-status-warning border-status-warning-border px-2 py-0.5 text-[11px]',
        info: 'border bg-status-info-bg text-status-info border-status-info-border px-2 py-0.5 text-[11px]',
        destructive:
          'border bg-destructive-bg text-destructive border-destructive-border px-2 py-0.5 text-[11px]',
        primary: 'border bg-primary/10 text-primary-strong border-primary/20 px-2 py-0.5 text-[11px]',
        muted: 'border bg-muted text-muted-foreground border-border px-2 py-0.5 text-[11px]',
        // Count chip — filled primary pill optimized for small numeric labels.
        // Tighter padding, no border, minimum-width so single-digit counts stay
        // pill-shaped.
        count:
          'bg-primary text-primary-foreground px-1.5 text-[10px] leading-4 min-w-[1.25rem] justify-center',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  },
);

function Chip({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof chipVariants>) {
  return (
    <span data-slot="chip" className={cn(chipVariants({ variant, className }))} {...props} />
  );
}

export { Chip, chipVariants };
