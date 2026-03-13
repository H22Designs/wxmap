import { Router } from 'express';
import type { AccessTokenPayload } from '../auth/tokens.js';
import { requireAuthenticatedUser } from '../middleware/requireAuthenticatedUser.js';

type UserPreferencesRepositoryLike = {
  getOrCreatePreferences: (userId: string) => unknown;
  upsertPreferences: (input: {
    userId: string;
    darkMode?: boolean;
    mapViewMode?: '2d' | '3d';
    unitSystem?: 'metric' | 'imperial';
    showRadarLayer?: boolean;
    showStationLayer?: boolean;
    weatherVisualTone?: 'balanced' | 'vivid' | 'minimal';
    showWeatherAnimations?: boolean;
    showMiniCharts?: boolean;
    historyChartMode?: 'line' | 'area';
    visibleProviders?: string[];
    activeWorkspace?: 'dashboard' | 'explore' | 'admin';
    surfaceStyle?: 'glass' | 'elevated' | 'neo';
    dashboardCardOrder?: string[];
    hiddenDashboardCards?: string[];
  }) => unknown;
};

type UserRouterDeps = {
  userPreferencesRepository: UserPreferencesRepositoryLike;
};

function getAuthPayload(res: { locals: Record<string, unknown> }): AccessTokenPayload | null {
  const auth = res.locals.auth;

  if (!auth || typeof auth !== 'object') {
    return null;
  }

  const candidate = auth as Partial<AccessTokenPayload>;

  if (typeof candidate.sub !== 'string' || typeof candidate.username !== 'string') {
    return null;
  }

  if (candidate.role !== 'user' && candidate.role !== 'admin') {
    return null;
  }

  return candidate as AccessTokenPayload;
}

export function userRouter(deps: UserRouterDeps): Router {
  const router = Router();

  router.use(requireAuthenticatedUser);

  router.get('/preferences', (_req, res) => {
    const auth = getAuthPayload(res);

    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const preferences = deps.userPreferencesRepository.getOrCreatePreferences(auth.sub);
    res.status(200).json(preferences);
  });

  router.put('/preferences', (req, res) => {
    const auth = getAuthPayload(res);

    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const rawMapViewMode = req.body?.mapViewMode;
    const rawUnitSystem = req.body?.unitSystem;
    const rawVisibleProviders = req.body?.visibleProviders;
    const rawWeatherVisualTone = req.body?.weatherVisualTone;
    const rawShowWeatherAnimations = req.body?.showWeatherAnimations;
    const rawShowMiniCharts = req.body?.showMiniCharts;
    const rawHistoryChartMode = req.body?.historyChartMode;
    const rawActiveWorkspace = req.body?.activeWorkspace;
    const rawSurfaceStyle = req.body?.surfaceStyle;
    const rawDashboardCardOrder = req.body?.dashboardCardOrder;
    const rawHiddenDashboardCards = req.body?.hiddenDashboardCards;

    if (rawMapViewMode !== undefined && rawMapViewMode !== '2d' && rawMapViewMode !== '3d') {
      res.status(400).json({ error: 'mapViewMode must be 2d or 3d' });
      return;
    }

    if (rawUnitSystem !== undefined && rawUnitSystem !== 'metric' && rawUnitSystem !== 'imperial') {
      res.status(400).json({ error: 'unitSystem must be metric or imperial' });
      return;
    }

    if (
      rawVisibleProviders !== undefined &&
      (!Array.isArray(rawVisibleProviders) || rawVisibleProviders.some((item) => typeof item !== 'string'))
    ) {
      res.status(400).json({ error: 'visibleProviders must be an array of strings' });
      return;
    }

    if (
      rawWeatherVisualTone !== undefined &&
      rawWeatherVisualTone !== 'balanced' &&
      rawWeatherVisualTone !== 'vivid' &&
      rawWeatherVisualTone !== 'minimal'
    ) {
      res.status(400).json({ error: 'weatherVisualTone must be balanced, vivid, or minimal' });
      return;
    }

    if (rawShowWeatherAnimations !== undefined && typeof rawShowWeatherAnimations !== 'boolean') {
      res.status(400).json({ error: 'showWeatherAnimations must be a boolean' });
      return;
    }

    if (rawShowMiniCharts !== undefined && typeof rawShowMiniCharts !== 'boolean') {
      res.status(400).json({ error: 'showMiniCharts must be a boolean' });
      return;
    }

    if (
      rawHistoryChartMode !== undefined &&
      rawHistoryChartMode !== 'line' &&
      rawHistoryChartMode !== 'area'
    ) {
      res.status(400).json({ error: 'historyChartMode must be line or area' });
      return;
    }

    if (
      rawActiveWorkspace !== undefined &&
      rawActiveWorkspace !== 'dashboard' &&
      rawActiveWorkspace !== 'explore' &&
      rawActiveWorkspace !== 'admin'
    ) {
      res.status(400).json({ error: 'activeWorkspace must be dashboard, explore, or admin' });
      return;
    }

    if (
      rawSurfaceStyle !== undefined &&
      rawSurfaceStyle !== 'glass' &&
      rawSurfaceStyle !== 'elevated' &&
      rawSurfaceStyle !== 'neo'
    ) {
      res.status(400).json({ error: 'surfaceStyle must be glass, elevated, or neo' });
      return;
    }

    if (
      rawDashboardCardOrder !== undefined &&
      (!Array.isArray(rawDashboardCardOrder) || rawDashboardCardOrder.some((item) => typeof item !== 'string'))
    ) {
      res.status(400).json({ error: 'dashboardCardOrder must be an array of strings' });
      return;
    }

    if (
      rawHiddenDashboardCards !== undefined &&
      (!Array.isArray(rawHiddenDashboardCards) || rawHiddenDashboardCards.some((item) => typeof item !== 'string'))
    ) {
      res.status(400).json({ error: 'hiddenDashboardCards must be an array of strings' });
      return;
    }

    const preferences = deps.userPreferencesRepository.upsertPreferences({
      userId: auth.sub,
      darkMode: typeof req.body?.darkMode === 'boolean' ? req.body.darkMode : undefined,
      mapViewMode: rawMapViewMode,
      unitSystem: rawUnitSystem,
      showRadarLayer: typeof req.body?.showRadarLayer === 'boolean' ? req.body.showRadarLayer : undefined,
      showStationLayer:
        typeof req.body?.showStationLayer === 'boolean' ? req.body.showStationLayer : undefined,
      weatherVisualTone: rawWeatherVisualTone,
      showWeatherAnimations:
        typeof rawShowWeatherAnimations === 'boolean' ? rawShowWeatherAnimations : undefined,
      showMiniCharts: typeof rawShowMiniCharts === 'boolean' ? rawShowMiniCharts : undefined,
      historyChartMode: rawHistoryChartMode,
      visibleProviders: rawVisibleProviders,
      activeWorkspace: rawActiveWorkspace,
      surfaceStyle: rawSurfaceStyle,
      dashboardCardOrder: rawDashboardCardOrder,
      hiddenDashboardCards: rawHiddenDashboardCards
    });

    res.status(200).json(preferences);
  });

  return router;
}
