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
import { sectionGridStyle, twoColumnGridStyle } from './styles/ui';
import { connectProviderStatusStream } from './services/realtime';
import {
  clearProviderActivity,
  loadProviderActivity,
  saveProviderActivity
} from './services/providerActivityStorage';

const SESSION_STORAGE_KEY = 'wxmap.session.v1';
const THEME_STORAGE_KEY = 'wxmap.theme.v1';
const MAX_PROVIDER_ACTIVITY = 25;

export function App(): JSX.Element {
  const [health, setHealth] = useState<string>('checking...');
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsStatus, setStationsStatus] = useState<string>('loading...');
  const [currentByStationId, setCurrentByStationId] = useState<
    Record<string, CurrentObservation | undefined>
  >({});
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
    void fetchHealth()
      .then((value) => setHealth(value))
      .catch(() => setHealth('offline'));

    void fetchStations()
      .then((items) => {
        setStations(items);
        setStationsStatus(items.length > 0 ? 'loaded' : 'empty');
      })
      .catch(() => {
        setStationsStatus('error');
      });

    void fetchCurrentObservations()
      .then((items) => {
        const byStationId = items.reduce<Record<string, CurrentObservation>>((accumulator, item) => {
          accumulator[item.stationId] = item;
          return accumulator;
        }, {});
        setCurrentByStationId(byStationId);
      })
      .catch(() => {
        setCurrentByStationId({});
      });

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LoginResult;

      if (!parsed?.accessToken || !parsed?.user?.username || !parsed?.user?.role) {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }

      setSession(parsed);
      setAuthStatus('restored');

      if (parsed.user.role === 'admin') {
        void loadAdminSettingsWithToken(parsed.accessToken);
        void loadAdminProvidersWithToken(parsed.accessToken);
      }
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
        intervalMinutes: input.intervalMinutes
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

  const filteredStations = useMemo(() => {
    if (selectedProvider === 'all') {
      return stations;
    }

    return stations.filter((station) => station.provider === selectedProvider);
  }, [stations, selectedProvider]);

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
      return current.tempC === null ? 'Temp: N/A' : `Temp: ${current.tempC.toFixed(1)} °C`;
    }

    if (metric === 'humidityPct') {
      return current.humidityPct === null ? 'Humidity: N/A' : `Humidity: ${current.humidityPct.toFixed(0)} %`;
    }

    return current.windSpeedMs === null ? 'Wind: N/A' : `Wind: ${current.windSpeedMs.toFixed(1)} m/s`;
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        minHeight: '100vh',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        color: darkMode ? '#e2e8f0' : '#0f172a',
        ['--wx-border' as string]: darkMode ? '#334155' : '#d1d5db',
        ['--wx-surface' as string]: darkMode ? '#111827' : '#ffffff',
        ['--wx-skeleton-start' as string]: darkMode ? '#1f2937' : '#f3f4f6',
        ['--wx-skeleton-mid' as string]: darkMode ? '#334155' : '#e5e7eb'
      }}
      aria-busy={stationsStatus === 'loading...' || isAuthSubmitting || isAdminLoading}
    >
      <style>{`
        @keyframes wxmapPulse {0% {background-position: 100% 50%;} 100% {background-position: 0 50%;}}
        select, input, button {
          background: ${darkMode ? '#1f2937' : '#ffffff'};
          color: ${darkMode ? '#e2e8f0' : '#111827'};
          border: 1px solid ${darkMode ? '#334155' : '#cbd5e1'};
          border-radius: 8px;
        }
        .wx-radar-layer {
          transition: opacity 240ms linear;
          will-change: opacity;
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8
        }}
      >
        <h1 style={{ margin: 0 }}>wxmap</h1>
        <SessionBadge session={session} />
      </div>
      <p>Frontend shell is ready. Next up: map, layers, providers, and live weather data.</p>
      <p>
        Backend status: <strong>{health}</strong>
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
          providerOptions={providerOptions}
          radarHours={radarHours}
          radarFrameDensity={radarFrameDensity}
          radarSpeedMs={radarSpeedMs}
          radarOpacity={radarOpacity}
          radarPlaying={radarPlaying}
          darkMode={darkMode}
          radarStatus={radarStatus}
          filteredCount={filteredStations.length}
          totalCount={stations.length}
          onMetricChange={setSelectedMetric}
          onProviderChange={setSelectedProvider}
          onRadarHoursChange={setRadarHours}
          onRadarFrameDensityChange={setRadarFrameDensity}
          onRadarSpeedChange={setRadarSpeedMs}
          onRadarOpacityChange={setRadarOpacity}
          onToggleRadarPlaying={() => setRadarPlaying((previous) => !previous)}
          onToggleDarkMode={() => setDarkMode((previous) => !previous)}
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
          radarFrames={radarFrames}
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
    </main>
  );
}
