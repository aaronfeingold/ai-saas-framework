'use client';

import { useState } from 'react';

import { Download, Plus, X } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface MetricOption {
  id: string;
  category: string;
  name: string;
  description: string;
  dataType: 'number' | 'percentage' | 'currency' | 'count';
}

const availableMetrics: MetricOption[] = [
  // System Metrics
  {
    id: 'system_uptime',
    category: 'System',
    name: 'System Uptime',
    description: 'Overall system availability percentage',
    dataType: 'percentage',
  },
  {
    id: 'response_time',
    category: 'System',
    name: 'Average Response Time',
    description: 'API response times in milliseconds',
    dataType: 'number',
  },
  {
    id: 'error_rate',
    category: 'System',
    name: 'Error Rate',
    description: 'Percentage of failed requests',
    dataType: 'percentage',
  },
  {
    id: 'active_connections',
    category: 'System',
    name: 'Active Connections',
    description: 'Current database connections',
    dataType: 'count',
  },

  // User Metrics
  {
    id: 'total_users',
    category: 'Users',
    name: 'Total Users',
    description: 'Total registered users',
    dataType: 'count',
  },
  {
    id: 'active_users',
    category: 'Users',
    name: 'Active Users',
    description: 'Currently active users',
    dataType: 'count',
  },
  {
    id: 'new_signups',
    category: 'Users',
    name: 'New Signups',
    description: 'New user registrations',
    dataType: 'count',
  },
  {
    id: 'session_duration',
    category: 'Users',
    name: 'Average Session Duration',
    description: 'Average time users spend per session',
    dataType: 'number',
  },

  // Content Metrics
  {
    id: 'total_content',
    category: 'Content',
    name: 'Total Content',
    description: 'Total content items',
    dataType: 'count',
  },
  {
    id: 'published_content',
    category: 'Content',
    name: 'Published Content',
    description: 'Live published content',
    dataType: 'count',
  },
  {
    id: 'content_views',
    category: 'Content',
    name: 'Content Views',
    description: 'Total content views',
    dataType: 'count',
  },
  {
    id: 'avg_content_engagement',
    category: 'Content',
    name: 'Avg Content Engagement',
    description: 'Average engagement per content item',
    dataType: 'number',
  },

  // AI Usage Metrics
  {
    id: 'ai_conversations',
    category: 'AI Usage',
    name: 'AI Conversations',
    description: 'Total AI chat conversations',
    dataType: 'count',
  },
  {
    id: 'ai_messages',
    category: 'AI Usage',
    name: 'AI Messages',
    description: 'Total AI messages generated',
    dataType: 'count',
  },
  {
    id: 'ai_tokens',
    category: 'AI Usage',
    name: 'Tokens Used',
    description: 'Total AI tokens consumed',
    dataType: 'count',
  },
  {
    id: 'ai_cost',
    category: 'AI Usage',
    name: 'AI Costs',
    description: 'Total AI usage costs',
    dataType: 'currency',
  },
];

export function CustomReportBuilder() {
  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState('7d');
  const [format, setFormat] = useState('pdf');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  function handleMetricToggle(metricId: string) {
    setSelectedMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((id) => id !== metricId)
        : [...prev, metricId]
    );
  }

  function addRecipient() {
    if (newRecipient && !recipients.includes(newRecipient)) {
      setRecipients((prev) => [...prev, newRecipient]);
      setNewRecipient('');
    }
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email));
  }

  async function generateCustomReport() {
    if (!reportName || selectedMetrics.length === 0) {
      toast.error(
        'Please provide a report name and select at least one metric'
      );
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/admin/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          description,
          metrics: selectedMetrics,
          timeframe,
          format,
          recipients,
        }),
      });

      if (response.ok) {
        toast.success('Custom report generated successfully!');
        // Reset form
        setReportName('');
        setDescription('');
        setSelectedMetrics([]);
        setRecipients([]);
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating custom report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }

  const groupedMetrics = availableMetrics.reduce(
    (acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    },
    {} as Record<string, MetricOption[]>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Custom Report Builder</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Report Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>
              Configure your custom report settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                placeholder="Enter report name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the report"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Time Range</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="1y">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Report</SelectItem>
                    <SelectItem value="csv">CSV Data</SelectItem>
                    <SelectItem value="json">JSON Data</SelectItem>
                    <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Recipients (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                />
                <Button size="sm" onClick={addRecipient}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {recipients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {recipients.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeRecipient(email)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={generateCustomReport}
              disabled={
                isGenerating || !reportName || selectedMetrics.length === 0
              }
              className="w-full"
            >
              {isGenerating ? (
                'Generating...'
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Metrics Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Metrics</CardTitle>
            <CardDescription>
              Choose the metrics to include in your report (
              {selectedMetrics.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedMetrics).map(([category, metrics]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {metrics.map((metric) => (
                      <div
                        key={metric.id}
                        className="flex items-start space-x-3"
                      >
                        <Checkbox
                          id={metric.id}
                          checked={selectedMetrics.includes(metric.id)}
                          onCheckedChange={() => handleMetricToggle(metric.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <Label
                            htmlFor={metric.id}
                            className="cursor-pointer text-sm font-medium"
                          >
                            {metric.name}
                          </Label>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {metric.description}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {metric.dataType}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Preview */}
      {selectedMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
            <CardDescription>
              Preview of metrics that will be included in your report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {selectedMetrics.map((metricId) => {
                const metric = availableMetrics.find((m) => m.id === metricId);
                if (!metric) return null;

                return (
                  <div key={metricId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{metric.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {metric.category}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMetricToggle(metricId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
