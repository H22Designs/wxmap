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
    visibleProviders?: string[];
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

    const preferences = deps.userPreferencesRepository.upsertPreferences({
      userId: auth.sub,
      darkMode: typeof req.body?.darkMode === 'boolean' ? req.body.darkMode : undefined,
      mapViewMode: rawMapViewMode,
      unitSystem: rawUnitSystem,
      showRadarLayer: typeof req.body?.showRadarLayer === 'boolean' ? req.body.showRadarLayer : undefined,
      showStationLayer:
        typeof req.body?.showStationLayer === 'boolean' ? req.body.showStationLayer : undefined,
      visibleProviders: rawVisibleProviders
    });

    res.status(200).json(preferences);
  });

  return router;
}
