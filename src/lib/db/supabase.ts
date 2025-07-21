import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-application-name': 'ai-saas-framework' },
  },
});

// Server-side Supabase client for API routes
export const createServerSupabaseClient = () => {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
    },
  });
};

// Admin client with service role key
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Health check function
export const checkSupabaseHealth = async () => {
  try {
    const { error } = await supabase.from('profiles').select('count').limit(1);
    return {
      healthy: !error,
      message: error ? error.message : 'Connected',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      healthy: false,
      message: 'Connection failed',
      timestamp: new Date().toISOString(),
    };
  }
};
