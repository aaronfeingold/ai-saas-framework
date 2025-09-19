'use client';

import { useEffect, useState } from 'react';

import {
  Activity,
  Clock,
  Database,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
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

interface SystemMetrics {
  uptime: number;
  responseTime: number;
  databaseConnections: number;
  redisConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  requestsPerMinute: number;
  activeUsers: number;
  lastUpdated: string;
}

export function SystemMetricsDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadMetrics() {
    try {
      const response = await fetch('/api/admin/metrics/system');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error loading system metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="py-8 text-center">Loading system metrics...</div>;
  }

  // Mock data for demonstration
  const mockMetrics: SystemMetrics = {
    uptime: 99.97,
    responseTime: 145,
    databaseConnections: 23,
    redisConnections: 8,
    memoryUsage: 67.5,
    cpuUsage: 34.2,
    errorRate: 0.12,
    requestsPerMinute: 847,
    activeUsers: 156,
    lastUpdated: new Date().toISOString(),
  };

  const data = metrics || mockMetrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">System Metrics</h2>
        <Badge variant="outline" className="text-xs">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="System Uptime"
          value={`${data.uptime}%`}
          icon={<Activity className="h-4 w-4" />}
          trend={
            data.uptime >= 99.9
              ? 'up'
              : data.uptime >= 99.5
                ? 'neutral'
                : 'down'
          }
          description="Last 30 days"
        />

        <MetricCard
          title="Avg Response Time"
          value={`${data.responseTime}ms`}
          icon={<Clock className="h-4 w-4" />}
          trend={
            data.responseTime <= 200
              ? 'up'
              : data.responseTime <= 500
                ? 'neutral'
                : 'down'
          }
          description="API endpoints"
        />

        <MetricCard
          title="Active Users"
          value={data.activeUsers.toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          trend="up"
          description="Currently online"
        />

        <MetricCard
          title="Requests/Min"
          value={data.requestsPerMinute.toLocaleString()}
          icon={<Zap className="h-4 w-4" />}
          trend="up"
          description="Current load"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Resource Usage
            </CardTitle>
            <CardDescription>
              Current system resource utilization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Memory Usage</span>
                <span>{data.memoryUsage}%</span>
              </div>
              <Progress
                value={data.memoryUsage}
                className={`h-2 ${data.memoryUsage > 80 ? 'bg-red-100' : ''}`}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>CPU Usage</span>
                <span>{data.cpuUsage}%</span>
              </div>
              <Progress
                value={data.cpuUsage}
                className={`h-2 ${data.cpuUsage > 70 ? 'bg-orange-100' : ''}`}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Database Connections</span>
                <span>{data.databaseConnections}/100</span>
              </div>
              <Progress
                value={(data.databaseConnections / 100) * 100}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Redis Connections</span>
                <span>{data.redisConnections}/50</span>
              </div>
              <Progress
                value={(data.redisConnections / 50) * 100}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Overall system health indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthIndicator
              label="API Endpoints"
              status={
                data.responseTime <= 200
                  ? 'healthy'
                  : data.responseTime <= 500
                    ? 'warning'
                    : 'critical'
              }
              value={`${data.responseTime}ms avg`}
            />

            <HealthIndicator
              label="Database"
              status={data.databaseConnections <= 80 ? 'healthy' : 'warning'}
              value={`${data.databaseConnections} active connections`}
            />

            <HealthIndicator
              label="Cache Layer"
              status="healthy"
              value={`${data.redisConnections} connections`}
            />

            <HealthIndicator
              label="Error Rate"
              status={
                data.errorRate <= 0.5
                  ? 'healthy'
                  : data.errorRate <= 2
                    ? 'warning'
                    : 'critical'
              }
              value={`${data.errorRate}% errors`}
            />

            <HealthIndicator
              label="Memory"
              status={
                data.memoryUsage <= 70
                  ? 'healthy'
                  : data.memoryUsage <= 85
                    ? 'warning'
                    : 'critical'
              }
              value={`${data.memoryUsage}% used`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  description: string;
}

function MetricCard({
  title,
  value,
  icon,
  trend,
  description,
}: MetricCardProps) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
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
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}

interface HealthIndicatorProps {
  label: string;
  status: 'healthy' | 'warning' | 'critical';
  value: string;
}

function HealthIndicator({ label, status, value }: HealthIndicatorProps) {
  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-muted-foreground text-sm">{value}</span>
    </div>
  );
}
