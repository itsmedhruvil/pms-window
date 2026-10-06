'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import {
  LayoutDashboard,
  FolderKanban,
  Image as ImageIcon,
  ClipboardList,
  AlertTriangle,
  Users,
  Factory,
  Plus,
  MessageCircle,
  Menu,
  Settings,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from 'lucide-react';
import { cn, getDepartmentLabel, apiFetch } from '@/lib/utils';
import { AlertStatus, UserRole } from '@/types';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IAlert } from '@/types';
import { useDepartments } from '@/hooks/useDepartments';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  prominent?: boolean;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/projects/new', label: 'Create Project', icon: Plus, prominent: true },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/media', label: 'Media', icon: ImageIcon },
  { href: '/discussions', label: 'Discussions', icon: MessageCircle },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
];

const DEPT_USER_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/media', label: 'Media', icon: ImageIcon },
  { href: '/discussions', label: 'Discussions', icon: MessageCircle },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
];

const TOP_BAR_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/media', label: 'Media' },
  { href: '/discussions', label: 'Discussions' },
  { href: '/alerts', label: 'Alerts' },
];

interface AppLayoutProps {
  children: React.ReactNode;
  activeAlertCount?: number;
}

/** Map of nav item labels to the sidebar-counts key for badge display */
const COUNT_KEY_MAP: Record<string, string> = {
  'Alerts': 'activeAlerts',
  'Discussions': 'unreadDiscussions',
  'Projects': 'activeProjects',
};

// ── Sidebar (uses Clerk, isolated from main content) ─────────────────────

