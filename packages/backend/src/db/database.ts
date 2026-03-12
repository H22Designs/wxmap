import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { applySchema } from './schema.js';
import { seedDatabase } from './seed.js';

let dbInstance: Database.Database | null = null;

function resolveDatabasePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(process.cwd(), inputPath);
}

function ensureDirectoryExists(filePath: string): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const configuredPath = process.env.DATABASE_PATH ?? './data/wxmap.db';
  const dbPath = resolveDatabasePath(configuredPath);
  ensureDirectoryExists(dbPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  applySchema(db);
  seedDatabase(db);

  dbInstance = db;
  return db;
}
