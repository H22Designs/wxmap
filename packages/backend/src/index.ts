import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { adminRouter } from './routes/adminRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { radarRouter } from './routes/radarRoutes.js';
import { weatherRouter } from './routes/weatherRoutes.js';
import { RealtimeBroadcaster } from './services/broadcaster.js';
import { CollectorService } from './services/collector.js';
import { ProviderStatusStore } from './services/providerStatusStore.js';
import type { Observation, Setting, Station, User } from './types/models.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const providerStatusStore = new ProviderStatusStore({
  providers: ['nws', 'madis', 'cwop', 'wunderground', 'ambient', 'acurite']
});

type StationRepositoryLike = {
  listStations: (args: { provider?: string; limit?: number }) => Station[];
  getStationById: (stationId: string) => Station | null;
};

type ObservationRepositoryLike = {
  listForStation: (stationId: string, limit?: number) => Observation[];
  listLatestForAllStations: (limit?: number) => Observation[];
};

type SettingsRepositoryLike = {
  listSettings: () => Setting[];
  setSetting: (key: string, value: string) => Setting;
};

type UserRepositoryLike = {
  findByUsername: (username: string) => User | null;
  findByEmail: (email: string) => User | null;
  createUser: (args: {
    username: string;
    email: string;
    passwordHash: string;
    role?: 'user' | 'admin';
  }) => User;
};

