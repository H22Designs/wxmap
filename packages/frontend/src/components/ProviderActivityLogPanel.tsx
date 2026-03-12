import { useMemo, useState, type CSSProperties } from 'react';
import { panelStyle } from '../styles/ui';

export type ProviderActivityEntry = {
  provider: string;
  state: 'idle' | 'running' | 'ok' | 'error';
  at: string;
  error: string | null;
};

type ProviderActivityLogPanelProps = {
  entries: ProviderActivityEntry[];
  onClear: () => void;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function getBadgeStyle(state: ProviderActivityEntry['state']): CSSProperties {
  if (state === 'error') {
    return { backgroundColor: '#fee2e2', color: '#991b1b' };
  }

  if (state === 'ok') {
    return { backgroundColor: '#dcfce7', color: '#166534' };
  }

  if (state === 'running') {
    return { backgroundColor: '#dbeafe', color: '#1e3a8a' };
  }

  return { backgroundColor: '#f3f4f6', color: '#374151' };
}

export function ProviderActivityLogPanel({ entries, onClear }: ProviderActivityLogPanelProps): JSX.Element {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const filteredEntries = useMemo(
    () => (showErrorsOnly ? entries.filter((entry) => entry.state === 'error') : entries),
    [entries, showErrorsOnly]
  );

  return (
    <section style={panelStyle} aria-label="Provider activity log panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Provider activity log</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={showErrorsOnly}
              onChange={(event) => setShowErrorsOnly(event.target.checked)}
              aria-label="Show only provider errors"
              style={{ marginRight: 6 }}
            />
            Errors only
          </label>
          <button type="button" onClick={onClear} disabled={entries.length === 0} aria-label="Clear provider activity log">
            Clear
          </button>
        </div>
      </div>
      {filteredEntries.length === 0 ? (
        <p>No live sync activity yet.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }} aria-label="Provider activity entries">
          {filteredEntries.map((entry, index) => (
            <li key={`${entry.provider}-${entry.at}-${index}`}>
              <strong>{entry.provider}</strong>{' '}
              <span
                style={{
                  ...getBadgeStyle(entry.state),
                  display: 'inline-block',
                  padding: '1px 8px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  marginLeft: 6,
                  marginRight: 6
                }}
              >
                {entry.state}
              </span>
              {formatDate(entry.at)}
              {entry.error ? ` · error: ${entry.error}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