const Sidebar = memo(function Sidebar({ activeAlertCount = 0 }: { activeAlertCount?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isSignedIn } = useUser();
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [dbDepartment, setDbDepartment] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const departments = useDepartments(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Fetch sidebar counts (discussions, pending tasks, alerts, etc.)
  useEffect(() => {
    if (!isSignedIn) return;
    const fetchCounts = () => {
      apiFetch<Record<string, number>>('/api/sidebar-counts')
        .then((res) => {
          if (res.success && res.data) setCounts(res.data as Record<string, number>);
        })
        .catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  // Re-fetch counts on alert events
  useEffect(() => {
    const handleEvent = () => {
      apiFetch<Record<string, number>>('/api/sidebar-counts')
        .then((res) => {
          if (res.success && res.data) setCounts(res.data as Record<string, number>);
        })
        .catch(() => {});
    };
    window.addEventListener('erp-alert-created', handleEvent);
    window.addEventListener('erp-alert-resolved', handleEvent);
    window.addEventListener('erp-alert-deleted', handleEvent);
    return () => {
      window.removeEventListener('erp-alert-created', handleEvent);
      window.removeEventListener('erp-alert-resolved', handleEvent);
      window.removeEventListener('erp-alert-deleted', handleEvent);
    };
  }, []);

  /** Get the badge count for a nav item, or null if 0 */
  const getBadgeCount = (label: string): number | null => {
    const key = COUNT_KEY_MAP[label];
    if (!key) return null;
    const count = counts[key] ?? 0;
    return count > 0 ? count : null;
  };

  // Fetch role directly from DB to override potentially stale Clerk metadata
  useEffect(() => {
    if (!isSignedIn || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch('/api/users/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setDbRole(data.data.role);
          setDbDepartment(data.data.department);
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  // DB is the source of truth — normalize so legacy/casing variants
  // (e.g. "ADMIN" vs "admin", "super_admin" vs "admin") never flip the
  // sidebar between admin/dept layouts after a login or metadata edit.
  const normalizeClientRole = (role: unknown): string | undefined => {
    if (typeof role !== 'string') return undefined;
    const normalized = role.trim().toLowerCase();
    if (normalized === 'super_admin' || normalized === 'superadmin' || normalized === 'super-admin') {
      return UserRole.SUPER_ADMIN;
    }
    if (normalized === 'admin' || normalized === 'administrator') return UserRole.ADMIN;
    if (normalized === 'department_user' || normalized === 'department-user' || normalized === 'dept_user' || normalized === 'user') {
      return UserRole.DEPARTMENT_USER;
    }
    return normalized;
  };

  const rawRole = dbRole || user?.publicMetadata?.role as string | undefined;
  const effectiveRole = normalizeClientRole(rawRole);
  const effectiveDepartment = dbDepartment || user?.publicMetadata?.department as string | undefined;

  const isAdmin = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.SUPER_ADMIN;
  const userDepartment = effectiveDepartment;

  const NAV_ITEMS = isAdmin ? ADMIN_NAV_ITEMS : DEPT_USER_NAV_ITEMS;

  const isNavActive = (href: string) =>
    href === '/tasks' ? pathname === '/tasks'
    : href === '/template-groups' ? pathname.startsWith('/template-groups')
    : href === '/media' ? pathname.startsWith('/media')
    : href === '/discussions' ? pathname.startsWith('/discussions')
    : pathname.startsWith(href);

  const visibleDepartments = useMemo(() => {
    if (isAdmin) return departments.map((department) => department.name);
    if (userDepartment) return [userDepartment];
    return [];
  }, [departments, isAdmin, userDepartment]);

  return (
    <>
      {/* Logo */}
      <div className="h-14 lg:h-16 px-4 lg:px-5 flex items-center gap-3 border-b border-primary-200">
        <div className="w-7 h-7 bg-dark-500 flex items-center justify-center flex-shrink-0">
          <Factory className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-black text-dark-500 tracking-tight leading-none">UNIQUE ARTS</p>
          <p className="text-[9px] font-mono text-primary-500 tracking-widest uppercase leading-none mt-0.5">PMS System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 lg:p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavActive(item.href);
          const Icon = item.icon;
          const isAlert = item.href === '/alerts';
          const badge = isAlert ? (activeAlertCount > 0 ? activeAlertCount : null) : getBadgeCount(item.label);

          if (item.prominent) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-bold bg-dark-500 text-white hover:bg-dark-500 transition-colors uppercase tracking-wide rounded-sm"
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
                isActive
                  ? 'bg-dark-500 text-white'
                  : 'text-dark-400 hover:text-dark-500 hover:bg-primary-50'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isAlert && activeAlertCount > 0 && !isActive && 'text-red-500')} />
              <span>{item.label}</span>
              {badge !== null && (
                <span className={cn(
                  'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
                  isActive ? 'bg-white/20 text-white' : 
                  isAlert ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          );
        })}

        {visibleDepartments.length > 0 && (
          <div className="pt-3 mt-3 border-t border-primary-100">
            <p className="px-3 pb-2 text-[9px] font-mono font-bold uppercase tracking-widest text-primary-400">
              {isAdmin ? 'Department Tasks' : 'My Tasks'}
            </p>
            <div className="space-y-0.5">
              {visibleDepartments.map((department) => {
                const href = `/tasks/departments/${department}`;
                const isActive = pathname === href;

                return (
                  <Link
                    key={department}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-xs font-mono font-medium transition-colors rounded-sm',
                      isActive
                        ? 'bg-dark-500 text-white'
                        : 'text-dark-400 hover:text-dark-500 hover:bg-primary-50'
                    )}
                  >
                    <ClipboardList className="w-4 h-4 flex-shrink-0" />
                    <span>{departments.find((item) => item.name === department)?.label || getDepartmentLabel(department)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {isAdmin && (
        <div className="px-3 lg:px-4 py-3 border-t border-primary-200 space-y-0.5">
          <Link
            href="/projects?tab=previous"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
              pathname === '/projects' && searchParams.get('tab') === 'previous'
                ? 'bg-dark-500 text-white'
                : 'text-dark-400 hover:text-dark-500 hover:bg-primary-50'
            )}
          >
            <FolderKanban className="w-4 h-4 flex-shrink-0" />
            <span>Previous Work</span>
          </Link>
          <Link
            href="/template-groups"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
              pathname.startsWith('/template-groups')
                ? 'bg-dark-500 text-white'
                : 'text-dark-400 hover:text-dark-500 hover:bg-primary-50'
            )}
          >
            <ClipboardList className="w-4 h-4 flex-shrink-0" />
            <span>Template Groups</span>
          </Link>
          <Link
            href="/users"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
              pathname === '/users'
                ? 'bg-dark-500 text-white'
                : 'text-dark-400 hover:text-dark-500 hover:bg-primary-50'
            )}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>Users</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
              pathname === '/settings'
                ? 'bg-dark-500 text-white'
                : 'text-dark-400 hover:text-dark-500 hover:bg-primary-50'
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span>Settings</span>
          </Link>
        </div>
      )}

      {/* User */}
      <div className="p-3 lg:p-4 border-t border-primary-200" suppressHydrationWarning>
        <div className="flex items-center gap-3">
          <UserButton />
          <div className="min-w-0">
            <p className="text-xs font-medium text-dark-500 truncate">Account</p>
            <p className="text-[10px] text-primary-500 font-mono truncate">Settings</p>
          </div>
        </div>
      </div>
    </>
  );
});

// ── Main layout ──────────────────────────────────────────────────────────
// AppLayoutInner uses usePathname() for sidebar logic but NOT useUser().
// Sidebar is a separate component that encapsulates Clerk hooks.
// Because Clerk state changes only re-render <Sidebar>, they don't cascade
// into <main> where text inputs live, preserving focus during typing.

/**
 * Minimal shape of the browser Navigation API (Chromium). TypeScript's DOM lib
 * does not ship these types yet, so only the members we use are declared.
 */
type NavigationLike = {
  currentEntry: unknown;
  entries(): unknown[];
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

function AppLayoutInner({ children, activeAlertCount = 0 }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveActiveAlertCount, setLiveActiveAlertCount] = useState(activeAlertCount);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  /** Mirrors the router's history stack in browsers without the Navigation API. */
  const navStackRef = useRef<{ urls: string[]; pos: number }>({ urls: [], pos: -1 });
  const poppedRef = useRef(false);

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  const handleForward = () => {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  };

  /**
   * Re-fetch every server component on the current route without a full page
   * reload, so open tabs, filters and scroll position are all preserved.
   */
  const handleReload = () => {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  };

  // ── Back / forward availability ────────────────────────────────────────────
  // Next.js 16's App Router no longer writes an `idx` into window.history.state
  // (it only writes `__NA` and `__PRIVATE_NEXTJS_INTERNALS_TREE`), so the old
  // `state.idx < history.length - 1` test could never pass and the forward
  // button stayed permanently disabled.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;

    // Preferred: the Navigation API reports our exact position in the session
    // history, so both buttons are always accurate.
    if (nav && typeof nav.entries === 'function') {
      const syncFromNavigation = () => {
        const entries = nav.entries();
        const index = nav.currentEntry
          ? entries.findIndex((entry) => entry === nav.currentEntry)
          : -1;
        setCanGoBack(index > 0);
        setCanGoForward(index >= 0 && index < entries.length - 1);
      };

      syncFromNavigation();
      nav.addEventListener('currententrychange', syncFromNavigation);
      window.addEventListener('popstate', syncFromNavigation);

      return () => {
        nav.removeEventListener('currententrychange', syncFromNavigation);
        window.removeEventListener('popstate', syncFromNavigation);
      };
    }

    // Fallback (Firefox / Safari): mirror the stack ourselves. `popstate` tells
    // browser traversal apart from programmatic navigation, and any programmatic
    // navigation wipes the forward entries.
    const stack = navStackRef.current;
    const url = window.location.pathname + window.location.search;

    if (stack.pos < 0) {
      stack.urls = [url];
      stack.pos = 0;
    } else if (poppedRef.current) {
      poppedRef.current = false;
      const landedAt = stack.urls.indexOf(url);
      if (landedAt >= 0) {
        stack.pos = landedAt;
      } else {
        stack.urls = [...stack.urls.slice(0, stack.pos + 1), url];
        stack.pos = stack.urls.length - 1;
      }
    } else if (stack.urls[stack.pos] !== url) {
      stack.urls = [...stack.urls.slice(0, stack.pos + 1), url];
      stack.pos = stack.urls.length - 1;
    }

    const syncFromStack = () => {
      setCanGoBack(stack.pos > 0);
      setCanGoForward(stack.pos < stack.urls.length - 1);
    };

    const handlePopState = () => {
      poppedRef.current = true;
      syncFromStack();
    };

    syncFromStack();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname]);

  useEffect(() => {
    setLiveActiveAlertCount(activeAlertCount);
  }, [activeAlertCount]);

  useEffect(() => {
    const handleAlertCreated = (event: Event) => {
      const alert = (event as CustomEvent<IAlert>).detail;
      if (alert?.status !== AlertStatus.RESOLVED) {
        setLiveActiveAlertCount((count) => count + 1);
      }
    };

    const handleAlertRemoved = () => {
      setLiveActiveAlertCount((count) => Math.max(0, count - 1));
    };

    window.addEventListener('erp-alert-created', handleAlertCreated);
    window.addEventListener('erp-alert-resolved', handleAlertRemoved);
    window.addEventListener('erp-alert-deleted', handleAlertRemoved);

    return () => {
      window.removeEventListener('erp-alert-created', handleAlertCreated);
      window.removeEventListener('erp-alert-resolved', handleAlertRemoved);
      window.removeEventListener('erp-alert-deleted', handleAlertRemoved);
    };
  }, []);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-dark-500/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — memo'ed and self-contained with Clerk hooks */}
      <aside className={cn(
        'w-56 flex-shrink-0 border-r border-primary-200 flex flex-col bg-white z-40 transition-transform duration-200',
        'fixed lg:static inset-y-0 left-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <Suspense fallback={<div className="flex-1" />}>
          <Sidebar activeAlertCount={liveActiveAlertCount} />
        </Suspense>
      </aside>

      {/* Mobile header bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-[calc(3.5rem+env(safe-area-inset-top))] bg-white/95 backdrop-blur-sm border-b border-primary-200 z-20 flex items-center justify-between px-3 safe-area-top">
        <div className="flex items-center gap-1 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-dark-400 hover:text-dark-500 active:bg-primary-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 ml-1">
            <div className="w-7 h-7 bg-dark-500 flex items-center justify-center rounded-sm">
              <Factory className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <p className="text-[11px] font-black text-dark-500 tracking-tight">UNIQUE ARTS</p>
              <p className="text-[8px] font-mono text-primary-400 tracking-widest uppercase">PMS</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-0.5 pt-[env(safe-area-inset-top)]">
          <NotificationBell serverActiveAlertCount={liveActiveAlertCount} />
          <UserButton />
        </div>
      </header>

      {/* Main content — isolated from Sidebar Clerk re-renders */}
      <main className="min-w-0 flex-1 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0">
        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-between px-6 h-12 border-b border-primary-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 p-1">
              <button
                type="button"
                onClick={handleBack}
                disabled={!canGoBack}
                className="p-1.5 text-primary-500 hover:text-dark-500 disabled:text-primary-300 disabled:cursor-not-allowed transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleForward}
                disabled={!canGoForward}
                className="p-1.5 text-primary-500 hover:text-dark-500 disabled:text-primary-300 disabled:cursor-not-allowed transition-colors"
                aria-label="Go forward"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="w-px h-4 bg-primary-200" aria-hidden="true" />
              <button
                type="button"
                onClick={handleReload}
                disabled={refreshing}
                className="p-1.5 text-primary-500 hover:text-dark-500 disabled:text-primary-300 disabled:cursor-not-allowed transition-colors"
                aria-label="Reload current page"
                title="Reload current page"
              >
                <RotateCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-dark-500 flex items-center justify-center rounded-sm">
                <Factory className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-[11px] font-black text-dark-500 tracking-tight">UNIQUE ARTS</p>
              <p className="text-[8px] font-mono text-primary-400 tracking-widest uppercase ml-1">PMS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell serverActiveAlertCount={liveActiveAlertCount} />
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-2 border-b border-primary-200 bg-primary-50 px-6 py-2.5 overflow-x-auto">
          {TOP_BAR_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-dark-500 text-white'
                    : 'bg-white text-primary-500 border border-primary-200 hover:border-primary-400 hover:text-dark-500'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </main>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────

export function AppLayout({ children, activeAlertCount }: AppLayoutProps) {
  return <AppLayoutInner activeAlertCount={activeAlertCount}>{children}</AppLayoutInner>;
}