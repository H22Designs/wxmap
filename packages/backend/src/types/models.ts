export type UserRole = 'user' | 'admin';

export type ProviderSyncState = 'idle' | 'running' | 'ok' | 'error';

export type ProviderConfig = {
  provider: string;
  enabled: boolean;
  intervalMinutes: number;
  endpoint: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  updatedAt: string;
};

export type ProviderStatus = {
  provider: string;
  enabled: boolean;
  intervalMinutes: number;
  state: ProviderSyncState;
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

export type Observation = {
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

export type Setting = {
  key: string;
  value: string;
  updatedAt: string;
};

export type User = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
};
