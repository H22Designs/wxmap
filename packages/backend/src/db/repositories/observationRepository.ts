import type Database from 'better-sqlite3';
import type { Observation } from '../../types/models.js';

type DbObservationRow = {
  id: string;
  station_id: string;
  observed_at: string;
  temp_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_ms: number | null;
  wind_dir_deg: number | null;
  precip_mm: number | null;
  raw_json: string | null;
};

function mapObservationRow(row: DbObservationRow): Observation {
  return {
    id: row.id,
    stationId: row.station_id,
    observedAt: row.observed_at,
    tempC: row.temp_c,
    humidityPct: row.humidity_pct,
    pressureHpa: row.pressure_hpa,
    windSpeedMs: row.wind_speed_ms,
    windDirDeg: row.wind_dir_deg,
    precipMm: row.precip_mm,
    rawJson: row.raw_json
  };
}

export class ObservationRepository {
  constructor(private readonly db: Database.Database) {}

  listForStation(stationId: string, limit = 120): Observation[] {
    const safeLimit = Math.max(1, Math.min(limit, 500));

    const statement = this.db.prepare(
      `
      SELECT id, station_id, observed_at, temp_c, humidity_pct, pressure_hpa,
             wind_speed_ms, wind_dir_deg, precip_mm, raw_json
      FROM observations
      WHERE station_id = ?
      ORDER BY observed_at DESC
      LIMIT ?
      `
    );

    const rows = statement.all(stationId, safeLimit) as DbObservationRow[];
    return rows.map(mapObservationRow);
  }

  listLatestForAllStations(limit = 1000): Observation[] {
    const safeLimit = Math.max(1, Math.min(limit, 5000));
    const statement = this.db.prepare(
      `
      SELECT o.id, o.station_id, o.observed_at, o.temp_c, o.humidity_pct, o.pressure_hpa,
             o.wind_speed_ms, o.wind_dir_deg, o.precip_mm, o.raw_json
      FROM observations o
      INNER JOIN (
        SELECT station_id, MAX(observed_at) AS max_observed_at
        FROM observations
        GROUP BY station_id
      ) latest
      ON latest.station_id = o.station_id AND latest.max_observed_at = o.observed_at
      ORDER BY o.observed_at DESC
      LIMIT ?
      `
    );

    const rows = statement.all(safeLimit) as DbObservationRow[];
    return rows.map(mapObservationRow);
  }
}
