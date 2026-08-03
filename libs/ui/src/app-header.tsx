import type { JSX, ReactNode } from 'react';
import { LogOut } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface AppHeaderUser {
  initials: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface AppHeaderProps {
  title: ReactNode;
  /** Optional breadcrumb slot rendered to the right of the title. Compose
   * with `<Breadcrumb>...</Breadcrumb>` from libs/ui. */
  breadcrumb?: ReactNode;
  /** Optional right-side action slot, rendered before the user menu. */
  actions?: ReactNode;
  user: AppHeaderUser;
  onLogout: () => void;
}

export function AppHeader({
  title,
  breadcrumb,
  actions,
  user,
  onLogout,
}: AppHeaderProps): JSX.Element {
  const { initials, firstName, lastName, email } = user;
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-5">
      <div className="flex min-w-0 items-center gap-4">
        {title}
        {breadcrumb}
      </div>

      <div className="flex items-center gap-2">
        {actions}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-muted"
            >
              <div className="text-right">
                {firstName && lastName ? (
                  <>
                    <div className="text-xs font-medium text-foreground">
                      {firstName} {lastName}
                    </div>
                    {email && <div className="text-[11px] text-muted-foreground">{email}</div>}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">{email ?? '...'}</span>
                )}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-strong">
                {initials}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={onLogout}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
