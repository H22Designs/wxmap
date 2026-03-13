import { useEffect, useMemo, useState } from 'react';
import {
  createWeatherStation,
  fetchAdminProviders,
  triggerAdminProviderSync,
  updateAdminProviderConfig,
  updateAdminSetting,
  fetchCurrentObservations,
  fetchAdminSettings,
  fetchHealth,
  fetchProviderStations,
  fetchRadarFrames,
  fetchStationObservations,
  fetchStations,
  fetchWeatherProviders,
  fetchUserPreferences,
  loginUser,
  registerUser,
  HttpStatusError,
  type CurrentObservation,
  type AdminProviderStatus,
  type AdminSetting,
  type LoginResult,
  type Observation,
  type ProviderStationCandidate,
  type RadarFrame,
  type RadarFrameDensity,
  type Station,
  type UserPreferences,
  updateUserPreferences,
  triggerStationBackfill
} from './services/api';
import { AdminSettingsPanel } from './components/AdminSettingsPanel';
import { AuthPanel } from './components/AuthPanel';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { MapControlPanel } from './components/MapControlPanel';
import { ProviderActivityLogPanel, type ProviderActivityEntry } from './components/ProviderActivityLogPanel';
import { ProviderStatusPanel } from './components/ProviderStatusPanel';
import { SessionBadge } from './components/SessionBadge';
import { StationHistoryChart } from './components/StationHistoryChart';
import { StationInsightsPanel } from './components/StationInsightsPanel';
import { StationMap, type MetricKey } from './components/StationMap';
import { ToastBanner, type Toast } from './components/ToastBanner';
import { UserExperiencePanel, type UnitSystem } from './components/UserExperiencePanel';
import { sectionGridStyle, twoColumnGridStyle } from './styles/ui';
import { connectProviderStatusStream } from './services/realtime';
import { buildPrioritizedProviders, sortStationsByProviderPriority } from './services/providerPriority';
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
const WORKSPACE_VIEW_STORAGE_KEY = 'wxmap.workspaceView.v1';
const SURFACE_STYLE_STORAGE_KEY = 'wxmap.surfaceStyle.v1';
const DASHBOARD_CARD_ORDER_STORAGE_KEY = 'wxmap.dashboardCardOrder.v1';
const DASHBOARD_CARD_HIDDEN_STORAGE_KEY = 'wxmap.dashboardCardHidden.v1';
const DASHBOARD_CARD_COLLAPSED_STORAGE_KEY = 'wxmap.dashboardCardCollapsed.v1';
const MAX_PROVIDER_ACTIVITY = 25;

type WorkspaceView = 'dashboard' | 'explore' | 'admin';
type SurfaceStyle = 'glass' | 'elevated' | 'neo';
type DashboardCardId = 'map-controls' | 'experience' | 'map' | 'history';
type ToastAction =
  | {
      kind: 'open-station-overview';
      stationId: string;
    }
  | null;

