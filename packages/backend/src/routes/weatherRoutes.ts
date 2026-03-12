import { Router } from 'express';
import type { ObservationRepository } from '../db/repositories/observationRepository.js';
import type { StationRepository } from '../db/repositories/stationRepository.js';

type WeatherRouterDeps = {
  stationRepository: StationRepository;
  observationRepository: ObservationRepository;
};

function parseLimit(input: unknown): number | undefined {
  if (typeof input !== 'string' || !input.trim()) {
    return undefined;
  }

  const value = Number(input);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.floor(value);
}

export function weatherRouter(deps: WeatherRouterDeps): Router {
  const router = Router();

  router.get('/stations', (req, res) => {
    const { bbox, provider } = req.query;
    const limit = parseLimit(req.query.limit);
    const stations = deps.stationRepository.listStations({
      provider: typeof provider === 'string' ? provider : undefined,
      limit
    });

    res.status(200).json({
      items: stations,
      filters: {
        bbox: bbox ?? null,
        provider: provider ?? null,
        limit: limit ?? null
      }
    });
  });

  router.get('/stations/:id/observations', (req, res) => {
    const stationId = req.params.id;
    const station = deps.stationRepository.getStationById(stationId);

    if (!station) {
      res.status(404).json({ error: `Station '${stationId}' not found` });
      return;
    }

    const limit = parseLimit(req.query.limit) ?? 120;
    const observations = deps.observationRepository.listForStation(stationId, limit);

    res.status(200).json({
      station,
      items: observations
    });
  });

  router.get('/current', (_req, res) => {
    const items = deps.observationRepository.listLatestForAllStations();

    res.status(200).json({
      items,
      collectedAt: new Date().toISOString()
    });
  });

  return router;
}
