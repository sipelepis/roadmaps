import type { ComponentType, JSX, ReactNode } from 'react';
import { useRef } from 'react';

import { cn } from './utils';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Optional trailing count badge. */
  count?: number;
  /** Custom trailing content (e.g. an "Unsaved" chip) — takes precedence over `count`. */
  badge?: ReactNode;
  disabled?: boolean;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Base id for tab/panel wiring — panels should use id={`${idBase}-panel-${tabId}`}. */
  idBase?: string;
  /** Accessible name for the tablist (WAI-ARIA: a tablist should be labelled). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Accessible tab strip (WAI-ARIA tabs): `role="tablist"` + `role="tab"`,
 * `aria-selected`, roving tabindex with Left/Right/Home/End, and a visible
 * focus ring. Replaces the app's hand-rolled `<button> border-b-2` strips.
 * Content panels stay where the page renders them — give each the matching
 * `role="tabpanel"` + `id`/`aria-labelledby` from `idBase`.
 */
export function TabBar<T extends string>({ tabs, value, onChange, idBase = 'tabs', ariaLabel, className }: TabBarProps<T>): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  const move = (dir: 1 | -1 | 'home' | 'end') => {
    const enabled = tabs.filter((t) => !t.disabled);
    const cur = enabled.findIndex((t) => t.id === value);
    let next: number;
    if (dir === 'home') next = 0;
    else if (dir === 'end') next = enabled.length - 1;
    else next = (cur + dir + enabled.length) % enabled.length;
    const target = enabled[next];
    if (!target) return;
    onChange(target.id);
    // Move focus to the newly-selected tab (roving tabindex).
    ref.current?.querySelector<HTMLButtonElement>(`#${idBase}-tab-${target.id}`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'Home') move('home');
    else if (e.key === 'End') move('end');
    else return;
    e.preventDefault();
  };

  // Null when `value` names a real tab (the normal case) — only computed as a
  // fallback so the roving tabindex below always has exactly one 0.
  const focusableId = tabs.some((t) => t.id === value) ? null : tabs.find((t) => !t.disabled)?.id;

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      // overflow-x-clip (not -auto): contains many-tab horizontal overflow
      // without becoming a scroll container — -auto forced overflow-y to auto
      // too, and the tabs' 1px -mb-px underline overhang tripped a spurious
      // vertical scrollbar on the strip.
      className={cn('flex gap-1 overflow-x-clip border-b border-border', className)}
    >
      {tabs.map((t) => {
        const on = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            id={`${idBase}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idBase}-panel-${t.id}`}
            // Roving tabindex needs exactly one 0. When `value` matches no tab
            // — a caller conditionally dropped the active one — every tab would
            // score -1 and the whole tablist would leave the keyboard order.
            // Fall back to the first enabled tab so the strip stays reachable.
            tabIndex={(focusableId ? t.id === focusableId : on) ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50',
              on
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {t.label}
            {t.badge ??
              (t.count != null && (
                <span className="bg-muted text-muted-foreground ml-0.5 rounded-full px-1.5 text-xs tabular-nums">
                  {t.count}
                </span>
              ))}
          </button>
        );
      })}
    </div>
  );
}
