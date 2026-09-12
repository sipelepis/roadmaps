import type { ReactNode } from 'react';

import { cn } from '@boost/ui';

/**
 * A single number that answers a question on its own — no plot, so no tooltip.
 * `tone` is reserved for state (over target, protein short), never decoration.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 font-heading text-2xl font-semibold tabular-nums',
          tone === 'warning' && 'text-status-warning',
          tone === 'success' && 'text-status-success',
          tone === 'neutral' && 'text-foreground',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
