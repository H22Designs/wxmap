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
    endpoint: string | null;
  }) => void;
  onReload: () => void;
};

type ProviderDraft = {
  enabled: boolean;
  intervalMinutes: number;
  endpoint: string;
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

function getStateBadge(state: AdminProviderStatus['state']): { color: string; background: string } {
  if (state === 'ok') {
    return { color: '#166534', background: '#dcfce7' };
  }

  if (state === 'running') {
    return { color: '#1e3a8a', background: '#dbeafe' };
  }

  if (state === 'error') {
    return { color: '#991b1b', background: '#fee2e2' };
  }

  return { color: '#374151', background: '#f3f4f6' };
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
        intervalMinutes: provider.intervalMinutes,
        endpoint: provider.endpoint ?? ''
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
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                <th align="left" style={{ padding: '8px 8px' }}>Provider</th>
                <th align="left" style={{ padding: '8px 8px' }}>Enabled</th>
                <th align="left" style={{ padding: '8px 8px' }}>State</th>
                <th align="left" style={{ padding: '8px 8px' }}>Interval</th>
                <th align="left" style={{ padding: '8px 8px' }}>Endpoint</th>
                <th align="left" style={{ padding: '8px 8px' }}>Last Sync</th>
                <th align="left" style={{ padding: '8px 8px' }}>Next Sync</th>
                <th align="left" style={{ padding: '8px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((item, index) => {
                const stateBadge = getStateBadge(item.state);

                return (
                <tr
                  key={item.provider}
                  style={{
                    background: index % 2 === 0 ? 'var(--wx-surface, #ffffff)' : 'var(--wx-surface-strong, #f8fafc)'
                  }}
                >
                  <td style={{ padding: '8px 8px' }}>
                    <code>{item.provider}</code>
                  </td>
                  <td style={{ padding: '8px 8px' }}>{item.enabled ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '8px 8px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontWeight: 700,
                        color: stateBadge.color,
                        background: stateBadge.background
                      }}
                    >
                      {item.state}
                    </span>
                  </td>
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
                                intervalMinutes: previous[item.provider]?.intervalMinutes ?? item.intervalMinutes,
                                endpoint: previous[item.provider]?.endpoint ?? item.endpoint ?? ''
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
                                intervalMinutes,
                                endpoint: previous[item.provider]?.endpoint ?? item.endpoint ?? ''
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
                  <td>
                    <input
                      type="text"
                      value={(draftByProvider[item.provider] ?? item).endpoint ?? ''}
                      onChange={(event) =>
                        setDraftByProvider((previous) => ({
                          ...previous,
                          [item.provider]: {
                            enabled: previous[item.provider]?.enabled ?? item.enabled,
                            intervalMinutes: previous[item.provider]?.intervalMinutes ?? item.intervalMinutes,
                            endpoint: event.target.value
                          }
                        }))
                      }
                      placeholder="https://..."
                      aria-label={`Endpoint for ${item.provider}`}
                      style={{ minWidth: 180 }}
                    />
                  </td>
                  <td style={{ padding: '8px 8px' }}>{formatDate(item.lastSyncAt)}</td>
                  <td style={{ padding: '8px 8px' }}>{formatDate(item.nextSyncAt)}</td>
                  <td>
                    <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveProviderConfig({
                            provider: item.provider,
                            enabled: (draftByProvider[item.provider] ?? item).enabled,
                            intervalMinutes: (draftByProvider[item.provider] ?? item).intervalMinutes,
                            endpoint: ((draftByProvider[item.provider] ?? item).endpoint ?? '').trim() || null
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
              );})}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
