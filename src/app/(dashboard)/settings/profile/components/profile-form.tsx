'use client';

import { useState } from 'react';

import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

import { AvatarUpload } from '@/components/ui/avatar-upload';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsCard } from '@/components/ui/settings-card';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';

import { updateProfile, uploadAvatar } from '../actions';

interface ProfileFormProps {
  user: User;
}

// Common timezones for the select dropdown
const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export function ProfileForm({ user }: ProfileFormProps) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleProfileSubmit = async (formData: FormData) => {
    const result = await updateProfile(formData);

    if (result.success) {
      toast.success(result.message || 'Profile updated successfully');
    } else {
      toast.error(result.error || 'Failed to update profile');
    }
  };

  const handleAvatarChange = async (file: File | null) => {
    setAvatarFile(file);

    if (file) {
      const formData = new FormData();
      formData.append('avatar', file);

      const result = await uploadAvatar(formData);

      if (result.success) {
        toast.success(result.message || 'Avatar updated successfully');
      } else {
        toast.error(result.error || 'Failed to upload avatar');
        setAvatarFile(null);
      }
    }
  };

  const userMetadata = user.user_metadata || {};
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <SettingsCard
        title="Profile Picture"
        description="Upload a profile picture to personalize your account."
      >
        <AvatarUpload
          currentImageUrl={userMetadata.avatar_url}
          fallbackText={getInitials(
            userMetadata.full_name || user.email?.charAt(0) || 'U'
          )}
          onImageChange={handleAvatarChange}
          size="lg"
        />
      </SettingsCard>

      {/* Profile Information */}
      <SettingsCard
        title="Profile Information"
        description="Update your personal details and preferences."
        footer={<SubmitButton form="profile-form">Save Changes</SubmitButton>}
      >
        <form
          id="profile-form"
          action={handleProfileSubmit}
          className="space-y-4"
        >
          <FormField
            label="Full Name"
            description="Your full name as it appears on your account."
            required
            htmlFor="full_name"
          >
            <Input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={userMetadata.full_name || ''}
              placeholder="Enter your full name"
              required
            />
          </FormField>

          <FormField
            label="Display Name"
            description="This is how your name will appear to other users."
            required
            htmlFor="display_name"
          >
            <Input
              id="display_name"
              name="display_name"
              type="text"
              defaultValue={
                userMetadata.display_name || userMetadata.full_name || ''
              }
              placeholder="Enter your display name"
              required
            />
          </FormField>

          <FormField
            label="Bio"
            description="Tell others about yourself in a few words."
            htmlFor="bio"
          >
            <Textarea
              id="bio"
              name="bio"
              placeholder="Write a short bio..."
              defaultValue={userMetadata.bio || ''}
              rows={3}
              maxLength={500}
            />
          </FormField>

          <FormField
            label="Timezone"
            description="Your timezone helps us show you the right times."
            htmlFor="timezone"
          >
            <Select
              name="timezone"
              defaultValue={userMetadata.timezone || 'UTC'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </form>
      </SettingsCard>
    </div>
  );
}
