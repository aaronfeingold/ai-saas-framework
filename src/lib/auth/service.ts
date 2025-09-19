import { cache } from 'react';

import 'server-only';

const AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'supabase';

// Unified user type
export interface UnifiedUser {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
}

export interface UnifiedSession {
  user: UnifiedUser;
}

// Supabase auth implementation
async function getSupabaseSession(): Promise<UnifiedUser | null> {
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

    return {
      id: user.id,
      email: user.email!,
      fullName: userInfo?.full_name || user.user_metadata?.full_name || '',
    };
  } catch (error) {
    console.error('Supabase auth error:', error);
    return null;
  }
}

// NextAuth.js implementation
async function getNextAuthSession(): Promise<UnifiedUser | null> {
  try {
    const { auth } = await import('@/lib/auth/nextauth/auth');
    const session = await auth();

    if (!session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email!,
      fullName: session.user.name || '',
    };
  } catch (error) {
    console.error('NextAuth session error:', error);
    return null;
  }
}

// Unified session getter
export const getSession = cache(async (): Promise<UnifiedUser | null> => {
  if (AUTH_PROVIDER === 'nextauth') {
    return await getNextAuthSession();
  } else {
    return await getSupabaseSession();
  }
});

// Unified user info getter (alias for getSession for compatibility)
export const getUserInfo = cache(async (): Promise<UnifiedUser | null> => {
  return await getSession();
});

// Auth provider information
export const getAuthProvider = () => AUTH_PROVIDER;

// Check if user is authenticated
export const isAuthenticated = cache(async (): Promise<boolean> => {
  const session = await getSession();
  return !!session;
});
