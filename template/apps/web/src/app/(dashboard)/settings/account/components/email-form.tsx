'use client';

import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { SubmitButton } from '@/components/ui/submit-button';

import { updateEmail } from '../../profile/actions';

interface EmailFormProps {
  user: User;
}

export function EmailForm({ user }: EmailFormProps) {
  const handleEmailSubmit = async (formData: FormData) => {
    const result = await updateEmail(formData);

    if (result.success) {
      toast.success(result.message || 'Email updated successfully');
    } else {
      toast.error(result.error || 'Failed to update email');
    }
  };

  const isEmailVerified = user.email_confirmed_at !== null;

  return (
    <SettingsCard
      title="Email Address"
      description="Manage your email address and verification status."
      footer={<SubmitButton form="email-form">Update Email</SubmitButton>}
    >
      <form id="email-form" action={handleEmailSubmit} className="space-y-4">
        <FormField
          label="Current Email"
          description="Your email address is used for login and notifications."
          required
          htmlFor="email"
        >
          <div className="flex items-center gap-2">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email || ''}
              placeholder="Enter your email address"
              required
            />
            <Badge variant={isEmailVerified ? 'default' : 'secondary'}>
              {isEmailVerified ? 'Verified' : 'Unverified'}
            </Badge>
          </div>
        </FormField>

        {!isEmailVerified && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              Your email address is not verified. Please check your inbox for a
              verification email.
            </p>
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
