import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../utils/simple-rate-limit';

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Read client IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    
    // Rate limit: allows 5 requests per 60 seconds (60000ms) per IP
    const success = checkRateLimit(ip, 5, 60000);

    if (!success) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }

    next();
  } catch (error) {
    // Fail-open safety fallback
    console.error('Rate limiting error:', error);
    next();
  }
};
