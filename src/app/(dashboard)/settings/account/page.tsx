import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { getSession } from '@/lib/auth/server/supabase';

import { DeleteAccountForm } from './components/delete-account-form';
import { EmailForm } from './components/email-form';

export default async function AccountPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Account"
        description="Manage your account settings and security options."
      />

      <div className="space-y-6">
        <EmailForm user={session} />
        <DeleteAccountForm />
      </div>
    </div>
  );
}
