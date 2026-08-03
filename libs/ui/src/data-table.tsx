import type { JSX, ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

import { Skeleton } from './skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { cn } from './utils';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  accessor: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  key: string;
  direction: SortDirection;
}

interface DataTableProps<T> {
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
  /** Override the inner `<Table>` className (e.g. `'table-auto'` to opt out
   * of the default `table-fixed` layout when natural column widths are
   * needed). */
  tableClassName?: string;
  /** Class for the table's scroll-container div. Pass `'overflow-x-auto'` to
   * make a genuinely-wide table scroll sideways at the table level (default is
   * `overflow-x-clip`). */
  containerClassName?: string;
  /** Override the header `<TableRow>` className — e.g. to add `bg-subtle`
   * tinting across the whole row, or remove the default left accent border. */
  headerRowClassName?: string;
  /** Class applied to each data `<TableRow>`. String form applies to all rows;
   * function form is evaluated per row (e.g. status-based row styling). Use
   * `'bg-background'` when the surrounding Card has its own tint and you want
   * the rows to "punch through" with the page background. */
  rowClassName?: string | ((row: T, index: number) => string | undefined);
}

function nextSort(current: SortState | null | undefined, key: string): SortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  loadingRows = 5,
  error,
  emptyState,
  onRowClick,
  sort,
  onSortChange,
  tableClassName,
  containerClassName,
  headerRowClassName,
  rowClassName,
}: DataTableProps<T>): JSX.Element {
  const showLoading = isLoading;
  const showError = !isLoading && error;
  const showEmpty = !isLoading && !error && data.length === 0;

  return (
    <Table className={tableClassName} containerClassName={containerClassName}>
      <TableHeader>
        <TableRow className={headerRowClassName}>
          {columns.map((col) => {
            const isSorted = sort?.key === col.key;
            const direction = isSorted ? sort?.direction : undefined;
            const sortable = col.sortable && onSortChange;
            return (
              <TableHead
                key={col.key}
                // Sticky on the CELLS (not <thead>) so it survives
                // border-collapse; bg-inherit picks up the header row's fill so
                // rows don't bleed under it. Only bites inside a scroll box.
                className={cn('bg-inherit sticky top-0 z-10', col.headerClassName, sortable && 'cursor-pointer select-none')}
                aria-sort={
                  isSorted
                    ? direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : sortable
                      ? 'none'
                      : undefined
                }
                onClick={sortable ? () => onSortChange(nextSort(sort, col.key)) : undefined}
                onKeyDown={
                  sortable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSortChange(nextSort(sort, col.key));
                        }
                      }
                    : undefined
                }
                // Keep the native `columnheader` role so screen readers still
                // expose `aria-sort`; just expose keyboard focus + activation.
                tabIndex={sortable ? 0 : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {sortable && (
                    <span className="text-muted-foreground/60 [&_svg]:size-3">
                      {direction === 'asc' ? (
                        <ChevronUp />
                      ) : direction === 'desc' ? (
                        <ChevronDown />
                      ) : (
                        <ChevronsUpDown />
                      )}
                    </span>
                  )}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {showLoading &&
          Array.from({ length: loadingRows }).map((_, i) => (
            <TableRow key={`loading-${i}`}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  <Skeleton className="h-4 w-full max-w-[180px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}

        {showError && (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-8 text-center text-destructive">
              {error.message}
            </TableCell>
          </TableRow>
        )}

        {showEmpty && (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-8">
              {emptyState ?? (
                <div className="text-center text-sm text-muted-foreground">No results.</div>
              )}
            </TableCell>
          </TableRow>
        )}

        {!isLoading &&
          !error &&
          data.map((row, i) => {
            const resolvedRowClassName =
              typeof rowClassName === 'function' ? rowClassName(row, i) : rowClassName;
            return (
              <TableRow
                key={getRowKey(row, i)}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={
                  onRowClick
                    ? (e) => {
                        // Don't fire row click when the user clicks an
                        // interactive descendant (button, link, input, etc.) —
                        // they have their own handlers and shouldn't double-fire.
                        // The row itself carries role="button", so exclude
                        // currentTarget from the match — otherwise closest()
                        // matches the row and suppresses every navigation.
                        const hit = (e.target as HTMLElement).closest(
                          'a, button, input, select, textarea, [role="button"], [role="checkbox"], [role="menuitem"]',
                        );
                        if (hit && hit !== e.currentTarget) return;
                        onRowClick(row);
                      }
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        const hit = (e.target as HTMLElement).closest(
                          'a, button, input, select, textarea, [role="button"], [role="checkbox"], [role="menuitem"]',
                        );
                        if (hit && hit !== e.currentTarget) return;
                        e.preventDefault();
                        onRowClick(row);
                      }
                    : undefined
                }
                className={cn(
                  onRowClick &&
                    'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  resolvedRowClassName,
                )}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.accessor(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
