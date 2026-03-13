export type ProviderStationCandidate = {
  provider: string;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  elevationM: number | null;
};

export type ProviderLookupConfig = {
  endpoint?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
};

const PROVIDER_LOOKUP_ALIASES: Record<string, string[]> = {
  cwop: ['cwop', 'findu'],
  findu: ['findu', 'cwop']
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

const PROVIDER_STATION_CATALOG: Record<string, ProviderStationCandidate[]> = {
  wunderground: [
    {
      provider: 'wunderground',
      externalId: 'kalmillp10',
      name: 'KALMILLP10',
      lat: 45.6573,
      lng: -68.7098,
      elevationM: 104
    },
    {
      provider: 'wunderground',
      externalId: 'kalmillp8',
      name: 'KALMILLP8',
      lat: 45.655,
      lng: -68.706,
      elevationM: 106
    },
    {
      provider: 'wunderground',
      externalId: 'kcasanfr70',
      name: 'San Francisco Personal Weather Station',
      lat: 37.7749,
      lng: -122.4194,
      elevationM: 16
    }
  ],
  ambient: [
    {
      provider: 'ambient',
      externalId: 'kalmillambient1',
      name: 'KALMILLAMBIENT1',
      lat: 45.6561,
      lng: -68.7072,
      elevationM: 105
    },
    {
      provider: 'ambient',
      externalId: 'ambient-seattle-demo',
      name: 'Ambient Seattle Demo Station',
      lat: 47.6062,
      lng: -122.3321,
      elevationM: 52
    }
  ],
  nws: [
    {
      provider: 'nws',
      externalId: 'KSEA',
      name: 'Seattle-Tacoma Intl Airport',
      lat: 47.449,
      lng: -122.309,
      elevationM: 132
    },
    {
      provider: 'nws',
      externalId: 'KBOS',
      name: 'Boston Logan Intl Airport',
      lat: 42.3656,
      lng: -71.0096,
      elevationM: 6
    },
    {
      provider: 'nws',
      externalId: 'KJFK',
      name: 'John F. Kennedy Intl Airport',
      lat: 40.6413,
      lng: -73.7781,
      elevationM: 4
    }
  ],
  noaa: [
    {
      provider: 'noaa',
      externalId: '72503',
      name: 'Los Angeles Intl (NOAA)',
      lat: 33.9425,
      lng: -118.4081,
      elevationM: 38
    },
    {
      provider: 'noaa',
      externalId: '72509',
      name: 'Boston Logan (NOAA)',
      lat: 42.3606,
      lng: -71.0096,
      elevationM: 6
    }
  ],
  cwop: [
    {
      provider: 'cwop',
      externalId: 'FW4617',
      name: 'Fayette CWOP Station (FW4617)',
      lat: 33.7084,
      lng: -87.9751,
      elevationM: 114.6
    },
    {
      provider: 'cwop',
      externalId: 'CW1111',
      name: 'CWOP Demo East',
      lat: 42.3601,
      lng: -71.0589,
      elevationM: 12
    },
    {
      provider: 'cwop',
      externalId: 'CW2222',
      name: 'CWOP Demo Central',
      lat: 41.8781,
      lng: -87.6298,
      elevationM: 181
    },
    {
      provider: 'cwop',
      externalId: 'CW3333',
      name: 'CWOP Demo West',
      lat: 34.0522,
      lng: -118.2437,
      elevationM: 89
    }
  ],
  findu: [
    {
      provider: 'findu',
      externalId: 'FW4617',
      name: 'Fayette CWOP/FindU Station (FW4617)',
      lat: 33.7084,
      lng: -87.9751,
      elevationM: 114.6
    }
  ],
  airport: [
    {
      provider: 'airport',
      externalId: 'KSEA',
      name: 'Seattle-Tacoma Intl Airport',
      lat: 47.449,
      lng: -122.309,
      elevationM: 132
    },
    {
      provider: 'airport',
      externalId: 'KBOS',
      name: 'Boston Logan Intl Airport',
      lat: 42.3656,
      lng: -71.0096,
      elevationM: 6
    },
    {
      provider: 'airport',
      externalId: 'KJFK',
      name: 'John F. Kennedy Intl Airport',
      lat: 40.6413,
      lng: -73.7781,
      elevationM: 4
    },
    {
      provider: 'airport',
      externalId: 'KLAX',
      name: 'Los Angeles Intl Airport',
      lat: 33.9425,
      lng: -118.4081,
      elevationM: 38
    }
  ]
};

function normalizeAirportStationId(externalId: string): string {
  const raw = externalId.trim().toUpperCase();

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

function resolveProviderKeys(provider: string): string[] {
  const normalized = provider.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return PROVIDER_LOOKUP_ALIASES[normalized] ?? [normalized];
}

function listCandidatesForProvider(provider: string): ProviderStationCandidate[] {
  const keys = resolveProviderKeys(provider);
  const merged = new Map<string, ProviderStationCandidate>();

  for (const key of keys) {
    const entries = PROVIDER_STATION_CATALOG[key] ?? [];

    for (const entry of entries) {
      const externalKey = entry.externalId.toLowerCase();

      if (!merged.has(externalKey)) {
        merged.set(externalKey, {
          ...entry,
          provider: provider.trim().toLowerCase() || entry.provider
        });
      }
    }
  }

  return [...merged.values()];
}

function normalizeCandidate(input: {
  provider: string;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  elevationM: number | null;
}): ProviderStationCandidate | null {
  const provider = input.provider.trim().toLowerCase();
  const externalId = input.externalId.trim();
  const name = input.name.trim();

  if (!provider || !externalId || !name) {
    return null;
  }

  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    return null;
  }

  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
    return null;
  }

  return {
    provider,
    externalId,
    name,
    lat: input.lat,
    lng: input.lng,
    elevationM: input.elevationM
  };
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

function extractString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function resolveViaWeatherGov(provider: string, externalId: string): Promise<ProviderStationCandidate | null> {
  const stationId = provider === 'airport'
    ? normalizeAirportStationId(externalId)
    : externalId.trim().toUpperCase();
  if (!stationId) {
    return null;
  }

  const response = await fetch(`https://api.weather.gov/stations/${encodeURIComponent(stationId)}`, {
    headers: {
      Accept: 'application/geo+json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const properties = (payload.properties as Record<string, unknown> | undefined) ?? {};
  const geometry = (payload.geometry as Record<string, unknown> | undefined) ?? {};
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

  const lng = typeof coordinates[0] === 'number' ? coordinates[0] : null;
  const lat = typeof coordinates[1] === 'number' ? coordinates[1] : null;
  const name = extractString(properties, ['name']) ?? `${provider.toUpperCase()} ${stationId}`;
  const elevationObj = (properties.elevation as Record<string, unknown> | undefined) ?? {};
  const elevationM = extractNumber(elevationObj, ['value']);

  if (lat === null || lng === null) {
    return null;
  }

  return normalizeCandidate({
    provider,
    externalId: stationId,
    name,
    lat,
    lng,
    elevationM
  });
}

async function resolveViaWxqa(provider: string, externalId: string): Promise<ProviderStationCandidate | null> {
  const stationId = externalId.trim().toUpperCase();
  if (!stationId) {
    return null;
  }

  const response = await fetch(`http://www.wxqa.com/sss/search1.cgi?keyword=${encodeURIComponent(stationId)}`);

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const escaped = stationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowRegex = new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+?)\\|\\s*([\\-\\d.]+)\\s*\\/\\s*([\\-\\d.]+)\\s*\\|\\s*([\\-\\d.]+|)\\s*\\|`, 'i');
  const match = html.match(rowRegex);

  if (!match) {
    return null;
  }

  const town = match[1]?.trim() || stationId;
  const lat = Number(match[2]);
  const lng = Number(match[3]);
  const elevationRaw = match[4]?.trim();
  const elevationM = elevationRaw ? Number(elevationRaw) : null;

  return normalizeCandidate({
    provider,
    externalId: stationId,
    name: `${town} (${stationId})`,
    lat,
    lng,
    elevationM: elevationM !== null && Number.isFinite(elevationM) ? elevationM : null
  });
}

function buildCustomEndpointUrl(config: ProviderLookupConfig, provider: string, externalId: string): string | null {
  const endpoint = config.endpoint?.trim();
  if (!endpoint) {
    return null;
  }

  if (endpoint.includes('{stationId}') || endpoint.includes('{provider}')) {
    return endpoint
      .replaceAll('{stationId}', encodeURIComponent(externalId))
      .replaceAll('{provider}', encodeURIComponent(provider));
  }

  const url = new URL(endpoint);
  if (!url.searchParams.has('stationId')) {
    url.searchParams.set('stationId', externalId);
  }
  if (!url.searchParams.has('provider')) {
    url.searchParams.set('provider', provider);
  }
  return url.toString();
}

async function resolveViaCustomEndpoint(
  provider: string,
  externalId: string,
  config: ProviderLookupConfig
): Promise<ProviderStationCandidate | null> {
  const url = buildCustomEndpointUrl(config, provider, externalId);
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
  const root = (payload.station as Record<string, unknown> | undefined) ?? payload;

  const lat = extractNumber(root, ['lat', 'latitude']);
  const lng = extractNumber(root, ['lng', 'lon', 'longitude']);
  const name = extractString(root, ['name', 'stationName']) ?? `${provider.toUpperCase()} ${externalId}`;
  const elevationM = extractNumber(root, ['elevationM', 'elevation', 'elevation_m']);

  if (lat === null || lng === null) {
    return null;
  }

  return normalizeCandidate({
    provider,
    externalId,
    name,
    lat,
    lng,
    elevationM
  });
}

async function resolveViaSynoptic(
  provider: string,
  externalId: string,
  config: ProviderLookupConfig
): Promise<ProviderStationCandidate | null> {
  const token = config.apiKey?.trim();
  if (!token) {
    return null;
  }

  const endpoint = config.endpoint?.trim() || 'https://api.synopticdata.com/v2/stations/metadata';
  const url = new URL(endpoint);
  url.searchParams.set('stid', externalId);
  url.searchParams.set('token', token);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const summary = (payload.SUMMARY as Record<string, unknown> | undefined) ?? {};
  const ok = extractNumber(summary, ['RESPONSE_CODE']);
  if (ok !== null && ok !== 1) {
    return null;
  }

  const stations = Array.isArray(payload.STATION) ? payload.STATION : [];
  const first = (stations[0] as Record<string, unknown> | undefined) ?? null;
  if (!first) {
    return null;
  }

  const lat = extractNumber(first, ['LATITUDE', 'latitude', 'lat']);
  const lng = extractNumber(first, ['LONGITUDE', 'longitude', 'lon', 'lng']);
  const name = extractString(first, ['NAME', 'name']) ?? `${provider.toUpperCase()} ${externalId}`;
  const elevationM = extractNumber(first, ['ELEVATION', 'elevation', 'elevation_m']);

  if (lat === null || lng === null) {
    return null;
  }

  return normalizeCandidate({
    provider,
    externalId,
    name,
    lat,
    lng,
    elevationM
  });
}

export function findProviderStationCandidate(input: {
  provider: string;
  externalId: string;
}): ProviderStationCandidate | null {
  const provider = input.provider.trim().toLowerCase();
  const externalId = provider === 'airport'
    ? normalizeAirportStationId(input.externalId).toLowerCase()
    : input.externalId.trim().toLowerCase();

  if (!provider || !externalId) {
    return null;
  }

  const candidates = listCandidatesForProvider(provider);
  return candidates.find((item) => item.externalId.toLowerCase() === externalId) ?? null;
}

export async function resolveProviderStationCandidate(input: {
  provider: string;
  externalId: string;
  config?: ProviderLookupConfig | null;
}): Promise<ProviderStationCandidate | null> {
  const provider = input.provider.trim().toLowerCase();
  const externalId = provider === 'airport'
    ? normalizeAirportStationId(input.externalId)
    : input.externalId.trim();

  if (!provider || !externalId) {
    return null;
  }

  const local = findProviderStationCandidate({ provider, externalId });
  if (local) {
    return local;
  }

  try {
    if (provider === 'cwop' || provider === 'findu') {
      const fromWxqa = await resolveViaWxqa(provider, externalId);
      if (fromWxqa) {
        return fromWxqa;
      }
    }

    if (provider === 'nws' || provider === 'noaa' || provider === 'airport') {
      const fromWeatherGov = await resolveViaWeatherGov(provider, externalId);
      if (fromWeatherGov) {
        return fromWeatherGov;
      }
    }

    if (provider === 'mesowest') {
      const fromSynoptic = await resolveViaSynoptic(provider, externalId, input.config ?? {});
      if (fromSynoptic) {
        return fromSynoptic;
      }
    }

    if (input.config?.endpoint) {
      const fromCustomEndpoint = await resolveViaCustomEndpoint(provider, externalId, input.config);
      if (fromCustomEndpoint) {
        return fromCustomEndpoint;
      }
    }
  } catch {
    // Gracefully fallback to manual entry when source lookups are unavailable.
  }

  return null;
}

export function listProviderStationCandidates(input: {
  provider: string;
  query?: string;
  limit?: number;
}): ProviderStationCandidate[] {
  const provider = input.provider.trim().toLowerCase();
  const query = (input.query ?? '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(input.limit ?? 50, 500));
  const candidates = listCandidatesForProvider(provider);

  const filtered = query
    ? candidates.filter((item) => {
        const target = `${item.externalId} ${item.name}`.toLowerCase();
        return target.includes(query);
      })
    : candidates;

  return filtered.slice(0, limit);
}
