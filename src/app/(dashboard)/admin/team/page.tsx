'use client';

import { useEffect, useState } from 'react';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TeamDataWithMembers } from '@/lib/db/schema';

export default function TeamManagementPage() {
  const [team, setTeam] = useState<TeamDataWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    try {
      setLoading(true);
      const response = await fetch('/api/team');
      if (response.ok) {
        const data = await response.json();
        setTeam(data);
      } else {
        setError('Failed to load team');
      }
    } catch (error) {
      console.error('Error loading team:', error);
      setError('Failed to load team');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="py-8 text-center">Loading team...</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <div className="text-destructive">{error}</div>
        <Button onClick={loadTeam} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="py-8 text-center">
        <h2 className="mb-4 text-2xl font-semibold">No Team Found</h2>
        <p className="text-muted-foreground mb-4">
          You need to be part of a team to access this page.
        </p>
        <Button>Create Team</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground">
          Manage your team settings and members
        </p>
      </div>

      {/* Team Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Name</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team.name}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team.teamMembers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team.planName || 'Free'}</div>
            <p className="text-muted-foreground text-xs">
              {team.subscriptionStatus || 'No subscription'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage team members and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.user.fullName || 'Unknown'}</TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        member.role === 'owner' ? 'default' : 'secondary'
                      }
                    >
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {member.role !== 'owner' && (
                      <Button variant="ghost" size="sm">
                        Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Subscription Management */}
      {team.stripeCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>
              Manage your team&apos;s subscription and billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current Plan</p>
                <p className="text-muted-foreground text-sm">
                  {team.planName || 'Free Plan'}
                </p>
              </div>
              <Badge
                variant={
                  team.subscriptionStatus === 'active' ? 'default' : 'secondary'
                }
              >
                {team.subscriptionStatus || 'inactive'}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button>Manage Billing</Button>
              <Button variant="outline">View Invoices</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
