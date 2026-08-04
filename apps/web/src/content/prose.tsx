import type { ReactNode } from 'react';

import { cn } from '@boost/ui';

/**
 * The four things written content is made of here. Shared by the Learn
 * articles and the per-step pages behind /flow — one set of typographic
 * decisions rather than two that drift.
 */

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-sm leading-relaxed text-muted-foreground', className)}>{children}</p>
  );
}

export function H({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 font-heading text-lg text-foreground">{children}</h2>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-elevation-2 p-3 text-xs leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

/** Points at the file in this repo that implements what the paragraph describes. */
export function Where({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-elevation-1 p-3">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary-strong">
        {path}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
