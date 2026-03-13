import { Router } from 'express';
import crypto from 'node:crypto';
import type { AccessTokenPayload } from '../auth/tokens.js';
import { requireAuthenticatedUser } from '../middleware/requireAuthenticatedUser.js';
import {
  fetchBackfillObservationsForStation,
  fetchOpenMeteoBackfillByCoordinates,
  fetchLatestObservationForStation,
  type ProviderObservationSample
} from '../services/providerObservations.js';
import {
  resolveProviderStationCandidate,
  listProviderStationCandidates
} from '../services/providerStationCatalog.js';

type StationRepositoryLike = {
  listStations: (args: { provider?: string; limit?: number }) => Array<unknown>;
  getStationById: (stationId: string) => unknown | null;
  getStationByProviderExternalId: (provider: string, externalId: string) => unknown | null;
  createStation: (input: {
    id: string;
    provider: string;
    externalId: string;
    name: string;
    lat: number;
    lng: number;
    elevationM: number | null;
    active?: boolean;
  }) => unknown;
};

type ObservationRepositoryLike = {
  listForStation: (stationId: string, limit?: number) => Array<unknown>;
  listLatestForAllStations: () => Array<unknown>;
  upsertObservation?: (input: {
    id: string;
    stationId: string;
    observedAt: string;
    tempC: number | null;
    humidityPct: number | null;
    pressureHpa: number | null;
    windSpeedMs: number | null;
    windDirDeg: number | null;
    precipMm: number | null;
    rawJson: string | null;
  }) => unknown;
};

type WeatherRouterDeps = {
  stationRepository: StationRepositoryLike;
  observationRepository: ObservationRepositoryLike;
  listAvailableProviders: () => string[];
  getProviderLookupConfig?: (
    provider: string
  ) => {
    endpoint?: string | null;
    apiKey?: string | null;
    apiSecret?: string | null;
  } | null;
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

type StationCandidate = {
  provider: string;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  elevationM: number | null;
  inDatabase: boolean;
  inCatalog: boolean;
};

function parseStationCandidate(input: unknown): StationCandidate | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const row = input as Partial<{
    provider: string;
    externalId: string;
    name: string;
    lat: number;
    lng: number;
    elevationM: number | null;
    inDatabase: boolean;
    inCatalog: boolean;
  }>;

  if (
    typeof row.provider !== 'string' ||
    typeof row.externalId !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.lat !== 'number' ||
    typeof row.lng !== 'number'
  ) {
    return null;
  }

  const elevationM = row.elevationM === null || typeof row.elevationM === 'number' ? row.elevationM : null;

  return {
    provider: row.provider,
    externalId: row.externalId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    elevationM,
    inDatabase: row.inDatabase === true,
    inCatalog: row.inCatalog === true
  };
}

