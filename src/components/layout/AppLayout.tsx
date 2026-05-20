'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  AlertTriangle,
  Users,
  Factory,
  Plus,
  MessageCircle,
  Menu,
  Building2,
} from 'lucide-react';
import { cn, getDepartmentLabel } from '@/lib/utils';
import { AlertStatus, UserRole } from '@/types';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IAlert } from '@/types';
import { useDepartments } from '@/hooks/useDepartments';

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
  { href: '/internal-tasks', label: 'Internal Tasks', icon: ClipboardList },
  { href: '/template-groups', label: 'Template Groups', icon: ClipboardList },
  { href: '/discussions', label: 'Discussions', icon: MessageCircle },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
];

const DEPT_USER_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/internal-tasks', label: 'Internal Tasks', icon: ClipboardList },
  { href: '/discussions', label: 'Discussions', icon: MessageCircle },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
];

interface AppLayoutProps {
  children: React.ReactNode;
  activeAlertCount?: number;
}

// ── Sidebar (uses Clerk, isolated from main content) ─────────────────────

const Sidebar = memo(function Sidebar({ activeAlertCount = 0 }: { activeAlertCount?: number }) {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [dbDepartment, setDbDepartment] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const departments = useDepartments();

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

  const effectiveRole = dbRole || user?.publicMetadata?.role as string | undefined;
  const effectiveDepartment = dbDepartment || user?.publicMetadata?.department as string | undefined;

  const isAdmin = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.SUPER_ADMIN;
  const userDepartment = effectiveDepartment;

  const NAV_ITEMS = isAdmin ? ADMIN_NAV_ITEMS : DEPT_USER_NAV_ITEMS;

  const isNavActive = (href: string) =>
    href === '/tasks' ? pathname === '/tasks'
    : href === '/template-groups' ? pathname.startsWith('/template-groups')
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
      <div className="h-14 lg:h-16 px-4 lg:px-5 flex items-center gap-3 border-b border-gray-200">
        <div className="w-7 h-7 bg-black flex items-center justify-center flex-shrink-0">
          <Factory className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-black text-gray-900 tracking-tight leading-none">WINDOW</p>
          <p className="text-[9px] font-mono text-gray-500 tracking-widest uppercase leading-none mt-0.5">ERP System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 lg:p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavActive(item.href);
          const Icon = item.icon;
          const isAlert = item.href === '/alerts';

          if (item.prominent) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-bold bg-black text-white hover:bg-gray-900 transition-colors uppercase tracking-wide rounded-sm"
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
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isAlert && activeAlertCount > 0 && !isActive && 'text-red-500')} />
              <span>{item.label}</span>
              {isAlert && activeAlertCount > 0 && (
                <span className={cn(
                  'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                )}>
                  {activeAlertCount}
                </span>
              )}
            </Link>
          );
        })}

        {visibleDepartments.length > 0 && (
          <div className="pt-3 mt-3 border-t border-gray-100">
            <p className="px-3 pb-2 text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400">
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
                        ? 'bg-black text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
        <div className="px-3 lg:px-4 py-3 border-t border-gray-200 space-y-0.5">
          <Link
            href="/users"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
              pathname === '/users'
                ? 'bg-black text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>Users</span>
          </Link>
          <Link
            href="/access"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
              pathname === '/access'
                ? 'bg-black text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>Access Summary</span>
          </Link>
          <Link
            href="/departments"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors rounded-sm',
              pathname === '/departments'
                ? 'bg-black text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span>Departments</span>
          </Link>
        </div>
      )}

      {/* User */}
      <div className="p-3 lg:p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <UserButton />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">Account</p>
            <p className="text-[10px] text-gray-500 font-mono truncate">Settings</p>
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

function AppLayoutInner({ children, activeAlertCount = 0 }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveActiveAlertCount, setLiveActiveAlertCount] = useState(activeAlertCount);
  const pathname = usePathname();

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
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — memo'ed and self-contained with Clerk hooks */}
      <aside className={cn(
        'w-56 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white z-40 transition-transform duration-200',
        'fixed lg:static inset-y-0 left-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <Sidebar activeAlertCount={liveActiveAlertCount} />
      </aside>

      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-20 flex items-center px-4 gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-black"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black flex items-center justify-center">
            <Factory className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-xs font-black text-gray-900">WINDOW</p>
        </div>
      </div>

      {/* Main content — isolated from Sidebar Clerk re-renders */}
      <main className="min-w-0 flex-1 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────

export function AppLayout({ children, activeAlertCount }: AppLayoutProps) {
  return <AppLayoutInner activeAlertCount={activeAlertCount}>{children}</AppLayoutInner>;
}
