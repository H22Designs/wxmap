export type ProviderCatalogEntry = {
  id: string;
  label: string;
  defaultEnabled: boolean;
  defaultIntervalMinutes: number;
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { id: 'airport', label: 'Airport Reference', defaultEnabled: false, defaultIntervalMinutes: 15 },
  { id: 'nws', label: 'National Weather Service', defaultEnabled: true, defaultIntervalMinutes: 10 },
  { id: 'noaa', label: 'NOAA', defaultEnabled: false, defaultIntervalMinutes: 15 },
  { id: 'madis', label: 'MADIS', defaultEnabled: false, defaultIntervalMinutes: 10 },
  { id: 'cwop', label: 'CWOP', defaultEnabled: false, defaultIntervalMinutes: 5 },
  { id: 'findu', label: 'FindU', defaultEnabled: false, defaultIntervalMinutes: 5 },
  { id: 'mesowest', label: 'MesoWest', defaultEnabled: false, defaultIntervalMinutes: 10 },
  { id: 'pwsweather', label: 'PWS Weather', defaultEnabled: false, defaultIntervalMinutes: 5 },
  { id: 'ambient', label: 'Ambient Weather', defaultEnabled: false, defaultIntervalMinutes: 5 },
  { id: 'acurite', label: 'AcuRite', defaultEnabled: false, defaultIntervalMinutes: 5 },
  { id: 'wunderground', label: 'Weather Underground', defaultEnabled: false, defaultIntervalMinutes: 5 }
];

export function getKnownProviders(): string[] {
  return PROVIDER_CATALOG.map((item) => item.id);
}
