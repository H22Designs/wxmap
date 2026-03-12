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
    res.status(200).json({
      items: deps.providerStatusStore.list()
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

    if (!hasEnabled && !hasInterval) {
      res.status(400).json({ error: 'At least one of enabled or intervalMinutes is required' });
      return;
    }

    if (hasEnabled) {
      deps.settingsRepository.setSetting(
        `provider.${provider}.enabled`,
        req.body.enabled ? 'true' : 'false'
      );
    }

    if (hasInterval) {
      const rawInterval = Number(req.body.intervalMinutes);
      const parsedInterval = Number.isFinite(rawInterval) ? Math.floor(rawInterval) : NaN;

      if (!Number.isFinite(parsedInterval) || parsedInterval < 1 || parsedInterval > 240) {
        res.status(400).json({ error: 'intervalMinutes must be an integer between 1 and 240' });
        return;
      }

      deps.settingsRepository.setSetting(
        `provider.${provider}.interval.minutes`,
        String(parsedInterval)
      );
    }

    deps.collectorService.refreshSchedules();

    const updated = deps.providerStatusStore.list().find((item) => item.provider === provider);

    if (!updated) {
      res.status(404).json({ error: `Unknown provider '${provider}'` });
      return;
    }

    res.status(200).json(updated);
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
