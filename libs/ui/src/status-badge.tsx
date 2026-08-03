import type * as React from 'react';

import { cn } from './utils';

export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const TONE: Record<StatusTone, { pill: string; dot: string }> = {
  success: {
    pill: 'bg-status-success-bg text-status-success border-status-success-border',
    dot: 'bg-status-success',
  },
  warning: {
    pill: 'bg-status-warning-bg text-status-warning border-status-warning-border',
    dot: 'bg-status-warning',
  },
  info: { pill: 'bg-status-info-bg text-status-info border-status-info-border', dot: 'bg-status-info' },
  danger: {
    pill: 'bg-destructive-bg text-destructive border-destructive-border',
    dot: 'bg-destructive',
  },
  neutral: { pill: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground/50' },
};

// Keyword → tone. Order matters (first match wins).
const RULES: [StatusTone, RegExp][] = [
  ['success', /^(connected|online|active|success(ful)?|succeeded|healthy|ok|ready|passing|passed|live|enabled|up|completed|done)$/],
  ['danger', /^(disconnected|offline|failed|fail|error(ed)?|revoked|blocked|cancell?ed|down|expired|denied|inactive|unhealthy)$/],
  ['warning', /^(invited|pending|paused|degraded|warning|warn|queued|stale|idle|draft|deprecated)$/],
  ['info', /^(running|in[_ -]?progress|scheduled|syncing|building|processing|new|info)$/],
];

/** Map a status string to a semantic tone. Unknown → neutral. */
export function statusTone(status: string): StatusTone {
  const s = status.trim().toLowerCase();
  for (const [tone, re] of RULES) if (re.test(s)) return tone;
  return 'neutral';
}

/**
 * Status pill with a colored dot — consistent status colors across the app.
 * Pass a `status` string (auto-mapped to a tone) or override with `tone`.
 */
export function StatusBadge({
  status,
  tone,
  label,
  dot = true,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  status: string;
  tone?: StatusTone;
  label?: React.ReactNode;
  dot?: boolean;
}) {
  const resolved = tone ?? statusTone(status);
  const t = TONE[resolved];
  return (
    <span
      data-slot="status-badge"
      data-tone={resolved}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap capitalize',
        t.pill,
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('size-1.5 shrink-0 rounded-full', t.dot, resolved === 'info' && 'motion-safe:animate-pulse')}
          aria-hidden
        />
      )}
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
