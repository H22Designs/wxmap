import type { CSSProperties } from 'react';
import type { CurrentObservation, Observation, Station } from '../services/api';
import { panelStyle } from '../styles/ui';
import type { UnitSystem } from './UserExperiencePanel';

type StationInsightsPanelProps = {
  station: Station | null;
  current: CurrentObservation | undefined;
  history: Observation[];
  unitSystem: UnitSystem;
  showMiniCharts?: boolean;
};

type TileProps = {
  label: string;
  value: string;
  accent?: string;
  icon?: string;
  chart?: JSX.Element | null;
};

function getNumericFromRaw(rawJson: string | null, keys: string[]): number | null {
  if (!rawJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;

    for (const key of keys) {
      const value = parsed[key];

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

function buildSeries(items: Observation[], pick: (item: Observation) => number | null): number[] {
  return items
    .map(pick)
    .filter((item): item is number => item !== null && Number.isFinite(item));
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }): JSX.Element | null {
  if (values.length < 2) {
    return null;
  }

  const width = 180;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-6, max - min);

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend sparkline" style={{ width: '100%', height: 48 }}>
      <defs>
        <linearGradient id={`spark-${stroke.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={stroke} strokeWidth={2.2} points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tile({ label, value, accent = '#2563eb', icon, chart }: TileProps): JSX.Element {
  return (
    <article
      style={{
        border: '1px solid var(--wx-border, #d1d5db)',
        borderRadius: 14,
        padding: '10px 12px',
        background: 'var(--wx-surface, #ffffff)',
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
        display: 'grid',
        gap: 6
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--wx-muted, #475569)', fontWeight: 600 }}>{label}</span>
        {icon ? <span aria-hidden="true" style={{ fontSize: 16 }}>{icon}</span> : null}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
      {chart}
    </article>
  );
}

function formatTemp(tempC: number | null, unitSystem: UnitSystem): string {
  if (tempC === null) {
    return 'N/A';
  }

  if (unitSystem === 'imperial') {
    return `${(tempC * 9 / 5 + 32).toFixed(1)} °F`;
  }

  return `${tempC.toFixed(1)} °C`;
}

function formatWind(speedMs: number | null, unitSystem: UnitSystem): string {
  if (speedMs === null) {
    return 'N/A';
  }

  if (unitSystem === 'imperial') {
    return `${(speedMs * 2.23693629).toFixed(1)} mph`;
  }

  return `${speedMs.toFixed(1)} m/s`;
}

function WindDirectionDial({ degrees }: { degrees: number | null }): JSX.Element {
  const safe = degrees === null || !Number.isFinite(degrees) ? null : ((degrees % 360) + 360) % 360;

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1px solid var(--wx-border, #d1d5db)',
          position: 'relative',
          background: 'var(--wx-surface-strong, #f8fafc)'
        }}
      >
        {safe !== null ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 2,
              height: 16,
              background: '#2563eb',
              transformOrigin: 'center bottom',
              transform: `translate(-50%, -100%) rotate(${safe}deg)`
            }}
          />
        ) : null}
      </div>
      <span style={{ fontSize: 11, color: 'var(--wx-muted, #475569)' }}>{safe === null ? 'N/A' : `${safe.toFixed(0)}°`}</span>
    </div>
  );
}

export function StationInsightsPanel({
  station,
  current,
  history,
  unitSystem,
  showMiniCharts = true
}: StationInsightsPanelProps): JSX.Element {
  const recent = [...history].slice(0, 48).reverse();

  const tempSeries = buildSeries(recent, (item) => {
    if (item.tempC === null) {
      return null;
    }

    return unitSystem === 'imperial' ? item.tempC * 9 / 5 + 32 : item.tempC;
  });
  const humiditySeries = buildSeries(recent, (item) => item.humidityPct);
  const pressureSeries = buildSeries(recent, (item) => item.pressureHpa);
  const windSeries = buildSeries(recent, (item) => {
    if (item.windSpeedMs === null) {
      return null;
    }

    return unitSystem === 'imperial' ? item.windSpeedMs * 2.23693629 : item.windSpeedMs;
  });

  const solarNow = getNumericFromRaw(current?.rawJson ?? null, [
    'solarRadiation',
    'solar_radiation',
    'solarRadiationWm2',
    'solar_wm2'
  ]);
  const lightningCount = getNumericFromRaw(current?.rawJson ?? null, [
    'lightningCount',
    'lightning_count',
    'lightningStrikes',
    'lightning_strikes'
  ]);
  const lightningDistance = getNumericFromRaw(current?.rawJson ?? null, [
    'lightningDistanceKm',
    'lightning_distance_km',
    'lightningDistanceMi',
    'lightning_distance_mi'
  ]);

  return (
    <section style={panelStyle} aria-label="Station intelligence panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ marginTop: 0, marginBottom: 6 }}>
          Station intelligence {station ? `· ${station.name}` : ''}
        </h3>
        <span style={{ fontSize: 12, color: 'var(--wx-muted, #475569)' }}>
          Source: {station?.provider ?? '—'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Tile label="Temperature" value={formatTemp(current?.tempC ?? null, unitSystem)} icon="🌡️" chart={showMiniCharts ? <Sparkline values={tempSeries} stroke="#ef4444" /> : null} />
        <Tile label="Humidity" value={current?.humidityPct === null || current?.humidityPct === undefined ? 'N/A' : `${current.humidityPct.toFixed(0)} %`} icon="💧" chart={showMiniCharts ? <Sparkline values={humiditySeries} stroke="#0ea5e9" /> : null} />
        <Tile label="Pressure" value={current?.pressureHpa === null || current?.pressureHpa === undefined ? 'N/A' : `${current.pressureHpa.toFixed(1)} hPa`} icon="🧭" chart={showMiniCharts ? <Sparkline values={pressureSeries} stroke="#7c3aed" /> : null} />
        <Tile label="Wind speed" value={formatWind(current?.windSpeedMs ?? null, unitSystem)} icon="💨" chart={showMiniCharts ? <Sparkline values={windSeries} stroke="#14b8a6" /> : null} />
        <Tile
          label="Wind direction"
          value={current?.windDirDeg === null || current?.windDirDeg === undefined ? 'N/A' : `${current.windDirDeg.toFixed(0)}°`}
          icon="🧭"
          chart={<WindDirectionDial degrees={current?.windDirDeg ?? null} />}
        />
        <Tile
          label="Solar radiation"
          value={solarNow === null ? 'N/A' : `${solarNow.toFixed(0)} W/m²`}
          icon="☀️"
          accent="#ca8a04"
        />
        <Tile
          label="Lightning"
          value={
            lightningCount === null
              ? 'N/A'
              : lightningDistance === null
                ? `${lightningCount.toFixed(0)} strikes`
                : `${lightningCount.toFixed(0)} strikes · ${lightningDistance.toFixed(1)} km`
          }
          icon="⚡"
          accent="#dc2626"
        />
        <Tile
          label="Precipitation"
          value={current?.precipMm === null || current?.precipMm === undefined ? 'N/A' : `${current.precipMm.toFixed(2)} mm`}
          icon="🌧️"
          accent="#2563eb"
        />
      </div>
    </section>
  );
}
