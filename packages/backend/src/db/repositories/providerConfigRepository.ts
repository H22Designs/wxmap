import type Database from 'better-sqlite3';
import type { ProviderConfig } from '../../types/models.js';

type DbProviderConfigRow = {
  provider: string;
  enabled: number;
  interval_minutes: number;
  endpoint: string | null;
  api_key: string | null;
  api_secret: string | null;
  updated_at: string;
};

function mapProviderConfigRow(row: DbProviderConfigRow): ProviderConfig {
  return {
    provider: row.provider,
    enabled: row.enabled === 1,
    intervalMinutes: row.interval_minutes,
    endpoint: row.endpoint,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    updatedAt: row.updated_at
  };
}

export class ProviderConfigRepository {
  constructor(private readonly db: Database.Database) {}

  listConfigs(): ProviderConfig[] {
    const statement = this.db.prepare(
      `
      SELECT provider, enabled, interval_minutes, endpoint, api_key, api_secret, updated_at
      FROM provider_configs
      ORDER BY provider ASC
      `
    );

    const rows = statement.all() as DbProviderConfigRow[];
    return rows.map(mapProviderConfigRow);
  }

  getConfig(provider: string): ProviderConfig | null {
    const statement = this.db.prepare(
      `
      SELECT provider, enabled, interval_minutes, endpoint, api_key, api_secret, updated_at
      FROM provider_configs
      WHERE provider = ?
      LIMIT 1
      `
    );

    const row = statement.get(provider) as DbProviderConfigRow | undefined;
    return row ? mapProviderConfigRow(row) : null;
  }

  upsertConfig(input: {
    provider: string;
    enabled?: boolean;
    intervalMinutes?: number;
    endpoint?: string | null;
    apiKey?: string | null;
    apiSecret?: string | null;
  }): ProviderConfig {
    const existing = this.getConfig(input.provider);

    const enabled = input.enabled ?? existing?.enabled ?? false;
    const intervalMinutes = Math.max(
      1,
      Math.floor(input.intervalMinutes ?? existing?.intervalMinutes ?? 5)
    );
    const endpoint = input.endpoint ?? existing?.endpoint ?? null;
    const apiKey = input.apiKey ?? existing?.apiKey ?? null;
    const apiSecret = input.apiSecret ?? existing?.apiSecret ?? null;

    const statement = this.db.prepare(`
      INSERT INTO provider_configs (
        provider,
        enabled,
        interval_minutes,
        endpoint,
        api_key,
        api_secret,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(provider) DO UPDATE SET
        enabled = excluded.enabled,
        interval_minutes = excluded.interval_minutes,
        endpoint = excluded.endpoint,
        api_key = excluded.api_key,
        api_secret = excluded.api_secret,
        updated_at = excluded.updated_at
    `);

    statement.run(
      input.provider,
      enabled ? 1 : 0,
      intervalMinutes,
      endpoint,
      apiKey,
      apiSecret
    );

    const updated = this.getConfig(input.provider);

    if (!updated) {
      throw new Error(`Failed to load provider config for '${input.provider}' after update`);
    }

    return updated;
  }
}
