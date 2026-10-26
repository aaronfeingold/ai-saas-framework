import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { getSession } from '@/lib/auth/server/supabase';

import { ProfileForm } from './components/profile-form';

export default async function ProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Profile"
        description="Manage your personal information and profile settings."
      />

      <ProfileForm user={session} />
    </div>
  );
}
