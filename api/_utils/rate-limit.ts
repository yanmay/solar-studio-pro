import { kv } from '@vercel/kv'

export async function checkRateLimit(
  ip: string,
  route: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rl:${route}:${ip}`
  try {
    const count = await kv.incr(key)
    if (count === 1) {
      await kv.expire(key, windowSeconds)
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
    }
  } catch (error) {
    console.warn('KV unavailable, allowing request:', error)
    return {
      allowed: true,
      remaining: limit,
    }
  }
}
