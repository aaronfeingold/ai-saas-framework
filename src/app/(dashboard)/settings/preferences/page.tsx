import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { getSession } from '@/lib/auth/server/supabase';

import { LanguageSettings } from './components/language-settings';
import { NotificationSettings } from './components/notification-settings';
import { ThemeSettings } from './components/theme-settings';

export default async function PreferencesPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Preferences"
        description="Customize your experience and app settings."
      />

      <div className="space-y-6">
        <ThemeSettings />
        <NotificationSettings />
        <LanguageSettings />
      </div>
    </div>
  );
}
