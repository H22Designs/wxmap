import { useMemo } from 'react';
import type { CurrentObservation, Station } from '../services/api';
import type { UnitSystem } from './UserExperiencePanel';
import { panelStyle } from '../styles/ui';

type ModelConsensusPanelProps = {
  selectedStation: Station | null;
  stations: Station[];
  currentByStationId: Record<string, CurrentObservation | undefined>;
  unitSystem: UnitSystem;
};

type ProviderSample = {
  provider: string;
  stationName: string;
  stationId: string;
  distanceKm: number;
  tempC: number;
};

function distanceKm(latA: number, lngA: number, latB: number, lngB: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTemp(tempC: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    return `${(tempC * 9 / 5 + 32).toFixed(1)} °F`;
  }

  return `${tempC.toFixed(1)} °C`;
}

export function ModelConsensusPanel({
  selectedStation,
  stations,
  currentByStationId,
  unitSystem
}: ModelConsensusPanelProps): JSX.Element {
  const samples = useMemo(() => {
    if (!selectedStation) {
      return [];
    }

    const bestByProvider = new Map<string, ProviderSample>();

    for (const station of stations) {
      const current = currentByStationId[station.id];

      if (!current || current.tempC === null || !Number.isFinite(current.tempC)) {
        continue;
      }

      const distance = distanceKm(selectedStation.lat, selectedStation.lng, station.lat, station.lng);

      if (distance > 150) {
        continue;
      }

      const candidate: ProviderSample = {
        provider: station.provider,
        stationName: station.name,
        stationId: station.id,
        distanceKm: distance,
        tempC: current.tempC
      };

      const existing = bestByProvider.get(station.provider);

      if (!existing || candidate.distanceKm < existing.distanceKm) {
        bestByProvider.set(station.provider, candidate);
      }
    }

    return [...bestByProvider.values()].sort((left, right) => left.provider.localeCompare(right.provider));
  }, [selectedStation, stations, currentByStationId]);

  const consensus = useMemo(() => {
    if (samples.length < 2) {
      return {
        label: 'Need at least 2 provider samples for consensus.',
        spreadC: null as number | null,
        outliers: [] as string[]
      };
    }

    const temps = samples.map((item) => item.tempC);
    const mean = temps.reduce((sum, value) => sum + value, 0) / temps.length;
    const spreadC = Math.max(...temps) - Math.min(...temps);

    const variance = temps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / temps.length;
    const sigma = Math.sqrt(Math.max(variance, 0));
    const outliers = samples
      .filter((sample) => Math.abs(sample.tempC - mean) > Math.max(1.2 * sigma, 2.2))
      .map((item) => item.provider);

    if (spreadC <= 1.5) {
      return { label: 'Strong multi-provider agreement.', spreadC, outliers };
    }

    if (spreadC <= 3.5) {
      return { label: 'Moderate spread across providers.', spreadC, outliers };
    }

    return { label: 'High disagreement detected. Treat as uncertain.', spreadC, outliers };
  }, [samples]);

  return (
    <section style={panelStyle} aria-label="Model comparison and consensus">
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Model & provider compare</h3>
      <p style={{ marginTop: 0 }}>
        {consensus.label}{' '}
        {consensus.spreadC !== null ? <strong>Spread: {consensus.spreadC.toFixed(1)}°C</strong> : null}
      </p>
      {consensus.outliers.length > 0 ? (
        <p style={{ marginTop: 0, color: '#92400e' }}>
          Outlier providers: <strong>{consensus.outliers.join(', ')}</strong>
        </p>
      ) : null}

      {samples.length === 0 ? (
        <p style={{ marginBottom: 0 }}>No comparable nearby provider samples found yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--wx-surface-strong, #f8fafc)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Provider</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Station</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Distance</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Temperature</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={`${sample.provider}-${sample.stationId}`} style={{ borderTop: '1px solid var(--wx-border, #d1d5db)' }}>
                  <td style={{ padding: '8px 10px' }}>{sample.provider}</td>
                  <td style={{ padding: '8px 10px' }}>{sample.stationName}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{sample.distanceKm.toFixed(1)} km</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{formatTemp(sample.tempC, unitSystem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
