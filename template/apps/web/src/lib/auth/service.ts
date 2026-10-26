import { cache } from 'react';

import 'server-only';

import type { UserType } from '@/lib/ai/entitlements';

export type { UserType };

// Supabase is the only auth provider; these types are what the rest of the app sees.
export interface UnifiedUser {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  image?: string;
  type: UserType;
}

export interface UnifiedSession {
  user: UnifiedUser;
}

export const getSession = cache(async (): Promise<UnifiedUser | null> => {
  try {
    const { createServerSupabaseClient } = await import('@/lib/server/server');
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Get user info from database
    const { data: userInfo } = await supabase
      .from('users')
      .select('full_name, email, id')
      .eq('id', user.id)
      .single();

    const fullName =
      userInfo?.full_name || user.user_metadata?.full_name || '';
    return {
      id: user.id,
      email: user.email!,
      fullName,
      name: fullName,
      image: user.user_metadata?.avatar_url,
      type: 'free',
    };
  } catch (error) {
    console.error('Supabase auth error:', error);
    return null;
  }
});

// The session in the `{ user }` shape route handlers and pages expect.
export const auth = cache(async (): Promise<UnifiedSession | null> => {
  const user = await getSession();
  return user ? { user } : null;
});

// Unified user info getter (alias for getSession for compatibility)
export const getUserInfo = cache(async (): Promise<UnifiedUser | null> => {
  return await getSession();
});

// Check if user is authenticated
export const isAuthenticated = cache(async (): Promise<boolean> => {
  const session = await getSession();
  return !!session;
});
