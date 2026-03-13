import type Database from 'better-sqlite3';
import type { Station } from '../../types/models.js';

type DbStationRow = {
  id: string;
  provider: string;
  external_id: string;
  name: string;
  lat: number;
  lng: number;
  elevation_m: number | null;
  active: number;
  created_at: string;
};

function mapStationRow(row: DbStationRow): Station {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    elevationM: row.elevation_m,
    active: row.active === 1,
    createdAt: row.created_at
  };
}

export class StationRepository {
  constructor(private readonly db: Database.Database) {}

  listStations(args: { provider?: string; limit?: number }): Station[] {
    const params: Array<string | number> = [];
    const where: string[] = ['active = 1'];

    if (args.provider) {
      where.push('provider = ?');
      params.push(args.provider);
    }

    const limit = Math.max(1, Math.min(args.limit ?? 100, 1000));
    params.push(limit);

    const statement = this.db.prepare(
      `
      SELECT id, provider, external_id, name, lat, lng, elevation_m, active, created_at
      FROM stations
      WHERE ${where.join(' AND ')}
      ORDER BY name ASC
      LIMIT ?
      `
    );

    const rows = statement.all(...params) as DbStationRow[];
    return rows.map(mapStationRow);
  }

  getStationById(stationId: string): Station | null {
    const statement = this.db.prepare(
      `
      SELECT id, provider, external_id, name, lat, lng, elevation_m, active, created_at
      FROM stations
      WHERE id = ?
      LIMIT 1
      `
    );

    const row = statement.get(stationId) as DbStationRow | undefined;
    return row ? mapStationRow(row) : null;
  }

  getStationByProviderExternalId(provider: string, externalId: string): Station | null {
    const statement = this.db.prepare(
      `
      SELECT id, provider, external_id, name, lat, lng, elevation_m, active, created_at
      FROM stations
      WHERE provider = ?
        AND external_id = ?
      LIMIT 1
      `
    );

    const row = statement.get(provider, externalId) as DbStationRow | undefined;
    return row ? mapStationRow(row) : null;
  }

  createStation(input: {
    id: string;
    provider: string;
    externalId: string;
    name: string;
    lat: number;
    lng: number;
    elevationM: number | null;
    active?: boolean;
  }): Station {
    const insertStatement = this.db.prepare(`
      INSERT INTO stations (
        id,
        provider,
        external_id,
        name,
        lat,
        lng,
        elevation_m,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStatement.run(
      input.id,
      input.provider,
      input.externalId,
      input.name,
      input.lat,
      input.lng,
      input.elevationM,
      input.active === false ? 0 : 1
    );

    const created = this.getStationById(input.id);

    if (!created) {
      throw new Error(`Failed to create station '${input.id}'`);
    }

    return created;
  }
}
