import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'node:http';
import { getDb } from './db/database.js';
import { ObservationRepository } from './db/repositories/observationRepository.js';
import { SettingsRepository } from './db/repositories/settingsRepository.js';
import { StationRepository } from './db/repositories/stationRepository.js';
import { UserRepository } from './db/repositories/userRepository.js';
import { adminRouter } from './routes/adminRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { radarRouter } from './routes/radarRoutes.js';
import { weatherRouter } from './routes/weatherRoutes.js';
import { RealtimeBroadcaster } from './services/broadcaster.js';
import { CollectorService } from './services/collector.js';
import { ProviderStatusStore } from './services/providerStatusStore.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const db = getDb();
const stationRepository = new StationRepository(db);
const observationRepository = new ObservationRepository(db);
const settingsRepository = new SettingsRepository(db);
const userRepository = new UserRepository(db);
const providerStatusStore = new ProviderStatusStore({
  providers: ['nws', 'madis', 'cwop', 'wunderground', 'ambient', 'acurite']
});

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
app.use('/api/v1/admin', adminRouter({ settingsRepository, providerStatusStore, collectorService }));

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wxmap-backend',
    timestamp: new Date().toISOString(),
    realtimeClients: broadcaster.getClientCount()
  });
});

collectorService.start();

httpServer.listen(port, () => {
  console.log(`wxmap backend listening on http://localhost:${port}`);
});

function shutdown(): void {
  collectorService.stop();
  broadcaster.close();
  httpServer.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