function createInMemoryRepositories(): {
  stationRepository: StationRepositoryLike;
  observationRepository: ObservationRepositoryLike;
  settingsRepository: SettingsRepositoryLike;
  userRepository: UserRepositoryLike;
} {
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const stations: Station[] = [
    {
      id: 'station-wu-kalmillp10',
      provider: 'wunderground',
      externalId: 'kalmillp10',
      name: 'KALMILLP10 (Built-in)',
      lat: 45.6573,
      lng: -68.7098,
      elevationM: 104,
      active: true,
      createdAt: nowIso
    },
    {
      id: 'station-wu-kalmillp8',
      provider: 'wunderground',
      externalId: 'kalmillp8',
      name: 'KALMILLP8 (Built-in)',
      lat: 45.655,
      lng: -68.706,
      elevationM: 106,
      active: true,
      createdAt: nowIso
    },
    {
      id: 'station-ambient-kalmillambient1',
      provider: 'ambient',
      externalId: 'kalmillambient1',
      name: 'KALMILLAMBIENT1 (Built-in)',
      lat: 45.6561,
      lng: -68.7072,
      elevationM: 105,
      active: true,
      createdAt: nowIso
    }
  ];

  const observations: Observation[] = [
    {
      id: 'obs-station-wu-kalmillp10-latest',
      stationId: 'station-wu-kalmillp10',
      observedAt: new Date(now).toISOString(),
      tempC: 7.8,
      humidityPct: 81,
      pressureHpa: 1015.1,
      windSpeedMs: 2.7,
      windDirDeg: 144,
      precipMm: 0,
      rawJson: JSON.stringify({ source: 'memory-seed', station: 'kalmillp10' })
    },
    {
      id: 'obs-station-wu-kalmillp8-latest',
      stationId: 'station-wu-kalmillp8',
      observedAt: new Date(now - 3 * 60_000).toISOString(),
      tempC: 8.2,
      humidityPct: 79,
      pressureHpa: 1014.8,
      windSpeedMs: 3.1,
      windDirDeg: 152,
      precipMm: 0,
      rawJson: JSON.stringify({ source: 'memory-seed', station: 'kalmillp8' })
    },
    {
      id: 'obs-station-ambient-kalmillambient1-latest',
      stationId: 'station-ambient-kalmillambient1',
      observedAt: new Date(now - 2 * 60_000).toISOString(),
      tempC: 7.9,
      humidityPct: 80,
      pressureHpa: 1015.0,
      windSpeedMs: 2.9,
      windDirDeg: 148,
      precipMm: 0,
      rawJson: JSON.stringify({ source: 'memory-seed', station: 'kalmillambient1' })
    }
  ];

  const settingsMap = new Map<string, Setting>([
    [
      'collector.interval.pws.minutes',
      {
        key: 'collector.interval.pws.minutes',
        value: '5',
        updatedAt: nowIso
      }
    ],
    [
      'collector.interval.nws.minutes',
      {
        key: 'collector.interval.nws.minutes',
        value: '10',
        updatedAt: nowIso
      }
    ],
    [
      'provider.wunderground.enabled',
      {
        key: 'provider.wunderground.enabled',
        value: 'false',
        updatedAt: nowIso
      }
    ],
    [
      'provider.ambient.enabled',
      {
        key: 'provider.ambient.enabled',
        value: 'false',
        updatedAt: nowIso
      }
    ]
  ]);

  const users: User[] = [];

  return {
    stationRepository: {
      listStations: ({ provider, limit }) => {
        const filtered = stations.filter((station) => {
          if (!station.active) {
            return false;
          }

          if (!provider) {
            return true;
          }

          return station.provider === provider;
        });

        const safeLimit = Math.max(1, Math.min(limit ?? 100, 1000));
        return filtered.slice(0, safeLimit);
      },
      getStationById: (stationId) => stations.find((station) => station.id === stationId) ?? null
    },
    observationRepository: {
      listForStation: (stationId, limit = 120) => {
        const safeLimit = Math.max(1, Math.min(limit, 500));
        return observations
          .filter((item) => item.stationId === stationId)
          .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
          .slice(0, safeLimit);
      },
      listLatestForAllStations: (limit = 1000) => {
        const latestByStation = new Map<string, Observation>();

        for (const item of observations) {
          const existing = latestByStation.get(item.stationId);
          if (!existing || item.observedAt > existing.observedAt) {
            latestByStation.set(item.stationId, item);
          }
        }

        const safeLimit = Math.max(1, Math.min(limit, 5000));
        return [...latestByStation.values()]
          .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
          .slice(0, safeLimit);
      }
    },
    settingsRepository: {
      listSettings: () => [...settingsMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
      setSetting: (key, value) => {
        const setting: Setting = {
          key,
          value,
          updatedAt: new Date().toISOString()
        };

        settingsMap.set(key, setting);
        return setting;
      }
    },
    userRepository: {
      findByUsername: (username) => users.find((user) => user.username === username) ?? null,
      findByEmail: (email) => users.find((user) => user.email === email) ?? null,
      createUser: ({ username, email, passwordHash, role = 'user' }) => {
        const created: User = {
          id: crypto.randomUUID(),
          username,
          email,
          passwordHash,
          role,
          createdAt: new Date().toISOString()
        };

        users.push(created);
        return created;
      }
    }
  };
}

async function createRepositories(): Promise<{
  stationRepository: StationRepositoryLike;
  observationRepository: ObservationRepositoryLike;
  settingsRepository: SettingsRepositoryLike;
  userRepository: UserRepositoryLike;
  mode: 'sqlite' | 'memory';
}> {
  try {
    const [{ getDb }, { ObservationRepository }, { SettingsRepository }, { StationRepository }, { UserRepository }] =
      await Promise.all([
        import('./db/database.js'),
        import('./db/repositories/observationRepository.js'),
        import('./db/repositories/settingsRepository.js'),
        import('./db/repositories/stationRepository.js'),
        import('./db/repositories/userRepository.js')
      ]);

    const db = getDb();

    return {
      stationRepository: new StationRepository(db),
      observationRepository: new ObservationRepository(db),
      settingsRepository: new SettingsRepository(db),
      userRepository: new UserRepository(db),
      mode: 'sqlite'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.warn(
      '[wxmap] Falling back to in-memory data store. SQLite bindings are unavailable in this environment.',
      errorMessage
    );

    if (/better-sqlite3|bindings?/i.test(errorMessage)) {
      console.warn(
        '[wxmap] Fix hint: rebuild native bindings for your current Node version -> npm rebuild better-sqlite3 --workspace=packages/backend'
      );
    }

    return {
      ...createInMemoryRepositories(),
      mode: 'memory'
    };
  }
}

const { stationRepository, observationRepository, settingsRepository, userRepository, mode } = await createRepositories();

const httpServer = createServer(app);
const broadcaster = new RealtimeBroadcaster(httpServer);

const collectorService = new CollectorService({
  settingsRepository,
  providerStatusStore,
  onProviderCycleCompleted: (status) => {
    broadcaster.broadcast('collector.provider-sync', { ...status });
  }
});

app.use(cors());
app.use(express.json());

app.use('/api/v1/weather', weatherRouter({ stationRepository, observationRepository }));
app.use('/api/v1/radar', radarRouter);
app.use('/api/v1/auth', authRouter({ userRepository }));
app.use(
  '/api/v1/admin',
  adminRouter({
    settingsRepository,
    providerStatusStore,
    collectorService
  })
);

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wxmap-backend',
    storeMode: mode,
    timestamp: new Date().toISOString(),
    realtimeClients: broadcaster.getClientCount()
  });
});

collectorService.start();

httpServer.listen(port, () => {
  console.log(`wxmap backend listening on http://localhost:${port} (store=${mode})`);
});

function shutdown(): void {
  collectorService.stop();
  broadcaster.close();
  httpServer.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
