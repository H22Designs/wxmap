import type { AdminSetting } from '../services/api';

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
    <>
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
        <div style={{ display: 'grid', gap: 8 }}>
          {settings.map((setting) => (
            <div
              key={setting.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 160px auto',
                gap: 8,
                alignItems: 'center'
              }}
            >
              <code>{setting.key}</code>
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
    </>
  );
}
