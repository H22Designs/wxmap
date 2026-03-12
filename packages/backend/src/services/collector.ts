import type { SettingsRepository } from '../db/repositories/settingsRepository.js';
import type { ProviderStatus } from '../types/models.js';
import { ProviderStatusStore } from './providerStatusStore.js';

type CollectorServiceDeps = {
  settingsRepository: SettingsRepository;
  providerStatusStore: ProviderStatusStore;
  onProviderCycleCompleted?: (status: ProviderStatus) => void;
};

type ProviderPlan = {
  provider: string;
  enabled: boolean;
  intervalMinutes: number;
};

const PWS_PROVIDERS = new Set(['wunderground', 'ambient', 'acurite']);

export class CollectorService {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly providers = ['nws', 'madis', 'cwop', 'wunderground', 'ambient', 'acurite'];

  constructor(private readonly deps: CollectorServiceDeps) {}

  start(): void {
    this.refreshSchedules();
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }

    this.timers.clear();
  }

  refreshSchedules(): void {
    this.stop();

    const settings = this.deps.settingsRepository.listSettings();
    const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]));

    for (const provider of this.providers) {
      const isPws = PWS_PROVIDERS.has(provider);
      const intervalKey = isPws
        ? 'collector.interval.pws.minutes'
        : 'collector.interval.nws.minutes';
      const intervalMinutes = this.parsePositiveInt(settingsMap.get(intervalKey), isPws ? 5 : 10);
      const enabledDefault = provider === 'nws';
      const enabled = this.parseBoolean(settingsMap.get(`provider.${provider}.enabled`), enabledDefault);

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

  private async runProviderCycle(provider: string, intervalMinutes: number): Promise<void> {
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
    }
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }

    return fallback;
  }

  private async simulateProviderFetch(_provider: string): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20);
    });
  }
}
