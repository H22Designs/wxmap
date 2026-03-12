import type Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      elevation_m REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      temp_c REAL,
      humidity_pct REAL,
      pressure_hpa REAL,
      wind_speed_ms REAL,
      wind_dir_deg REAL,
      precip_mm REAL,
      raw_json TEXT,
      FOREIGN KEY(station_id) REFERENCES stations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_observations_station_observed
      ON observations(station_id, observed_at);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS provider_configs (
      provider TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      interval_minutes INTEGER NOT NULL DEFAULT 5,
      endpoint TEXT,
      api_key TEXT,
      api_secret TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      dark_mode INTEGER NOT NULL DEFAULT 0,
      map_view_mode TEXT NOT NULL DEFAULT '2d' CHECK (map_view_mode IN ('2d', '3d')),
      unit_system TEXT NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
      show_radar_layer INTEGER NOT NULL DEFAULT 1,
      show_station_layer INTEGER NOT NULL DEFAULT 1,
      visible_providers_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}
