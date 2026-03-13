import type Database from 'better-sqlite3';
import type { HistoryChartMode, MapViewMode, UnitSystem, UserPreferences, WeatherVisualTone } from '../../types/models.js';

type DbUserPreferencesRow = {
  user_id: string;
  dark_mode: number;
  map_view_mode: MapViewMode;
  unit_system: UnitSystem;
  show_radar_layer: number;
  show_station_layer: number;
  weather_visual_tone: WeatherVisualTone;
  show_weather_animations: number;
  show_mini_charts: number;
  history_chart_mode: HistoryChartMode;
  visible_providers_json: string;
  active_workspace: 'dashboard' | 'explore' | 'admin';
  surface_style: 'glass' | 'elevated' | 'neo';
  dashboard_card_order_json: string;
  hidden_dashboard_cards_json: string;
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

function parseStringArray(raw: string): string[] {
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
    weatherVisualTone: row.weather_visual_tone,
    showWeatherAnimations: row.show_weather_animations === 1,
    showMiniCharts: row.show_mini_charts === 1,
    historyChartMode: row.history_chart_mode,
    visibleProviders: parseVisibleProviders(row.visible_providers_json),
    activeWorkspace: row.active_workspace,
    surfaceStyle: row.surface_style,
    dashboardCardOrder: parseStringArray(row.dashboard_card_order_json),
    hiddenDashboardCards: parseStringArray(row.hidden_dashboard_cards_json),
    updatedAt: row.updated_at
  };
}

export class UserPreferencesRepository {
  constructor(private readonly db: Database.Database) {}

  getOrCreatePreferences(userId: string): UserPreferences {
    const getStatement = this.db.prepare(
      `
      SELECT user_id, dark_mode, map_view_mode, unit_system, show_radar_layer,
              show_station_layer, weather_visual_tone, show_weather_animations,
              show_mini_charts, history_chart_mode, visible_providers_json, active_workspace,
              surface_style, dashboard_card_order_json, hidden_dashboard_cards_json, updated_at
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
        weather_visual_tone,
        show_weather_animations,
        show_mini_charts,
        history_chart_mode,
        visible_providers_json,
        active_workspace,
        surface_style,
        dashboard_card_order_json,
        hidden_dashboard_cards_json,
        updated_at
      )
      VALUES (
        ?,
        0,
        '2d',
        'imperial',
        1,
        1,
        'balanced',
        1,
        1,
        'line',
        '[]',
        'dashboard',
        'glass',
        '["map-controls","experience","map","history"]',
        '[]',
        strftime('%Y-%m-%dT%H:%M:%fZ','now')
      )
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
    weatherVisualTone?: WeatherVisualTone;
    showWeatherAnimations?: boolean;
    showMiniCharts?: boolean;
    historyChartMode?: HistoryChartMode;
    visibleProviders?: string[];
    activeWorkspace?: 'dashboard' | 'explore' | 'admin';
    surfaceStyle?: 'glass' | 'elevated' | 'neo';
    dashboardCardOrder?: string[];
    hiddenDashboardCards?: string[];
  }): UserPreferences {
    const existing = this.getOrCreatePreferences(input.userId);

    const next: UserPreferences = {
      userId: input.userId,
      darkMode: input.darkMode ?? existing.darkMode,
      mapViewMode: input.mapViewMode ?? existing.mapViewMode,
      unitSystem: input.unitSystem ?? existing.unitSystem,
      showRadarLayer: input.showRadarLayer ?? existing.showRadarLayer,
      showStationLayer: input.showStationLayer ?? existing.showStationLayer,
      weatherVisualTone: input.weatherVisualTone ?? existing.weatherVisualTone,
      showWeatherAnimations: input.showWeatherAnimations ?? existing.showWeatherAnimations,
      showMiniCharts: input.showMiniCharts ?? existing.showMiniCharts,
      historyChartMode: input.historyChartMode ?? existing.historyChartMode,
      visibleProviders: input.visibleProviders ?? existing.visibleProviders,
      activeWorkspace: input.activeWorkspace ?? existing.activeWorkspace,
      surfaceStyle: input.surfaceStyle ?? existing.surfaceStyle,
      dashboardCardOrder: input.dashboardCardOrder ?? existing.dashboardCardOrder,
      hiddenDashboardCards: input.hiddenDashboardCards ?? existing.hiddenDashboardCards,
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
        weather_visual_tone,
        show_weather_animations,
        show_mini_charts,
        history_chart_mode,
        visible_providers_json,
        active_workspace,
        surface_style,
        dashboard_card_order_json,
        hidden_dashboard_cards_json,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(user_id) DO UPDATE SET
        dark_mode = excluded.dark_mode,
        map_view_mode = excluded.map_view_mode,
        unit_system = excluded.unit_system,
        show_radar_layer = excluded.show_radar_layer,
        show_station_layer = excluded.show_station_layer,
        weather_visual_tone = excluded.weather_visual_tone,
        show_weather_animations = excluded.show_weather_animations,
        show_mini_charts = excluded.show_mini_charts,
        history_chart_mode = excluded.history_chart_mode,
        visible_providers_json = excluded.visible_providers_json,
        active_workspace = excluded.active_workspace,
        surface_style = excluded.surface_style,
        dashboard_card_order_json = excluded.dashboard_card_order_json,
        hidden_dashboard_cards_json = excluded.hidden_dashboard_cards_json,
        updated_at = excluded.updated_at
    `);

    upsertStatement.run(
      next.userId,
      next.darkMode ? 1 : 0,
      next.mapViewMode,
      next.unitSystem,
      next.showRadarLayer ? 1 : 0,
      next.showStationLayer ? 1 : 0,
      next.weatherVisualTone,
      next.showWeatherAnimations ? 1 : 0,
      next.showMiniCharts ? 1 : 0,
      next.historyChartMode,
      JSON.stringify(next.visibleProviders),
      next.activeWorkspace,
      next.surfaceStyle,
      JSON.stringify(next.dashboardCardOrder),
      JSON.stringify(next.hiddenDashboardCards)
    );

    return this.getOrCreatePreferences(input.userId);
  }
}
