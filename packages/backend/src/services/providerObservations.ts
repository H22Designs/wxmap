import type { Station } from '../types/models.js';
import { fetchLatestCwopLikeObservation } from './cwopObservation.js';

type ProviderLookupConfig = {
  endpoint?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
};

export type ProviderObservationSample = {
  observedAt: string;
  tempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  windDirDeg: number | null;
  precipMm: number | null;
  rawJson: string | null;
};

const AIRPORT_IATA_TO_ICAO: Record<string, string> = {
  ATL: 'KATL',
  BOS: 'KBOS',
  DCA: 'KDCA',
  DFW: 'KDFW',
  DEN: 'KDEN',
  DTW: 'KDTW',
  EWR: 'KEWR',
  IAD: 'KIAD',
  IAH: 'KIAH',
  JFK: 'KJFK',
  LAS: 'KLAS',
  LAX: 'KLAX',
  LGA: 'KLGA',
  MCO: 'KMCO',
  MIA: 'KMIA',
  MSP: 'KMSP',
  ORD: 'KORD',
  PDX: 'KPDX',
  PHL: 'KPHL',
  PHX: 'KPHX',
  SAN: 'KSAN',
  SEA: 'KSEA',
  SFO: 'KSFO',
  SJC: 'KSJC',
  SLC: 'KSLC',
  TPA: 'KTPA'
};

function extractNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeAirportStationId(input: string): string {
  const raw = input.trim().toUpperCase();

  if (!raw) {
    return raw;
  }

  if (/^[A-Z]{4}$/.test(raw)) {
    return raw;
  }

  if (/^[A-Z]{3}$/.test(raw)) {
    return AIRPORT_IATA_TO_ICAO[raw] ?? `K${raw}`;
  }

  return raw;
}

function resolveWeatherGovStationId(provider: string, externalId: string): string | null {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedExternalId = externalId.trim().toUpperCase();

  if (!normalizedExternalId) {
    return null;
  }

  if (normalizedProvider === 'airport') {
    return normalizeAirportStationId(normalizedExternalId);
  }

  if (normalizedProvider === 'nws') {
    return normalizedExternalId;
  }

  if (normalizedProvider === 'noaa') {
    return /^[A-Z]{4}$/.test(normalizedExternalId) ? normalizedExternalId : null;
  }

  return null;
}

function mapWeatherGovProperties(
  stationId: string,
  properties: Record<string, unknown>
): ProviderObservationSample | null {
  const observedAtRaw = typeof properties.timestamp === 'string' ? properties.timestamp : null;
  const observedAt = observedAtRaw && !Number.isNaN(new Date(observedAtRaw).getTime())
    ? observedAtRaw
    : new Date().toISOString();

  const temperature = (properties.temperature as Record<string, unknown> | undefined) ?? {};
  const humidity = (properties.relativeHumidity as Record<string, unknown> | undefined) ?? {};
  const pressure = (properties.barometricPressure as Record<string, unknown> | undefined) ?? {};
  const windSpeed = (properties.windSpeed as Record<string, unknown> | undefined) ?? {};
  const windDirection = (properties.windDirection as Record<string, unknown> | undefined) ?? {};
  const precipLastHour = (properties.precipitationLastHour as Record<string, unknown> | undefined) ?? {};

  const tempC = extractNumber(temperature, ['value']);
  const humidityPct = extractNumber(humidity, ['value']);
  const pressurePa = extractNumber(pressure, ['value']);
  const pressureHpa = pressurePa === null ? null : pressurePa / 100;
  const windSpeedMs = extractNumber(windSpeed, ['value']);
  const windDirDeg = extractNumber(windDirection, ['value']);
  const precipMm = extractNumber(precipLastHour, ['value']);

  return {
    observedAt,
    tempC,
    humidityPct,
    pressureHpa,
    windSpeedMs,
    windDirDeg,
    precipMm,
    rawJson: JSON.stringify({
      source: 'weather.gov',
      stationId,
      properties
    })
  };
}

async function fetchWeatherGovLatest(stationId: string): Promise<ProviderObservationSample | null> {
  const response = await fetch(`https://api.weather.gov/stations/${encodeURIComponent(stationId)}/observations/latest`, {
    headers: {
      Accept: 'application/geo+json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const properties = (payload.properties as Record<string, unknown> | undefined) ?? {};

  return mapWeatherGovProperties(stationId, properties);
}

async function fetchWeatherGovBackfill(stationId: string, days: number): Promise<ProviderObservationSample[]> {
  const response = await fetch(
    `https://api.weather.gov/stations/${encodeURIComponent(stationId)}/observations?limit=500`,
    {
      headers: {
        Accept: 'application/geo+json'
      }
    }
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const features = Array.isArray(payload.features) ? payload.features : [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const mapped = features
    .map((feature) => {
      const featureRecord = (feature as Record<string, unknown> | undefined) ?? {};
      const properties = (featureRecord.properties as Record<string, unknown> | undefined) ?? {};
      return mapWeatherGovProperties(stationId, properties);
    })
    .filter((item): item is ProviderObservationSample => item !== null)
    .filter((item) => {
      const observedAtMs = new Date(item.observedAt).getTime();
      return Number.isFinite(observedAtMs) && observedAtMs >= cutoff;
    })
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));

  return mapped;
}

function buildCustomEndpointUrl(config: ProviderLookupConfig, station: Station, mode: 'latest' | 'backfill', days?: number): string | null {
  const endpoint = config.endpoint?.trim();

  if (!endpoint) {
    return null;
  }

  if (endpoint.includes('{stationId}') || endpoint.includes('{provider}')) {
    const withStation = endpoint
      .replaceAll('{stationId}', encodeURIComponent(station.externalId))
      .replaceAll('{provider}', encodeURIComponent(station.provider));

    if (mode === 'backfill') {
      const url = new URL(withStation);
      url.searchParams.set('mode', 'backfill');
      url.searchParams.set('days', String(days ?? 5));
      return url.toString();
    }

    return withStation;
  }

  const url = new URL(endpoint);
  url.searchParams.set('stationId', station.externalId);
  url.searchParams.set('provider', station.provider);

  if (mode === 'backfill') {
    url.searchParams.set('mode', 'backfill');
    url.searchParams.set('days', String(days ?? 5));
  }

  return url.toString();
}

function mapCustomObservationRecord(record: Record<string, unknown>): ProviderObservationSample | null {
  const observedAtRaw = typeof record.observedAt === 'string'
    ? record.observedAt
    : typeof record.timestamp === 'string'
      ? record.timestamp
      : new Date().toISOString();

  const observedAt = Number.isNaN(new Date(observedAtRaw).getTime())
    ? new Date().toISOString()
    : observedAtRaw;

  const tempC = extractNumber(record, ['tempC', 'temp_c', 'temperatureC', 'temperature_c']);
  const tempF = extractNumber(record, ['tempF', 'temp_f', 'temperatureF', 'temperature_f']);
  const resolvedTempC = tempC ?? (tempF === null ? null : (tempF - 32) * (5 / 9));

  const humidityPct = extractNumber(record, ['humidityPct', 'humidity_pct', 'humidity']);

  const pressureHpa = extractNumber(record, ['pressureHpa', 'pressure_hpa']);
  const pressurePa = extractNumber(record, ['pressurePa', 'pressure_pa']);
  const resolvedPressureHpa = pressureHpa ?? (pressurePa === null ? null : pressurePa / 100);

  const windSpeedMs = extractNumber(record, ['windSpeedMs', 'wind_speed_ms']);
  const windSpeedMph = extractNumber(record, ['windSpeedMph', 'wind_speed_mph']);
  const resolvedWindMs = windSpeedMs ?? (windSpeedMph === null ? null : windSpeedMph * 0.44704);

  const windDirDeg = extractNumber(record, ['windDirDeg', 'wind_dir_deg']);

  const precipMm = extractNumber(record, ['precipMm', 'precip_mm']);
  const precipIn = extractNumber(record, ['precipIn', 'precip_in']);
  const resolvedPrecipMm = precipMm ?? (precipIn === null ? null : precipIn * 25.4);

  return {
    observedAt,
    tempC: resolvedTempC,
    humidityPct,
    pressureHpa: resolvedPressureHpa,
    windSpeedMs: resolvedWindMs,
    windDirDeg,
    precipMm: resolvedPrecipMm,
    rawJson: JSON.stringify({
      source: 'custom-endpoint',
      payload: record
    })
  };
}

async function fetchCustomLatest(station: Station, config: ProviderLookupConfig): Promise<ProviderObservationSample | null> {
  const url = buildCustomEndpointUrl(config, station, 'latest');

  if (!url) {
    return null;
  }

  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (config.apiKey?.trim()) {
    headers['x-api-key'] = config.apiKey.trim();
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const root = (payload.observation as Record<string, unknown> | undefined) ?? payload;

  return mapCustomObservationRecord(root);
}

async function fetchCustomBackfill(
  station: Station,
  days: number,
  config: ProviderLookupConfig
): Promise<ProviderObservationSample[]> {
  const url = buildCustomEndpointUrl(config, station, 'backfill', days);

  if (!url) {
    return [];
  }

  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (config.apiKey?.trim()) {
    headers['x-api-key'] = config.apiKey.trim();
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const itemsRaw = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.observations)
      ? payload.observations
      : Array.isArray(payload.data)
        ? payload.data
        : [];

  return itemsRaw
    .map((item) => mapCustomObservationRecord((item as Record<string, unknown> | undefined) ?? {}))
    .filter((item): item is ProviderObservationSample => item !== null)
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
}

export async function fetchLatestObservationForStation(input: {
  station: Station;
  config?: ProviderLookupConfig | null;
}): Promise<ProviderObservationSample | null> {
  const provider = input.station.provider.trim().toLowerCase();

  if (provider === 'cwop' || provider === 'findu') {
    return fetchLatestCwopLikeObservation({
      provider,
      externalId: input.station.externalId
    });
  }

  if (provider === 'nws' || provider === 'noaa' || provider === 'airport') {
    const stationId = resolveWeatherGovStationId(provider, input.station.externalId);

    if (!stationId) {
      return null;
    }

    const fromWeatherGov = await fetchWeatherGovLatest(stationId);

    if (fromWeatherGov) {
      return fromWeatherGov;
    }
  }

  if (input.config?.endpoint) {
    return fetchCustomLatest(input.station, input.config);
  }

  return null;
}

export async function fetchBackfillObservationsForStation(input: {
  station: Station;
  days: number;
  config?: ProviderLookupConfig | null;
}): Promise<ProviderObservationSample[]> {
  const provider = input.station.provider.trim().toLowerCase();
  const days = Math.max(1, Math.min(Math.floor(input.days), 14));

  if (provider === 'nws' || provider === 'noaa' || provider === 'airport') {
    const stationId = resolveWeatherGovStationId(provider, input.station.externalId);

    if (!stationId) {
      return [];
    }

    const fromWeatherGov = await fetchWeatherGovBackfill(stationId, days);

    if (fromWeatherGov.length > 0) {
      return fromWeatherGov;
    }
  }

  if (input.config?.endpoint) {
    return fetchCustomBackfill(input.station, days, input.config);
  }

  return [];
}
