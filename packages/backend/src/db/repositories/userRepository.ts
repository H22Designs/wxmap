import type Database from 'better-sqlite3';
import crypto from 'node:crypto';
import type { User, UserRole } from '../../types/models.js';

type DbUserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
};

function mapUserRow(row: DbUserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at
  };
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  findByUsername(username: string): User | null {
    const statement = this.db.prepare(
      `
      SELECT id, username, email, password_hash, role, created_at
      FROM users
      WHERE username = ?
      LIMIT 1
      `
    );

    const row = statement.get(username) as DbUserRow | undefined;
    return row ? mapUserRow(row) : null;
  }

  findByEmail(email: string): User | null {
    const statement = this.db.prepare(
      `
      SELECT id, username, email, password_hash, role, created_at
      FROM users
      WHERE email = ?
      LIMIT 1
      `
    );

    const row = statement.get(email) as DbUserRow | undefined;
    return row ? mapUserRow(row) : null;
  }

  createUser(args: {
    username: string;
    email: string;
    passwordHash: string;
    role?: UserRole;
  }): User {
    const role = args.role ?? 'user';
    const id = crypto.randomUUID();

    const insertStatement = this.db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertStatement.run(id, args.username, args.email, args.passwordHash, role);

    const created = this.findByUsername(args.username);
    if (!created) {
      throw new Error('Failed to load created user');
    }

    return created;
  }
}
