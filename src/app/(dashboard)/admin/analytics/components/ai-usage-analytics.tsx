'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Bot,
  Brain,
  Clock,
  DollarSign,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

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

interface AIUsageData {
  totalConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  totalCost: number;
  averageResponseTime: number;
  costByModel: Array<{
    model: string;
    cost: number;
    usage: number;
    percentage: number;
  }>;
  usageByTimeframe: Array<{
    date: string;
    conversations: number;
    tokens: number;
    cost: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    conversations: number;
    cost: number;
  }>;
  lastUpdated: string;
}

export function AIUsageAnalytics() {
  const [data, setData] = useState<AIUsageData | null>(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [loading, setLoading] = useState(true);

  const loadUsageData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/metrics/ai-usage?timeframe=${timeframe}`
      );
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error('Error loading AI usage data:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadUsageData();
  }, [loadUsageData]);

  if (loading) {
    return (
      <div className="py-8 text-center">Loading AI usage analytics...</div>
    );
  }

  // Mock data for demonstration
  const mockData: AIUsageData = {
    totalConversations: 1247,
    totalMessages: 8932,
    totalTokensUsed: 2456789,
    totalCost: 147.83,
    averageResponseTime: 1.2,
    costByModel: [
      {
        model: 'Claude 3.5 Sonnet',
        cost: 89.45,
        usage: 1456789,
        percentage: 60.5,
      },
      { model: 'Claude 3 Haiku', cost: 34.21, usage: 567890, percentage: 23.1 },
      { model: 'GPT-4', cost: 24.17, usage: 432110, percentage: 16.4 },
    ],
    usageByTimeframe: [
      { date: '2024-01-15', conversations: 178, tokens: 345678, cost: 20.85 },
      { date: '2024-01-16', conversations: 203, tokens: 389012, cost: 23.44 },
      { date: '2024-01-17', conversations: 156, tokens: 298765, cost: 17.98 },
      { date: '2024-01-18', conversations: 189, tokens: 367890, cost: 22.15 },
      { date: '2024-01-19', conversations: 234, tokens: 445123, cost: 26.78 },
      { date: '2024-01-20', conversations: 167, tokens: 321456, cost: 19.34 },
      { date: '2024-01-21', conversations: 120, tokens: 289865, cost: 17.29 },
    ],
    topUsers: [
      {
        userId: '1',
        email: 'john@example.com',
        conversations: 89,
        cost: 12.45,
      },
      {
        userId: '2',
        email: 'sarah@example.com',
        conversations: 67,
        cost: 9.87,
      },
      { userId: '3', email: 'mike@example.com', conversations: 54, cost: 7.23 },
      { userId: '4', email: 'emma@example.com', conversations: 43, cost: 6.12 },
      { userId: '5', email: 'alex@example.com', conversations: 38, cost: 5.34 },
    ],
    lastUpdated: new Date().toISOString(),
  };

  const usageData = data || mockData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">AI Usage Analytics</h2>
        <div className="flex items-center gap-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            Updated: {new Date(usageData.lastUpdated).toLocaleTimeString()}
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Conversations"
          value={usageData.totalConversations.toLocaleString()}
          icon={<MessageSquare className="h-4 w-4" />}
          description={`${timeframe === '1d' ? 'Today' : `Last ${timeframe.replace('d', ' days')}`}`}
          trend="up"
        />

        <MetricCard
          title="Total Messages"
          value={usageData.totalMessages.toLocaleString()}
          icon={<Brain className="h-4 w-4" />}
          description="AI responses generated"
          trend="up"
        />

        <MetricCard
          title="Total Cost"
          value={`$${usageData.totalCost.toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4" />}
          description="API usage costs"
          trend="neutral"
        />

        <MetricCard
          title="Avg Response Time"
          value={`${usageData.averageResponseTime}s`}
          icon={<Clock className="h-4 w-4" />}
          description="Time to first token"
          trend="up"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Cost by Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Cost by AI Model
            </CardTitle>
            <CardDescription>
              Breakdown of costs by AI model usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageData.costByModel.map((model) => (
              <div key={model.model} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{model.model}</span>
                  <div className="text-right">
                    <div className="font-medium">${model.cost.toFixed(2)}</div>
                    <div className="text-muted-foreground text-xs">
                      {model.usage.toLocaleString()} tokens
                    </div>
                  </div>
                </div>
                <Progress value={model.percentage} className="h-2" />
                <div className="text-muted-foreground text-right text-xs">
                  {model.percentage}% of total cost
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle>Top AI Users</CardTitle>
            <CardDescription>
              Users with highest AI usage and costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usageData.topUsers.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{user.email}</div>
                      <div className="text-muted-foreground text-xs">
                        {user.conversations} conversations
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      ${user.cost.toFixed(2)}
                    </div>
                    <div className="text-muted-foreground text-xs">cost</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Timeline</CardTitle>
          <CardDescription>
            Daily AI usage and cost trends over the selected timeframe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageData.usageByTimeframe.map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center space-x-4">
                  <div className="min-w-[80px] text-sm font-medium">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex items-center space-x-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Conversations:{' '}
                      </span>
                      <span className="font-medium">{day.conversations}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tokens: </span>
                      <span className="font-medium">
                        {day.tokens.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium">
                  ${day.cost.toFixed(2)}
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
  trend: 'up' | 'down' | 'neutral';
}

function MetricCard({
  title,
  value,
  icon,
  description,
  trend,
}: MetricCardProps) {
  const trendColor =
    trend === 'up'
      ? 'text-green-600'
      : trend === 'down'
        ? 'text-red-600'
        : 'text-gray-600';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <div className="text-2xl font-bold">{value}</div>
          <TrendingUp className={`h-4 w-4 ${trendColor}`} />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
