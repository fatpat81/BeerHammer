// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — JWT Authentication Middleware
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Middleware that validates JWT bearer tokens from the Authorization header.
 * Attaches userId and userEmail to the request on success.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header.' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      email?: string;
      iat: number;
      exp: number;
    };

    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'JWT verification failed.' },
    });
  }
}

/**
 * Optional auth — attaches user info if token present, but doesn't block.
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
        sub: string;
        email?: string;
      };
      req.userId = decoded.sub;
      req.userEmail = decoded.email;
    } catch {
      // Token invalid — continue without auth
    }
  }
  next();
}
