import { cache } from 'react';

import 'server-only';

import { createServerSupabaseClient } from '@/lib/server/server';

// React Cache: https://react.dev/reference/react/cache
//This memoizes/dedupes the request
// if it is called multiple times in the same request.
export const getSession = cache(async () => {
  const supabase = await createServerSupabaseClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
});

//This memoizes/dedupes the request
// if it is called multiple times in the same request.
export const getUserInfo = cache(async () => {
  const supabase = await createServerSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('users')
      .select('full_name, email, id')
      .maybeSingle(); // MaybeSingle returns null if no data is found. single() returns an error if no data is found.

    if (error) {
      console.error('Supabase Error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
});

// Helper to ensure user exists in our users table
export const ensureUserExists = cache(async () => {
  const user = await getSession();
  if (!user) return null;

  const supabase = await createServerSupabaseClient();

  // Check if user exists in our users table
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingUser) {
    // Create user in our users table
    const { error } = await supabase.from('users').insert({
      id: user.id,
      email: user.email || '',
      full_name:
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Anonymous',
    });

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  return user;
});
