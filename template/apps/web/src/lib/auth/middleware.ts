import { redirect } from 'next/navigation';

import { z } from 'zod';

import { getTeamForUser, getUser } from '@/lib/db/queries';
import { type SelectUser, type TeamDataWithMembers } from '@/lib/db/schema';

export type ActionState = {
  error?: string;
  success?: string;
  [key: string]: unknown; // This allows for additional properties
};

type ValidatedActionFunction<S extends z.ZodType<unknown, unknown>, T> = (
  data: z.infer<S>,
  formData: FormData
) => Promise<T>;

export function validatedAction<S extends z.ZodType<unknown, unknown>, T>(
  schema: S,
  action: ValidatedActionFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData) => {
    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      return { error: result.error.errors[0].message };
    }

    return action(result.data, formData);
  };
}

type ValidatedActionWithUserFunction<
  S extends z.ZodType<unknown, unknown>,
  T,
> = (data: z.infer<S>, formData: FormData, user: SelectUser) => Promise<T>;

export function validatedActionWithUser<
  S extends z.ZodType<unknown, unknown>,
  T,
>(schema: S, action: ValidatedActionWithUserFunction<S, T>) {
  return async (prevState: ActionState, formData: FormData) => {
    const user = await getUser();
    if (!user) {
      throw new Error('User is not authenticated');
    }

    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      return { error: result.error.errors[0].message };
    }

    return action(result.data, formData, user);
  };
}

type ActionWithTeamFunction<T> = (
  formData: FormData,
  team: TeamDataWithMembers
) => Promise<T>;

export function withTeam<T>(action: ActionWithTeamFunction<T>) {
  return async (formData: FormData): Promise<T> => {
    const user = await getUser();
    if (!user) {
      redirect('/signin');
    }

    const team = await getTeamForUser();
    if (!team) {
      throw new Error('Team not found');
    }

    return action(formData, team);
  };
}

// Additional helper for actions that need both user and team context
type ActionWithUserAndTeamFunction<T> = (
  formData: FormData,
  user: SelectUser,
  team: TeamDataWithMembers
) => Promise<T>;

export function withUserAndTeam<T>(action: ActionWithUserAndTeamFunction<T>) {
  return async (formData: FormData): Promise<T> => {
    const user = await getUser();
    if (!user) {
      redirect('/signin');
    }

    const team = await getTeamForUser();
    if (!team) {
      throw new Error('Team not found');
    }

    return action(formData, user, team);
  };
}

// Helper for checking if user has permission for team actions
export async function requireTeamPermission(
  userId: string,
  teamId: string,
  requiredRole: 'owner' | 'admin' | 'member' = 'member'
): Promise<boolean> {
  const team = await getTeamForUser();
  if (!team || team.id !== teamId) {
    return false;
  }

  const userMembership = team.teamMembers.find(
    (member) => member.userId === userId
  );
  if (!userMembership) {
    return false;
  }

  // Role hierarchy: owner > admin > member
  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  const userRoleLevel =
    roleHierarchy[userMembership.role as keyof typeof roleHierarchy] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole];

  return userRoleLevel >= requiredRoleLevel;
}
