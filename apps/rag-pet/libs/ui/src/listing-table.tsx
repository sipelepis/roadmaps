import type { JSX, ReactNode } from 'react';

import { Card, CardContent } from './card';
import { DataTable, type DataTableColumn, type SortState } from './data-table';
import { cn } from './utils';

interface ListingTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string | number;
  isLoading?: boolean;
  loadingRows?: number;
  error?: { message: string } | null;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Card wrapper className override. Defaults to the standard listing
   * convention (subtle frame). */
  cardClassName?: string;
  /** CardContent (the table's scroll parent) className. Set
   * `'max-h-… overflow-y-auto'` to make a scroll region with a sticky header. */
  contentClassName?: string;
  /** Inner `<Table>` className. Defaults inherited from DataTable
   * (`table-fixed`). Pass `'table-auto'` for natural column widths. */
  tableClassName?: string;
  /** Scroll-container div className. Pass `'overflow-x-auto'` for a wide table
   * that should scroll sideways at the table level (default `overflow-x-clip`). */
  containerClassName?: string;
}

/**
 * Listing-page convention used across both admin and mercury: a `bg-subtle`
 * Card frame wrapping a `DataTable` with a tinted header row and white data
 * rows that "punch through" the frame, plus a `bg-subtle` hover state with a
 * primary left-accent border.
 *
 * Bundles `<Card>` + `<DataTable>` + the three overrides
 * (`headerRowClassName`, `rowClassName`, and the Card class string) into one
 * call site. Use this for any standard listing page. Reach for `<DataTable>`
 * directly only when the page needs a non-standard frame.
 */
export function ListingTable<T>({
  cardClassName,
  contentClassName,
  tableClassName,
  ...dataTableProps
}: ListingTableProps<T>): JSX.Element {
  return (
    <Card
      className={cn(
        // overflow-clip (not -hidden) keeps the rounded-corner clip without
        // trapping the table's sticky header in a scroll container.
        'overflow-clip rounded-lg border border-border gap-0 bg-subtle px-0 py-1 shadow-xs',
        cardClassName,
      )}
    >
      {/* Scroll the CONTENT (not the Card) so a sticky header inside sticks to
          it — the Card keeps overflow-hidden for its rounded corners. Pass
          contentClassName="max-h-… overflow-y-auto" to make a scroll region. */}
      <CardContent className={cn('p-0', contentClassName)}>
        <DataTable
          {...dataTableProps}
          tableClassName={tableClassName}
          headerRowClassName="border-l-0 bg-subtle hover:bg-subtle"
          // Explicitly include the full hover shape (transparent 2px left
          // border that turns primary blue on hover + subtle row tint) so
          // ListingTable doesn't depend on libs/ui Table TableRow defaults
          // reaching the row through twMerge.
          rowClassName="bg-background transition-colors duration-150 ease-out hover:bg-subtle"
        />
      </CardContent>
    </Card>
  );
}
