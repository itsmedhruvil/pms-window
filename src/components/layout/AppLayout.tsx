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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalCreateButton } from '@/components/layout/GlobalCreateButton';
import { DEPARTMENT_LABELS, DEPARTMENT_SEQUENCE } from '@/types';

const BASE_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/templates', label: 'Templates', icon: ClipboardList },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/users', label: 'Users', icon: Users },
];

const ADMIN_NAV_ITEMS = [
  { href: '/tasks', label: 'Task Templates', icon: ClipboardList },
];

interface AppLayoutProps {
  children: React.ReactNode;
  activeAlertCount?: number;
}

export function AppLayout({ children, activeAlertCount = 0 }: AppLayoutProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const isAdmin = user?.publicMetadata?.role === 'ADMIN' || user?.publicMetadata?.role === 'SUPER_ADMIN';
  const NAV_ITEMS = isAdmin ? [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS] : BASE_NAV_ITEMS;
  const isNavActive = (href: string) =>
    href === '/tasks' ? pathname === '/tasks' : href === '/templates' ? pathname === '/templates' : href === '/template-groups' ? pathname === '/template-groups' : pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        {/* Logo */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-gray-200">
          <div className="w-7 h-7 bg-black flex items-center justify-center">
            <Factory className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-900 tracking-tight leading-none">WINDOW</p>
            <p className="text-[9px] font-mono text-gray-500 tracking-widest uppercase leading-none mt-0.5">ERP System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(item.href);
            const Icon = item.icon;
            const isAlert = item.href === '/alerts';

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-xs font-mono font-medium transition-colors',
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

          <div className="pt-3 mt-3 border-t border-gray-100">
            <p className="px-3 pb-2 text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400">
              Department Tasks
            </p>
            <div className="space-y-0.5">
              {DEPARTMENT_SEQUENCE.map((department) => {
                const href = `/tasks/departments/${department}`;
                const isActive = pathname === href;

                return (
                  <Link
                    key={department}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-xs font-mono font-medium transition-colors',
                      isActive
                        ? 'bg-black text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <ClipboardList className="w-4 h-4 flex-shrink-0" />
                    <span>{DEPARTMENT_LABELS[department]}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <UserButton />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">Account</p>
              <p className="text-[10px] text-gray-500 font-mono truncate">Settings</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      {pathname.startsWith('/dashboard') && <GlobalCreateButton />}
    </div>
  );
}