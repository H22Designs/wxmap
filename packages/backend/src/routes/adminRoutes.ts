import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import type { CollectorService } from '../services/collector.js';
import { ProviderStatusStore } from '../services/providerStatusStore.js';

type SettingsRepositoryLike = {
  listSettings: () => Array<unknown>;
  setSetting: (key: string, value: string) => unknown;
};

type AdminRouterDeps = {
  settingsRepository: SettingsRepositoryLike;
  providerConfigRepository: {
    listConfigs: () => Array<{
      provider: string;
      enabled: boolean;
      intervalMinutes: number;
      endpoint: string | null;
      apiKey: string | null;
      apiSecret: string | null;
      updatedAt: string;
    }>;
    upsertConfig: (input: {
      provider: string;
      enabled?: boolean;
      intervalMinutes?: number;
      endpoint?: string | null;
      apiKey?: string | null;
      apiSecret?: string | null;
    }) => unknown;
  };
  providerStatusStore: ProviderStatusStore;
  collectorService: CollectorService;
};

export function adminRouter(deps: AdminRouterDeps): Router {
  const router = Router();

  router.use(requireAdmin);

  router.get('/settings', (_req, res) => {
    const items = deps.settingsRepository.listSettings();
    res.status(200).json({ items });
  });

  router.get('/dashboard', (_req, res) => {
    const providerConfigs = deps.providerConfigRepository.listConfigs();
    const providerStatuses = deps.providerStatusStore.list();
    const runningProviders = providerStatuses.filter((item) => item.state === 'running').length;
    const errorProviders = providerStatuses.filter((item) => item.state === 'error').length;

    res.status(200).json({
      counts: {
        providers: providerConfigs.length,
        enabledProviders: providerConfigs.filter((item) => item.enabled).length,
        runningProviders,
        errorProviders
      },
      providerConfigs,
      providerStatuses
    });
  });

  router.put('/settings/:key', (req, res) => {
    const key = req.params.key;
    const value = String(req.body?.value ?? '').trim();

    if (!value) {
      res.status(400).json({ error: 'value is required' });
      return;
    }

    const updated = deps.settingsRepository.setSetting(key, value);

    res.status(200).json(updated);
  });

  router.get('/providers', (_req, res) => {
    const statusByProvider = new Map(
      deps.providerStatusStore.list().map((status) => [status.provider, status] as const)
    );
    const items = deps.providerConfigRepository.listConfigs().map((config) => {
      const status = statusByProvider.get(config.provider);
      return {
        provider: config.provider,
        enabled: config.enabled,
        intervalMinutes: config.intervalMinutes,
        endpoint: config.endpoint,
        hasApiKey: Boolean(config.apiKey),
        hasApiSecret: Boolean(config.apiSecret),
        updatedAt: config.updatedAt,
        state: status?.state ?? 'idle',
        lastSyncAt: status?.lastSyncAt ?? null,
        lastError: status?.lastError ?? null,
        nextSyncAt: status?.nextSyncAt ?? null
      };
    });

    res.status(200).json({
      items
    });
  });

  router.put('/providers/:provider', (req, res) => {
    const provider = String(req.params.provider ?? '').trim().toLowerCase();

    if (!provider) {
      res.status(400).json({ error: 'provider is required' });
      return;
    }

    const knownProviders = new Set(deps.collectorService.listProviders());

    if (!knownProviders.has(provider)) {
      res.status(404).json({ error: `Unknown provider '${provider}'` });
      return;
    }

    const hasEnabled = typeof req.body?.enabled === 'boolean';
    const hasInterval = req.body?.intervalMinutes !== undefined;
    const hasEndpoint = req.body?.endpoint !== undefined;
    const hasApiKey = req.body?.apiKey !== undefined;
    const hasApiSecret = req.body?.apiSecret !== undefined;

    if (!hasEnabled && !hasInterval && !hasEndpoint && !hasApiKey && !hasApiSecret) {
      res.status(400).json({ error: 'At least one of enabled, intervalMinutes, endpoint, apiKey, or apiSecret is required' });
      return;
    }

    const updatePayload: {
      provider: string;
      enabled?: boolean;
      intervalMinutes?: number;
      endpoint?: string | null;
      apiKey?: string | null;
      apiSecret?: string | null;
    } = { provider };

    if (hasEnabled) {
      updatePayload.enabled = req.body.enabled;
    }

    if (hasInterval) {
      const rawInterval = Number(req.body.intervalMinutes);
      const parsedInterval = Number.isFinite(rawInterval) ? Math.floor(rawInterval) : NaN;

      if (!Number.isFinite(parsedInterval) || parsedInterval < 1 || parsedInterval > 240) {
        res.status(400).json({ error: 'intervalMinutes must be an integer between 1 and 240' });
        return;
      }

      updatePayload.intervalMinutes = parsedInterval;
    }

    if (hasEndpoint) {
      const endpoint = String(req.body.endpoint ?? '').trim();
      updatePayload.endpoint = endpoint.length > 0 ? endpoint : null;
    }

    if (req.body?.apiKey !== undefined) {
      const apiKey = String(req.body.apiKey ?? '').trim();
      updatePayload.apiKey = apiKey.length > 0 ? apiKey : null;
    }

    if (req.body?.apiSecret !== undefined) {
      const apiSecret = String(req.body.apiSecret ?? '').trim();
      updatePayload.apiSecret = apiSecret.length > 0 ? apiSecret : null;
    }

    deps.providerConfigRepository.upsertConfig(updatePayload);

    deps.collectorService.refreshSchedules();

    const status = deps.providerStatusStore.list().find((item) => item.provider === provider);
    const config = deps.providerConfigRepository.listConfigs().find((item) => item.provider === provider);

    if (!status || !config) {
      res.status(404).json({ error: `Unknown provider '${provider}'` });
      return;
    }

    res.status(200).json({
      provider: config.provider,
      enabled: config.enabled,
      intervalMinutes: config.intervalMinutes,
      endpoint: config.endpoint,
      hasApiKey: Boolean(config.apiKey),
      hasApiSecret: Boolean(config.apiSecret),
      updatedAt: config.updatedAt,
      state: status.state,
      lastSyncAt: status.lastSyncAt,
      lastError: status.lastError,
      nextSyncAt: status.nextSyncAt
    });
  });

  router.post('/providers/:provider/sync', async (req, res) => {
    const provider = String(req.params.provider ?? '').trim().toLowerCase();

    if (!provider) {
      res.status(400).json({ error: 'provider is required' });
      return;
    }

    const status = await deps.collectorService.runNow(provider);

    if (!status) {
      res.status(404).json({ error: `Unknown provider '${provider}'` });
      return;
    }

    res.status(200).json(status);
  });

  return router;
}
