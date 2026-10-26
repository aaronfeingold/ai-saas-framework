'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Dot } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon?: React.ReactNode;
  }[];
}

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'mt-8 ml-0 flex min-h-full space-x-2 lg:flex-col lg:space-y-1 lg:space-x-0',
        className
      )}
      {...props}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            pathname.includes(item.href) && 'text-accent-foreground bg-muted',
            'hover:bg-muted',
            'justify-between pr-1 pl-2.5'
          )}
        >
          <div className="flex items-center gap-2">
            {item.icon}
            {item.title}
          </div>
          {pathname.includes(item.href) && <Dot className="h-6 w-6" />}
        </Link>
      ))}
    </nav>
  );
}
