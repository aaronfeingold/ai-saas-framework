import { NextResponse } from 'next/server';

import { checkRedisHealth } from '@/lib/db/cache';
import { checkMongoHealth } from '@/lib/db/mongodb';
import { checkSupabaseHealth } from '@/lib/db/supabase';
import { checkVectorHealth } from '@/lib/db/vector';

export async function GET() {
  try {
    // Run all health checks in parallel
    const [supabaseHealth, mongoHealth, vectorHealth, redisHealth] =
      await Promise.allSettled([
        checkSupabaseHealth(),
        checkMongoHealth(),
        checkVectorHealth(),
        checkRedisHealth(),
      ]);

    const health = {
      supabase:
        supabaseHealth.status === 'fulfilled'
          ? supabaseHealth.value
          : { healthy: false, message: 'Health check failed' },
      mongodb:
        mongoHealth.status === 'fulfilled'
          ? mongoHealth.value
          : { healthy: false, message: 'Health check failed' },
      vector:
        vectorHealth.status === 'fulfilled'
          ? vectorHealth.value
          : { healthy: false, message: 'Health check failed' },
      redis:
        redisHealth.status === 'fulfilled'
          ? redisHealth.value
          : { healthy: false, message: 'Health check failed' },
      timestamp: new Date().toISOString(),
    };

    // Check if all systems are healthy
    const allHealthy = Object.entries(health).every(([key, status]) => {
      if (key === 'timestamp') return true;
      return typeof status === 'object' && status.healthy;
    });

    return NextResponse.json(health, {
      status: allHealthy ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
