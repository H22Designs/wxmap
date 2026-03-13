import type { AdminSetting } from '../services/api';
import { panelStyle } from '../styles/ui';

type AdminSettingsPanelProps = {
  status: string;
  settings: AdminSetting[];
  draftValues: Record<string, string>;
  savingSettingKey: string | null;
  loadDisabled: boolean;
  onLoad: () => void;
  onProbe: () => void;
  onDraftChange: (key: string, value: string) => void;
  onSave: (key: string) => void;
};

export function AdminSettingsPanel({
  status,
  settings,
  draftValues,
  savingSettingKey,
  loadDisabled,
  onLoad,
  onProbe,
  onDraftChange,
  onSave
}: AdminSettingsPanelProps): JSX.Element {
  return (
    <section style={panelStyle} aria-label="Admin settings panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>System settings</h3>
        <span style={{ fontSize: 12, color: 'var(--wx-muted, #475569)' }}>{settings.length} settings</span>
      </div>
      <p style={{ marginTop: 6, marginBottom: 10, color: 'var(--wx-muted, #475569)', fontSize: 13 }}>
        Configure collector cadence and provider-level behavior.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onProbe} disabled={loadDisabled} aria-label="Probe admin API access">
          Test admin settings
        </button>
        <button type="button" onClick={onLoad} disabled={loadDisabled} aria-label="Load admin settings">
          Load settings
        </button>
      </div>
      <p aria-live="polite">
        Admin settings status: <strong>{status}</strong>
      </p>
      {settings.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {settings.map((setting) => (
            <div
              key={setting.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1fr) minmax(180px, 260px) auto',
                gap: 8,
                alignItems: 'center',
                border: '1px solid var(--wx-border, #d1d5db)',
                borderRadius: 12,
                padding: '8px 10px',
                background: 'var(--wx-surface, #ffffff)'
              }}
            >
              <code style={{ fontSize: 12 }}>{setting.key}</code>
              <input
                aria-label={`Value for setting ${setting.key}`}
                value={draftValues[setting.key] ?? ''}
                onChange={(event) => onDraftChange(setting.key, event.target.value)}
              />
              <button type="button" onClick={() => onSave(setting.key)} disabled={savingSettingKey === setting.key}>
                {savingSettingKey === setting.key ? 'Saving...' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
