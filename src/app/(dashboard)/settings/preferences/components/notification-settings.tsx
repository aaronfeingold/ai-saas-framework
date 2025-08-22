'use client';

import { useState } from 'react';

import { Bell, Mail, MessageSquare, Shield } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { SettingsCard } from '@/components/ui/settings-card';
import { SubmitButton } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';

export function NotificationSettings() {
  // Mock notification preferences - replace with actual user data
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    chatNotifications: true,
    securityAlerts: true,
    marketingEmails: false,
    systemUpdates: true,
    weeklyDigest: true,
  });

  const handlePreferenceChange = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    // TODO: Implement saving preferences
    console.log('Saving preferences:', preferences);
  };

  const notificationTypes = [
    {
      key: 'emailNotifications' as const,
      label: 'Email Notifications',
      description: 'Receive email notifications for important updates',
      icon: <Mail className="h-4 w-4" />,
    },
    {
      key: 'chatNotifications' as const,
      label: 'Chat Notifications',
      description: 'Get notified about new messages and mentions',
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      key: 'securityAlerts' as const,
      label: 'Security Alerts',
      description: 'Important security notifications (always recommended)',
      icon: <Shield className="h-4 w-4" />,
    },
    {
      key: 'marketingEmails' as const,
      label: 'Marketing Emails',
      description: 'Product updates, tips, and promotional content',
      icon: <Bell className="h-4 w-4" />,
    },
    {
      key: 'systemUpdates' as const,
      label: 'System Updates',
      description: 'Notifications about system maintenance and updates',
      icon: <Bell className="h-4 w-4" />,
    },
    {
      key: 'weeklyDigest' as const,
      label: 'Weekly Digest',
      description: 'Weekly summary of your account activity',
      icon: <Mail className="h-4 w-4" />,
    },
  ];

  return (
    <SettingsCard
      title="Notification Preferences"
      description="Control what notifications you receive and how."
      footer={
        <SubmitButton onClick={handleSave}>Save Preferences</SubmitButton>
      }
    >
      <div className="space-y-4">
        {notificationTypes.map((type) => (
          <div key={type.key} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {type.icon}
              <div>
                <Label
                  htmlFor={type.key}
                  className="cursor-pointer font-medium"
                >
                  {type.label}
                </Label>
                <p className="text-muted-foreground text-sm">
                  {type.description}
                </p>
              </div>
            </div>
            <Switch
              id={type.key}
              checked={preferences[type.key]}
              onCheckedChange={() => handlePreferenceChange(type.key)}
            />
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
