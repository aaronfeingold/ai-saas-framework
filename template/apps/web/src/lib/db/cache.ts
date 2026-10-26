import { createHash } from 'crypto';
import Redis from 'ioredis';

// Redis caching layer configuration
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Cache user data with 5-minute TTL
export const getCachedUser = async (userId: string) => {
  try {
    const cached = await redis.get(`user:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

export const setCachedUser = async (
  userId: string,
  userData: Record<string, unknown>,
  ttl: number = 300
) => {
  try {
    await redis.setex(`user:${userId}`, ttl, JSON.stringify(userData));
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

// Cache vector search results with 30-minute TTL
export const getCachedSimilarDocuments = async (
  query: string,
  limit: number,
  userId?: string
) => {
  try {
    const cacheKey = `vector:${createHash('md5')
      .update(`${query}:${limit}:${userId || 'global'}`)
      .digest('hex')}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

export const setCachedSimilarDocuments = async (
  query: string,
  limit: number,
  results: Record<string, unknown>[],
  userId?: string,
  ttl: number = 1800
) => {
  try {
    const cacheKey = `vector:${createHash('md5')
      .update(`${query}:${limit}:${userId || 'global'}`)
      .digest('hex')}`;
    await redis.setex(cacheKey, ttl, JSON.stringify(results));
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

// Cache content with flexible TTL
export const getCachedContent = async (key: string) => {
  try {
    const cached = await redis.get(`content:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

export const setCachedContent = async (
  key: string,
  content: unknown,
  ttl: number = 600
) => {
  try {
    await redis.setex(`content:${key}`, ttl, JSON.stringify(content));
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

// Cache session data
export const getCachedSession = async (sessionId: string) => {
  try {
    const cached = await redis.get(`session:${sessionId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

export const setCachedSession = async (
  sessionId: string,
  sessionData: unknown,
  ttl: number = 3600
) => {
  try {
    await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(sessionData));
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

// Clear cache patterns
export const clearUserCache = async (userId: string) => {
  try {
    const keys = await redis.keys(`user:${userId}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis clear error:', error);
  }
};

export const clearContentCache = async (pattern: string) => {
  try {
    const keys = await redis.keys(`content:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis clear error:', error);
  }
};

// Health check function
export const checkRedisHealth = async () => {
  try {
    await redis.ping();
    return {
      healthy: true,
      message: 'Connected',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: new Date().toISOString(),
    };
  }
};

export default redis;
