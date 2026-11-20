import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (redisUrl && redisToken) {
  try {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (err) {
    console.error('Failed to initialize Upstash Redis:', err);
  }
} else {
  console.warn('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Rate limiting is disabled.');
}

export async function checkRateLimit(
  ip: string,
  route: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (!redis) {
    return {
      allowed: true,
      remaining: limit,
    };
  }

  const key = `rl:${route}:${ip}`;
  try {
    const rateLimiter = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    });

    const { success, remaining } = await rateLimiter.limit(key);
    return {
      allowed: success,
      remaining: remaining,
    };
  } catch (error) {
    console.warn('Upstash rate limiting failed, allowing request:', error);
    return {
      allowed: true,
      remaining: limit,
    };
  }
}
