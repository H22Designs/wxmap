import type Database from 'better-sqlite3';
import type { Setting } from '../../types/models.js';

type DbSettingRow = {
  key: string;
  value: string;
  updated_at: string;
};

function mapSettingRow(row: DbSettingRow): Setting {
  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at
  };
}

export class SettingsRepository {
  constructor(private readonly db: Database.Database) {}

  listSettings(): Setting[] {
    const statement = this.db.prepare(
      'SELECT key, value, updated_at FROM settings ORDER BY key ASC'
    );
    const rows = statement.all() as DbSettingRow[];
    return rows.map(mapSettingRow);
  }

  setSetting(key: string, value: string): Setting {
    const upsert = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    upsert.run(key, value);

    const getByKey = this.db.prepare(
      'SELECT key, value, updated_at FROM settings WHERE key = ? LIMIT 1'
    );
    const row = getByKey.get(key) as DbSettingRow | undefined;

    if (!row) {
      throw new Error(`Failed to fetch updated setting for key '${key}'`);
    }

    return mapSettingRow(row);
  }
}
