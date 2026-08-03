import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { EmptyState, Skeleton } from '@boost/ui';

/** The three states every page shares, so no page hand-rolls them. */
export function QueryState({
  isPending,
  error,
  children,
  rows = 3,
}: {
  isPending: boolean;
  error: unknown;
  children: ReactNode;
  rows?: number;
}) {
  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="Could not load that"
        description={error instanceof Error ? error.message : 'The API did not answer.'}
      />
    );
  }
  return <>{children}</>;
}
