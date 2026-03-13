import { panelStyle } from '../styles/ui';

export type AlertSeverity = 'all' | 'elevated' | 'critical';

export type AlertPreferences = {
  enabled: boolean;
  tempHighC: number;
  tempLowC: number;
  windHighMs: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  severity: AlertSeverity;
};

type AlertTuningPanelProps = {
  value: AlertPreferences;
  onChange: (next: AlertPreferences) => void;
};

export function AlertTuningPanel({ value, onChange }: AlertTuningPanelProps): JSX.Element {
  function patch(next: Partial<AlertPreferences>): void {
    onChange({
      ...value,
      ...next
    });
  }

  return (
    <section style={panelStyle} aria-label="Alert tuning center">
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Alert tuning center</h3>
      <p style={{ marginTop: 0, fontSize: 13, color: 'var(--wx-muted, #475569)' }}>
        Control thresholds, quiet hours, and noise level to avoid notification fatigue.
      </p>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) => patch({ enabled: event.target.checked })}
            aria-label="Enable weather alerts"
          />
          Alerts enabled
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          Severity
          <select
            value={value.severity}
            onChange={(event) => patch({ severity: event.target.value as AlertSeverity })}
            aria-label="Alert severity"
          >
            <option value="all">All</option>
            <option value="elevated">Elevated + critical</option>
            <option value="critical">Critical only</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          High temperature (°C)
          <input
            type="number"
            value={value.tempHighC}
            onChange={(event) => patch({ tempHighC: Number(event.target.value) })}
            aria-label="High temperature alert threshold"
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          Low temperature (°C)
          <input
            type="number"
            value={value.tempLowC}
            onChange={(event) => patch({ tempLowC: Number(event.target.value) })}
            aria-label="Low temperature alert threshold"
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          High wind (m/s)
          <input
            type="number"
            min={0}
            step={0.5}
            value={value.windHighMs}
            onChange={(event) => patch({ windHighMs: Number(event.target.value) })}
            aria-label="High wind alert threshold"
          />
        </label>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid var(--wx-border, #d1d5db)',
          background: 'var(--wx-surface-strong, #f8fafc)',
          display: 'grid',
          gap: 8
        }}
      >
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={value.quietHoursEnabled}
            onChange={(event) => patch({ quietHoursEnabled: event.target.checked })}
            aria-label="Enable quiet hours"
          />
          Quiet hours
        </label>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            Start
            <input
              type="time"
              value={value.quietHoursStart}
              onChange={(event) => patch({ quietHoursStart: event.target.value })}
              disabled={!value.quietHoursEnabled}
              aria-label="Quiet hours start"
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            End
            <input
              type="time"
              value={value.quietHoursEnd}
              onChange={(event) => patch({ quietHoursEnd: event.target.value })}
              disabled={!value.quietHoursEnabled}
              aria-label="Quiet hours end"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
