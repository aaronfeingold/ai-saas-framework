import { Bell, Settings, Shield, User } from 'lucide-react';

import { SidebarNav } from '@/components/ui/sidebar-nav';

const sidebarNavItems = [
  {
    title: 'Profile',
    href: '/settings/profile',
    icon: <User className="h-4 w-4" />,
  },
  {
    title: 'Account',
    href: '/settings/account',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    title: 'Security',
    href: '/settings/security',
    icon: <Shield className="h-4 w-4" />,
  },
  {
    title: 'Preferences',
    href: '/settings/preferences',
    icon: <Bell className="h-4 w-4" />,
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default async function SettingsLayout({
  children,
}: SettingsLayoutProps) {
  return (
    <div className="space-y-1">
      <div className="flex min-h-full flex-col space-y-8 lg:flex-row lg:space-y-0 lg:space-x-4">
        <aside className="lg:w-1/5">
          <SidebarNav items={sidebarNavItems} />
        </aside>
        <div className="border-border bg-card rounded-2xl border p-2 shadow-sm lg:w-4/5">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
