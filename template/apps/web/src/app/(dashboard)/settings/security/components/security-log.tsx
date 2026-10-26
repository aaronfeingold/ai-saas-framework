'use client';

import { useState } from 'react';

import { CheckCircle, Clock, MapPin, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';

interface SecurityLogProps {
  userId: string;
}

// Mock security events - replace with actual data from your security_events table
const mockEvents = [
  {
    id: '1',
    eventType: 'login',
    success: true,
    ipAddress: '192.168.1.1',
    location: 'New York, US',
    timestamp: '2024-01-20T10:30:00Z',
    userAgent: 'Chrome on Windows',
  },
  {
    id: '2',
    eventType: 'profile_update',
    success: true,
    ipAddress: '192.168.1.1',
    location: 'New York, US',
    timestamp: '2024-01-19T15:45:00Z',
    userAgent: 'Chrome on Windows',
  },
  {
    id: '3',
    eventType: 'login',
    success: false,
    ipAddress: '192.168.1.100',
    location: 'Unknown',
    timestamp: '2024-01-18T08:20:00Z',
    userAgent: 'Chrome on Linux',
  },
];

export function SecurityLog({}: SecurityLogProps) {
  const [showAll, setShowAll] = useState(false);

  const displayEvents = showAll ? mockEvents : mockEvents.slice(0, 5);

  const getEventDescription = (eventType: string, success: boolean) => {
    const descriptions: Record<string, string> = {
      login: success ? 'Successful login' : 'Failed login attempt',
      logout: 'Logged out',
      profile_update: 'Profile updated',
      email_change: 'Email address changed',
      password_change: 'Password changed',
      avatar_update: 'Profile picture updated',
    };

    return descriptions[eventType] || eventType;
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <SettingsCard
      title="Security Activity"
      description="Monitor recent security events on your account."
      footer={
        mockEvents.length > 5 && (
          <Button variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show Less' : `Show All (${mockEvents.length})`}
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {displayEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-3 rounded-md border p-3"
          >
            <div className="mt-0.5">
              {event.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {getEventDescription(event.eventType, event.success)}
                </p>
                <Badge
                  variant={event.success ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {event.success ? 'Success' : 'Failed'}
                </Badge>
              </div>

              <div className="mt-1 space-y-1">
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(event.timestamp)}</span>
                </div>

                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3" />
                  <span>{event.location}</span>
                  <span>•</span>
                  <span>{event.ipAddress}</span>
                </div>

                {event.userAgent && (
                  <div className="text-muted-foreground text-xs">
                    {event.userAgent}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {displayEvents.length === 0 && (
          <div className="text-muted-foreground py-6 text-center">
            No security events found.
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
