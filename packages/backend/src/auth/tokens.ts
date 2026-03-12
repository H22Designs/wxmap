import jwt from 'jsonwebtoken';
import type { UserRole } from '../types/models.js';

export type AccessTokenPayload = {
  sub: string;
  username: string;
  role: UserRole;
};

const fallbackSecret = 'replace-me-in-env';

function getJwtSecret(): string {
  return process.env.JWT_SECRET?.trim() || fallbackSecret;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '15m'
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded !== 'object' || decoded === null) {
      return null;
    }

    const sub = typeof decoded.sub === 'string' ? decoded.sub : '';
    const username = typeof decoded.username === 'string' ? decoded.username : '';
    const role = decoded.role;

    if (!sub || !username || (role !== 'user' && role !== 'admin')) {
      return null;
    }

    return {
      sub,
      username,
      role
    };
  } catch {
    return null;
  }
}
