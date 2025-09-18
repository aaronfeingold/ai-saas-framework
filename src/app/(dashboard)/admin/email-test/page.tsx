'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface SystemTest {
  resendConnection: boolean;
  databaseConnection: boolean;
  errors: string[];
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: string;
  createdAt: string;
  error?: string;
}

interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  bounced: number;
}

export default function EmailTestPage() {
  const [systemStatus, setSystemStatus] = useState<{
    success: boolean;
    tests: SystemTest;
    loading: boolean;
  }>({
    success: false,
    tests: { resendConnection: false, databaseConnection: false, errors: [] },
    loading: true,
  });

  const [testEmail, setTestEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('notification');
  const [sendingTest, setSendingTest] = useState(false);

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  // Test system connectivity
  const testSystem = async () => {
    try {
      setSystemStatus(prev => ({ ...prev, loading: true }));
      const response = await fetch('/api/email/test');
      const data = await response.json();
      
      setSystemStatus({
        success: data.success,
        tests: data.tests,
        loading: false,
      });

      if (data.success) {
        toast.success('Email system is operational');
      } else {
        toast.error('Email system has issues');
      }
    } catch (error) {
      setSystemStatus({
        success: false,
        tests: { resendConnection: false, databaseConnection: false, errors: ['Failed to test system'] },
        loading: false,
      });
      toast.error('Failed to test email system');
    }
  };

  // Send test email
  const sendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setSendingTest(true);
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          template: selectedTemplate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Test email sent to ${testEmail}`);
        loadEmailLogs(); // Refresh logs
      } else {
        toast.error(data.error || 'Failed to send test email');
      }
    } catch (error) {
      toast.error('Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  // Load email logs
  const loadEmailLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await fetch('/api/email/logs?limit=10');
      const data = await response.json();
      
      if (data.success) {
        setEmailLogs(data.data.logs);
      }
    } catch (error) {
      toast.error('Failed to load email logs');
    } finally {
      setLogsLoading(false);
    }
  };

  // Load email statistics
  const loadEmailStats = async () => {
    try {
      const response = await fetch('/api/email/stats');
      const data = await response.json();
      
      if (data.success) {
        setEmailStats(data.data.overview);
      }
    } catch (error) {
      toast.error('Failed to load email statistics');
    }
  };

  useEffect(() => {
    testSystem();
    loadEmailLogs();
    loadEmailStats();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default';
      case 'delivered':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'bounced':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email System Test</h1>
        <p className="text-muted-foreground">
          Test and monitor your email system functionality
        </p>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Test email service connectivity and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={testSystem} 
              disabled={systemStatus.loading}
              variant="outline"
            >
              {systemStatus.loading ? 'Testing...' : 'Test System'}
            </Button>
            <Badge 
              variant={systemStatus.success ? 'default' : 'destructive'}
            >
              {systemStatus.success ? 'Operational' : 'Issues Detected'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Resend Connection:</span>
              <Badge 
                variant={systemStatus.tests.resendConnection ? 'default' : 'destructive'}
              >
                {systemStatus.tests.resendConnection ? 'Connected' : 'Failed'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Database Connection:</span>
              <Badge 
                variant={systemStatus.tests.databaseConnection ? 'default' : 'destructive'}
              >
                {systemStatus.tests.databaseConnection ? 'Connected' : 'Failed'}
              </Badge>
            </div>
          </div>

          {systemStatus.tests.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-800">Errors:</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
                {systemStatus.tests.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Statistics */}
      {emailStats && (
        <Card>
          <CardHeader>
            <CardTitle>Email Statistics</CardTitle>
            <CardDescription>
              Overview of email activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{emailStats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{emailStats.sent}</div>
                <div className="text-sm text-muted-foreground">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{emailStats.delivered}</div>
                <div className="text-sm text-muted-foreground">Delivered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{emailStats.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{emailStats.pending}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{emailStats.bounced}</div>
                <div className="text-sm text-muted-foreground">Bounced</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send Test Email */}
      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            Send a test email using one of the available templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notification">Notification</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="password-reset">Password Reset</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            onClick={sendTestEmail} 
            disabled={sendingTest || !testEmail}
          >
            {sendingTest ? 'Sending...' : 'Send Test Email'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Email Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Email Logs</CardTitle>
          <CardDescription>
            Latest email activity and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={loadEmailLogs} disabled={logsLoading} variant="outline">
              {logsLoading ? 'Loading...' : 'Refresh Logs'}
            </Button>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.to}</TableCell>
                  <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.template}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(log.status)}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {emailLogs.length === 0 && !logsLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No email logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}