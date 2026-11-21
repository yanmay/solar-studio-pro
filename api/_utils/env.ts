/**
 * Environment detection and configuration utilities
 */

export const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
export const IS_TEST_ENV = !!process.env.VITEST || process.env.NODE_ENV === 'test';

/**
 * Gate for mock payments - NEVER allow in production
 */
export function isMockPaymentAllowed(): boolean {
  if (IS_PRODUCTION) return false;
  return process.env.ALLOW_MOCK_PAYMENTS === 'true';
}

/**
 * Get allowed CORS origins
 */
export function getAllowedOrigins(): string[] {
  const originsEnv = process.env.ALLOWED_ORIGINS || '';
  if (!originsEnv) return [];
  return originsEnv.split(',').map(o => o.trim()).filter(Boolean);
}
