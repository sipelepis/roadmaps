import type { ComponentType, JSX, ReactNode } from 'react';

import { cn } from './utils';

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarLinkProps {
  to: string;
  className?: string;
  children?: ReactNode;
  title?: string;
}

interface AppSidebarProps {
  groups: NavGroup[];
  isActive: (item: NavItem) => boolean;
  linkComponent: ComponentType<SidebarLinkProps>;
  /** Collapsed state — when true, sidebar renders icon-only at narrow width.
   * Controlled by the app (typically via a toggle button in the header). */
  collapsed?: boolean;
  footer?: ReactNode;
}

export function AppSidebar({
  groups,
  isActive,
  linkComponent: Link,
  collapsed = false,
  footer,
}: AppSidebarProps): JSX.Element {
  return (
    <aside
      data-slot="app-sidebar"
      data-collapsed={collapsed || undefined}
      className={cn(
        'h-[calc(100vh-3.5rem)] shrink-0 border-r border-border bg-card transition-[width] duration-150 ease-out',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <nav
        className={cn(
          'flex h-full flex-col justify-between py-4',
          collapsed ? 'px-1' : 'px-3',
        )}
      >
        <div>
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.label}>
                  {!collapsed && (
                    <div className="mb-1 px-3 pt-5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {group.label}
                    </div>
                  )}
                  {/* In collapsed mode the empty `pt-5` block keeps vertical
                      rhythm between groups so icons stay aligned. */}
                  {collapsed && <div className="pt-5" />}
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            to={item.href}
                            title={collapsed ? item.label : undefined}
                            aria-label={collapsed ? item.label : undefined}
                            className={cn(
                              'group relative flex items-center rounded-md text-[13px] font-medium transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              collapsed
                                ? 'justify-center h-9 w-12 mx-auto'
                                : 'gap-3 px-3 py-2',
                              active
                                ? 'bg-brand-subtle text-primary-strong'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                active
                                  ? 'text-primary-strong'
                                  : 'text-muted-foreground group-hover:text-foreground',
                              )}
                            />
                            {!collapsed && item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
          )}
        </div>
        {footer && !collapsed && (
          <div className="border-t border-border pt-3">{footer}</div>
        )}
      </nav>
    </aside>
  );
}