const DEFAULT_DASHBOARD_CARD_ORDER: DashboardCardId[] = [
  'map-controls',
  'experience',
  'map',
  'history'
];

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
  const [isUserPreferencesHydrated, setIsUserPreferencesHydrated] = useState(false);
  const [preferencePersistenceState, setPreferencePersistenceState] = useState<
    'guest' | 'loading' | 'saving' | 'saved' | 'error'
  >('guest');
  const [lastSyncedPreferencesSignature, setLastSyncedPreferencesSignature] = useState<string | null>(null);
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
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial');
  const [showRadarLayer, setShowRadarLayer] = useState(true);
  const [showStationLayer, setShowStationLayer] = useState(true);
  const [weatherVisualTone, setWeatherVisualTone] = useState<'balanced' | 'vivid' | 'minimal'>('balanced');
  const [showWeatherAnimations, setShowWeatherAnimations] = useState(true);
  const [showMiniCharts, setShowMiniCharts] = useState(true);
  const [historyChartMode, setHistoryChartMode] = useState<'line' | 'area'>('line');
  const [visibleProviders, setVisibleProviders] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>('dashboard');
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>('glass');
  const [dashboardCardOrder, setDashboardCardOrder] = useState<DashboardCardId[]>(
    DEFAULT_DASHBOARD_CARD_ORDER
  );
  const [hiddenDashboardCards, setHiddenDashboardCards] = useState<DashboardCardId[]>([]);
  const [collapsedDashboardCards, setCollapsedDashboardCards] = useState<DashboardCardId[]>([]);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarHours, setRadarHours] = useState<1 | 3 | 6 | 12>(3);
  const [radarFrameDensity, setRadarFrameDensity] = useState<RadarFrameDensity>('normal');
  const [radarSpeedMs, setRadarSpeedMs] = useState<number>(550);
  const [radarOpacity, setRadarOpacity] = useState<number>(0.45);
  const [radarPlaying, setRadarPlaying] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [radarStatus, setRadarStatus] = useState<string>('loading...');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [stationSearchQuery, setStationSearchQuery] = useState<string>('');
  const [availableWeatherProviders, setAvailableWeatherProviders] = useState<string[]>([]);
  const [quickAddProvider, setQuickAddProvider] = useState<string>('');
  const [quickAddExternalId, setQuickAddExternalId] = useState<string>('');
  const [quickAddAdvanced, setQuickAddAdvanced] = useState<boolean>(false);
  const [quickAddCandidates, setQuickAddCandidates] = useState<ProviderStationCandidate[]>([]);
  const [quickAddSelectedCandidateExternalId, setQuickAddSelectedCandidateExternalId] =
    useState<string>('');
  const [quickAddCandidatesStatus, setQuickAddCandidatesStatus] = useState<string>('idle');
  const [quickAddName, setQuickAddName] = useState<string>('');
  const [quickAddLat, setQuickAddLat] = useState<string>('');
  const [quickAddLng, setQuickAddLng] = useState<string>('');
  const [quickAddElevationM, setQuickAddElevationM] = useState<string>('');
  const [quickAddStatus, setQuickAddStatus] = useState<string>('idle');
  const [isQuickAddingStation, setIsQuickAddingStation] = useState<boolean>(false);
  const [isQuickLookupRunning, setIsQuickLookupRunning] = useState<boolean>(false);
  const [selectedStationHistory, setSelectedStationHistory] = useState<Observation[]>([]);
  const [historyStatus, setHistoryStatus] = useState<string>('no-station-selected');
  const [backfillStatus, setBackfillStatus] = useState<string>('idle');
  const [isBackfilling, setIsBackfilling] = useState<boolean>(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastAction, setToastAction] = useState<ToastAction>(null);

  function showToast(
    type: Toast['type'],
    message: string,
    action?: { label: string; value: NonNullable<ToastAction> }
  ): void {
    setToast({ type, message, actionLabel: action?.label });
    setToastAction(action?.value ?? null);
  }

  function serializeUserPreferences(input: Omit<UserPreferences, 'userId' | 'updatedAt'>): string {
    return JSON.stringify({
      darkMode: input.darkMode,
      mapViewMode: input.mapViewMode,
      unitSystem: input.unitSystem,
      showRadarLayer: input.showRadarLayer,
      showStationLayer: input.showStationLayer,
      weatherVisualTone: input.weatherVisualTone,
      showWeatherAnimations: input.showWeatherAnimations,
      showMiniCharts: input.showMiniCharts,
      historyChartMode: input.historyChartMode,
      visibleProviders: input.visibleProviders,
      activeWorkspace: input.activeWorkspace,
      surfaceStyle: input.surfaceStyle,
      dashboardCardOrder: input.dashboardCardOrder,
      hiddenDashboardCards: input.hiddenDashboardCards
    });
  }

  function applyUserPreferences(preferences: UserPreferences): void {
    setDarkMode(preferences.darkMode);
    setMapViewMode(preferences.mapViewMode);
    setUnitSystem(preferences.unitSystem);
    setShowRadarLayer(preferences.showRadarLayer);
    setShowStationLayer(preferences.showStationLayer);
    setWeatherVisualTone(preferences.weatherVisualTone);
    setShowWeatherAnimations(preferences.showWeatherAnimations);
    setShowMiniCharts(preferences.showMiniCharts);
    setHistoryChartMode(preferences.historyChartMode);
    setVisibleProviders(preferences.visibleProviders);
    setActiveWorkspace(preferences.activeWorkspace);
    setSurfaceStyle(preferences.surfaceStyle);
    setDashboardCardOrder(
      preferences.dashboardCardOrder.length > 0
        ? (preferences.dashboardCardOrder.filter((item): item is DashboardCardId =>
            DEFAULT_DASHBOARD_CARD_ORDER.includes(item as DashboardCardId)
          ))
        : DEFAULT_DASHBOARD_CARD_ORDER
    );
    setHiddenDashboardCards(
      preferences.hiddenDashboardCards.filter((item): item is DashboardCardId =>
        DEFAULT_DASHBOARD_CARD_ORDER.includes(item as DashboardCardId)
      )
    );
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

  async function loadUserPreferencesWithToken(accessToken: string): Promise<void> {
    setPreferencePersistenceState('loading');

    try {
      const preferences = await fetchUserPreferences(accessToken);
      applyUserPreferences(preferences);
      setLastSyncedPreferencesSignature(
        serializeUserPreferences({
          darkMode: preferences.darkMode,
          mapViewMode: preferences.mapViewMode,
          unitSystem: preferences.unitSystem,
          showRadarLayer: preferences.showRadarLayer,
          showStationLayer: preferences.showStationLayer,
          weatherVisualTone: preferences.weatherVisualTone,
          showWeatherAnimations: preferences.showWeatherAnimations,
          showMiniCharts: preferences.showMiniCharts,
          historyChartMode: preferences.historyChartMode,
          visibleProviders: preferences.visibleProviders,
          activeWorkspace: preferences.activeWorkspace,
          surfaceStyle: preferences.surfaceStyle,
          dashboardCardOrder: preferences.dashboardCardOrder,
          hiddenDashboardCards: preferences.hiddenDashboardCards
        })
      );
      setPreferencePersistenceState('saved');
      setIsUserPreferencesHydrated(true);
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        handleUnauthorizedSession();
        return;
      }

      setPreferencePersistenceState('error');
      setIsUserPreferencesHydrated(true);
      showToast('error', 'Failed to load saved user preferences.');
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

    const timeoutMs = toast.actionLabel ? 8000 : 3000;
    const timer = window.setTimeout(() => {
      setToast(null);
      setToastAction(null);
    }, timeoutMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    void refreshWeatherData();
    void fetchWeatherProviders()
      .then((items) => {
        setAvailableWeatherProviders(items);
      })
      .catch(() => {
        setAvailableWeatherProviders([]);
      });

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

    const savedWorkspaceView = window.localStorage.getItem(WORKSPACE_VIEW_STORAGE_KEY);
    if (savedWorkspaceView === 'dashboard' || savedWorkspaceView === 'explore' || savedWorkspaceView === 'admin') {
      setActiveWorkspace(savedWorkspaceView);
    }

    const savedSurfaceStyle = window.localStorage.getItem(SURFACE_STYLE_STORAGE_KEY);
    if (savedSurfaceStyle === 'glass' || savedSurfaceStyle === 'elevated' || savedSurfaceStyle === 'neo') {
      setSurfaceStyle(savedSurfaceStyle);
    }

    const savedDashboardCardOrder = window.localStorage.getItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
    if (savedDashboardCardOrder) {
      try {
        const parsed = JSON.parse(savedDashboardCardOrder) as DashboardCardId[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is DashboardCardId =>
            DEFAULT_DASHBOARD_CARD_ORDER.includes(item as DashboardCardId)
          );
          const missing = DEFAULT_DASHBOARD_CARD_ORDER.filter((item) => !valid.includes(item));
          if (valid.length > 0) {
            setDashboardCardOrder([...valid, ...missing]);
          }
        }
      } catch {
        // Ignore malformed dashboard card order
      }
    }

    const savedHiddenDashboardCards = window.localStorage.getItem(DASHBOARD_CARD_HIDDEN_STORAGE_KEY);
    if (savedHiddenDashboardCards) {
      try {
        const parsed = JSON.parse(savedHiddenDashboardCards) as DashboardCardId[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is DashboardCardId =>
            DEFAULT_DASHBOARD_CARD_ORDER.includes(item as DashboardCardId)
          );
          setHiddenDashboardCards(Array.from(new Set(valid)));
        }
      } catch {
        // Ignore malformed hidden dashboard cards
      }
    }

    const savedCollapsedDashboardCards = window.localStorage.getItem(DASHBOARD_CARD_COLLAPSED_STORAGE_KEY);
    if (savedCollapsedDashboardCards) {
      try {
        const parsed = JSON.parse(savedCollapsedDashboardCards) as DashboardCardId[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is DashboardCardId =>
            DEFAULT_DASHBOARD_CARD_ORDER.includes(item as DashboardCardId)
          );
          setCollapsedDashboardCards(Array.from(new Set(valid)));
        }
      } catch {
        // Ignore malformed collapsed dashboard cards
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
    window.localStorage.setItem(WORKSPACE_VIEW_STORAGE_KEY, activeWorkspace);
  }, [activeWorkspace]);

  useEffect(() => {
    window.localStorage.setItem(SURFACE_STYLE_STORAGE_KEY, surfaceStyle);
  }, [surfaceStyle]);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_CARD_ORDER_STORAGE_KEY, JSON.stringify(dashboardCardOrder));
  }, [dashboardCardOrder]);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_CARD_HIDDEN_STORAGE_KEY, JSON.stringify(hiddenDashboardCards));
  }, [hiddenDashboardCards]);

  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_CARD_COLLAPSED_STORAGE_KEY,
      JSON.stringify(collapsedDashboardCards)
    );
  }, [collapsedDashboardCards]);

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
      setIsUserPreferencesHydrated(false);
      setLastSyncedPreferencesSignature(null);
      setPreferencePersistenceState('guest');
      setProviderStatusState('not-loaded');
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setIsUserPreferencesHydrated(false);
    void loadUserPreferencesWithToken(session.accessToken);
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
    if (activeWorkspace !== 'admin') {
      return;
    }

    if (session?.user.role !== 'admin') {
      setActiveWorkspace('dashboard');
    }
  }, [activeWorkspace, session]);

  useEffect(() => {
    if (!session || !isUserPreferencesHydrated) {
      return;
    }

    const nextSignature = serializeUserPreferences({
      darkMode,
      mapViewMode,
      unitSystem,
      showRadarLayer,
      showStationLayer,
      weatherVisualTone,
      showWeatherAnimations,
      showMiniCharts,
      historyChartMode,
      visibleProviders,
      activeWorkspace,
      surfaceStyle,
      dashboardCardOrder,
      hiddenDashboardCards
    });

    if (nextSignature === lastSyncedPreferencesSignature) {
      return;
    }

    setPreferencePersistenceState('saving');

    const timer = window.setTimeout(() => {
      void updateUserPreferences({
        accessToken: session.accessToken,
        darkMode,
        mapViewMode,
        unitSystem,
        showRadarLayer,
        showStationLayer,
        weatherVisualTone,
        showWeatherAnimations,
        showMiniCharts,
        historyChartMode,
        visibleProviders,
        activeWorkspace,
        surfaceStyle,
        dashboardCardOrder,
        hiddenDashboardCards
      })
        .then((preferences) => {
          setLastSyncedPreferencesSignature(
            serializeUserPreferences({
              darkMode: preferences.darkMode,
              mapViewMode: preferences.mapViewMode,
              unitSystem: preferences.unitSystem,
              showRadarLayer: preferences.showRadarLayer,
              showStationLayer: preferences.showStationLayer,
              weatherVisualTone: preferences.weatherVisualTone,
              showWeatherAnimations: preferences.showWeatherAnimations,
              showMiniCharts: preferences.showMiniCharts,
              historyChartMode: preferences.historyChartMode,
              visibleProviders: preferences.visibleProviders,
              activeWorkspace: preferences.activeWorkspace,
              surfaceStyle: preferences.surfaceStyle,
              dashboardCardOrder: preferences.dashboardCardOrder,
              hiddenDashboardCards: preferences.hiddenDashboardCards
            })
          );
          setPreferencePersistenceState('saved');
        })
        .catch((error) => {
          if (error instanceof HttpStatusError && error.status === 401) {
            handleUnauthorizedSession();
            return;
          }

          setPreferencePersistenceState('error');
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    session,
    isUserPreferencesHydrated,
    darkMode,
    mapViewMode,
    unitSystem,
    showRadarLayer,
    showStationLayer,
    weatherVisualTone,
    showWeatherAnimations,
    showMiniCharts,
    historyChartMode,
    visibleProviders,
    activeWorkspace,
    surfaceStyle,
    dashboardCardOrder,
    hiddenDashboardCards,
    lastSyncedPreferencesSignature
  ]);

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

  const prioritizedProviderOptions = useMemo(() => {
    const providers = providerOptions.filter((provider) => provider !== 'all');
    const prioritized = buildPrioritizedProviders({
      providers,
      visibleProviders
    });

    return ['all', ...prioritized];
  }, [providerOptions, visibleProviders]);

  const quickAddProviderOptions = useMemo(() => {
    const known = providerOptions.filter((provider) => provider !== 'all');
    return Array.from(new Set([...availableWeatherProviders, ...known])).sort();
  }, [availableWeatherProviders, providerOptions]);

  const lastDataRefreshLabel = useMemo(() => {
    if (!lastDataRefreshAt) {
      return 'never';
    }

    return new Date(lastDataRefreshAt).toLocaleTimeString();
  }, [lastDataRefreshAt]);

  const surfaceTokens = useMemo(() => {
    if (surfaceStyle === 'elevated') {
      return {
        border: darkMode ? '#334155' : '#cbd5e1',
        surface: darkMode ? '#0f172a' : '#ffffff',
        surfaceStrong: darkMode ? '#111827' : '#f8fafc',
        shellShadow: darkMode ? '0 18px 42px rgba(2, 6, 23, 0.44)' : '0 16px 36px rgba(15, 23, 42, 0.14)'
      };
    }

    if (surfaceStyle === 'neo') {
      return {
        border: darkMode ? '#1f2937' : '#dbeafe',
        surface: darkMode ? '#0b1220' : '#eef2ff',
        surfaceStrong: darkMode ? '#111827' : '#f8fafc',
        shellShadow: darkMode ? '12px 12px 28px rgba(2, 6, 23, 0.45)' : '12px 12px 26px rgba(148, 163, 184, 0.35)'
      };
    }

    return {
      border: darkMode ? '#334155' : '#d1d5db',
      surface: darkMode ? 'rgba(17, 24, 39, 0.72)' : 'rgba(255, 255, 255, 0.74)',
      surfaceStrong: darkMode ? 'rgba(11, 18, 32, 0.78)' : 'rgba(248, 250, 252, 0.85)',
      shellShadow: darkMode ? '0 18px 46px rgba(2, 6, 23, 0.52)' : '0 16px 34px rgba(15, 23, 42, 0.12)'
    };
  }, [darkMode, surfaceStyle]);

  const isDashboardWorkspace = activeWorkspace === 'dashboard';
  const isExploreWorkspace = activeWorkspace === 'explore';
  const isAdminWorkspace = activeWorkspace === 'admin';

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

  useEffect(() => {
    if (!prioritizedProviderOptions.includes(selectedProvider)) {
      setSelectedProvider('all');
    }
  }, [prioritizedProviderOptions, selectedProvider]);

  useEffect(() => {
    if (quickAddProviderOptions.length === 0) {
      setQuickAddProvider('');
      return;
    }

    if (!quickAddProviderOptions.includes(quickAddProvider)) {
      setQuickAddProvider(quickAddProviderOptions[0]);
    }
  }, [quickAddProviderOptions, quickAddProvider]);

  useEffect(() => {
    const provider = quickAddProvider.trim().toLowerCase();

    if (!provider) {
      setQuickAddCandidates([]);
      setQuickAddSelectedCandidateExternalId('');
      setQuickAddCandidatesStatus('idle');
      return;
    }

    setQuickAddCandidatesStatus('loading...');

    void fetchProviderStations({
      provider,
      query: quickAddExternalId,
      limit: 75
    })
      .then((items) => {
        setQuickAddCandidates(items);
        setQuickAddCandidatesStatus(items.length > 0 ? `loaded (${items.length})` : 'empty');
      })
      .catch(() => {
        setQuickAddCandidates([]);
        setQuickAddCandidatesStatus('error');
      });
  }, [quickAddProvider, quickAddExternalId]);

  useEffect(() => {
    if (!quickAddSelectedCandidateExternalId) {
      return;
    }

    const selected = quickAddCandidates.find(
      (item) => item.externalId.toLowerCase() === quickAddSelectedCandidateExternalId.toLowerCase()
    );

    if (!selected) {
      return;
    }

    setQuickAddExternalId(selected.externalId);
    setQuickAddName(selected.name);
    setQuickAddLat(String(selected.lat));
    setQuickAddLng(String(selected.lng));
    setQuickAddElevationM(selected.elevationM === null ? '' : String(selected.elevationM));
  }, [quickAddSelectedCandidateExternalId, quickAddCandidates]);

  const filteredStations = useMemo(() => {
    const byProviderSelection =
      selectedProvider === 'all'
        ? stations
        : stations.filter((station) => station.provider === selectedProvider);

    const byVisibility =
      visibleProviders.length === 0
        ? byProviderSelection
        : byProviderSelection.filter((station) => visibleProviders.includes(station.provider));

    return sortStationsByProviderPriority({
      stations: byVisibility,
      prioritizedProviders: prioritizedProviderOptions.filter((provider) => provider !== 'all')
    });
  }, [stations, selectedProvider, visibleProviders, prioritizedProviderOptions]);

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

  async function reloadStationHistory(stationId: string): Promise<void> {
    setHistoryStatus('loading...');

    try {
      const items = await fetchStationObservations({ stationId, limit: 240 });
      setSelectedStationHistory(items);
      setHistoryStatus(items.length > 0 ? `loaded (${items.length} points)` : 'empty');
    } catch {
      setSelectedStationHistory([]);
      setHistoryStatus('error');
    }
  }

  useEffect(() => {
    if (!selectedStationId) {
      setSelectedStationHistory([]);
      setHistoryStatus('no-station-selected');
      return;
    }

    void reloadStationHistory(selectedStationId);
  }, [selectedStationId]);

  async function handleBackfillStation(days: 5 | 10): Promise<void> {
    if (!session) {
      showToast('error', 'Please log in to backfill station history.');
      return;
    }

    if (!selectedStationId) {
      showToast('info', 'Select a station first to run backfill.');
      return;
    }

    if (isBackfilling) {
      return;
    }

    setIsBackfilling(true);
    setBackfillStatus(`Backfilling ${days} days...`);

    try {
      const result = await triggerStationBackfill({
        accessToken: session.accessToken,
        stationId: selectedStationId,
        days
      });

      await reloadStationHistory(selectedStationId);
      await refreshWeatherData();
      setBackfillStatus(`Imported ${result.imported} observations (${result.days}d).`);
      showToast('success', `Backfill complete: ${result.imported} observations imported.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backfill failed.';
      setBackfillStatus(message);
      showToast('error', 'Backfill failed for this station/source.');
    } finally {
      setIsBackfilling(false);
    }
  }

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) ?? null,
    [stations, selectedStationId]
  );

  const selectedStationCurrent = useMemo(
    () => (selectedStationId ? currentByStationId[selectedStationId] : undefined),
    [currentByStationId, selectedStationId]
  );

  const stationPickerOptions = useMemo(() => {
    const normalizedQuery = stationSearchQuery.trim().toLowerCase();
    const sorted = [...stations].sort((left, right) => {
      const byProvider = left.provider.localeCompare(right.provider);
      if (byProvider !== 0) {
        return byProvider;
      }

      const byName = left.name.localeCompare(right.name);
      if (byName !== 0) {
        return byName;
      }

      return left.id.localeCompare(right.id);
    });

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((station) => {
      const target = `${station.name} ${station.provider} ${station.externalId}`.toLowerCase();
      return target.includes(normalizedQuery);
    });
  }, [stations, stationSearchQuery]);

  const quickAddResolvedCandidate = useMemo(() => {
    const externalId = quickAddExternalId.trim().toLowerCase();

    if (!externalId) {
      return null;
    }

    return (
      quickAddCandidates.find((item) => item.externalId.toLowerCase() === externalId) ??
      null
    );
  }, [quickAddCandidates, quickAddExternalId]);

  const quickAddSavedCandidates = useMemo(
    () => quickAddCandidates.filter((item) => item.inDatabase),
    [quickAddCandidates]
  );

  const quickAddUnsavedCandidates = useMemo(
    () => quickAddCandidates.filter((item) => !item.inDatabase),
    [quickAddCandidates]
  );

  const quickAddManualLat = Number(quickAddLat);
  const quickAddManualLng = Number(quickAddLng);
  const hasQuickAddManualLocation =
    quickAddAdvanced &&
    quickAddLat.trim().length > 0 &&
    quickAddLng.trim().length > 0 &&
    Number.isFinite(quickAddManualLat) &&
    Number.isFinite(quickAddManualLng) &&
    quickAddManualLat >= -90 &&
    quickAddManualLat <= 90 &&
    quickAddManualLng >= -180 &&
    quickAddManualLng <= 180;

  const quickAddNeedsResolvableLocation =
    quickAddProvider.trim().length > 0 &&
    quickAddExternalId.trim().length > 0 &&
    !quickAddResolvedCandidate &&
    !hasQuickAddManualLocation;

  const quickAddCanSubmit =
    !isQuickAddingStation &&
    Boolean(session) &&
    quickAddProviderOptions.length > 0 &&
    quickAddProvider.trim().length > 0 &&
    quickAddExternalId.trim().length > 0 &&
    !quickAddNeedsResolvableLocation;

  const quickAddActionLabel = useMemo(() => {
    const provider = quickAddProvider.trim().toLowerCase();
    const externalId = quickAddExternalId.trim();

    if (!provider || !externalId) {
      return 'Add station';
    }

    return quickAddResolvedCandidate
      ? `Add ${quickAddResolvedCandidate.externalId}`
      : `Add ${externalId}`;
  }, [quickAddProvider, quickAddExternalId, quickAddResolvedCandidate]);

  const quickAddIdentifierPlaceholder = useMemo(() => {
    if (quickAddProvider.trim().toLowerCase() === 'airport') {
      return 'e.g. KSEA or SEA';
    }

    return 'e.g. KSEA or 72493';
  }, [quickAddProvider]);

  const quickAddGuidance = useMemo(() => {
    if (!session) {
      return 'Log in to add stations.';
    }

    if (!quickAddProvider.trim()) {
      return 'Pick a source provider.';
    }

    if (!quickAddExternalId.trim()) {
      return quickAddProvider.trim().toLowerCase() === 'airport'
        ? 'Enter an airport ICAO or IATA code (for example KSEA or SEA).'
        : 'Select a station/site from the source list, or enter station ID/call sign.';
    }

    if (quickAddResolvedCandidate) {
      return quickAddResolvedCandidate.inDatabase
        ? 'This station is already saved. Add will focus/select it.'
        : 'This station will be saved and shown on the map.';
    }

    if (hasQuickAddManualLocation) {
      return 'Manual location provided. Station can be added.';
    }

    if (quickAddCandidatesStatus === 'loading...') {
      return 'Looking up station metadata from source...';
    }

    return 'No source match yet. Pick from available stations or add optional location details.';
  }, [
    session,
    quickAddProvider,
    quickAddExternalId,
    quickAddResolvedCandidate,
    hasQuickAddManualLocation,
    quickAddCandidatesStatus
  ]);

  const selectedStationFreshness = useMemo(() => {
    if (!selectedStationCurrent?.observedAt) {
      return { label: 'No live sample', color: '#6b7280', background: '#f3f4f6' };
    }

    const observedAtMs = new Date(selectedStationCurrent.observedAt).getTime();

    if (!Number.isFinite(observedAtMs)) {
      return { label: 'Timestamp invalid', color: '#991b1b', background: '#fee2e2' };
    }

    const ageMinutes = Math.max(0, (Date.now() - observedAtMs) / 60_000);

    if (ageMinutes <= 5) {
      return { label: 'Live (≤5m)', color: '#065f46', background: '#d1fae5' };
    }

    if (ageMinutes <= 20) {
      return { label: 'Recent (≤20m)', color: '#92400e', background: '#fef3c7' };
    }

    return { label: 'Stale (>20m)', color: '#991b1b', background: '#fee2e2' };
  }, [selectedStationCurrent]);

  function formatKpiMetric(label: string, value: string): JSX.Element {
    return (
      <div
        style={{
          border: '1px solid var(--wx-border, #d1d5db)',
          borderRadius: 12,
          padding: '10px 12px',
          background: 'var(--wx-surface, #ffffff)'
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--wx-muted, #475569)' }}>{label}</div>
        <div style={{ fontWeight: 700, marginTop: 2 }}>{value}</div>
      </div>
    );
  }

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

  const dashboardCardLabels: Record<DashboardCardId, string> = {
    'map-controls': 'Map controls',
    experience: 'Experience',
    map: 'Map canvas',
    history: 'History chart'
  };

  function toggleDashboardCardVisibility(cardId: DashboardCardId): void {
    setHiddenDashboardCards((previous) =>
      previous.includes(cardId)
        ? previous.filter((item) => item !== cardId)
        : [...previous, cardId]
    );
  }

  function moveDashboardCard(cardId: DashboardCardId, direction: 'up' | 'down'): void {
    setDashboardCardOrder((previous) => {
      const currentIndex = previous.indexOf(cardId);

      if (currentIndex === -1) {
        return previous;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function toggleDashboardCardCollapsed(cardId: DashboardCardId): void {
    setCollapsedDashboardCards((previous) =>
      previous.includes(cardId)
        ? previous.filter((item) => item !== cardId)
        : [...previous, cardId]
    );
  }

  async function handleQuickAddStation(): Promise<void> {
    if (isQuickAddingStation) {
      return;
    }

    if (!session) {
      setQuickAddStatus('Login required');
      showToast('error', 'Please log in before adding a station.');
      return;
    }

    const provider = quickAddProvider.trim().toLowerCase();
    const externalId = quickAddExternalId.trim();

    if (!provider) {
      setQuickAddStatus('Select a source');
      return;
    }

    if (!externalId) {
      setQuickAddStatus('Station ID/callsign required');
      return;
    }

    const existedBefore = stations.some(
      (station) => station.provider === provider && station.externalId.toLowerCase() === externalId.toLowerCase()
    );

    const payload: {
      accessToken: string;
      provider: string;
      externalId: string;
      name?: string;
      lat?: number;
      lng?: number;
      elevationM?: number | null;
    } = {
      accessToken: session.accessToken,
      provider,
      externalId
    };

    const selectedCandidate = quickAddCandidates.find(
      (item) => item.externalId.toLowerCase() === externalId.toLowerCase()
    );

    if (selectedCandidate) {
      payload.name = selectedCandidate.name;
      payload.lat = selectedCandidate.lat;
      payload.lng = selectedCandidate.lng;
      payload.elevationM = selectedCandidate.elevationM;
    }

    if (quickAddAdvanced) {
      const name = quickAddName.trim();
      const lat = Number(quickAddLat);
      const lng = Number(quickAddLng);
      const elevation = quickAddElevationM.trim();

      if (name) {
        payload.name = name;
      }

      if (quickAddLat.trim()) {
        payload.lat = lat;
      }

      if (quickAddLng.trim()) {
        payload.lng = lng;
      }

      if (elevation) {
        const elevationM = Number(elevation);
        if (Number.isFinite(elevationM)) {
          payload.elevationM = elevationM;
        }
      }
    }

    setIsQuickAddingStation(true);
    setQuickAddStatus('Adding station...');

    try {
      const created = await createWeatherStation(payload);
      setSelectedStationId(created.id);
      setSelectedProvider('all');
      setVisibleProviders((previous) =>
        previous.includes(created.provider) ? previous : [...previous, created.provider]
      );
      setShowStationLayer(true);
      setStationSearchQuery('');
      setQuickAddExternalId('');
      setQuickAddSelectedCandidateExternalId('');
      setQuickAddName('');
      setQuickAddLat('');
      setQuickAddLng('');
      setQuickAddElevationM('');
      setQuickAddStatus(existedBefore ? 'Already existed in database — focused station' : 'Station saved to database');
      showToast(
        'success',
        existedBefore
          ? 'Station already existed in database. Focus updated.'
          : 'Station saved and visible on the map.'
      );
      await refreshWeatherData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Add station failed';

      if (message.toLowerCase().includes('lat is required') || message.toLowerCase().includes('lng is required')) {
        setQuickAddAdvanced(true);
      }

      setQuickAddStatus(message);
      showToast('error', 'Could not add station. Add optional location details and try again.');
    } finally {
      setIsQuickAddingStation(false);
    }
  }

  async function handleAutoLookupStation(): Promise<void> {
    if (isQuickLookupRunning) {
      return;
    }

    const provider = quickAddProvider.trim().toLowerCase();
    const externalId = quickAddExternalId.trim();

    if (!provider) {
      setQuickAddStatus('Select a source first');
      return;
    }

    if (!externalId) {
      setQuickAddStatus('Enter station ID/call sign first');
      return;
    }

    setIsQuickLookupRunning(true);
    setQuickAddStatus('Looking up station metadata...');

    try {
      const candidates = await fetchProviderStations({
        provider,
        query: externalId,
        limit: 25
      });

      setQuickAddCandidates(candidates);

      const exact = candidates.find(
        (item) => item.externalId.toLowerCase() === externalId.toLowerCase()
      );
      const selected = exact ?? candidates[0];

      if (!selected) {
        setQuickAddStatus('No station match found from source lookup');
        showToast('info', 'No station metadata found. You can still add optional location details manually.');
        return;
      }

      setQuickAddSelectedCandidateExternalId(selected.externalId);
      setQuickAddExternalId(selected.externalId);
      setQuickAddName(selected.name);
      setQuickAddLat(String(selected.lat));
      setQuickAddLng(String(selected.lng));
      setQuickAddElevationM(selected.elevationM === null ? '' : String(selected.elevationM));

      setQuickAddStatus(
        selected.inDatabase
          ? `Match found: ${selected.externalId} (already saved)`
          : `Match found: ${selected.externalId}`
      );
      showToast('success', `Auto lookup matched ${selected.name} (${selected.externalId}).`);
    } catch {
      setQuickAddStatus('Auto lookup failed. Try again or use optional details.');
      showToast('error', 'Auto lookup failed for this provider right now.');
    } finally {
      setIsQuickLookupRunning(false);
    }
  }

  function handleStationSelectFromMap(stationId: string): void {
    setSelectedStationId(stationId);

    const station = stations.find((item) => item.id === stationId);
    const current = currentByStationId[stationId];

    if (!station) {
      return;
    }

    const metricSummary = getMetricLabel(selectedMetric, current);
    showToast(
      'info',
      `${station.name} · ${station.provider} · ${metricSummary}`,
      {
        label: 'View detailed overview',
        value: {
          kind: 'open-station-overview',
          stationId
        }
      }
    );
  }

  function handleToastAction(): void {
    if (!toastAction) {
      return;
    }

    if (toastAction.kind === 'open-station-overview') {
      setSelectedStationId(toastAction.stationId);
      setActiveWorkspace('dashboard');
      setHiddenDashboardCards((previous) => previous.filter((item) => item !== 'history'));
      setShowStationLayer(true);
      setToast(null);
      setToastAction(null);
    }
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
        ['--wx-border' as string]: surfaceTokens.border,
        ['--wx-surface' as string]: surfaceTokens.surface,
        ['--wx-surface-strong' as string]: surfaceTokens.surfaceStrong,
        ['--wx-skeleton-start' as string]: darkMode ? '#1f2937' : '#f3f4f6',
        ['--wx-skeleton-mid' as string]: darkMode ? '#334155' : '#e5e7eb',
        ['--wx-text' as string]: darkMode ? '#e2e8f0' : '#111827',
        ['--wx-muted' as string]: darkMode ? '#94a3b8' : '#475569',
        ['--wx-accent' as string]: darkMode ? '#93c5fd' : '#2563eb',
        ['--wx-shell-shadow' as string]: surfaceTokens.shellShadow
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
        .wx-workspace-switcher {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin: 10px 0 14px;
          padding: 10px;
          border-radius: 14px;
          background: var(--wx-surface-strong, #f8fafc);
          border: 1px solid var(--wx-border, #d1d5db);
          box-shadow: var(--wx-shell-shadow, 0 10px 24px rgba(15,23,42,0.1));
          backdrop-filter: blur(10px);
        }
        .wx-workspace-btn[data-active='true'] {
          background: ${darkMode ? '#2563eb' : '#1d4ed8'};
          color: #fff;
          border-color: transparent;
        }
        .wx-view-shell {
          display: grid;
          gap: 14px;
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
        .wx-card-shell {
          border: 1px solid var(--wx-border, #d1d5db);
          border-radius: 14px;
          background: var(--wx-surface, #ffffff);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }
        .wx-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          background: var(--wx-surface-strong, #f8fafc);
          border-bottom: 1px solid var(--wx-border, #d1d5db);
        }
        .wx-card-body {
          padding: 12px;
          display: grid;
          gap: 12px;
        }
        .wx-sticky-controls {
          position: sticky;
          top: 8px;
          z-index: 30;
        }
        @media (max-width: 900px) {
          main {
            padding: 14px;
          }
          .wx-workspace-switcher {
            position: sticky;
            top: 8px;
            z-index: 40;
          }
          .wx-card-body {
            padding: 10px;
          }
        }
        @media (max-width: 640px) {
          main {
            padding: 10px;
          }
          .wx-workspace-switcher {
            gap: 6px;
            padding: 8px;
          }
          .wx-workspace-btn {
            font-size: 13px;
            padding: 7px 9px;
          }
          .wx-header-title {
            font-size: clamp(1.4rem, 6vw, 1.9rem);
          }
          .wx-subtitle {
            font-size: 0.9rem;
          }
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

        <div className="wx-workspace-switcher" aria-label="Workspace layout controls">
          <button
            type="button"
            className="wx-workspace-btn"
            data-active={isDashboardWorkspace}
            onClick={() => setActiveWorkspace('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className="wx-workspace-btn"
            data-active={isExploreWorkspace}
            onClick={() => setActiveWorkspace('explore')}
          >
            Explore
          </button>
          <button
            type="button"
            className="wx-workspace-btn"
            data-active={isAdminWorkspace}
            onClick={() => setActiveWorkspace('admin')}
            disabled={session?.user.role !== 'admin'}
            title={session?.user.role === 'admin' ? 'Open admin workspace' : 'Admin workspace requires admin login'}
          >
            Admin
          </button>
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Surface style
            <select
              value={surfaceStyle}
              onChange={(event) => setSurfaceStyle(event.target.value as SurfaceStyle)}
              aria-label="Select surface style"
            >
              <option value="glass">Glass</option>
              <option value="elevated">Elevated</option>
              <option value="neo">Neo</option>
            </select>
          </label>
        </div>

        {isDashboardWorkspace ? (
        <section style={sectionGridStyle} aria-labelledby="station-map-heading" className="wx-view-shell">
        <h2 id="station-map-heading" style={{ marginBottom: 0 }}>
          Dashboard view
        </h2>
        <p style={{ marginTop: 0 }}>
          Station data status: <strong>{stationsStatus}</strong>
        </p>
        <div
          style={{
            display: 'grid',
            gap: 8,
            gridTemplateColumns: '1fr minmax(220px, 340px)',
            alignItems: 'end'
          }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            Find station
            <input
              aria-label="Search stations"
              placeholder="Search by station, provider, or external ID"
              value={stationSearchQuery}
              onChange={(event) => setStationSearchQuery(event.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Station focus
            <select
              aria-label="Select station focus"
              value={selectedStationId ?? ''}
              onChange={(event) => setSelectedStationId(event.target.value || null)}
            >
              <option value="">Select a station...</option>
              {stationPickerOptions.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name} · {station.provider}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 12,
              color: selectedStationFreshness.color,
              background: selectedStationFreshness.background
            }}
          >
            {selectedStationFreshness.label}
          </span>
          <span style={{ fontSize: 13, color: 'var(--wx-muted, #475569)' }}>
            Latest sample:{' '}
            <strong>
              {selectedStationCurrent?.observedAt
                ? new Date(selectedStationCurrent.observedAt).toLocaleTimeString()
                : '—'}
            </strong>
          </span>
          <span style={{ fontSize: 13, color: 'var(--wx-muted, #475569)' }}>
            Station source: <strong>{selectedStation?.provider ?? '—'}</strong>
          </span>
        </div>
        <details
          className="wx-card-shell"
          style={{ padding: 10, background: 'var(--wx-surface-strong, #f8fafc)' }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Customize dashboard layout
          </summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {dashboardCardOrder.map((cardId, index) => {
              const isHidden = hiddenDashboardCards.includes(cardId);
              return (
                <div
                  key={cardId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 10,
                    border: '1px solid var(--wx-border, #d1d5db)',
                    background: 'var(--wx-surface, #ffffff)'
                  }}
                >
                  <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggleDashboardCardVisibility(cardId)}
                      aria-label={`Toggle ${dashboardCardLabels[cardId]}`}
                    />
                    {dashboardCardLabels[cardId]}
                  </label>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => moveDashboardCard(cardId, 'up')}
                      disabled={index === 0}
                      aria-label={`Move ${dashboardCardLabels[cardId]} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDashboardCard(cardId, 'down')}
                      disabled={index === dashboardCardOrder.length - 1}
                      aria-label={`Move ${dashboardCardLabels[cardId]} down`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        {dashboardCardOrder.map((cardId) => {
          if (hiddenDashboardCards.includes(cardId)) {
            return null;
          }

          const isCollapsed = collapsedDashboardCards.includes(cardId);

          let content: JSX.Element;

          if (cardId === 'map-controls') {
            content = (
              <div className="wx-sticky-controls">
                <MapControlPanel
                  key={cardId}
                  selectedMetric={selectedMetric}
                  selectedProvider={selectedProvider}
                  mapViewMode={mapViewMode}
                  providerOptions={prioritizedProviderOptions}
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
              </div>
            );
          } else if (cardId === 'experience') {
            content = (
              <UserExperiencePanel
                key={cardId}
                darkMode={darkMode}
                mapViewMode={mapViewMode}
                unitSystem={unitSystem}
                showRadarLayer={showRadarLayer}
                showStationLayer={showStationLayer}
                weatherVisualTone={weatherVisualTone}
                showWeatherAnimations={showWeatherAnimations}
                showMiniCharts={showMiniCharts}
                historyChartMode={historyChartMode}
                providerOptions={prioritizedProviderOptions}
                visibleProviders={visibleProviders}
                onToggleDarkMode={() => setDarkMode((previous) => !previous)}
                onMapViewModeChange={setMapViewMode}
                onUnitSystemChange={setUnitSystem}
                onShowRadarLayerChange={setShowRadarLayer}
                onShowStationLayerChange={setShowStationLayer}
                onWeatherVisualToneChange={setWeatherVisualTone}
                onShowWeatherAnimationsChange={setShowWeatherAnimations}
                onShowMiniChartsChange={setShowMiniCharts}
                onHistoryChartModeChange={setHistoryChartMode}
                onVisibleProvidersChange={(providers) => {
                  const deduped = Array.from(new Set(providers));
                  setVisibleProviders(deduped);
                }}
                persistenceState={preferencePersistenceState}
              />
            );
          } else if (cardId === 'map') {
            content = stationsStatus === 'loading...' ? (
              <div key={cardId} aria-label="Loading station map" role="status" aria-live="polite" style={{ display: 'grid', gap: 8 }}>
                <LoadingSkeleton ariaLabel="Loading map summary" />
                <LoadingSkeleton ariaLabel="Loading map controls" width="85%" />
                <LoadingSkeleton ariaLabel="Loading map canvas" width="92%" height={320} />
              </div>
            ) : (
              <StationMap
                key={cardId}
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
                onStationSelect={handleStationSelectFromMap}
              />
            );
          } else {
            content = (
              <div>
                <StationInsightsPanel
                  station={selectedStation}
                  current={selectedStationCurrent}
                  history={selectedStationHistory}
                  unitSystem={unitSystem}
                  showMiniCharts={showMiniCharts}
                />
                <p>
                  History status: <strong>{historyStatus}</strong>
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      void handleBackfillStation(5);
                    }}
                    disabled={!session || !selectedStation || isBackfilling}
                    title={!session ? 'Login required' : 'Backfill 5 days of history for selected station'}
                  >
                    {isBackfilling ? 'Backfilling...' : 'Backfill 5d'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleBackfillStation(10);
                    }}
                    disabled={!session || !selectedStation || isBackfilling}
                    title={!session ? 'Login required' : 'Backfill 10 days of history for selected station'}
                  >
                    {isBackfilling ? 'Backfilling...' : 'Backfill 10d'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--wx-muted, #475569)' }}>
                    Backfill status: <strong>{backfillStatus}</strong>
                  </span>
                </div>
                {selectedStation ? (
                  <>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    <StationHistoryChart
                      stationName={selectedStation.name}
                      observations={selectedStationHistory}
                      metric="tempC"
                      unitSystem={unitSystem}
                      chartMode={historyChartMode}
                      weatherVisualTone={weatherVisualTone}
                      animated={showWeatherAnimations}
                    />
                    <StationHistoryChart
                      stationName={selectedStation.name}
                      observations={selectedStationHistory}
                      metric="humidityPct"
                      unitSystem={unitSystem}
                      chartMode={historyChartMode}
                      weatherVisualTone={weatherVisualTone}
                      animated={showWeatherAnimations}
                    />
                    <StationHistoryChart
                      stationName={selectedStation.name}
                      observations={selectedStationHistory}
                      metric="windSpeedMs"
                      unitSystem={unitSystem}
                      chartMode={historyChartMode}
                      weatherVisualTone={weatherVisualTone}
                      animated={showWeatherAnimations}
                    />
                    <StationHistoryChart
                      stationName={selectedStation.name}
                      observations={selectedStationHistory}
                      metric="pressureHpa"
                      unitSystem={unitSystem}
                      chartMode={historyChartMode}
                      weatherVisualTone={weatherVisualTone}
                      animated={showWeatherAnimations}
                    />
                    <StationHistoryChart
                      stationName={selectedStation.name}
                      observations={selectedStationHistory}
                      metric="precipMm"
                      unitSystem={unitSystem}
                      chartMode={historyChartMode}
                      weatherVisualTone={weatherVisualTone}
                      animated={showWeatherAnimations}
                    />
                  </div>
                  <section
                    aria-label="Recent station observations table"
                    style={{
                      marginTop: 12,
                      border: '1px solid var(--wx-border, #d1d5db)',
                      borderRadius: 12,
                      background: 'var(--wx-surface, #ffffff)',
                      overflow: 'auto'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                      <thead>
                        <tr style={{ background: 'var(--wx-surface-strong, #f8fafc)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px' }}>Observed</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px' }}>Temp</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px' }}>Humidity</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px' }}>Wind</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px' }}>Pressure</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px' }}>Precip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStationHistory.slice(0, 16).map((item) => {
                          const tempLabel = item.tempC === null
                            ? 'N/A'
                            : unitSystem === 'imperial'
                              ? `${(item.tempC * 9 / 5 + 32).toFixed(1)} °F`
                              : `${item.tempC.toFixed(1)} °C`;

                          const windLabel = item.windSpeedMs === null
                            ? 'N/A'
                            : unitSystem === 'imperial'
                              ? `${(item.windSpeedMs * 2.23693629).toFixed(1)} mph`
                              : `${item.windSpeedMs.toFixed(1)} m/s`;

                          const precipLabel = item.precipMm === null
                            ? 'N/A'
                            : unitSystem === 'imperial'
                              ? `${(item.precipMm / 25.4).toFixed(2)} in`
                              : `${item.precipMm.toFixed(2)} mm`;

                          return (
                            <tr key={item.id} style={{ borderTop: '1px solid var(--wx-border, #d1d5db)' }}>
                              <td style={{ padding: '8px 10px' }}>{new Date(item.observedAt).toLocaleString()}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{tempLabel}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.humidityPct === null ? 'N/A' : `${item.humidityPct.toFixed(0)} %`}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{windLabel}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.pressureHpa === null ? 'N/A' : `${item.pressureHpa.toFixed(1)} hPa`}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{precipLabel}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                  </>
                ) : null}
              </div>
            );
          }

          return (
            <section key={cardId} className="wx-card-shell" aria-label={`${dashboardCardLabels[cardId]} card`}>
              <div className="wx-card-header">
                <strong>{dashboardCardLabels[cardId]}</strong>
                <button
                  type="button"
                  onClick={() => toggleDashboardCardCollapsed(cardId)}
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${dashboardCardLabels[cardId]}`}
                  title={isCollapsed ? 'Expand card' : 'Collapse card'}
                >
                  {isCollapsed ? '▾' : '▴'}
                </button>
              </div>
              {!isCollapsed ? <div className="wx-card-body">{content}</div> : null}
            </section>
          );
        })}
        </section>
        ) : null}

        {(isExploreWorkspace || isAdminWorkspace) ? (
        <section style={twoColumnGridStyle} aria-label="Stations and authentication panels" className="wx-view-shell">
        {isExploreWorkspace ? (
        <div aria-labelledby="stations-list-heading">
          <details
            style={{
              border: '1px solid var(--wx-border, #d1d5db)',
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
              background: 'var(--wx-surface, #ffffff)',
              display: 'grid',
              gap: 8
            }}
            aria-label="Quick add weather station"
            open
          >
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Quick add station</summary>
            <p style={{ margin: 0, color: 'var(--wx-muted, #475569)', fontSize: 13 }}>
              Enter source + station ID/call sign (airport source accepts ICAO/IATA). No endpoint knowledge needed.
            </p>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 4 }}>
                Source
                <select
                  value={quickAddProvider}
                  onChange={(event) => setQuickAddProvider(event.target.value)}
                  aria-label="Quick add source"
                >
                  {quickAddProviderOptions.length === 0 ? <option value="">No sources available</option> : null}
                  {quickAddProviderOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Station ID / call sign
                <input
                  placeholder={quickAddIdentifierPlaceholder}
                  value={quickAddExternalId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setQuickAddExternalId(value);

                    const matched = quickAddCandidates.find(
                      (item) => item.externalId.toLowerCase() === value.trim().toLowerCase()
                    );

                    setQuickAddSelectedCandidateExternalId(matched?.externalId ?? '');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleAutoLookupStation();
                    }
                  }}
                  aria-label="Quick add station identifier"
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Available stations from source
                <select
                  value={quickAddSelectedCandidateExternalId}
                  onChange={(event) => setQuickAddSelectedCandidateExternalId(event.target.value)}
                  aria-label="Select available station from provider"
                >
                  <option value="">Choose a station/site…</option>
                  {quickAddSavedCandidates.length > 0 ? (
                    <optgroup label="Saved in database">
                      {quickAddSavedCandidates.map((item) => (
                        <option key={`${item.provider}:${item.externalId}`} value={item.externalId}>
                          {item.name} ({item.externalId})
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {quickAddUnsavedCandidates.length > 0 ? (
                    <optgroup label="Available from source">
                      {quickAddUnsavedCandidates.map((item) => (
                        <option key={`${item.provider}:${item.externalId}`} value={item.externalId}>
                          {item.name} ({item.externalId})
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--wx-muted, #475569)' }}>
              Source station list: <strong>{quickAddCandidatesStatus}</strong>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  void handleQuickAddStation();
                }}
                disabled={!quickAddCanSubmit}
                title={!session ? 'Login required to add stations' : quickAddNeedsResolvableLocation ? 'Select a source station/site or provide location details first' : 'Add station'}
              >
                {isQuickAddingStation ? 'Adding...' : quickAddActionLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleAutoLookupStation();
                }}
                disabled={
                  isQuickLookupRunning ||
                  quickAddProvider.trim().length === 0 ||
                  quickAddExternalId.trim().length === 0
                }
                title="Resolve station metadata from source"
              >
                {isQuickLookupRunning ? 'Looking up...' : 'Auto lookup'}
              </button>
              <button
                type="button"
                onClick={() => setQuickAddAdvanced((previous) => !previous)}
              >
                {quickAddAdvanced ? 'Hide details' : 'Add optional details'}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--wx-muted, #475569)' }}>
              {quickAddResolvedCandidate ? (
                <>
                  Ready to add:{' '}
                  <strong>
                    {quickAddResolvedCandidate.name} ({quickAddResolvedCandidate.externalId})
                  </strong>{' '}
                  from <strong>{quickAddResolvedCandidate.provider}</strong>{' '}
                  {quickAddResolvedCandidate.inDatabase ? '· already saved' : '· new station'}
                </>
              ) : quickAddProvider.trim() && quickAddExternalId.trim() ? (
                <>
                  Ready to add: <strong>{quickAddExternalId.trim()}</strong> from{' '}
                  <strong>{quickAddProvider.trim().toLowerCase()}</strong>
                </>
              ) : (
                'Pick a source station/site or enter a station ID/call sign to preview what will be added.'
              )}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: quickAddCanSubmit ? '#065f46' : '#92400e' }}>
              {quickAddGuidance}
            </p>
            {quickAddAdvanced ? (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  Name (optional)
                  <input value={quickAddName} onChange={(event) => setQuickAddName(event.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  Latitude
                  <input
                    value={quickAddLat}
                    onChange={(event) => setQuickAddLat(event.target.value)}
                    placeholder="47.449"
                  />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  Longitude
                  <input
                    value={quickAddLng}
                    onChange={(event) => setQuickAddLng(event.target.value)}
                    placeholder="-122.309"
                  />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  Elevation m (optional)
                  <input
                    value={quickAddElevationM}
                    onChange={(event) => setQuickAddElevationM(event.target.value)}
                    placeholder="132"
                  />
                </label>
              </div>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--wx-muted, #475569)' }}>
              Status: <strong>{quickAddStatus}</strong>
            </p>
          </details>
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
        ) : (
          <div>
            <h2 style={{ marginBottom: 6 }}>Admin workspace</h2>
            <p style={{ marginTop: 0, color: 'var(--wx-muted, #475569)' }}>
              Manage provider operations, settings, and live sync health in a focused view.
            </p>
          </div>
        )}
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
        ) : null}
        {toast ? (
          <ToastBanner
            toast={toast}
            onAction={toastAction ? handleToastAction : undefined}
            onClose={() => {
              setToast(null);
              setToastAction(null);
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
