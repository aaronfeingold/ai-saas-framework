'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Activity,
  Clock,
  MapPin,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UserActivityData {
  totalUsers: number;
  activeUsers: number;
  newSignups: number;
  averageSessionDuration: number;
  userSessions: Array<{
    userId: string;
    email: string;
    sessionStart: string;
    sessionEnd?: string;
    duration: number;
    ipAddress: string;
    userAgent: string;
    location: string;
    actions: number;
  }>;
  topActions: Array<{
    action: string;
    count: number;
    uniqueUsers: number;
  }>;
  signupTrend: Array<{
    date: string;
    signups: number;
    activations: number;
  }>;
  auditLog: Array<{
    id: string;
    userId: string;
    email: string;
    action: string;
    resource: string;
    timestamp: string;
    ipAddress: string;
    result: 'success' | 'failure';
  }>;
  lastUpdated: string;
}

export function UserActivityMonitor() {
  const [data, setData] = useState<UserActivityData | null>(null);
  const [timeframe, setTimeframe] = useState('24h');
  const [loading, setLoading] = useState(true);

  const loadUserActivity = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/metrics/user-activity?timeframe=${timeframe}`
      );
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error('Error loading user activity:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadUserActivity();
  }, [loadUserActivity]);

  if (loading) {
    return <div className="py-8 text-center">Loading user activity...</div>;
  }

  // Mock data for demonstration
  const mockData: UserActivityData = {
    totalUsers: 1247,
    activeUsers: 89,
    newSignups: 23,
    averageSessionDuration: 24.5,
    userSessions: [
      {
        userId: '1',
        email: 'john@example.com',
        sessionStart: '2024-01-21T14:30:00Z',
        sessionEnd: undefined,
        duration: 145,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        location: 'San Francisco, CA',
        actions: 34,
      },
      {
        userId: '2',
        email: 'sarah@example.com',
        sessionStart: '2024-01-21T13:15:00Z',
        sessionEnd: '2024-01-21T14:45:00Z',
        duration: 90,
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        location: 'New York, NY',
        actions: 28,
      },
      {
        userId: '3',
        email: 'mike@example.com',
        sessionStart: '2024-01-21T12:00:00Z',
        sessionEnd: '2024-01-21T12:30:00Z',
        duration: 30,
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        location: 'Austin, TX',
        actions: 12,
      },
      {
        userId: '4',
        email: 'emma@example.com',
        sessionStart: '2024-01-21T11:20:00Z',
        sessionEnd: undefined,
        duration: 67,
        ipAddress: '192.168.1.103',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        location: 'Seattle, WA',
        actions: 19,
      },
      {
        userId: '5',
        email: 'alex@example.com',
        sessionStart: '2024-01-21T10:45:00Z',
        sessionEnd: '2024-01-21T11:15:00Z',
        duration: 30,
        ipAddress: '192.168.1.104',
        userAgent: 'Mozilla/5.0 (Android 13; SM-G991B)',
        location: 'Miami, FL',
        actions: 8,
      },
    ],
    topActions: [
      { action: 'Content View', count: 1234, uniqueUsers: 567 },
      { action: 'AI Chat', count: 892, uniqueUsers: 234 },
      { action: 'Content Create', count: 456, uniqueUsers: 123 },
      { action: 'Profile Update', count: 234, uniqueUsers: 89 },
      { action: 'Settings Change', count: 123, uniqueUsers: 67 },
    ],
    signupTrend: [
      { date: '2024-01-15', signups: 12, activations: 10 },
      { date: '2024-01-16', signups: 15, activations: 13 },
      { date: '2024-01-17', signups: 8, activations: 7 },
      { date: '2024-01-18', signups: 18, activations: 16 },
      { date: '2024-01-19', signups: 22, activations: 19 },
      { date: '2024-01-20', signups: 14, activations: 12 },
      { date: '2024-01-21', signups: 23, activations: 20 },
    ],
    auditLog: [
      {
        id: '1',
        userId: '1',
        email: 'john@example.com',
        action: 'LOGIN',
        resource: 'Dashboard',
        timestamp: '2024-01-21T14:30:00Z',
        ipAddress: '192.168.1.100',
        result: 'success',
      },
      {
        id: '2',
        userId: '2',
        email: 'sarah@example.com',
        action: 'CONTENT_CREATE',
        resource: 'Event',
        timestamp: '2024-01-21T13:45:00Z',
        ipAddress: '192.168.1.101',
        result: 'success',
      },
      {
        id: '3',
        userId: '3',
        email: 'mike@example.com',
        action: 'CONTENT_UPDATE',
        resource: 'Venue',
        timestamp: '2024-01-21T12:15:00Z',
        ipAddress: '192.168.1.102',
        result: 'success',
      },
      {
        id: '4',
        userId: '4',
        email: 'admin@example.com',
        action: 'USER_DELETE',
        resource: 'User',
        timestamp: '2024-01-21T11:30:00Z',
        ipAddress: '192.168.1.103',
        result: 'success',
      },
      {
        id: '5',
        userId: '5',
        email: 'alex@example.com',
        action: 'LOGIN_FAILED',
        resource: 'Auth',
        timestamp: '2024-01-21T10:20:00Z',
        ipAddress: '192.168.1.104',
        result: 'failure',
      },
    ],
    lastUpdated: new Date().toISOString(),
  };

  const activity = data || mockData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">User Activity Monitor</h2>
        <div className="flex items-center gap-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            Updated: {new Date(activity.lastUpdated).toLocaleTimeString()}
          </Badge>
        </div>
      </div>

      {/* User Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={activity.totalUsers.toLocaleString()}
          icon={<Users className="h-4 w-4" />}
          description="Registered users"
          color="blue"
        />

        <MetricCard
          title="Active Users"
          value={activity.activeUsers.toLocaleString()}
          icon={<UserCheck className="h-4 w-4" />}
          description={`Currently online`}
          color="green"
        />

        <MetricCard
          title="New Signups"
          value={activity.newSignups.toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          description={
            timeframe === '1h'
              ? 'This hour'
              : timeframe === '24h'
                ? 'Today'
                : `Last ${timeframe}`
          }
          color="purple"
        />

        <MetricCard
          title="Avg Session"
          value={`${activity.averageSessionDuration}m`}
          icon={<Clock className="h-4 w-4" />}
          description="Session duration"
          color="orange"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Current user sessions and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.userSessions.map((session) => (
                <div
                  key={session.userId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {session.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{session.email}</div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <MapPin className="h-3 w-3" />
                        {session.location}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {session.duration}m
                      {!session.sessionEnd && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {session.actions} actions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Top User Actions</CardTitle>
            <CardDescription>Most common user activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.topActions.map((action, index) => (
                <div
                  key={action.action}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{action.action}</div>
                      <div className="text-muted-foreground text-xs">
                        {action.uniqueUsers} unique users
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {action.count.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground text-xs">total</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Log
          </CardTitle>
          <CardDescription>
            Recent user actions and security events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.auditLog.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {log.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{log.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted rounded px-2 py-1 text-xs">
                      {log.action}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm">{log.resource}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.ipAddress}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.result === 'success' ? 'default' : 'destructive'
                      }
                      className="text-xs"
                    >
                      {log.result}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({
  title,
  value,
  icon,
  description,
  color,
}: MetricCardProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={colorClasses[color]}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
