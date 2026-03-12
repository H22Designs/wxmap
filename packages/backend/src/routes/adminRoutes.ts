import { Router } from 'express';
import type { SettingsRepository } from '../db/repositories/settingsRepository.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { ProviderStatusStore } from '../services/providerStatusStore.js';

type AdminRouterDeps = {
  settingsRepository: SettingsRepository;
  providerStatusStore: ProviderStatusStore;
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

  return router;
}
