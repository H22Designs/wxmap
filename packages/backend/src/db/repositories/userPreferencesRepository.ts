import type Database from 'better-sqlite3';
import type { MapViewMode, UnitSystem, UserPreferences } from '../../types/models.js';

type DbUserPreferencesRow = {
  user_id: string;
  dark_mode: number;
  map_view_mode: MapViewMode;
  unit_system: UnitSystem;
  show_radar_layer: number;
  show_station_layer: number;
  visible_providers_json: string;
  updated_at: string;
};

function parseVisibleProviders(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function mapUserPreferencesRow(row: DbUserPreferencesRow): UserPreferences {
  return {
    userId: row.user_id,
    darkMode: row.dark_mode === 1,
    mapViewMode: row.map_view_mode,
    unitSystem: row.unit_system,
    showRadarLayer: row.show_radar_layer === 1,
    showStationLayer: row.show_station_layer === 1,
    visibleProviders: parseVisibleProviders(row.visible_providers_json),
    updatedAt: row.updated_at
  };
}

export class UserPreferencesRepository {
  constructor(private readonly db: Database.Database) {}

  getOrCreatePreferences(userId: string): UserPreferences {
    const getStatement = this.db.prepare(
      `
      SELECT user_id, dark_mode, map_view_mode, unit_system, show_radar_layer,
             show_station_layer, visible_providers_json, updated_at
      FROM user_preferences
      WHERE user_id = ?
      LIMIT 1
      `
    );

    const existing = getStatement.get(userId) as DbUserPreferencesRow | undefined;

    if (existing) {
      return mapUserPreferencesRow(existing);
    }

    const insertStatement = this.db.prepare(`
      INSERT INTO user_preferences (
        user_id,
        dark_mode,
        map_view_mode,
        unit_system,
        show_radar_layer,
        show_station_layer,
        visible_providers_json,
        updated_at
      )
      VALUES (?, 0, '2d', 'metric', 1, 1, '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `);

    insertStatement.run(userId);

    const created = getStatement.get(userId) as DbUserPreferencesRow | undefined;

    if (!created) {
      throw new Error(`Failed to create user preferences for user '${userId}'`);
    }

    return mapUserPreferencesRow(created);
  }

  upsertPreferences(input: {
    userId: string;
    darkMode?: boolean;
    mapViewMode?: MapViewMode;
    unitSystem?: UnitSystem;
    showRadarLayer?: boolean;
    showStationLayer?: boolean;
    visibleProviders?: string[];
  }): UserPreferences {
    const existing = this.getOrCreatePreferences(input.userId);

    const next: UserPreferences = {
      userId: input.userId,
      darkMode: input.darkMode ?? existing.darkMode,
      mapViewMode: input.mapViewMode ?? existing.mapViewMode,
      unitSystem: input.unitSystem ?? existing.unitSystem,
      showRadarLayer: input.showRadarLayer ?? existing.showRadarLayer,
      showStationLayer: input.showStationLayer ?? existing.showStationLayer,
      visibleProviders: input.visibleProviders ?? existing.visibleProviders,
      updatedAt: existing.updatedAt
    };

    const upsertStatement = this.db.prepare(`
      INSERT INTO user_preferences (
        user_id,
        dark_mode,
        map_view_mode,
        unit_system,
        show_radar_layer,
        show_station_layer,
        visible_providers_json,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(user_id) DO UPDATE SET
        dark_mode = excluded.dark_mode,
        map_view_mode = excluded.map_view_mode,
        unit_system = excluded.unit_system,
        show_radar_layer = excluded.show_radar_layer,
        show_station_layer = excluded.show_station_layer,
        visible_providers_json = excluded.visible_providers_json,
        updated_at = excluded.updated_at
    `);

    upsertStatement.run(
      next.userId,
      next.darkMode ? 1 : 0,
      next.mapViewMode,
      next.unitSystem,
      next.showRadarLayer ? 1 : 0,
      next.showStationLayer ? 1 : 0,
      JSON.stringify(next.visibleProviders)
    );

    return this.getOrCreatePreferences(input.userId);
  }
}
