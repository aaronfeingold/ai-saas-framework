'use client';

import type { User } from '@supabase/supabase-js';
import { Shield, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';

interface TwoFactorSetupProps {
  user: User;
}

export function TwoFactorSetup({}: TwoFactorSetupProps) {
  // TODO: Implement 2FA setup logic
  const is2FAEnabled = false; // This should come from user data

  return (
    <SettingsCard
      title="Two-Factor Authentication"
      description="Add an extra layer of security to your account."
      footer={
        <Button disabled>{is2FAEnabled ? 'Disable 2FA' : 'Enable 2FA'}</Button>
      }
    >
      <div className="flex items-center gap-3">
        {is2FAEnabled ? (
          <ShieldCheck className="h-8 w-8 text-green-600" />
        ) : (
          <Shield className="h-8 w-8 text-gray-400" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Two-Factor Authentication</h4>
            <Badge variant={is2FAEnabled ? 'default' : 'secondary'}>
              {is2FAEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {is2FAEnabled
              ? 'Your account is protected with two-factor authentication.'
              : 'Protect your account with an additional security layer.'}
          </p>
        </div>
      </div>

      {!is2FAEnabled && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            Two-factor authentication feature is coming soon. We&apos;ll notify
            you when it&apos;s available.
          </p>
        </div>
      )}
    </SettingsCard>
  );
}
