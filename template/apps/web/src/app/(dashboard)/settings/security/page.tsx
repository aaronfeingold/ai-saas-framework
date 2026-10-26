import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { getSession } from '@/lib/auth/server/supabase';

import { SecurityLog } from './components/security-log';
import { SessionManager } from './components/session-manager';
import { TwoFactorSetup } from './components/two-factor-setup';

export default async function SecurityPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Security"
        description="Manage your account security settings and monitor access."
      />

      <div className="space-y-6">
        <TwoFactorSetup user={session} />
        <SessionManager userId={session.id} />
        <SecurityLog userId={session.id} />
      </div>
    </div>
  );
}
