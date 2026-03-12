import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminProviders,
  triggerAdminProviderSync,
  updateAdminProviderConfig,
  updateAdminSetting,
  fetchCurrentObservations,
  fetchAdminSettings,
  fetchHealth,
  fetchRadarFrames,
  fetchStationObservations,
  fetchStations,
  loginUser,
  registerUser,
  HttpStatusError,
  type CurrentObservation,
  type AdminProviderStatus,
  type AdminSetting,
  type LoginResult,
  type Observation,
  type RadarFrame,
  type RadarFrameDensity,
  type Station
} from './services/api';
import { AdminSettingsPanel } from './components/AdminSettingsPanel';
import { AuthPanel } from './components/AuthPanel';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { MapControlPanel } from './components/MapControlPanel';
import { ProviderActivityLogPanel, type ProviderActivityEntry } from './components/ProviderActivityLogPanel';
import { ProviderStatusPanel } from './components/ProviderStatusPanel';
import { SessionBadge } from './components/SessionBadge';
import { StationHistoryChart } from './components/StationHistoryChart';
import { StationMap, type MetricKey } from './components/StationMap';
import { ToastBanner, type Toast } from './components/ToastBanner';
import { UserExperiencePanel, type UnitSystem } from './components/UserExperiencePanel';
import { sectionGridStyle, twoColumnGridStyle } from './styles/ui';
import { connectProviderStatusStream } from './services/realtime';
import {
  clearProviderActivity,
  loadProviderActivity,
  saveProviderActivity
} from './services/providerActivityStorage';

const SESSION_STORAGE_KEY = 'wxmap.session.v1';
const THEME_STORAGE_KEY = 'wxmap.theme.v1';
const MAP_VIEW_MODE_STORAGE_KEY = 'wxmap.mapViewMode.v1';
const UNIT_SYSTEM_STORAGE_KEY = 'wxmap.unitSystem.v1';
const SHOW_RADAR_LAYER_STORAGE_KEY = 'wxmap.showRadarLayer.v1';
const SHOW_STATION_LAYER_STORAGE_KEY = 'wxmap.showStationLayer.v1';
const VISIBLE_PROVIDERS_STORAGE_KEY = 'wxmap.visibleProviders.v1';
const MAX_PROVIDER_ACTIVITY = 25;

