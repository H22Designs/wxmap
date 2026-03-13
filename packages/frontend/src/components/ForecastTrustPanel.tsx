import { useMemo } from 'react';
import type { CurrentObservation, Observation, Station } from '../services/api';
import { panelStyle } from '../styles/ui';

type ForecastTrustPanelProps = {
  station: Station | null;
  current: CurrentObservation | undefined;
  history: Observation[];
};

function parseRawPayload(rawJson: string | null): Record<string, unknown> | null {
  if (!rawJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(Math.max(variance, 0));
}

export function ForecastTrustPanel({ station, current, history }: ForecastTrustPanelProps): JSX.Element {
  const sourceSummary = useMemo(() => {
    const raw = parseRawPayload(current?.rawJson ?? null);

    const source = typeof raw?.source === 'string' ? raw.source : station?.provider ?? 'unknown';
    const model = typeof raw?.model === 'string' ? raw.model : typeof raw?.modelName === 'string' ? raw.modelName : 'n/a';
    const endpoint = typeof raw?.endpoint === 'string' ? raw.endpoint : null;

    return {
      source,
      model,
      endpoint
    };
  }, [current?.rawJson, station?.provider]);

  const confidence = useMemo(() => {
    const missingMetrics = [current?.tempC, current?.humidityPct, current?.windSpeedMs, current?.pressureHpa].filter(
      (item) => item === null || item === undefined
    ).length;

    const ageMinutes = current?.observedAt
      ? Math.max(0, (Date.now() - new Date(current.observedAt).getTime()) / 60_000)
      : 120;

    const tempSeries = history
      .slice(0, 18)
      .map((item) => item.tempC)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const volatility = stdDev(tempSeries);

    const score = Math.max(
      5,
      Math.round(100 - Math.min(56, ageMinutes * 2.2) - missingMetrics * 8 - Math.min(20, volatility * 2.5))
    );

    if (score >= 82) {
      return { score, label: 'High confidence', color: '#166534', background: '#dcfce7' };
    }

    if (score >= 62) {
      return { score, label: 'Moderate confidence', color: '#92400e', background: '#fef3c7' };
    }

    return { score, label: 'Low confidence', color: '#991b1b', background: '#fee2e2' };
  }, [current, history]);

  const changeSummary = useMemo(() => {
    const samples = history
      .slice(0, 12)
      .map((item) => item.tempC)
      .filter((item): item is number => item !== null && Number.isFinite(item));

    if (samples.length < 6) {
      return 'Not enough history yet to explain recent changes.';
    }

    const latestWindow = samples.slice(0, 3);
    const previousWindow = samples.slice(3, 6);

    const latestMean = latestWindow.reduce((sum, value) => sum + value, 0) / latestWindow.length;
    const previousMean = previousWindow.reduce((sum, value) => sum + value, 0) / previousWindow.length;
    const delta = latestMean - previousMean;

    if (Math.abs(delta) < 0.4) {
      return 'Conditions are stable compared with the previous hour.';
    }

    if (delta > 0) {
      return `Temperature trend is rising (${delta.toFixed(1)}°C vs previous hour).`;
    }

    return `Temperature trend is cooling (${Math.abs(delta).toFixed(1)}°C vs previous hour).`;
  }, [history]);

  return (
    <section style={panelStyle} aria-label="Forecast trust and transparency">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Forecast trust center</h3>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 700,
            color: confidence.color,
            background: confidence.background
          }}
        >
          {confidence.label} · {confidence.score}/100
        </span>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--wx-muted, #475569)' }}>Source attribution</div>
          <div style={{ fontWeight: 700 }}>{sourceSummary.source}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--wx-muted, #475569)' }}>Model</div>
          <div style={{ fontWeight: 700 }}>{sourceSummary.model}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--wx-muted, #475569)' }}>Observed</div>
          <div style={{ fontWeight: 700 }}>
            {current?.observedAt ? new Date(current.observedAt).toLocaleString() : 'No live sample'}
          </div>
        </div>
      </div>
      {sourceSummary.endpoint ? (
        <p style={{ marginBottom: 0, fontSize: 12, color: 'var(--wx-muted, #475569)' }}>Endpoint: {sourceSummary.endpoint}</p>
      ) : null}
      <p style={{ marginBottom: 0, marginTop: 10 }}>{changeSummary}</p>
    </section>
  );
}
