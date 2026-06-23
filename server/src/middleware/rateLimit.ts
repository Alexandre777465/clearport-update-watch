import { Request, Response, NextFunction } from 'express';

/**
 * Minimal in-memory fixed-window rate limiter (no external dependency).
 * Sufficient for a small private pilot on a single Railway instance.
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Periodic cleanup of expired buckets.
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  }, opts.windowMs).unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const k = `${opts.key ?? 'rl'}:${ip}`;
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || entry.resetAt < now) {
      hits.set(k, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    if (entry.count >= opts.max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    entry.count++;
    next();
  };
}
