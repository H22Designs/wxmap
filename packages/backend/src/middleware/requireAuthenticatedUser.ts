import type { NextFunction, Request, Response } from 'express';
import type { AccessTokenPayload } from '../auth/tokens.js';
import { verifyAccessToken } from '../auth/tokens.js';

export function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  res.locals.auth = payload satisfies AccessTokenPayload;
  next();
}
