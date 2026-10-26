import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import type { Env } from '../config/env.js';

/** The user id a bearer token proves, or null when it proves nothing. */
export type UserVerifier = (token: string) => Promise<string | null>;

/**
 * Checks Supabase access tokens: signed by the project, issued by its auth server, meant for
 * a signed-in user. Uses the project's signing keys, or the legacy shared secret when set.
 */
export function createSupabaseVerifier(env: Env): UserVerifier {
  if (!env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required to verify users');
  }
  const issuer = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
  const key: Uint8Array | JWTVerifyGetKey = env.SUPABASE_JWT_SECRET
    ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
    : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, key as JWTVerifyGetKey, {
        issuer,
        audience: 'authenticated',
      });
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  };
}
