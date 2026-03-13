import type { Station } from './api';

export function buildPrioritizedProviders(input: {
  providers: string[];
  visibleProviders: string[];
}): string[] {
  const uniqueProviders = Array.from(new Set(input.providers));
  const visibleInSet = input.visibleProviders.filter((provider) => uniqueProviders.includes(provider));
  const hiddenProviders = uniqueProviders.filter((provider) => !visibleInSet.includes(provider)).sort();

  return [...visibleInSet, ...hiddenProviders];
}

export function sortStationsByProviderPriority(input: {
  stations: Station[];
  prioritizedProviders: string[];
}): Station[] {
  const rankByProvider = new Map<string, number>();

  input.prioritizedProviders.forEach((provider, index) => {
    rankByProvider.set(provider, index);
  });

  return [...input.stations].sort((left, right) => {
    const leftRank = rankByProvider.get(left.provider) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankByProvider.get(right.provider) ?? Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const byName = left.name.localeCompare(right.name);

    if (byName !== 0) {
      return byName;
    }

    return left.id.localeCompare(right.id);
  });
}
