import type { AdminProviderStatus } from '../services/api';
import { panelStyle } from '../styles/ui';

type ProviderStatusPanelProps = {
  status: string;
  providers: AdminProviderStatus[];
  isLoading: boolean;
  onReload: () => void;
};

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
  onReload
}: ProviderStatusPanelProps): JSX.Element {
  return (
    <section style={panelStyle} aria-label="Provider sync status panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Provider status</h3>
        <button type="button" onClick={onReload} disabled={isLoading} aria-label="Reload provider statuses">
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
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
                  <td>{item.intervalMinutes} min</td>
                  <td>{formatDate(item.lastSyncAt)}</td>
                  <td>{formatDate(item.nextSyncAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
