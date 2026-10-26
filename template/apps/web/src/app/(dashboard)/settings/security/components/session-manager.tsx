'use client';

import { Globe, Monitor, Smartphone } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';

interface SessionManagerProps {
  userId: string;
}

// Mock session data - replace with actual data from your sessions table
const mockSessions = [
  {
    id: '1',
    deviceInfo: 'Chrome on Windows',
    location: 'New York, US',
    ipAddress: '192.168.1.1',
    lastActive: '2 minutes ago',
    isCurrent: true,
  },
  {
    id: '2',
    deviceInfo: 'Safari on iPhone',
    location: 'New York, US',
    ipAddress: '192.168.1.2',
    lastActive: '2 hours ago',
    isCurrent: false,
  },
];

export function SessionManager({}: SessionManagerProps) {
  const handleRevokeSession = (sessionId: string) => {
    // TODO: Implement session revocation
    console.log('Revoking session:', sessionId);
  };

  const handleRevokeAllOther = () => {
    // TODO: Implement revoking all other sessions
    console.log('Revoking all other sessions');
  };

  const getDeviceIcon = (deviceInfo: string) => {
    if (
      deviceInfo.toLowerCase().includes('iphone') ||
      deviceInfo.toLowerCase().includes('android')
    ) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <SettingsCard
      title="Active Sessions"
      description="Manage your active sessions across different devices."
      footer={
        <Button variant="outline" onClick={handleRevokeAllOther}>
          Revoke All Other Sessions
        </Button>
      }
    >
      <div className="space-y-3">
        {mockSessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              {getDeviceIcon(session.deviceInfo)}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{session.deviceInfo}</p>
                  {session.isCurrent && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Globe className="h-3 w-3" />
                  <span>{session.location}</span>
                  <span>•</span>
                  <span>{session.ipAddress}</span>
                  <span>•</span>
                  <span>{session.lastActive}</span>
                </div>
              </div>
            </div>

            {!session.isCurrent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRevokeSession(session.id)}
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
