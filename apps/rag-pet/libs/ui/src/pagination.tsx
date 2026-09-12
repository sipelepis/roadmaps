import type { JSX } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  totalPages?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalItems,
  totalPages: totalPagesProp,
  pageSize = 10,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps): JSX.Element | null {
  const totalPages = totalPagesProp ?? Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  function getPageNumbers(): (number | 'ellipsis')[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1);

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);

    return pages;
  }

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <div className="flex items-center gap-3">
        {pageSizeOptions && onPageSizeChange && (
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              onPageSizeChange(parseInt(v, 10));
            }}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground">
          Showing {start}–{end} of {totalItems}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {getPageNumbers().map((page, i) =>
          page === 'ellipsis' ? (
            <span
              key={`ellipsis-${i}`}
              className="flex h-6 w-6 items-center justify-center text-xs text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="icon-xs"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon-xs"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
