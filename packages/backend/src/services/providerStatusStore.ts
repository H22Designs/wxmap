import type { ProviderStatus } from '../types/models.js';

type ProviderStatusStoreOptions = {
  providers: string[];
};

const DEFAULT_INTERVAL_MINUTES = 5;

export class ProviderStatusStore {
  private readonly statusByProvider = new Map<string, ProviderStatus>();

  constructor(options: ProviderStatusStoreOptions) {
    for (const provider of options.providers) {
      this.statusByProvider.set(provider, {
        provider,
        enabled: provider === 'nws',
        intervalMinutes: DEFAULT_INTERVAL_MINUTES,
        state: 'idle',
        lastSyncAt: null,
        lastError: null,
        nextSyncAt: null
      });
    }
  }

  list(): ProviderStatus[] {
    return Array.from(this.statusByProvider.values())
      .map((item) => ({ ...item }))
      .sort((a, b) => a.provider.localeCompare(b.provider));
  }

  setConfig(provider: string, config: { enabled: boolean; intervalMinutes: number }): void {
    const existing = this.statusByProvider.get(provider);
    if (!existing) {
      return;
    }

    this.statusByProvider.set(provider, {
      ...existing,
      enabled: config.enabled,
      intervalMinutes: Math.max(1, Math.floor(config.intervalMinutes))
    });
  }

  markStarted(provider: string): void {
    const existing = this.statusByProvider.get(provider);
    if (!existing) {
      return;
    }

    this.statusByProvider.set(provider, {
      ...existing,
      state: 'running',
      lastError: null
    });
  }

  markCompleted(args: {
    provider: string;
    ok: boolean;
    at: string;
    nextSyncAt: string | null;
    error?: string;
  }): ProviderStatus | null {
    const existing = this.statusByProvider.get(args.provider);
    if (!existing) {
      return null;
    }

    const updated: ProviderStatus = {
      ...existing,
      state: args.ok ? 'ok' : 'error',
      lastSyncAt: args.at,
      lastError: args.ok ? null : args.error ?? 'unknown error',
      nextSyncAt: args.nextSyncAt
    };

    this.statusByProvider.set(args.provider, updated);
    return { ...updated };
  }
}
