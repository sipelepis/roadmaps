import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils';

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full outline-none transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        // 44px meets the WCAG 2.5.8 minimum mobile tap target even though the
        // visible icon stays 16px — the hit area is bigger than the glyph.
        default: 'size-11',
        sm: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface IconButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof iconButtonVariants> {
  /** Required — icon-only controls must have an accessible name. */
  'aria-label': string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-slot="icon-button"
      className={cn(iconButtonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };
