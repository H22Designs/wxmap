import {
  fetchBackfillCwopLikeObservations,
  fetchLatestCwopLikeObservation
} from './cwopObservation.js';

type StationLike = {
  provider: string;
  externalId: string;
  lat?: number;
  lng?: number;
};

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

const INHG_TO_HPA = 33.8638866667;
const MPH_TO_MS = 0.44704;
const KMH_TO_MS = 0.2777777778;
const IN_TO_MM = 25.4;

function formatUtcYyyyMmDdHhMm(input: Date): string {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, '0');
  const day = String(input.getUTCDate()).padStart(2, '0');
  const hour = String(input.getUTCHours()).padStart(2, '0');
  const minute = String(input.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}`;
}

function resolveObservedAt(record: Record<string, unknown>): string {
  const dateIso = typeof record.date === 'string' ? record.date : null;
  const observedAtRaw = typeof record.observedAt === 'string'
    ? record.observedAt
    : typeof record.timestamp === 'string'
      ? record.timestamp
      : dateIso;

  if (observedAtRaw && !Number.isNaN(new Date(observedAtRaw).getTime())) {
    return observedAtRaw;
  }

  const dateUtc = record.dateutc;
  if (typeof dateUtc === 'number' && Number.isFinite(dateUtc)) {
    const parsed = new Date(dateUtc);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof dateUtc === 'string' && dateUtc.trim()) {
    const parsedNumeric = Number(dateUtc);
    if (Number.isFinite(parsedNumeric)) {
      const parsed = new Date(parsedNumeric);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    const parsed = new Date(dateUtc);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

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

function buildCustomEndpointUrl(config: ProviderLookupConfig, station: StationLike, mode: 'latest' | 'backfill', days?: number): string | null {
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

async function fetchCustomLatest(station: StationLike, config: ProviderLookupConfig): Promise<ProviderObservationSample | null> {
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
  station: StationLike,
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

function mapAmbientObservationRecord(record: Record<string, unknown>): ProviderObservationSample | null {
  const observedAt = resolveObservedAt(record);

  const tempCDirect = extractNumber(record, ['tempc']);
  const tempF = extractNumber(record, ['tempf']);
  const tempC = tempCDirect ?? (tempF === null ? null : (tempF - 32) * (5 / 9));

  const humidityPct = extractNumber(record, ['humidity']);

  const pressureHpaDirect = extractNumber(record, ['baromrelhpa', 'baromabshpa']);
  const pressureInHg = extractNumber(record, ['baromrelin', 'baromabsin']);
  const pressureHpa = pressureHpaDirect ?? (pressureInHg === null ? null : pressureInHg * INHG_TO_HPA);

  const windSpeedMsDirect = extractNumber(record, ['windspeedms']);
  const windSpeedMph = extractNumber(record, ['windspeedmph', 'windspdmph_avg2m', 'windspdmph_avg10m']);
  const windSpeedMs = windSpeedMsDirect ?? (windSpeedMph === null ? null : windSpeedMph * MPH_TO_MS);

  const windDirDeg = extractNumber(record, ['winddir']);

  const precipMmDirect = extractNumber(record, ['hourlyrainmm', 'dailyrainmm']);
  const precipIn = extractNumber(record, ['hourlyrainin', 'dailyrainin']);
  const precipMm = precipMmDirect ?? (precipIn === null ? null : precipIn * IN_TO_MM);

  return {
    observedAt,
    tempC,
    humidityPct,
    pressureHpa,
    windSpeedMs,
    windDirDeg,
    precipMm,
    rawJson: JSON.stringify({
      source: 'ambientweather',
      payload: record
    })
  };
}

async function fetchAmbientLatest(station: StationLike, config: ProviderLookupConfig): Promise<ProviderObservationSample | null> {
  const apiKey = config.apiKey?.trim();
  const applicationKey = config.apiSecret?.trim();

  if (!apiKey || !applicationKey) {
    return null;
  }

  const base = (config.endpoint?.trim() || 'https://rt.ambientweather.net/v1').replace(/\/$/, '');
  const url = new URL(`${base}/devices`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('applicationKey', applicationKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  const devices = Array.isArray(payload) ? payload : [];

  const stationExternalId = station.externalId.trim().toLowerCase();
  const match = devices.find((item) => {
    const record = (item as Record<string, unknown> | undefined) ?? {};
    const mac = String(record.macAddress ?? '').trim().toLowerCase();
    const deviceId = String(record.deviceId ?? '').trim().toLowerCase();
    return mac === stationExternalId || deviceId === stationExternalId;
  });

  const matchedRecord = ((match as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const lastData = (matchedRecord.lastData as Record<string, unknown> | undefined) ?? matchedRecord;
  return mapAmbientObservationRecord(lastData);
}

async function fetchAmbientBackfill(
  station: StationLike,
  days: number,
  config: ProviderLookupConfig
): Promise<ProviderObservationSample[]> {
  const apiKey = config.apiKey?.trim();
  const applicationKey = config.apiSecret?.trim();

  if (!apiKey || !applicationKey) {
    return [];
  }

  const base = (config.endpoint?.trim() || 'https://rt.ambientweather.net/v1').replace(/\/$/, '');
  const stationId = station.externalId.trim();
  if (!stationId) {
    return [];
  }

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const maxRequests = Math.max(1, Math.ceil((days * 24 * 60) / 288));
  const allSamples: ProviderObservationSample[] = [];
  let endDate: string | null = null;

  for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
    const url = new URL(`${base}/devices/${encodeURIComponent(stationId)}`);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('applicationKey', applicationKey);
    url.searchParams.set('limit', '288');

    if (endDate) {
      url.searchParams.set('endDate', endDate);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      break;
    }

    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload) ? payload : [];
    if (rows.length === 0) {
      break;
    }

    const mapped = rows
      .map((item) => mapAmbientObservationRecord((item as Record<string, unknown> | undefined) ?? {}))
      .filter((item): item is ProviderObservationSample => item !== null)
      .filter((item) => {
        const observedAtMs = new Date(item.observedAt).getTime();
        return Number.isFinite(observedAtMs) && observedAtMs >= cutoffMs;
      });

    allSamples.push(...mapped);

    const oldestObservedAt = mapped.length > 0
      ? mapped.reduce((oldest, item) => (item.observedAt < oldest ? item.observedAt : oldest), mapped[0].observedAt)
      : null;

    if (!oldestObservedAt) {
      break;
    }

    const oldestMs = new Date(oldestObservedAt).getTime();
    if (!Number.isFinite(oldestMs) || oldestMs <= cutoffMs) {
      break;
    }

    endDate = new Date(oldestMs - 1).toISOString();
  }

  const dedupedByTimestamp = new Map<string, ProviderObservationSample>();
  for (const item of allSamples) {
    dedupedByTimestamp.set(item.observedAt, item);
  }

  return [...dedupedByTimestamp.values()].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
}

function readSynopticSeriesNumber(
  observations: Record<string, unknown>,
  prefixes: string[],
  index: number
): number | null {
  for (const [key, value] of Object.entries(observations)) {
    const normalizedKey = key.toLowerCase();
    if (!prefixes.some((prefix) => normalizedKey.startsWith(prefix))) {
      continue;
    }

    if (!Array.isArray(value)) {
      continue;
    }

    const sample = value[index];
    if (typeof sample === 'number' && Number.isFinite(sample)) {
      return sample;
    }
  }

  return null;
}

function extractSynopticLatestValue(
  observations: Record<string, unknown>,
  prefixes: string[]
): { value: number | null; observedAt: string | null } {
  for (const [key, value] of Object.entries(observations)) {
    const normalizedKey = key.toLowerCase();
    if (!prefixes.some((prefix) => normalizedKey.startsWith(prefix))) {
      continue;
    }

    if (!value || typeof value !== 'object') {
      continue;
    }

    const row = value as Record<string, unknown>;
    const numeric = typeof row.value === 'number' && Number.isFinite(row.value)
      ? row.value
      : typeof row.value === 'string' && Number.isFinite(Number(row.value))
        ? Number(row.value)
        : null;
    const observedAt = typeof row.date_time === 'string' ? row.date_time : null;

    if (numeric !== null || observedAt !== null) {
      return { value: numeric, observedAt };
    }
  }

  return { value: null, observedAt: null };
}

async function fetchSynopticLatest(station: StationLike, config: ProviderLookupConfig): Promise<ProviderObservationSample | null> {
  const token = config.apiKey?.trim();
  if (!token) {
    return null;
  }

  const endpoint = config.endpoint?.trim() || 'https://api.synopticdata.com/v2/stations/latest';
  const url = new URL(endpoint);
  url.searchParams.set('token', token);
  url.searchParams.set('stid', station.externalId.trim());
  url.searchParams.set('units', 'metric');
  url.searchParams.set('obtimezone', 'utc');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const stations = Array.isArray(payload.STATION) ? payload.STATION : [];
  const first = (stations[0] as Record<string, unknown> | undefined) ?? null;
  if (!first) {
    return null;
  }

  const observations = (first.OBSERVATIONS as Record<string, unknown> | undefined) ?? {};
  const temp = extractSynopticLatestValue(observations, ['air_temp']);
  const humidity = extractSynopticLatestValue(observations, ['relative_humidity']);
  const pressure = extractSynopticLatestValue(observations, ['pressure', 'sea_level_pressure', 'altimeter']);
  const windSpeed = extractSynopticLatestValue(observations, ['wind_speed']);
  const windDir = extractSynopticLatestValue(observations, ['wind_direction']);
  const precip = extractSynopticLatestValue(observations, ['precip_accum', 'precip_interval']);

  const observedAt =
    temp.observedAt ??
    humidity.observedAt ??
    pressure.observedAt ??
    windSpeed.observedAt ??
    windDir.observedAt ??
    precip.observedAt ??
    new Date().toISOString();

  return {
    observedAt,
    tempC: temp.value,
    humidityPct: humidity.value,
    pressureHpa: pressure.value,
    windSpeedMs: windSpeed.value,
    windDirDeg: windDir.value,
    precipMm: precip.value,
    rawJson: JSON.stringify({
      source: 'synoptic',
      payload: first
    })
  };
}

async function fetchSynopticBackfill(
  station: StationLike,
  days: number,
  config: ProviderLookupConfig
): Promise<ProviderObservationSample[]> {
  const token = config.apiKey?.trim();
  if (!token) {
    return [];
  }

  const endpoint = config.endpoint?.trim() || 'https://api.synopticdata.com/v2/stations/timeseries';
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const url = new URL(endpoint);
  url.searchParams.set('token', token);
  url.searchParams.set('stid', station.externalId.trim());
  url.searchParams.set('start', formatUtcYyyyMmDdHhMm(start));
  url.searchParams.set('end', formatUtcYyyyMmDdHhMm(now));
  url.searchParams.set('units', 'metric');
  url.searchParams.set('obtimezone', 'utc');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const stations = Array.isArray(payload.STATION) ? payload.STATION : [];
  const first = (stations[0] as Record<string, unknown> | undefined) ?? null;
  if (!first) {
    return [];
  }

  const observations = (first.OBSERVATIONS as Record<string, unknown> | undefined) ?? {};
  const dateSeries = (observations.date_time as unknown[] | undefined) ?? [];

  if (!Array.isArray(dateSeries) || dateSeries.length === 0) {
    return [];
  }

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const mapped = dateSeries
    .map((timeValue, index) => {
      const observedAt = typeof timeValue === 'string' && !Number.isNaN(new Date(timeValue).getTime())
        ? timeValue
        : null;

      if (!observedAt) {
        return null;
      }

      return {
        observedAt,
        tempC: readSynopticSeriesNumber(observations, ['air_temp'], index),
        humidityPct: readSynopticSeriesNumber(observations, ['relative_humidity'], index),
        pressureHpa: readSynopticSeriesNumber(observations, ['pressure', 'sea_level_pressure', 'altimeter'], index),
        windSpeedMs: readSynopticSeriesNumber(observations, ['wind_speed'], index),
        windDirDeg: readSynopticSeriesNumber(observations, ['wind_direction'], index),
        precipMm: readSynopticSeriesNumber(observations, ['precip_accum', 'precip_interval'], index),
        rawJson: JSON.stringify({
          source: 'synoptic',
          station: station.externalId,
          index
        })
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => {
      const observedAtMs = new Date(item.observedAt).getTime();
      return Number.isFinite(observedAtMs) && observedAtMs >= cutoffMs;
    })
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));

  return mapped;
}

function parseOpenMeteoObservedAt(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  const withTimezone = raw.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(raw)
    ? raw
    : `${raw}Z`;

  return Number.isNaN(new Date(withTimezone).getTime()) ? null : withTimezone;
}

function readOpenMeteoNumber(series: unknown[], index: number): number | null {
  if (!Array.isArray(series)) {
    return null;
  }

  const value = series[index];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function fetchOpenMeteoBackfillByCoordinates(input: {
  lat: number;
  lng: number;
  days: number;
}): Promise<ProviderObservationSample[]> {
  const lat = input.lat;
  const lng = input.lng;
  const days = Math.max(1, Math.min(Math.floor(input.days), 14));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return [];
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return [];
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const formatDate = (value: Date): string => {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('start_date', formatDate(startDate));
  url.searchParams.set('end_date', formatDate(endDate));
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation'
    ].join(',')
  );

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const hourly = (payload.hourly as Record<string, unknown> | undefined) ?? {};
  const times = Array.isArray(hourly.time) ? (hourly.time as unknown[]) : [];

  if (times.length === 0) {
    return [];
  }

  const temperatureSeries = Array.isArray(hourly.temperature_2m) ? (hourly.temperature_2m as unknown[]) : [];
  const humiditySeries = Array.isArray(hourly.relative_humidity_2m) ? (hourly.relative_humidity_2m as unknown[]) : [];
  const pressureSeries = Array.isArray(hourly.pressure_msl) ? (hourly.pressure_msl as unknown[]) : [];
  const windSpeedSeries = Array.isArray(hourly.wind_speed_10m) ? (hourly.wind_speed_10m as unknown[]) : [];
  const windDirSeries = Array.isArray(hourly.wind_direction_10m) ? (hourly.wind_direction_10m as unknown[]) : [];
  const precipSeries = Array.isArray(hourly.precipitation) ? (hourly.precipitation as unknown[]) : [];

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  return times
    .map<ProviderObservationSample | null>((timeValue, index) => {
      const observedAt = parseOpenMeteoObservedAt(timeValue);

      if (!observedAt) {
        return null;
      }

      return {
        observedAt,
        tempC: readOpenMeteoNumber(temperatureSeries, index),
        humidityPct: readOpenMeteoNumber(humiditySeries, index),
        pressureHpa: readOpenMeteoNumber(pressureSeries, index),
        windSpeedMs: (() => {
          const kmh = readOpenMeteoNumber(windSpeedSeries, index);
          return kmh === null ? null : kmh * KMH_TO_MS;
        })(),
        windDirDeg: readOpenMeteoNumber(windDirSeries, index),
        precipMm: readOpenMeteoNumber(precipSeries, index),
        rawJson: JSON.stringify({
          source: 'open-meteo-archive',
          latitude: lat,
          longitude: lng,
          index
        })
      };
    })
    .filter((item): item is ProviderObservationSample => item !== null)
    .filter((item) => {
      const observedAtMs = new Date(item.observedAt).getTime();
      return Number.isFinite(observedAtMs) && observedAtMs >= cutoffMs;
    })
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
}

export async function fetchLatestObservationForStation(input: {
  station: StationLike;
  config?: ProviderLookupConfig | null;
}): Promise<ProviderObservationSample | null> {
  const provider = input.station.provider.trim().toLowerCase();

  if (provider === 'ambient') {
    const fromAmbient = await fetchAmbientLatest(input.station, input.config ?? {});
    if (fromAmbient) {
      return fromAmbient;
    }
  }

  if (provider === 'mesowest' || provider === 'madis') {
    const fromSynoptic = await fetchSynopticLatest(input.station, input.config ?? {});
    if (fromSynoptic) {
      return fromSynoptic;
    }
  }

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
  station: StationLike;
  days: number;
  config?: ProviderLookupConfig | null;
}): Promise<ProviderObservationSample[]> {
  const provider = input.station.provider.trim().toLowerCase();
  const days = Math.max(1, Math.min(Math.floor(input.days), 14));

  if (provider === 'ambient') {
    const fromAmbient = await fetchAmbientBackfill(input.station, days, input.config ?? {});
    if (fromAmbient.length > 0) {
      return fromAmbient;
    }
  }

  if (provider === 'mesowest' || provider === 'madis') {
    const fromSynoptic = await fetchSynopticBackfill(input.station, days, input.config ?? {});
    if (fromSynoptic.length > 0) {
      return fromSynoptic;
    }
  }

  if (provider === 'cwop' || provider === 'findu') {
    const fromCwop = await fetchBackfillCwopLikeObservations({
      provider,
      externalId: input.station.externalId,
      days
    });

    if (fromCwop.length > 0) {
      return fromCwop;
    }
  }

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