const NEARBY_FALLBACK_MAX_DISTANCE_METERS = 250;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  leftLat: number,
  leftLng: number,
  rightLat: number,
  rightLng: number
): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(rightLat - leftLat);
  const dLng = toRadians(rightLng - leftLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(leftLat)) * Math.cos(toRadians(rightLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

type StationRecord = {
  id: string;
  provider: string;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  elevationM: number | null;
  active: boolean;
  createdAt: string;
};

export function weatherRouter(deps: WeatherRouterDeps): Router {
  const router = Router();

  async function tryNearbyStationFallbackBackfill(input: {
    station: StationRecord;
    days: number;
  }): Promise<{ samples: ProviderObservationSample[]; from: StationRecord; distanceMeters: number } | null> {
    const allStations = deps.stationRepository.listStations({ limit: 5000 }) as StationRecord[];

    const nearbyCandidates = allStations
      .filter((candidate) => candidate.id !== input.station.id)
      .filter((candidate) => Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng))
      .map((candidate) => ({
        candidate,
        distance: distanceMeters(input.station.lat, input.station.lng, candidate.lat, candidate.lng)
      }))
      .filter((item) => item.distance <= NEARBY_FALLBACK_MAX_DISTANCE_METERS)
      .sort((left, right) => left.distance - right.distance);

    for (const item of nearbyCandidates) {
      const samples = await fetchBackfillObservationsForStation({
        station: item.candidate,
        days: input.days,
        config: deps.getProviderLookupConfig?.(item.candidate.provider) ?? null
      });

      if (samples.length === 0) {
        continue;
      }

      return {
        samples,
        from: item.candidate,
        distanceMeters: item.distance
      };
    }

    return null;
  }

  async function hydrateLatestObservationIfAvailable(station: {
    id: string;
    provider: string;
    externalId: string;
  }): Promise<void> {
    if (typeof deps.observationRepository.upsertObservation !== 'function') {
      return;
    }

    const latest = await fetchLatestObservationForStation({
      station,
      config: deps.getProviderLookupConfig?.(station.provider) ?? null
    });

    if (!latest) {
      return;
    }

    deps.observationRepository.upsertObservation({
      id: `obs-${station.id}-${latest.observedAt}`,
      stationId: station.id,
      observedAt: latest.observedAt,
      tempC: latest.tempC,
      humidityPct: latest.humidityPct,
      pressureHpa: latest.pressureHpa,
      windSpeedMs: latest.windSpeedMs,
      windDirDeg: latest.windDirDeg,
      precipMm: latest.precipMm,
      rawJson: latest.rawJson
    });
  }

  router.get('/providers', (_req, res) => {
    const items = deps
      .listAvailableProviders()
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((provider) => provider.trim().toLowerCase())
      .sort();

    res.status(200).json({ items });
  });

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

  router.get('/providers/:provider/stations', async (req, res) => {
    const provider = String(req.params.provider ?? '').trim().toLowerCase();
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = parseLimit(req.query.limit) ?? 50;

    if (!provider) {
      res.status(400).json({ error: 'provider is required' });
      return;
    }

    const knownProviders = new Set(deps.listAvailableProviders().map((item) => item.toLowerCase()));

    if (!knownProviders.has(provider)) {
      res.status(400).json({ error: `provider must be one of: ${Array.from(knownProviders).sort().join(', ')}` });
      return;
    }

    const dbStations = deps.stationRepository.listStations({ provider, limit: 1000 });
    const dbCandidates = dbStations
      .map(parseStationCandidate)
      .filter((item): item is StationCandidate => item !== null)
      .map((item) => ({
        ...item,
        inDatabase: true,
        inCatalog: false
      }));

    const catalogCandidates = listProviderStationCandidates({ provider, query, limit: 1000 }).map((item) => ({
      ...item,
      inDatabase: false,
      inCatalog: true
    }));

    const queryLooksLikeStationId = query.length >= 3 && !query.includes(' ');
    const needsRemoteResolution =
      queryLooksLikeStationId &&
      !catalogCandidates.some((item) => item.externalId.toLowerCase() === query.toLowerCase());

    if (needsRemoteResolution) {
      const resolved = await resolveProviderStationCandidate({
        provider,
        externalId: query,
        config: deps.getProviderLookupConfig?.(provider) ?? null
      });

      if (resolved) {
        catalogCandidates.push({
          ...resolved,
          inDatabase: false,
          inCatalog: false
        });
      }
    }

    const mergedByExternalId = new Map<string, StationCandidate>();

    for (const item of catalogCandidates) {
      mergedByExternalId.set(item.externalId.toLowerCase(), item);
    }

    for (const item of dbCandidates) {
      const key = item.externalId.toLowerCase();
      const existing = mergedByExternalId.get(key);

      if (!existing) {
        mergedByExternalId.set(key, item);
        continue;
      }

      mergedByExternalId.set(key, {
        ...existing,
        name: item.name || existing.name,
        lat: item.lat,
        lng: item.lng,
        elevationM: item.elevationM,
        inDatabase: true,
        inCatalog: existing.inCatalog
      });
    }

    let items = [...mergedByExternalId.values()].sort((left, right) => left.name.localeCompare(right.name));

    if (query) {
      const normalizedQuery = query.toLowerCase();
      items = items.filter((item) => {
        const target = `${item.externalId} ${item.name}`.toLowerCase();
        return target.includes(normalizedQuery);
      });
    }

    const safeLimit = Math.max(1, Math.min(limit, 500));

    res.status(200).json({
      provider,
      items: items.slice(0, safeLimit)
    });
  });

  router.post('/stations', requireAuthenticatedUser, async (req, res) => {
    const auth = getAuthPayload(res);

    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const provider = String(req.body?.provider ?? '').trim().toLowerCase();
    const externalId = String(req.body?.externalId ?? '').trim();
    const name = String(req.body?.name ?? '').trim();
    const hasLat = req.body?.lat !== undefined && req.body?.lat !== null && req.body?.lat !== '';
    const hasLng = req.body?.lng !== undefined && req.body?.lng !== null && req.body?.lng !== '';
    const lat = hasLat ? Number(req.body?.lat) : NaN;
    const lng = hasLng ? Number(req.body?.lng) : NaN;
    const elevationRaw = req.body?.elevationM;
    const elevationM =
      elevationRaw === null || elevationRaw === undefined || elevationRaw === ''
        ? null
        : Number(elevationRaw);

    if (!provider) {
      res.status(400).json({ error: 'provider is required' });
      return;
    }

    const knownProviders = new Set(deps.listAvailableProviders().map((item) => item.toLowerCase()));

    if (!knownProviders.has(provider)) {
      res.status(400).json({ error: `provider must be one of: ${Array.from(knownProviders).sort().join(', ')}` });
      return;
    }

    if (!externalId) {
      res.status(400).json({ error: 'externalId is required' });
      return;
    }

    const existing = deps.stationRepository.getStationByProviderExternalId(provider, externalId);

    if (existing) {
      const existingStation = existing as { id: string; provider: string; externalId: string };
      await hydrateLatestObservationIfAvailable(existingStation);
      res.status(200).json(existing);
      return;
    }

    const resolvedCandidate = await resolveProviderStationCandidate({
      provider,
      externalId,
      config: deps.getProviderLookupConfig?.(provider) ?? null
    });

    const resolvedLat = Number.isFinite(lat) ? lat : resolvedCandidate?.lat ?? NaN;
    const resolvedLng = Number.isFinite(lng) ? lng : resolvedCandidate?.lng ?? NaN;
    const resolvedElevationM =
      elevationM !== null && Number.isFinite(elevationM)
        ? elevationM
        : (resolvedCandidate?.elevationM ?? null);

    const resolvedName = name || resolvedCandidate?.name || `${provider.toUpperCase()} ${externalId}`;

    if (!Number.isFinite(resolvedLat) || resolvedLat < -90 || resolvedLat > 90) {
      res.status(400).json({
        error:
          'lat is required when creating a new station and must be a number between -90 and 90. If this station exists in the provider source list, select it first to auto-fill location.'
      });
      return;
    }

    if (!Number.isFinite(resolvedLng) || resolvedLng < -180 || resolvedLng > 180) {
      res.status(400).json({
        error:
          'lng is required when creating a new station and must be a number between -180 and 180. If this station exists in the provider source list, select it first to auto-fill location.'
      });
      return;
    }

    if (elevationM !== null && !Number.isFinite(elevationM)) {
      res.status(400).json({ error: 'elevationM must be a number when provided' });
      return;
    }

    const created = deps.stationRepository.createStation({
      id: `station-${provider}-${crypto.randomUUID()}`,
      provider,
      externalId,
      name: resolvedName,
      lat: resolvedLat,
      lng: resolvedLng,
      elevationM: resolvedElevationM
    });

    await hydrateLatestObservationIfAvailable(created as { id: string; provider: string; externalId: string });

    res.status(201).json(created);
  });

  router.post('/stations/:id/backfill', requireAuthenticatedUser, async (req, res) => {
    const auth = getAuthPayload(res);

    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (typeof deps.observationRepository.upsertObservation !== 'function') {
      res.status(501).json({ error: 'Backfill is unavailable: observation upsert not supported by current store.' });
      return;
    }

    const stationId = String(req.params.id ?? '').trim();
    const station = deps.stationRepository.getStationById(stationId) as StationRecord | null;

    if (!station) {
      res.status(404).json({ error: `Station '${stationId}' not found` });
      return;
    }

    const rawDays = Number(req.body?.days ?? 5);
    const days = Number.isFinite(rawDays) ? Math.floor(rawDays) : NaN;

    if (!Number.isFinite(days) || days < 1 || days > 14) {
      res.status(400).json({ error: 'days must be an integer between 1 and 14' });
      return;
    }

    let samples = await fetchBackfillObservationsForStation({
      station,
      days,
      config: deps.getProviderLookupConfig?.(station.provider) ?? null
    });

    let fallbackFrom: { provider: string; externalId: string; distanceMeters: number } | null = null;
    let usedOpenMeteoFallback = false;

    if (
      samples.length === 0 &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lng)
    ) {
      const nearbyFallback = await tryNearbyStationFallbackBackfill({ station, days });

      if (nearbyFallback) {
        fallbackFrom = {
          provider: nearbyFallback.from.provider,
          externalId: nearbyFallback.from.externalId,
          distanceMeters: nearbyFallback.distanceMeters
        };

        samples = nearbyFallback.samples.map((sample) => ({
          ...sample,
          rawJson: JSON.stringify({
            source: 'nearby-fallback',
            targetStation: {
              provider: station.provider,
              externalId: station.externalId
            },
            fallbackStation: {
              provider: nearbyFallback.from.provider,
              externalId: nearbyFallback.from.externalId,
              distanceMeters: Math.round(nearbyFallback.distanceMeters)
            },
            originalRawJson: sample.rawJson
          })
        }));
      }
    }

    if (
      samples.length === 0 &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lng)
    ) {
      const openMeteoSamples = await fetchOpenMeteoBackfillByCoordinates({
        lat: station.lat,
        lng: station.lng,
        days
      });

      if (openMeteoSamples.length > 0) {
        usedOpenMeteoFallback = true;
        samples = openMeteoSamples.map((sample) => ({
          ...sample,
          rawJson: JSON.stringify({
            source: 'open-meteo-fallback',
            targetStation: {
              provider: station.provider,
              externalId: station.externalId
            },
            originalRawJson: sample.rawJson
          })
        }));
      }
    }

    for (const sample of samples) {
      deps.observationRepository.upsertObservation({
        id: `obs-${station.id}-${sample.observedAt}`,
        stationId: station.id,
        observedAt: sample.observedAt,
        tempC: sample.tempC,
        humidityPct: sample.humidityPct,
        pressureHpa: sample.pressureHpa,
        windSpeedMs: sample.windSpeedMs,
        windDirDeg: sample.windDirDeg,
        precipMm: sample.precipMm,
        rawJson: sample.rawJson
      });
    }

    const normalizedProvider = station.provider.trim().toLowerCase();
    const sourceStatus = samples.length > 0 ? 'ok' : 'no-data';
    let note: string | null = null;

    if (samples.length === 0) {
      const providerConfig = deps.getProviderLookupConfig?.(station.provider) ?? null;
      const hasCustomEndpoint = Boolean(providerConfig?.endpoint && providerConfig.endpoint.trim().length > 0);

      if (normalizedProvider === 'cwop' || normalizedProvider === 'findu') {
        note = `No upstream CWOP/FindU weather reports were available for ${station.externalId} in the requested time window.`;
      } else if (normalizedProvider === 'airport' || normalizedProvider === 'nws' || normalizedProvider === 'noaa') {
        note = `No upstream weather.gov observations were available for ${station.externalId} in the requested time window.`;
      } else if (normalizedProvider === 'ambient') {
        note = `No Ambient Weather historical records were returned for ${station.externalId}. Verify provider API key + application key and station MAC identifier.`;
      } else if (normalizedProvider === 'mesowest' || normalizedProvider === 'madis') {
        note = `No Synoptic/MesoWest time-series records were returned for ${station.externalId}. Verify token scope and historical access window.`;
      } else if (
        (normalizedProvider === 'wunderground' || normalizedProvider === 'acurite' || normalizedProvider === 'pwsweather') &&
        !hasCustomEndpoint
      ) {
        note = `No historical endpoint is configured for ${normalizedProvider}. Set provider endpoint and credentials in Admin > Providers, then retry backfill.`;
      } else {
        note = `No upstream observations were available for ${station.externalId} in the requested time window.`;
      }
    } else if (fallbackFrom) {
      note = `Imported fallback history from nearby station ${fallbackFrom.provider}:${fallbackFrom.externalId} (~${Math.round(fallbackFrom.distanceMeters)}m away) because direct provider history was unavailable.`;
    } else if (usedOpenMeteoFallback) {
      note = 'Imported fallback history from Open-Meteo archive grid data because direct/nearby station history was unavailable.';
    }

    res.status(200).json({
      stationId: station.id,
      provider: station.provider,
      externalId: station.externalId,
      days,
      imported: samples.length,
      sourceStatus,
      note
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