export function App(): JSX.Element {
  const [health, setHealth] = useState<string>('checking...');
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsStatus, setStationsStatus] = useState<string>('loading...');
  const [currentByStationId, setCurrentByStationId] = useState<
    Record<string, CurrentObservation | undefined>
  >({});
  const [isDataRefreshing, setIsDataRefreshing] = useState(false);
  const [lastDataRefreshAt, setLastDataRefreshAt] = useState<string | null>(null);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<0 | 30 | 60 | 120 | 300>(60);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('idle');
  const [authError, setAuthError] = useState('');
  const [session, setSession] = useState<LoginResult | null>(null);
  const [adminProbe, setAdminProbe] = useState('not-run');
  const [adminSettings, setAdminSettings] = useState<AdminSetting[]>([]);
  const [adminDraftValues, setAdminDraftValues] = useState<Record<string, string>>({});
  const [adminSettingsStatus, setAdminSettingsStatus] = useState('not-loaded');
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<AdminProviderStatus[]>([]);
  const [providerActivity, setProviderActivity] = useState<ProviderActivityEntry[]>([]);
  const [isProviderActivityHydrated, setIsProviderActivityHydrated] = useState(false);
  const [providerStatusState, setProviderStatusState] = useState('not-loaded');
  const [providerStreamState, setProviderStreamState] = useState<
    'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  >('disconnected');
  const [isProviderStatusLoading, setIsProviderStatusLoading] = useState(false);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [savingProviderConfig, setSavingProviderConfig] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('tempC');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [mapViewMode, setMapViewMode] = useState<'2d' | '3d'>('2d');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [showRadarLayer, setShowRadarLayer] = useState(true);
  const [showStationLayer, setShowStationLayer] = useState(true);
  const [visibleProviders, setVisibleProviders] = useState<string[]>([]);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarHours, setRadarHours] = useState<1 | 3 | 6 | 12>(3);
  const [radarFrameDensity, setRadarFrameDensity] = useState<RadarFrameDensity>('normal');
  const [radarSpeedMs, setRadarSpeedMs] = useState<number>(550);
  const [radarOpacity, setRadarOpacity] = useState<number>(0.45);
  const [radarPlaying, setRadarPlaying] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [radarStatus, setRadarStatus] = useState<string>('loading...');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedStationHistory, setSelectedStationHistory] = useState<Observation[]>([]);
  const [historyStatus, setHistoryStatus] = useState<string>('no-station-selected');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(type: Toast['type'], message: string): void {
    setToast({ type, message });
  }

  async function refreshWeatherData(options: { showToasts?: boolean } = {}): Promise<void> {
    setIsDataRefreshing(true);

    try {
      const [healthResult, stationsResult, currentResult] = await Promise.allSettled([
        fetchHealth(),
        fetchStations(),
        fetchCurrentObservations()
      ]);

      let hasError = false;
      let hasAnySuccess = false;

      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value);
        hasAnySuccess = true;
      } else {
        setHealth('offline');
        hasError = true;
      }

      if (stationsResult.status === 'fulfilled') {
        setStations(stationsResult.value);
        setStationsStatus(stationsResult.value.length > 0 ? 'loaded' : 'empty');
        hasAnySuccess = true;
      } else {
        setStationsStatus('error');
        hasError = true;
      }

      if (currentResult.status === 'fulfilled') {
        const byStationId = currentResult.value.reduce<Record<string, CurrentObservation>>((accumulator, item) => {
          accumulator[item.stationId] = item;
          return accumulator;
        }, {});

        setCurrentByStationId(byStationId);
        hasAnySuccess = true;
      } else {
        setCurrentByStationId({});
        hasError = true;
      }

      if (hasAnySuccess) {
        setLastDataRefreshAt(new Date().toISOString());
      }

      if (options.showToasts) {
        if (hasError) {
          showToast('error', 'Some weather data failed to refresh.');
        } else {
          showToast('success', 'Weather data refreshed.');
        }
      }
    } finally {
      setIsDataRefreshing(false);
    }
  }

  function handleUnauthorizedSession(): void {
    setSession(null);
    setAuthStatus('session-expired');
    setAuthError('Your session expired. Please log in again.');
    setAdminProbe('no-session');
    setProviderStatuses([]);
    setProviderActivity([]);
    setProviderStreamState('disconnected');
    setIsProviderActivityHydrated(false);
    setProviderStatusState('not-loaded');
    showToast('error', 'Session expired. Please log in again.');
  }

  async function loadAdminProvidersWithToken(accessToken: string): Promise<void> {
    setProviderStatusState('loading...');
    setIsProviderStatusLoading(true);

    try {
      const items = await fetchAdminProviders(accessToken);
      setProviderStatuses(items);
      setProviderStatusState(items.length > 0 ? `loaded (${items.length})` : 'empty');
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        handleUnauthorizedSession();
        return;
      }

      setProviderStatusState(error instanceof Error ? `error: ${error.message}` : 'error');
      showToast('error', 'Failed to load provider statuses.');
    } finally {
      setIsProviderStatusLoading(false);
    }
  }

  async function loadAdminSettingsWithToken(accessToken: string): Promise<void> {
    setAdminSettingsStatus('loading...');
    setIsAdminLoading(true);

    try {
      const items = await fetchAdminSettings(accessToken);
      setAdminSettings(items);
      setAdminDraftValues(
        items.reduce<Record<string, string>>((accumulator, item) => {
          accumulator[item.key] = item.value;
          return accumulator;
        }, {})
      );
      setAdminSettingsStatus(items.length > 0 ? `loaded (${items.length})` : 'empty');
      showToast('success', 'Admin settings loaded.');
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        handleUnauthorizedSession();
        return;
      }
      setAdminSettingsStatus(error instanceof Error ? `error: ${error.message}` : 'error');
      showToast('error', 'Failed to load admin settings.');
    } finally {
      setIsAdminLoading(false);
    }
  }

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void refreshWeatherData();

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as LoginResult;

        if (!parsed?.accessToken || !parsed?.user?.username || !parsed?.user?.role) {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        } else {
          setSession(parsed);
          setAuthStatus('restored');

          if (parsed.user.role === 'admin') {
            void loadAdminSettingsWithToken(parsed.accessToken);
            void loadAdminProvidersWithToken(parsed.accessToken);
          }
        }
      } catch {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
      setDarkMode(true);
    }

    const savedMapViewMode = window.localStorage.getItem(MAP_VIEW_MODE_STORAGE_KEY);
    if (savedMapViewMode === '2d' || savedMapViewMode === '3d') {
      setMapViewMode(savedMapViewMode);
    }

    const savedUnitSystem = window.localStorage.getItem(UNIT_SYSTEM_STORAGE_KEY);
    if (savedUnitSystem === 'metric' || savedUnitSystem === 'imperial') {
      setUnitSystem(savedUnitSystem);
    }

    const savedShowRadarLayer = window.localStorage.getItem(SHOW_RADAR_LAYER_STORAGE_KEY);
    if (savedShowRadarLayer === 'true' || savedShowRadarLayer === 'false') {
      setShowRadarLayer(savedShowRadarLayer === 'true');
    }

    const savedShowStationLayer = window.localStorage.getItem(SHOW_STATION_LAYER_STORAGE_KEY);
    if (savedShowStationLayer === 'true' || savedShowStationLayer === 'false') {
      setShowStationLayer(savedShowStationLayer === 'true');
    }

    const savedVisibleProviders = window.localStorage.getItem(VISIBLE_PROVIDERS_STORAGE_KEY);
    if (savedVisibleProviders) {
      try {
        const parsed = JSON.parse(savedVisibleProviders) as string[];
        if (Array.isArray(parsed)) {
          setVisibleProviders(parsed.filter((item) => typeof item === 'string'));
        }
      } catch {
        // Ignore malformed persisted preferences
      }
    }
  }, []);

  useEffect(() => {
    if (autoRefreshSeconds === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshWeatherData();
    }, autoRefreshSeconds * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefreshSeconds]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem(MAP_VIEW_MODE_STORAGE_KEY, mapViewMode);
  }, [mapViewMode]);

  useEffect(() => {
    window.localStorage.setItem(UNIT_SYSTEM_STORAGE_KEY, unitSystem);
  }, [unitSystem]);

  useEffect(() => {
    window.localStorage.setItem(SHOW_RADAR_LAYER_STORAGE_KEY, String(showRadarLayer));
  }, [showRadarLayer]);

  useEffect(() => {
    window.localStorage.setItem(SHOW_STATION_LAYER_STORAGE_KEY, String(showStationLayer));
  }, [showStationLayer]);

  useEffect(() => {
    window.localStorage.setItem(VISIBLE_PROVIDERS_STORAGE_KEY, JSON.stringify(visibleProviders));
  }, [visibleProviders]);

  useEffect(() => {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      setAdminSettings([]);
      setAdminDraftValues({});
      setAdminSettingsStatus('not-loaded');
      setProviderStatuses([]);
      setProviderActivity([]);
      setProviderStreamState('disconnected');
      setIsProviderActivityHydrated(false);
      setProviderStatusState('not-loaded');
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session || session.user.role !== 'admin') {
      return;
    }

    const restored = loadProviderActivity(session.user.id);
    setProviderActivity(restored);
    setIsProviderActivityHydrated(true);
  }, [session]);

  useEffect(() => {
    if (!session || session.user.role !== 'admin' || !isProviderActivityHydrated) {
      return;
    }

    saveProviderActivity(session.user.id, providerActivity);
  }, [session, providerActivity, isProviderActivityHydrated]);

  useEffect(() => {
    if (!session || session.user.role !== 'admin') {
      return;
    }

    setProviderStreamState('connecting');

    const disconnect = connectProviderStatusStream({
      onConnected: () => {
        setProviderStreamState('connected');
        setProviderStatusState((previous) =>
          previous.startsWith('loaded') || previous.startsWith('live') ? 'live updates' : previous
        );
      },
      onProviderSync: (incoming) => {
        setProviderStatuses((previous) => {
          const next = [...previous.filter((item) => item.provider !== incoming.provider), incoming];
          next.sort((a, b) => a.provider.localeCompare(b.provider));
          return next;
        });
        setProviderActivity((previous) => {
          const entry: ProviderActivityEntry = {
            provider: incoming.provider,
            state: incoming.state,
            at: incoming.lastSyncAt ?? new Date().toISOString(),
            error: incoming.lastError
          };

          return [entry, ...previous].slice(0, MAX_PROVIDER_ACTIVITY);
        });
        setProviderStatusState('live updates');
      },
      onDisconnected: () => {
        setProviderStreamState('reconnecting');
        setProviderStatusState((previous) =>
          previous.startsWith('error') ? previous : 'live reconnecting...'
        );
      }
    });

    return () => {
      disconnect();
    };
  }, [session]);

  useEffect(() => {
    const center =
      stations.length > 0
        ? {
            lat: stations.reduce((sum, station) => sum + station.lat, 0) / stations.length,
            lng: stations.reduce((sum, station) => sum + station.lng, 0) / stations.length
          }
        : { lat: 39.8283, lng: -98.5795 };

    setRadarStatus('loading...');

    void fetchRadarFrames({
      lat: center.lat,
      lng: center.lng,
      hours: radarHours,
      frameDensity: radarFrameDensity
    })
      .then((frames) => {
        setRadarFrames(frames);
        setRadarStatus(frames.length > 0 ? `loaded (${frames.length} frames)` : 'empty');
      })
      .catch(() => {
        setRadarFrames([]);
        setRadarStatus('error');
      });
  }, [radarHours, radarFrameDensity, stations]);

  async function handleRegister(): Promise<void> {
    if (isAuthSubmitting) {
      return;
    }

    setIsAuthSubmitting(true);
    setAuthStatus('registering');
    setAuthError('');

    try {
      await registerUser({ username, email, password });
      setAuthStatus('registered');
      showToast('success', 'Registration complete. You can now log in.');
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'Register failed');
      showToast('error', 'Registration failed.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogin(): Promise<void> {
    if (isAuthSubmitting) {
      return;
    }

    setIsAuthSubmitting(true);
    setAuthStatus('logging-in');
    setAuthError('');

    try {
      const result = await loginUser({ username, password });
      setSession(result);
      setAuthStatus('logged-in');

      if (result.user.role === 'admin') {
        await loadAdminSettingsWithToken(result.accessToken);
        await loadAdminProvidersWithToken(result.accessToken);
      } else {
        setAdminSettings([]);
        setAdminDraftValues({});
        setAdminSettingsStatus('hidden-for-non-admin');
        setProviderStatuses([]);
        setProviderActivity([]);
        setProviderStreamState('disconnected');
        setIsProviderActivityHydrated(false);
        setProviderStatusState('hidden-for-non-admin');
      }
      showToast('success', `Welcome back, ${result.user.username}.`);
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'Login failed');
      showToast('error', 'Login failed.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleAdminProbe(): Promise<void> {
    if (!session) {
      setAdminProbe('no-session');
      return;
    }

    try {
      const settings = await fetchAdminSettings(session.accessToken);
      setAdminProbe(`ok (${settings.length} settings)`);
      showToast('success', 'Admin probe succeeded.');
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        handleUnauthorizedSession();
        return;
      }
      setAdminProbe(error instanceof Error ? `denied: ${error.message}` : 'denied');
      showToast('error', 'Admin probe failed.');
    }
  }

  async function handleLoadAdminSettings(): Promise<void> {
    if (!session) {
      setAdminSettingsStatus('no-session');
      return;
    }

    if (session.user.role !== 'admin') {
      setAdminSettingsStatus('forbidden-for-non-admin');
      return;
    }

    await loadAdminSettingsWithToken(session.accessToken);
  }

  async function handleTriggerProviderSync(provider: string): Promise<void> {
    if (!session || session.user.role !== 'admin') {
      setProviderStatusState('forbidden-for-non-admin');
      return;
    }

    setSyncingProvider(provider);

    try {
      const updated = await triggerAdminProviderSync({
        accessToken: session.accessToken,
        provider
      });

      setProviderStatuses((previous) => {
        const next = [...previous.filter((item) => item.provider !== updated.provider), updated];
        next.sort((a, b) => a.provider.localeCompare(b.provider));
        return next;
      });

      setProviderActivity((previous) => {
        const entry: ProviderActivityEntry = {
          provider: updated.provider,
          state: updated.state,
          at: updated.lastSyncAt ?? new Date().toISOString(),
          error: updated.lastError
        };

        return [entry, ...previous].slice(0, MAX_PROVIDER_ACTIVITY);
      });

      setProviderStatusState('live updates');
      showToast('success', `Triggered sync for ${provider}.`);
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        handleUnauthorizedSession();
        return;
      }

      showToast('error', `Failed to sync ${provider}.`);
    } finally {
      setSyncingProvider(null);
    }
  }

  async function handleSaveProviderConfig(input: {
    provider: string;
    enabled: boolean;
    intervalMinutes: number;
    endpoint: string | null;
  }): Promise<void> {
    if (!session || session.user.role !== 'admin') {
      setProviderStatusState('forbidden-for-non-admin');
      return;
    }

    setSavingProviderConfig(input.provider);

    try {
      const updated = await updateAdminProviderConfig({
        accessToken: session.accessToken,
        provider: input.provider,
        enabled: input.enabled,
        intervalMinutes: input.intervalMinutes,
        endpoint: input.endpoint
      });

      setProviderStatuses((previous) => {
        const next = [...previous.filter((item) => item.provider !== updated.provider), updated];
        next.sort((a, b) => a.provider.localeCompare(b.provider));
        return next;
      });

      setProviderStatusState('live updates');
      showToast('success', `Saved provider config for ${input.provider}.`);
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        handleUnauthorizedSession();
        return;
      }

      showToast('error', `Failed to save config for ${input.provider}.`);
    } finally {
      setSavingProviderConfig(null);
    }
  }

  async function handleSaveAdminSetting(key: string): Promise<void> {
    if (!session) {
      setAdminSettingsStatus('no-session');
      return;
    }

    if (session.user.role !== 'admin') {
      setAdminSettingsStatus('forbidden-for-non-admin');
      return;
    }

    const value = adminDraftValues[key] ?? '';
    const previousSettings = adminSettings;
    const previousDraftValue = adminDraftValues[key] ?? '';

    setAdminSettings((previous) =>
      previous.map((item) =>
        item.key === key
          ? {
              ...item,
              value,
              updatedAt: new Date().toISOString()
            }
          : item
      )
    );
    setAdminSettingsStatus(`saving: ${key}`);
    setSavingSettingKey(key);

    try {
      const updated = await updateAdminSetting({
        accessToken: session.accessToken,
        key,
        value
      });

      setAdminSettings((previous) =>
        previous.map((item) => (item.key === key ? updated : item))
      );
      setAdminSettingsStatus(`saved: ${key}`);
      showToast('success', `Saved setting: ${key}`);
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        handleUnauthorizedSession();
        return;
      }

      setAdminSettings(previousSettings);
      setAdminDraftValues((previous) => ({
        ...previous,
        [key]: previousDraftValue
      }));
      setAdminSettingsStatus(error instanceof Error ? `save error: ${error.message}` : 'save error');
      showToast('error', `Failed to save setting: ${key}`);
    } finally {
      setSavingSettingKey(null);
    }
  }

  const providerOptions = useMemo(() => {
    const providers = new Set(stations.map((station) => station.provider));
    return ['all', ...Array.from(providers).sort()];
  }, [stations]);

  const lastDataRefreshLabel = useMemo(() => {
    if (!lastDataRefreshAt) {
      return 'never';
    }

    return new Date(lastDataRefreshAt).toLocaleTimeString();
  }, [lastDataRefreshAt]);

  useEffect(() => {
    const stationProviders = providerOptions.filter((provider) => provider !== 'all');

    if (stationProviders.length === 0) {
      setVisibleProviders([]);
      return;
    }

    setVisibleProviders((previous) => {
      const previousInCurrent = previous.filter((provider) => stationProviders.includes(provider));

      if (previousInCurrent.length === 0) {
        return stationProviders;
      }

      return previousInCurrent;
    });
  }, [providerOptions]);

  const filteredStations = useMemo(() => {
    const byProviderSelection =
      selectedProvider === 'all'
        ? stations
        : stations.filter((station) => station.provider === selectedProvider);

    if (visibleProviders.length === 0) {
      return byProviderSelection;
    }

    return byProviderSelection.filter((station) => visibleProviders.includes(station.provider));
  }, [stations, selectedProvider, visibleProviders]);

  useEffect(() => {
    if (filteredStations.length === 0) {
      setSelectedStationId(null);
      return;
    }

    const existsInFiltered = filteredStations.some((station) => station.id === selectedStationId);
    if (!existsInFiltered) {
      setSelectedStationId(filteredStations[0].id);
    }
  }, [filteredStations, selectedStationId]);

  useEffect(() => {
    if (!selectedStationId) {
      setSelectedStationHistory([]);
      setHistoryStatus('no-station-selected');
      return;
    }

    setHistoryStatus('loading...');

    void fetchStationObservations({ stationId: selectedStationId, limit: 72 })
      .then((items) => {
        setSelectedStationHistory(items);
        setHistoryStatus(items.length > 0 ? `loaded (${items.length} points)` : 'empty');
      })
      .catch(() => {
        setSelectedStationHistory([]);
        setHistoryStatus('error');
      });
  }, [selectedStationId]);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) ?? null,
    [stations, selectedStationId]
  );

  function getMetricLabel(metric: MetricKey, current: CurrentObservation | undefined): string {
    if (!current) {
      return `${metric}: N/A`;
    }

    if (metric === 'tempC') {
      if (current.tempC === null) {
        return 'Temp: N/A';
      }

      return unitSystem === 'imperial'
        ? `Temp: ${(current.tempC * 9 / 5 + 32).toFixed(1)} °F`
        : `Temp: ${current.tempC.toFixed(1)} °C`;
    }

    if (metric === 'humidityPct') {
      return current.humidityPct === null ? 'Humidity: N/A' : `Humidity: ${current.humidityPct.toFixed(0)} %`;
    }

    if (current.windSpeedMs === null) {
      return 'Wind: N/A';
    }

    return unitSystem === 'imperial'
      ? `Wind: ${(current.windSpeedMs * 2.23693629).toFixed(1)} mph`
      : `Wind: ${current.windSpeedMs.toFixed(1)} m/s`;
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        minHeight: '100vh',
        background: darkMode
          ? 'radial-gradient(circle at top, #1e293b 0%, #0f172a 55%, #020617 100%)'
          : 'radial-gradient(circle at top, #f8fbff 0%, #eef2ff 45%, #e2e8f0 100%)',
        color: darkMode ? '#e2e8f0' : '#0f172a',
        ['--wx-border' as string]: darkMode ? '#334155' : '#d1d5db',
        ['--wx-surface' as string]: darkMode ? '#111827' : '#ffffff',
        ['--wx-surface-strong' as string]: darkMode ? '#0b1220' : '#f8fafc',
        ['--wx-skeleton-start' as string]: darkMode ? '#1f2937' : '#f3f4f6',
        ['--wx-skeleton-mid' as string]: darkMode ? '#334155' : '#e5e7eb',
        ['--wx-text' as string]: darkMode ? '#e2e8f0' : '#111827',
        ['--wx-muted' as string]: darkMode ? '#94a3b8' : '#475569',
        ['--wx-accent' as string]: darkMode ? '#93c5fd' : '#2563eb'
      }}
      aria-busy={stationsStatus === 'loading...' || isAuthSubmitting || isAdminLoading}
    >
      <style>{`
        @keyframes wxmapPulse {0% {background-position: 100% 50%;} 100% {background-position: 0 50%;}}
        main {
          line-height: 1.45;
        }
        h1, h2, h3 {
          letter-spacing: -0.01em;
        }
        select, input, button {
          background: ${darkMode ? '#1f2937' : '#ffffff'};
          color: ${darkMode ? '#e2e8f0' : '#111827'};
          border: 1px solid ${darkMode ? '#334155' : '#cbd5e1'};
          border-radius: 10px;
          padding: 8px 10px;
          transition: all 140ms ease;
        }
        select:focus, input:focus, button:focus {
          outline: 2px solid ${darkMode ? '#60a5fa' : '#3b82f6'};
          outline-offset: 1px;
        }
        button {
          cursor: pointer;
          font-weight: 600;
        }
        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
        }
        .wx-radar-layer {
          transition: opacity 240ms linear;
          will-change: opacity;
        }
        .wx-shell {
          width: min(1280px, 100%);
          margin: 0 auto;
        }
        .wx-header-title {
          font-size: clamp(1.8rem, 2.7vw, 2.6rem);
          margin: 0;
          font-weight: 800;
          background: ${darkMode
            ? 'linear-gradient(120deg, #bfdbfe 0%, #7dd3fc 45%, #67e8f9 100%)'
            : 'linear-gradient(120deg, #1d4ed8 0%, #0891b2 45%, #0ea5e9 100%)'};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          color: transparent;
        }
        .wx-subtitle {
          margin-top: 6px;
          margin-bottom: 10px;
          color: var(--wx-muted, #475569);
          font-size: 0.97rem;
        }
      `}</style>
      <div className="wx-shell">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8
          }}
        >
          <h1 className="wx-header-title">wxmap</h1>
          <SessionBadge session={session} />
        </div>
        <p className="wx-subtitle">
          Explore real-time weather with animated radar, provider controls, and customizable map views.
        </p>
        <p style={{ marginTop: 0, color: 'var(--wx-muted, #475569)' }}>
          Backend status: <strong style={{ color: 'var(--wx-accent, #2563eb)' }}>{health}</strong>
        </p>
        <section style={sectionGridStyle} aria-labelledby="station-map-heading">
        <h2 id="station-map-heading" style={{ marginBottom: 0 }}>
          Station map
        </h2>
        <p style={{ marginTop: 0 }}>
          Station data status: <strong>{stationsStatus}</strong>
        </p>
        <MapControlPanel
          selectedMetric={selectedMetric}
          selectedProvider={selectedProvider}
          mapViewMode={mapViewMode}
          providerOptions={providerOptions}
          radarHours={radarHours}
          radarFrameDensity={radarFrameDensity}
          radarSpeedMs={radarSpeedMs}
          radarOpacity={radarOpacity}
          radarPlaying={radarPlaying}
          darkMode={darkMode}
          radarStatus={radarStatus}
          isDataRefreshing={isDataRefreshing}
          lastDataRefreshLabel={lastDataRefreshLabel}
          autoRefreshSeconds={autoRefreshSeconds}
          filteredCount={filteredStations.length}
          totalCount={stations.length}
          onMetricChange={setSelectedMetric}
          onProviderChange={setSelectedProvider}
          onMapViewModeChange={setMapViewMode}
          onRadarHoursChange={setRadarHours}
          onRadarFrameDensityChange={setRadarFrameDensity}
          onRadarSpeedChange={setRadarSpeedMs}
          onRadarOpacityChange={setRadarOpacity}
          onToggleRadarPlaying={() => setRadarPlaying((previous) => !previous)}
          onToggleDarkMode={() => setDarkMode((previous) => !previous)}
          onRefreshData={() => {
            void refreshWeatherData({ showToasts: true });
          }}
          onAutoRefreshSecondsChange={setAutoRefreshSeconds}
        />
        <UserExperiencePanel
          darkMode={darkMode}
          mapViewMode={mapViewMode}
          unitSystem={unitSystem}
          showRadarLayer={showRadarLayer}
          showStationLayer={showStationLayer}
          providerOptions={providerOptions}
          visibleProviders={visibleProviders}
          onToggleDarkMode={() => setDarkMode((previous) => !previous)}
          onMapViewModeChange={setMapViewMode}
          onUnitSystemChange={setUnitSystem}
          onShowRadarLayerChange={setShowRadarLayer}
          onShowStationLayerChange={setShowStationLayer}
          onVisibleProvidersChange={(providers) => {
            const deduped = Array.from(new Set(providers));
            setVisibleProviders(deduped);
          }}
        />
        {stationsStatus === 'loading...' ? (
          <div aria-label="Loading station map" role="status" aria-live="polite" style={{ display: 'grid', gap: 8 }}>
            <LoadingSkeleton ariaLabel="Loading map summary" />
            <LoadingSkeleton ariaLabel="Loading map controls" width="85%" />
            <LoadingSkeleton ariaLabel="Loading map canvas" width="92%" height={320} />
          </div>
        ) : (
        <StationMap
          stations={filteredStations}
          currentByStationId={currentByStationId}
          selectedMetric={selectedMetric}
          mapViewMode={mapViewMode}
          unitSystem={unitSystem}
          showRadarLayer={showRadarLayer}
          showStationLayer={showStationLayer}
          radarFrames={radarFrames}
          radarFrameDensity={radarFrameDensity}
          radarOpacity={radarOpacity}
          radarSpeedMs={radarSpeedMs}
          radarPlaying={radarPlaying}
          darkMode={darkMode}
          selectedStationId={selectedStationId}
          onStationSelect={setSelectedStationId}
        />
        )}
        <p>
          History status: <strong>{historyStatus}</strong>
        </p>
        {selectedStation ? (
          <StationHistoryChart
            stationName={selectedStation.name}
            observations={selectedStationHistory}
            metric={selectedMetric}
            unitSystem={unitSystem}
          />
        ) : null}
        </section>
        <section style={twoColumnGridStyle} aria-label="Stations and authentication panels">
        <div aria-labelledby="stations-list-heading">
          <h2 id="stations-list-heading">Stations</h2>
          {stationsStatus === 'loading...' ? (
            <div aria-label="Loading station list" role="status" aria-live="polite" style={{ display: 'grid', gap: 6 }}>
              <LoadingSkeleton ariaLabel="Loading station item one" />
              <LoadingSkeleton ariaLabel="Loading station item two" width="93%" />
              <LoadingSkeleton ariaLabel="Loading station item three" width="88%" />
            </div>
          ) : (
          <ul aria-label="Available weather stations">
            {filteredStations.map((station) => {
              const current = currentByStationId[station.id];
              const isSelected = station.id === selectedStationId;

              return (
                <li key={station.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedStationId(station.id)}
                    aria-pressed={isSelected}
                    aria-label={`Select station ${station.name}`}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 6,
                      backgroundColor: isSelected ? '#ede9fe' : 'transparent'
                    }}
                  >
                    {station.name} ({station.provider}) - {station.lat.toFixed(3)}, {station.lng.toFixed(3)}
                    {` - ${getMetricLabel(selectedMetric, current)}`}
                  </button>
                </li>
              );
            })}
          </ul>
          )}
        </div>
        <div>
          <AuthPanel
            username={username}
            email={email}
            password={password}
            authStatus={authStatus}
            authError={authError}
            session={session}
            isSubmitting={isAuthSubmitting}
            onUsernameChange={setUsername}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onRegister={() => {
              void handleRegister();
            }}
            onLogin={() => {
              void handleLogin();
            }}
            onLogout={() => {
              setSession(null);
              setAuthStatus('logged-out');
              setAuthError('');
              showToast('info', 'Logged out.');
            }}
            adminActions={
              session?.user.role === 'admin' ? (
                <>
                  <AdminSettingsPanel
                    status={adminSettingsStatus}
                    settings={adminSettings}
                    draftValues={adminDraftValues}
                    savingSettingKey={savingSettingKey}
                    loadDisabled={isAdminLoading || isAuthSubmitting}
                    onProbe={() => {
                      void handleAdminProbe();
                    }}
                    onLoad={() => {
                      void handleLoadAdminSettings();
                    }}
                    onDraftChange={(key, value) =>
                      setAdminDraftValues((previous) => ({
                        ...previous,
                        [key]: value
                      }))
                    }
                    onSave={(key) => {
                      void handleSaveAdminSetting(key);
                    }}
                  />
                  <div style={{ marginTop: 12 }}>
                    <ProviderStatusPanel
                      status={providerStatusState}
                      providers={providerStatuses}
                      isLoading={isProviderStatusLoading}
                      realtimeState={providerStreamState}
                      syncingProvider={syncingProvider}
                      savingProviderConfig={savingProviderConfig}
                      onTriggerSync={(provider) => {
                        void handleTriggerProviderSync(provider);
                      }}
                      onSaveProviderConfig={(input) => {
                        void handleSaveProviderConfig(input);
                      }}
                      onReload={() => {
                        if (session) {
                          void loadAdminProvidersWithToken(session.accessToken);
                        }
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <ProviderActivityLogPanel
                      entries={providerActivity}
                      onClear={() => {
                        setProviderActivity([]);
                        if (session) {
                          clearProviderActivity(session.user.id);
                        }
                        showToast('info', 'Provider activity log cleared.');
                      }}
                    />
                  </div>
                </>
              ) : null
            }
          />
        </div>
        </section>
        {toast ? <ToastBanner toast={toast} onClose={() => setToast(null)} /> : null}
      </div>
    </main>
  );
}
