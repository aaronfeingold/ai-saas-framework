'use client';

import { useEffect, useState } from 'react';

import {
  Calendar,
  Download,
  FileText,
  Mail,
  Pause,
  Play,
  Settings,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AutomatedReport {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'content' | 'users' | 'ai_usage' | 'combined';
  schedule: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv' | 'json';
  recipients: string[];
  isActive: boolean;
  lastRun?: string;
  nextRun: string;
  generatedCount: number;
}

export function AutomatedReports() {
  const [reports, setReports] = useState<AutomatedReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const response = await fetch('/api/admin/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleReport(reportId: string, isActive: boolean) {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        toast.success(`Report ${isActive ? 'activated' : 'paused'}`);
        loadReports();
      } else {
        toast.error('Failed to update report');
      }
    } catch (error) {
      console.error('Error toggling report:', error);
      toast.error('Failed to update report');
    }
  }

  async function generateReport(reportId: string) {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/generate`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Report generation started');
        // In a real app, you might poll for completion or show progress
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  }

  if (loading) {
    return <div className="py-8 text-center">Loading automated reports...</div>;
  }

  // Mock data for demonstration
  const mockReports: AutomatedReport[] = [
    {
      id: '1',
      name: 'Daily System Health',
      description:
        'Comprehensive system metrics, performance, and uptime report',
      type: 'system',
      schedule: 'daily',
      format: 'pdf',
      recipients: ['admin@example.com', 'ops@example.com'],
      isActive: true,
      lastRun: '2024-01-21T06:00:00Z',
      nextRun: '2024-01-22T06:00:00Z',
      generatedCount: 127,
    },
    {
      id: '2',
      name: 'Weekly Content Analytics',
      description: 'Content creation, engagement, and moderation metrics',
      type: 'content',
      schedule: 'weekly',
      format: 'pdf',
      recipients: ['content@example.com', 'marketing@example.com'],
      isActive: true,
      lastRun: '2024-01-15T09:00:00Z',
      nextRun: '2024-01-22T09:00:00Z',
      generatedCount: 18,
    },
    {
      id: '3',
      name: 'Monthly AI Usage Report',
      description: 'AI model usage, costs, and performance analysis',
      type: 'ai_usage',
      schedule: 'monthly',
      format: 'csv',
      recipients: ['finance@example.com', 'product@example.com'],
      isActive: true,
      lastRun: '2024-01-01T10:00:00Z',
      nextRun: '2024-02-01T10:00:00Z',
      generatedCount: 6,
    },
    {
      id: '4',
      name: 'User Activity Summary',
      description: 'User engagement, session analytics, and growth metrics',
      type: 'users',
      schedule: 'weekly',
      format: 'pdf',
      recipients: ['growth@example.com'],
      isActive: false,
      lastRun: '2024-01-08T12:00:00Z',
      nextRun: '2024-01-29T12:00:00Z',
      generatedCount: 12,
    },
    {
      id: '5',
      name: 'Executive Dashboard',
      description: 'High-level KPIs and business metrics across all areas',
      type: 'combined',
      schedule: 'weekly',
      format: 'pdf',
      recipients: ['ceo@example.com', 'cto@example.com'],
      isActive: true,
      lastRun: '2024-01-15T08:00:00Z',
      nextRun: '2024-01-22T08:00:00Z',
      generatedCount: 24,
    },
    {
      id: '6',
      name: 'Data Export - Content',
      description: 'Raw content data export for analysis',
      type: 'content',
      schedule: 'monthly',
      format: 'json',
      recipients: ['data@example.com'],
      isActive: true,
      lastRun: '2024-01-01T14:00:00Z',
      nextRun: '2024-02-01T14:00:00Z',
      generatedCount: 3,
    },
  ];

  const reportData = reports.length > 0 ? reports : mockReports;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Automated Reports</h2>
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          Create New Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportData.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onToggle={(isActive) => toggleReport(report.id, isActive)}
            onGenerate={() => generateReport(report.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ReportCardProps {
  report: AutomatedReport;
  onToggle: (isActive: boolean) => void;
  onGenerate: () => void;
}

function ReportCard({ report, onToggle, onGenerate }: ReportCardProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'system':
        return '⚙️';
      case 'content':
        return '📝';
      case 'users':
        return '👥';
      case 'ai_usage':
        return '🤖';
      case 'combined':
        return '📊';
      default:
        return '📄';
    }
  };

  const getScheduleBadge = (schedule: string) => {
    const colors = {
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-green-100 text-green-800',
      monthly: 'bg-purple-100 text-purple-800',
    };
    return colors[schedule as keyof typeof colors] || colors.monthly;
  };

  return (
    <Card className={!report.isActive ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getTypeIcon(report.type)}</span>
            <div>
              <CardTitle className="text-lg">{report.name}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  className={`${getScheduleBadge(report.schedule)} text-xs`}
                >
                  {report.schedule}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {report.format.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggle(!report.isActive)}>
                {report.isActive ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Report
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Activate Report
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerate}>
                <Play className="mr-2 h-4 w-4" />
                Generate Now
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Edit Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Download Latest
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <CardDescription className="text-sm">
          {report.description}
        </CardDescription>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Recipients
            </span>
            <span className="font-medium">{report.recipients.length}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Next Run
            </span>
            <span className="font-medium">
              {new Date(report.nextRun).toLocaleDateString()}
            </span>
          </div>

          {report.lastRun && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Run</span>
              <span className="font-medium">
                {new Date(report.lastRun).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Generated</span>
            <span className="font-medium">{report.generatedCount} times</span>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerate}
            className="flex-1"
          >
            <Play className="mr-2 h-3 w-3" />
            Generate
          </Button>

          <Button
            size="sm"
            variant={report.isActive ? 'destructive' : 'default'}
            onClick={() => onToggle(!report.isActive)}
          >
            {report.isActive ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
