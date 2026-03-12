import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { signAccessToken } from '../auth/tokens.js';

type UserRepositoryLike = {
  findByUsername: (username: string) => {
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin';
    passwordHash: string;
  } | null;
  findByEmail: (email: string) => { id: string } | null;
  createUser: (args: {
    username: string;
    email: string;
    passwordHash: string;
    role?: 'user' | 'admin';
  }) => {
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin';
  };
};

type LoginPayload = {
  username?: unknown;
  password?: unknown;
};

type RegisterPayload = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

type AuthRouterDeps = {
  userRepository: UserRepositoryLike;
};

function sanitize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function authRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const payload = req.body as RegisterPayload;
    const username = sanitize(payload.username);
    const email = sanitize(payload.email).toLowerCase();
    const password = sanitize(payload.password);

    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email, and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'password must be at least 8 characters' });
      return;
    }

    if (deps.userRepository.findByUsername(username)) {
      res.status(409).json({ error: 'username already exists' });
      return;
    }

    if (deps.userRepository.findByEmail(email)) {
      res.status(409).json({ error: 'email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = deps.userRepository.createUser({
      username,
      email,
      passwordHash
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  });

  router.post('/login', async (req, res) => {
    const payload = req.body as LoginPayload;
    const username = sanitize(payload.username);
    const password = sanitize(payload.password);

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const user = deps.userRepository.findByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role
    });

    res.status(200).json({
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds: 900,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  });

  return router;
}
