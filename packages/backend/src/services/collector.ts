import type { ProviderStatus } from '../types/models.js';
import { ProviderStatusStore } from './providerStatusStore.js';
import { getKnownProviders } from './providerCatalog.js';

type ProviderConfigRepositoryLike = {
  listConfigs: () => Array<{
    provider: string;
    enabled: boolean;
    intervalMinutes: number;
  }>;
};

type CollectorServiceDeps = {
  providerConfigRepository: ProviderConfigRepositoryLike;
  providerStatusStore: ProviderStatusStore;
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
      await this.simulateProviderFetch(provider);

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

  private async simulateProviderFetch(_provider: string): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20);
    });
  }
}
