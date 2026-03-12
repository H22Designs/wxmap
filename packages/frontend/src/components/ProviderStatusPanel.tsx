import { useEffect, useState } from 'react';
import type { AdminProviderStatus } from '../services/api';
import { panelStyle } from '../styles/ui';

type ProviderStatusPanelProps = {
  status: string;
  providers: AdminProviderStatus[];
  isLoading: boolean;
  realtimeState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  syncingProvider: string | null;
  savingProviderConfig: string | null;
  onTriggerSync: (provider: string) => void;
  onSaveProviderConfig: (input: {
    provider: string;
    enabled: boolean;
    intervalMinutes: number;
  }) => void;
  onReload: () => void;
};

type ProviderDraft = {
  enabled: boolean;
  intervalMinutes: number;
};

function getRealtimeBadge(realtimeState: ProviderStatusPanelProps['realtimeState']): {
  label: string;
  color: string;
  background: string;
} {
  if (realtimeState === 'connected') {
    return { label: 'Live connected', color: '#166534', background: '#dcfce7' };
  }

  if (realtimeState === 'reconnecting') {
    return { label: 'Live reconnecting', color: '#92400e', background: '#fef3c7' };
  }

  if (realtimeState === 'connecting') {
    return { label: 'Live connecting', color: '#1e3a8a', background: '#dbeafe' };
  }

  return { label: 'Live disconnected', color: '#374151', background: '#f3f4f6' };
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString();
}

export function ProviderStatusPanel({
  status,
  providers,
  isLoading,
  realtimeState,
  syncingProvider,
  savingProviderConfig,
  onTriggerSync,
  onSaveProviderConfig,
  onReload
}: ProviderStatusPanelProps): JSX.Element {
  const [draftByProvider, setDraftByProvider] = useState<Record<string, ProviderDraft>>({});
  const realtimeBadge = getRealtimeBadge(realtimeState);

  useEffect(() => {
    const next: Record<string, ProviderDraft> = {};

    for (const provider of providers) {
      next[provider.provider] = {
        enabled: provider.enabled,
        intervalMinutes: provider.intervalMinutes
      };
    }

    setDraftByProvider(next);
  }, [providers]);

  return (
    <section style={panelStyle} aria-label="Provider sync status panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Provider status</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-label="Realtime connection state"
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              color: realtimeBadge.color,
              background: realtimeBadge.background
            }}
          >
            {realtimeBadge.label}
          </span>
          <button type="button" onClick={onReload} disabled={isLoading} aria-label="Reload provider statuses">
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      <p aria-live="polite" style={{ marginBottom: 8 }}>
        Provider status: <strong>{status}</strong>
      </p>
      {providers.length === 0 ? (
        <p>No provider statuses available yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th align="left">Provider</th>
                <th align="left">Enabled</th>
                <th align="left">State</th>
                <th align="left">Interval</th>
                <th align="left">Last Sync</th>
                <th align="left">Next Sync</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((item) => (
                <tr key={item.provider}>
                  <td style={{ padding: '4px 0' }}>
                    <code>{item.provider}</code>
                  </td>
                  <td>{item.enabled ? 'Yes' : 'No'}</td>
                  <td>{item.state}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={(draftByProvider[item.provider] ?? item).enabled}
                          onChange={(event) =>
                            setDraftByProvider((previous) => ({
                              ...previous,
                              [item.provider]: {
                                enabled: event.target.checked,
                                intervalMinutes:
                                  previous[item.provider]?.intervalMinutes ?? item.intervalMinutes
                              }
                            }))
                          }
                          aria-label={`Enable provider ${item.provider}`}
                        />
                        Enabled
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Every
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={(draftByProvider[item.provider] ?? item).intervalMinutes}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            const intervalMinutes = Number.isFinite(parsed)
                              ? Math.max(1, Math.min(240, Math.floor(parsed)))
                              : 1;

                            setDraftByProvider((previous) => ({
                              ...previous,
                              [item.provider]: {
                                enabled: previous[item.provider]?.enabled ?? item.enabled,
                                intervalMinutes
                              }
                            }));
                          }}
                          aria-label={`Interval minutes for ${item.provider}`}
                          style={{ width: 70 }}
                        />
                        min
                      </label>
                    </div>
                  </td>
                  <td>{formatDate(item.lastSyncAt)}</td>
                  <td>{formatDate(item.nextSyncAt)}</td>
                  <td>
                    <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveProviderConfig({
                            provider: item.provider,
                            enabled: (draftByProvider[item.provider] ?? item).enabled,
                            intervalMinutes: (draftByProvider[item.provider] ?? item).intervalMinutes
                          })
                        }
                        disabled={savingProviderConfig === item.provider}
                        aria-label={`Save config for ${item.provider}`}
                      >
                        {savingProviderConfig === item.provider ? 'Saving...' : 'Save config'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onTriggerSync(item.provider)}
                        disabled={syncingProvider === item.provider}
                        aria-label={`Trigger sync for ${item.provider}`}
                      >
                        {syncingProvider === item.provider ? 'Syncing...' : 'Sync now'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
