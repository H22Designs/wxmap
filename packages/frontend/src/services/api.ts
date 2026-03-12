type HealthResponse = {
  status: string;
};

type StationsResponse = {
  items: Station[];
};

type CurrentResponse = {
  items: CurrentObservation[];
  collectedAt: string;
};

type StationObservationsResponse = {
  station: Station;
  items: Observation[];
};

type RadarFramesResponse = {
  location: {
    lat: number | null;
    lng: number | null;
  };
  frameIntervalMinutes: number;
  selectedHours: number;
  frameDensity?: 'normal' | 'dense';
  frames: RadarFrame[];
};

export type RadarFrameDensity = 'normal' | 'dense' | 'ultra';

type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
};

type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: AuthUser;
};

type RegisterResponse = AuthUser;

type AdminSettingsResponse = {
  items: AdminSetting[];
};

type AdminProvidersResponse = {
  items: AdminProviderStatus[];
};

export type AdminSetting = {
  key: string;
  value: string;
  updatedAt: string;
};

export type AdminProviderStatus = {
  provider: string;
  enabled: boolean;
  intervalMinutes: number;
  endpoint?: string | null;
  updatedAt?: string;
  state: 'idle' | 'running' | 'ok' | 'error';
  lastSyncAt: string | null;
  lastError: string | null;
  nextSyncAt: string | null;
};

export type Station = {
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

export type LoginResult = LoginResponse;
export type RegisterResult = RegisterResponse;

export type CurrentObservation = {
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
};

export type Observation = CurrentObservation;

export type RadarFrame = {
  id: string;
  observedAt: string;
  tileUrl: string;
};

export class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '/api/v1';

export async function fetchHealth(): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as HealthResponse;
  return payload.status;
}

export async function fetchStations(limit = 50): Promise<Station[]> {
  const response = await fetch(`${apiBaseUrl}/weather/stations?limit=${limit}`);

  if (!response.ok) {
    throw new Error(`Stations request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as StationsResponse;
  return payload.items;
}

export async function fetchCurrentObservations(): Promise<CurrentObservation[]> {
  const response = await fetch(`${apiBaseUrl}/weather/current`);

  if (!response.ok) {
    throw new Error(`Current weather request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as CurrentResponse;
  return payload.items;
}

export async function fetchStationObservations(input: {
  stationId: string;
  limit?: number;
}): Promise<Observation[]> {
  const query = new URLSearchParams();

  if (typeof input.limit === 'number') {
    query.set('limit', String(Math.max(1, Math.floor(input.limit))));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const response = await fetch(
    `${apiBaseUrl}/weather/stations/${encodeURIComponent(input.stationId)}/observations${suffix}`
  );

  if (!response.ok) {
    throw new Error(`Station observations request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as StationObservationsResponse;
  return payload.items;
}

export async function fetchRadarFrames(input: {
  lat: number;
  lng: number;
  hours: 1 | 3 | 6 | 12;
  frameDensity?: RadarFrameDensity;
}): Promise<RadarFrame[]> {
  const query = new URLSearchParams({
    lat: input.lat.toFixed(4),
    lng: input.lng.toFixed(4),
    hours: String(input.hours),
    frameDensity: input.frameDensity === 'ultra' ? 'dense' : (input.frameDensity ?? 'normal')
  });

  const response = await fetch(`${apiBaseUrl}/radar/frames?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`Radar frames request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as RadarFramesResponse;
  return payload.frames;
}

export async function registerUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Register request failed with status ${response.status}`);
  }

  return (await response.json()) as RegisterResponse;
}

export async function loginUser(input: {
  username: string;
  password: string;
}): Promise<LoginResult> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Login request failed with status ${response.status}`);
  }

  return (await response.json()) as LoginResponse;
}

export async function fetchAdminSettings(accessToken: string): Promise<AdminSettingsResponse['items']> {
  const response = await fetch(`${apiBaseUrl}/admin/settings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpStatusError(
      errorText || `Admin settings request failed with status ${response.status}`,
      response.status
    );
  }

  const payload = (await response.json()) as AdminSettingsResponse;
  return payload.items;
}

export async function updateAdminSetting(input: {
  accessToken: string;
  key: string;
  value: string;
}): Promise<AdminSetting> {
  const response = await fetch(`${apiBaseUrl}/admin/settings/${encodeURIComponent(input.key)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: input.value })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpStatusError(
      errorText || `Update setting request failed with status ${response.status}`,
      response.status
    );
  }

  return (await response.json()) as AdminSetting;
}

export async function fetchAdminProviders(accessToken: string): Promise<AdminProvidersResponse['items']> {
  const response = await fetch(`${apiBaseUrl}/admin/providers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpStatusError(
      errorText || `Admin providers request failed with status ${response.status}`,
      response.status
    );
  }

  const payload = (await response.json()) as AdminProvidersResponse;
  return payload.items;
}

export async function triggerAdminProviderSync(input: {
  accessToken: string;
  provider: string;
}): Promise<AdminProviderStatus> {
  const response = await fetch(`${apiBaseUrl}/admin/providers/${encodeURIComponent(input.provider)}/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpStatusError(
      errorText || `Trigger provider sync request failed with status ${response.status}`,
      response.status
    );
  }

  return (await response.json()) as AdminProviderStatus;
}

export async function updateAdminProviderConfig(input: {
  accessToken: string;
  provider: string;
  enabled?: boolean;
  intervalMinutes?: number;
  endpoint?: string | null;
}): Promise<AdminProviderStatus> {
  const body: Record<string, boolean | number | string | null> = {};

  if (typeof input.enabled === 'boolean') {
    body.enabled = input.enabled;
  }

  if (typeof input.intervalMinutes === 'number') {
    body.intervalMinutes = input.intervalMinutes;
  }

  if (input.endpoint !== undefined) {
    body.endpoint = input.endpoint;
  }

  const response = await fetch(`${apiBaseUrl}/admin/providers/${encodeURIComponent(input.provider)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpStatusError(
      errorText || `Update provider config request failed with status ${response.status}`,
      response.status
    );
  }

  return (await response.json()) as AdminProviderStatus;
}
