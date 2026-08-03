import { QueryClientProvider } from '@tanstack/react-query';
import { BookOpen, LayoutDashboard, MessageSquare, Moon, Sun } from 'lucide-react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router';

import { AppLayout, AppSidebar, Button, Toaster } from '@boost/ui';

import { queryClient } from './lib/query-client';
import { useTheme } from './lib/use-theme';
import { AskPage } from './pages/ask';
import { DashboardPage } from './pages/dashboard';
import { ArticlePage, LearnPage } from './pages/learn';

const NAV = [
  {
    label: 'Console',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/ask', label: 'Ask', icon: MessageSquare },
      { href: '/learn', label: 'Learn RAG', icon: BookOpen },
    ],
  },
];

function Header() {
  const { light, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-5">
      <span className="font-mono text-sm font-bold tracking-tight text-foreground">
        RAG<span className="text-primary-strong">/</span>CONSOLE
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
      >
        {light ? <Moon /> : <Sun />}
      </Button>
    </header>
  );
}

function Sidebar() {
  const { pathname } = useLocation();

  return (
    <AppSidebar
      groups={NAV}
      // /learn/:slug is still the Learn section; every other route matches exactly.
      isActive={(item) =>
        item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
      }
      linkComponent={Link}
    />
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout header={<Header />} sidebar={<Sidebar />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/learn/:slug" element={<ArticlePage />} />
          </Routes>
        </AppLayout>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
