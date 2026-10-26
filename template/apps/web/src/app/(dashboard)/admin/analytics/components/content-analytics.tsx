'use client';

import { useCallback, useEffect, useState } from 'react';

import { Calendar, Edit, Eye, FileText, TrendingUp, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ContentAnalyticsData {
  totalContent: number;
  publishedContent: number;
  draftContent: number;
  pendingReview: number;
  contentByType: Array<{
    contentType: string;
    count: number;
    published: number;
    draft: number;
    icon: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: 'created' | 'published' | 'updated' | 'deleted';
    contentType: string;
    title: string;
    author: string;
    timestamp: string;
  }>;
  topContributors: Array<{
    userId: string;
    email: string;
    contentCount: number;
    publishedCount: number;
  }>;
  engagementMetrics: {
    totalViews: number;
    avgViewsPerContent: number;
    topContent: Array<{
      id: string;
      title: string;
      contentType: string;
      views: number;
      lastViewed: string;
    }>;
  };
  lastUpdated: string;
}

export function ContentAnalytics() {
  const [data, setData] = useState<ContentAnalyticsData | null>(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);

  const loadContentAnalytics = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/metrics/content?timeframe=${timeframe}`
      );
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error('Error loading content analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadContentAnalytics();
  }, [loadContentAnalytics]);

  if (loading) {
    return <div className="py-8 text-center">Loading content analytics...</div>;
  }

  // Mock data for demonstration
  const mockData: ContentAnalyticsData = {
    totalContent: 342,
    publishedContent: 278,
    draftContent: 45,
    pendingReview: 19,
    contentByType: [
      { contentType: 'Event', count: 89, published: 72, draft: 17, icon: '🎪' },
      { contentType: 'Venue', count: 67, published: 58, draft: 9, icon: '🏟️' },
      {
        contentType: 'Artist',
        count: 124,
        published: 98,
        draft: 26,
        icon: '🎤',
      },
      {
        contentType: 'Blog Post',
        count: 62,
        published: 50,
        draft: 12,
        icon: '📝',
      },
    ],
    recentActivity: [
      {
        id: '1',
        action: 'published',
        contentType: 'Event',
        title: 'Summer Music Festival 2024',
        author: 'john@example.com',
        timestamp: '2024-01-21T14:30:00Z',
      },
      {
        id: '2',
        action: 'created',
        contentType: 'Artist',
        title: 'The Midnight Collective',
        author: 'sarah@example.com',
        timestamp: '2024-01-21T13:15:00Z',
      },
      {
        id: '3',
        action: 'updated',
        contentType: 'Venue',
        title: 'Central Park Amphitheater',
        author: 'mike@example.com',
        timestamp: '2024-01-21T11:45:00Z',
      },
      {
        id: '4',
        action: 'published',
        contentType: 'Blog Post',
        title: 'Festival Safety Guidelines',
        author: 'emma@example.com',
        timestamp: '2024-01-21T10:20:00Z',
      },
      {
        id: '5',
        action: 'created',
        contentType: 'Event',
        title: 'Jazz Night Under Stars',
        author: 'alex@example.com',
        timestamp: '2024-01-21T09:30:00Z',
      },
    ],
    topContributors: [
      {
        userId: '1',
        email: 'john@example.com',
        contentCount: 45,
        publishedCount: 38,
      },
      {
        userId: '2',
        email: 'sarah@example.com',
        contentCount: 34,
        publishedCount: 29,
      },
      {
        userId: '3',
        email: 'mike@example.com',
        contentCount: 28,
        publishedCount: 24,
      },
      {
        userId: '4',
        email: 'emma@example.com',
        contentCount: 22,
        publishedCount: 19,
      },
      {
        userId: '5',
        email: 'alex@example.com',
        contentCount: 18,
        publishedCount: 15,
      },
    ],
    engagementMetrics: {
      totalViews: 12456,
      avgViewsPerContent: 44.8,
      topContent: [
        {
          id: '1',
          title: 'Summer Music Festival 2024',
          contentType: 'Event',
          views: 1234,
          lastViewed: '2024-01-21T15:30:00Z',
        },
        {
          id: '2',
          title: 'The Midnight Collective',
          contentType: 'Artist',
          views: 987,
          lastViewed: '2024-01-21T14:20:00Z',
        },
        {
          id: '3',
          title: 'Central Park Amphitheater',
          contentType: 'Venue',
          views: 756,
          lastViewed: '2024-01-21T13:45:00Z',
        },
        {
          id: '4',
          title: 'Jazz Night Under Stars',
          contentType: 'Event',
          views: 623,
          lastViewed: '2024-01-21T12:15:00Z',
        },
        {
          id: '5',
          title: 'Rock Festival Equipment Guide',
          contentType: 'Blog Post',
          views: 567,
          lastViewed: '2024-01-21T11:30:00Z',
        },
      ],
    },
    lastUpdated: new Date().toISOString(),
  };

  const analytics = data || mockData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Content Analytics</h2>
        <div className="flex items-center gap-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            Updated: {new Date(analytics.lastUpdated).toLocaleTimeString()}
          </Badge>
        </div>
      </div>

      {/* Content Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Content"
          value={analytics.totalContent.toLocaleString()}
          icon={<FileText className="h-4 w-4" />}
          description="All content items"
          color="blue"
        />

        <MetricCard
          title="Published"
          value={analytics.publishedContent.toLocaleString()}
          icon={<Eye className="h-4 w-4" />}
          description="Live content"
          color="green"
        />

        <MetricCard
          title="Draft"
          value={analytics.draftContent.toLocaleString()}
          icon={<Edit className="h-4 w-4" />}
          description="Work in progress"
          color="yellow"
        />

        <MetricCard
          title="Pending Review"
          value={analytics.pendingReview.toLocaleString()}
          icon={<Calendar className="h-4 w-4" />}
          description="Awaiting approval"
          color="orange"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Content by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Content by Type</CardTitle>
            <CardDescription>
              Breakdown of content across different types
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.contentByType.map((type) => (
              <div key={type.contentType} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span className="font-medium">{type.contentType}</span>
                  </span>
                  <span className="font-medium">{type.count}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>{type.published} published</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span>{type.draft} draft</span>
                  </div>
                </div>
                <Progress
                  value={(type.published / type.count) * 100}
                  className="h-1"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Contributors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Contributors
            </CardTitle>
            <CardDescription>Most active content creators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topContributors.map((contributor, index) => (
                <div
                  key={contributor.userId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {contributor.email}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {contributor.publishedCount}/{contributor.contentCount}{' '}
                        published
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {contributor.contentCount}
                    </div>
                    <div className="text-muted-foreground text-xs">items</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Engagement
            </CardTitle>
            <CardDescription>Content views and engagement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {analytics.engagementMetrics.totalViews.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-sm">Total Views</div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold">
                {analytics.engagementMetrics.avgViewsPerContent}
              </div>
              <div className="text-muted-foreground text-sm">
                Avg Views per Content
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Top Viewed Content</div>
              {analytics.engagementMetrics.topContent
                .slice(0, 3)
                .map((content, index) => (
                  <div
                    key={content.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span
                        className="max-w-[120px] truncate"
                        title={content.title}
                      >
                        {content.title}
                      </span>
                    </div>
                    <span className="font-medium">{content.views}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest content creation and publishing activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center space-x-3">
                  <ActivityBadge action={activity.action} />
                  <div>
                    <div className="text-sm font-medium">{activity.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {activity.contentType} • by {activity.author}
                    </div>
                  </div>
                </div>
                <div className="text-muted-foreground text-xs">
                  {new Date(activity.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
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
  color: 'blue' | 'green' | 'yellow' | 'orange';
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
    yellow: 'text-yellow-600',
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

function ActivityBadge({ action }: { action: string }) {
  const actionConfig = {
    created: { color: 'bg-blue-100 text-blue-800', text: 'Created' },
    published: { color: 'bg-green-100 text-green-800', text: 'Published' },
    updated: { color: 'bg-yellow-100 text-yellow-800', text: 'Updated' },
    deleted: { color: 'bg-red-100 text-red-800', text: 'Deleted' },
  };

  const config =
    actionConfig[action as keyof typeof actionConfig] || actionConfig.created;

  return (
    <Badge className={`${config.color} px-2 py-1 text-xs`}>{config.text}</Badge>
  );
}
