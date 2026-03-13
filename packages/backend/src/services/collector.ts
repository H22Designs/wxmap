import type { ProviderStatus } from '../types/models.js';
import { ProviderStatusStore } from './providerStatusStore.js';
import { getKnownProviders } from './providerCatalog.js';
import { fetchLatestObservationForStation } from './providerObservations.js';

type ProviderConfigRepositoryLike = {
  listConfigs: () => Array<{
    provider: string;
    enabled: boolean;
    intervalMinutes: number;
    endpoint: string | null;
    apiKey: string | null;
    apiSecret: string | null;
  }>;
  getConfig: (provider: string) => {
    provider: string;
    enabled: boolean;
    intervalMinutes: number;
    endpoint: string | null;
    apiKey: string | null;
    apiSecret: string | null;
  } | null;
};

type StationRepositoryLike = {
  listStations: (args: { provider?: string; limit?: number }) => Array<{
    id: string;
    provider: string;
    externalId: string;
    name: string;
    lat: number;
    lng: number;
    elevationM: number | null;
    active: boolean;
    createdAt: string;
  }>;
};

type ObservationRepositoryLike = {
  upsertObservation: (input: {
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

type CollectorServiceDeps = {
  providerConfigRepository: ProviderConfigRepositoryLike;
  providerStatusStore: ProviderStatusStore;
  stationRepository: StationRepositoryLike;
  observationRepository: ObservationRepositoryLike;
  onProviderCycleCompleted?: (status: ProviderStatus) => void;
};

type ProviderPlan = {
  provider: string;
  enabled: boolean;
  intervalMinutes: number;
};

export class CollectorService {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly providers = getKnownProviders();

  constructor(private readonly deps: CollectorServiceDeps) {}

  start(): void {
    this.refreshSchedules();
  }

  listProviders(): string[] {
    return [...this.providers];
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }

    this.timers.clear();
  }

  refreshSchedules(): void {
    this.stop();

    const configByProvider = new Map(
      this.deps.providerConfigRepository
        .listConfigs()
        .map((config) => [config.provider, config] as const)
    );

    for (const provider of this.providers) {
      const config = configByProvider.get(provider);
      const intervalMinutes = this.parsePositiveInt(config?.intervalMinutes, provider === 'nws' ? 10 : 5);
      const enabled = this.parseBoolean(config?.enabled, provider === 'nws');

      const plan: ProviderPlan = {
        provider,
        enabled,
        intervalMinutes
      };

      this.deps.providerStatusStore.setConfig(plan.provider, {
        enabled: plan.enabled,
        intervalMinutes: plan.intervalMinutes
      });

      if (!plan.enabled) {
        continue;
      }

      void this.runProviderCycle(plan.provider, plan.intervalMinutes);

      const timer = setInterval(() => {
        void this.runProviderCycle(plan.provider, plan.intervalMinutes);
      }, plan.intervalMinutes * 60_000);

      this.timers.set(plan.provider, timer);
    }
  }

  async runNow(provider: string): Promise<ProviderStatus | null> {
    if (!this.providers.includes(provider)) {
      return null;
    }

    const status = this.deps.providerStatusStore.list().find((item) => item.provider === provider);
    const intervalMinutes = status?.intervalMinutes ?? 5;
    return this.runProviderCycle(provider, intervalMinutes);
  }

  private async runProviderCycle(provider: string, intervalMinutes: number): Promise<ProviderStatus | null> {
    this.deps.providerStatusStore.markStarted(provider);

    try {
      await this.fetchProviderStations(provider);

      const now = new Date();
      const nextSyncAt = new Date(now.getTime() + intervalMinutes * 60_000).toISOString();
      const status = this.deps.providerStatusStore.markCompleted({
        provider,
        ok: true,
        at: now.toISOString(),
        nextSyncAt
      });

      if (status) {
        this.deps.onProviderCycleCompleted?.(status);
      }

      return status;
    } catch (error) {
      const now = new Date();
      const nextSyncAt = new Date(now.getTime() + intervalMinutes * 60_000).toISOString();
      const status = this.deps.providerStatusStore.markCompleted({
        provider,
        ok: false,
        at: now.toISOString(),
        nextSyncAt,
        error: error instanceof Error ? error.message : 'unknown collector error'
      });

      if (status) {
        this.deps.onProviderCycleCompleted?.(status);
      }

      return status;
    }
  }

  private parsePositiveInt(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number') {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private parseBoolean(value: boolean | undefined, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private async fetchProviderStations(provider: string): Promise<void> {
    const stations = this.deps.stationRepository.listStations({
      provider,
      limit: 5000
    });

    if (stations.length === 0) {
      return;
    }

    const config = this.deps.providerConfigRepository.getConfig(provider);
    let successCount = 0;
    let failureCount = 0;
    let lastError: string | null = null;

    for (const station of stations) {
      try {
        const latest = await fetchLatestObservationForStation({
          station,
          config
        });

        if (!latest) {
          failureCount += 1;
          continue;
        }

        this.deps.observationRepository.upsertObservation({
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

        successCount += 1;
      } catch (error) {
        failureCount += 1;
        lastError = error instanceof Error ? error.message : 'unknown connector error';
      }
    }

    if (successCount === 0 && failureCount > 0) {
      throw new Error(lastError ?? `No observations fetched for provider '${provider}'`);
    }
  }
}
