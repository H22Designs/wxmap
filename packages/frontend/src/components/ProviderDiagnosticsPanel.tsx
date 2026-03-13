import { useMemo } from 'react';
import type { AdminProviderStatus } from '../services/api';
import type { ProviderActivityEntry } from './ProviderActivityLogPanel';
import { panelStyle } from '../styles/ui';

type ProviderDiagnosticsPanelProps = {
  providers: AdminProviderStatus[];
  activity: ProviderActivityEntry[];
};

function minutesSince(iso: string | null): number | null {
  if (!iso) {
    return null;
  }

  const value = new Date(iso).getTime();

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, (Date.now() - value) / 60_000);
}

export function ProviderDiagnosticsPanel({ providers, activity }: ProviderDiagnosticsPanelProps): JSX.Element {
  const diagnostics = useMemo(() => {
    const staleProviders = providers.filter((provider) => {
      const age = minutesSince(provider.lastSyncAt);

      if (age === null) {
        return true;
      }

      return age > Math.max(20, provider.intervalMinutes * 2.5);
    });

    const errorCounts = activity.reduce<Record<string, number>>((accumulator, item) => {
      if (item.state !== 'error') {
        return accumulator;
      }

      accumulator[item.provider] = (accumulator[item.provider] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      staleProviders,
      errorCounts
    };
  }, [providers, activity]);

  return (
    <section style={panelStyle} aria-label="Provider diagnostics">
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Operations diagnostics</h3>
      <p style={{ marginTop: 0 }}>
        Stale providers: <strong>{diagnostics.staleProviders.length}</strong> · Providers in error:{' '}
        <strong>{providers.filter((provider) => provider.state === 'error').length}</strong>
      </p>

      {providers.length === 0 ? (
        <p style={{ marginBottom: 0 }}>No provider telemetry available yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--wx-surface-strong, #f8fafc)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Provider</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Last sync age</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Errors (session)</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => {
                const age = minutesSince(provider.lastSyncAt);
                const isStale = diagnostics.staleProviders.some((item) => item.provider === provider.provider);
                const errorCount = diagnostics.errorCounts[provider.provider] ?? 0;

                return (
                  <tr key={provider.provider} style={{ borderTop: '1px solid var(--wx-border, #d1d5db)' }}>
                    <td style={{ padding: '8px 10px' }}>{provider.provider}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {age === null ? 'never' : `${age.toFixed(1)} min`}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{errorCount}</td>
                    <td style={{ padding: '8px 10px', color: isStale || provider.state === 'error' ? '#991b1b' : '#166534' }}>
                      {isStale ? 'stale' : provider.state}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
