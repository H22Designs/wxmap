import { describe, expect, it } from 'vitest';
import type { Station } from './api';
import { buildPrioritizedProviders, sortStationsByProviderPriority } from './providerPriority';

function station(overrides: Partial<Station>): Station {
  return {
    id: overrides.id ?? 'station-id',
    provider: overrides.provider ?? 'nws',
    externalId: overrides.externalId ?? 'external-id',
    name: overrides.name ?? 'Station',
    lat: overrides.lat ?? 1,
    lng: overrides.lng ?? 1,
    elevationM: overrides.elevationM ?? null,
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z'
  };
}

describe('providerPriority', () => {
  it('places visible providers first in saved order', () => {
    const prioritized = buildPrioritizedProviders({
      providers: ['nws', 'metar', 'noaa'],
      visibleProviders: ['noaa', 'nws']
    });

    expect(prioritized).toEqual(['noaa', 'nws', 'metar']);
  });

  it('sorts stations using provider priority then station name', () => {
    const stations = [
      station({ id: '3', provider: 'metar', name: 'Zulu' }),
      station({ id: '2', provider: 'nws', name: 'Beta' }),
      station({ id: '1', provider: 'nws', name: 'Alpha' }),
      station({ id: '4', provider: 'noaa', name: 'Gamma' })
    ];

    const sorted = sortStationsByProviderPriority({
      stations,
      prioritizedProviders: ['noaa', 'nws', 'metar']
    });

    expect(sorted.map((item) => `${item.provider}:${item.name}`)).toEqual([
      'noaa:Gamma',
      'nws:Alpha',
      'nws:Beta',
      'metar:Zulu'
    ]);
  });
});
