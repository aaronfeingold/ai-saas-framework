'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Search } from 'lucide-react';

import { Spinner } from '@/components/icons';
import { Input } from '@/components/ui/input';

export function SearchInput() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function searchAction(formData: FormData) {
    const value = formData.get('q') as string;
    const params = new URLSearchParams({ q: value });
    startTransition(() => {
      router.replace(`/?${params.toString()}`);
    });
  }

  return (
    <form action={searchAction} className="relative ml-auto flex-1 md:grow-0">
      <Search className="text-muted-foreground absolute top-[.75rem] left-2.5 h-4 w-4" />
      <Input
        name="q"
        type="search"
        placeholder="Search..."
        className="bg-background w-full rounded-lg pl-8 md:w-[200px] lg:w-[336px]"
      />
      {isPending && <Spinner />}
    </form>
  );
}
