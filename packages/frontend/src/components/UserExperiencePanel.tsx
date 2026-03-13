import { panelStyle } from '../styles/ui';

export type UnitSystem = 'metric' | 'imperial';

type PreferencesPersistenceState = 'guest' | 'loading' | 'saving' | 'saved' | 'error';

type UserExperiencePanelProps = {
  darkMode: boolean;
  mapViewMode: '2d' | '3d';
  unitSystem: UnitSystem;
  showRadarLayer: boolean;
  showStationLayer: boolean;
  weatherVisualTone: 'balanced' | 'vivid' | 'minimal';
  showWeatherAnimations: boolean;
  showMiniCharts: boolean;
  historyChartMode: 'line' | 'area';
  providerOptions: string[];
  visibleProviders: string[];
  onToggleDarkMode: () => void;
  onMapViewModeChange: (mode: '2d' | '3d') => void;
  onUnitSystemChange: (unitSystem: UnitSystem) => void;
  onShowRadarLayerChange: (value: boolean) => void;
  onShowStationLayerChange: (value: boolean) => void;
  onWeatherVisualToneChange: (value: 'balanced' | 'vivid' | 'minimal') => void;
  onShowWeatherAnimationsChange: (value: boolean) => void;
  onShowMiniChartsChange: (value: boolean) => void;
  onHistoryChartModeChange: (value: 'line' | 'area') => void;
  onVisibleProvidersChange: (providers: string[]) => void;
  persistenceState?: PreferencesPersistenceState;
};

export function UserExperiencePanel({
  darkMode,
  mapViewMode,
  unitSystem,
  showRadarLayer,
  showStationLayer,
  weatherVisualTone,
  showWeatherAnimations,
  showMiniCharts,
  historyChartMode,
  providerOptions,
  visibleProviders,
  onToggleDarkMode,
  onMapViewModeChange,
  onUnitSystemChange,
  onShowRadarLayerChange,
  onShowStationLayerChange,
  onWeatherVisualToneChange,
  onShowWeatherAnimationsChange,
  onShowMiniChartsChange,
  onHistoryChartModeChange,
  onVisibleProvidersChange,
  persistenceState = 'guest'
}: UserExperiencePanelProps): JSX.Element {
  const providers = providerOptions.filter((provider) => provider !== 'all');
  const orderedProviders = [
    ...visibleProviders.filter((provider) => providers.includes(provider)),
    ...providers.filter((provider) => !visibleProviders.includes(provider))
  ];

  function moveProviderPriority(provider: string, direction: 'up' | 'down'): void {
    const currentIndex = visibleProviders.indexOf(provider);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= visibleProviders.length) {
      return;
    }

    const next = [...visibleProviders];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);
    onVisibleProvidersChange(next);
  }

  const persistenceLabel =
    persistenceState === 'guest'
      ? 'Preferences are saved locally for guests.'
      : persistenceState === 'loading'
        ? 'Loading your saved preferences...'
        : persistenceState === 'saving'
          ? 'Saving your preferences...'
          : persistenceState === 'saved'
            ? 'Preferences synced to your account.'
            : 'Unable to sync preferences right now.';

  return (
    <section style={panelStyle} aria-label="User customization panel">
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>Customize your experience</h3>
      <p aria-live="polite" style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>
        {persistenceLabel}
      </p>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          Units
          <select
            aria-label="Select units"
            value={unitSystem}
            onChange={(event) => onUnitSystemChange(event.target.value as UnitSystem)}
          >
            <option value="metric">Metric (°C, m/s)</option>
            <option value="imperial">Imperial (°F, mph)</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          Map mode
          <select
            aria-label="Select map mode"
            value={mapViewMode}
            onChange={(event) => onMapViewModeChange(event.target.value as '2d' | '3d')}
          >
            <option value="2d">2D flat</option>
            <option value="3d">3D globe-style</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          Weather visuals
          <select
            aria-label="Select weather visual style"
            value={weatherVisualTone}
            onChange={(event) => onWeatherVisualToneChange(event.target.value as 'balanced' | 'vivid' | 'minimal')}
          >
            <option value="balanced">Balanced</option>
            <option value="vivid">Vivid</option>
            <option value="minimal">Minimal</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          History chart style
          <select
            aria-label="Select history chart style"
            value={historyChartMode}
            onChange={(event) => onHistoryChartModeChange(event.target.value as 'line' | 'area')}
          >
            <option value="line">Line</option>
            <option value="area">Area</option>
          </select>
        </label>

        <div style={{ display: 'grid', gap: 8, alignContent: 'center' }}>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={onToggleDarkMode}
              aria-label="Toggle dark mode"
            />
            Dark mode
          </label>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showRadarLayer}
              onChange={(event) => onShowRadarLayerChange(event.target.checked)}
              aria-label="Toggle radar layer"
            />
            Show radar layer
          </label>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showStationLayer}
              onChange={(event) => onShowStationLayerChange(event.target.checked)}
              aria-label="Toggle station markers"
            />
            Show station markers
          </label>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showMiniCharts}
              onChange={(event) => onShowMiniChartsChange(event.target.checked)}
              aria-label="Toggle mini charts"
            />
            Show mini charts
          </label>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showWeatherAnimations}
              onChange={(event) => onShowWeatherAnimationsChange(event.target.checked)}
              aria-label="Toggle weather animations"
            />
            Animate weather visuals
          </label>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>Visible station sources</strong>
        {providers.length === 0 ? (
          <p style={{ marginBottom: 0 }}>No station providers available yet.</p>
        ) : (
          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            {orderedProviders.map((provider) => {
              const checked = visibleProviders.includes(provider);
              const currentIndex = visibleProviders.indexOf(provider);
              return (
                <div
                  key={provider}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 10,
                    border: '1px solid var(--wx-border, #d1d5db)',
                    background: 'var(--wx-surface-strong, #f8fafc)'
                  }}
                >
                  <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onVisibleProvidersChange([...visibleProviders, provider]);
                          return;
                        }

                        onVisibleProvidersChange(visibleProviders.filter((item) => item !== provider));
                      }}
                      aria-label={`Toggle provider ${provider}`}
                    />
                    <span>{provider}</span>
                  </label>
                  {checked ? (
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => moveProviderPriority(provider, 'up')}
                        disabled={currentIndex <= 0}
                        aria-label={`Move ${provider} up`}
                        title="Increase priority"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProviderPriority(provider, 'down')}
                        disabled={currentIndex === -1 || currentIndex >= visibleProviders.length - 1}
                        aria-label={`Move ${provider} down`}
                        title="Decrease priority"
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, opacity: 0.85 }}>
          Tip: checked providers are shown in priority order from top to bottom. Use arrows to reorder.
        </p>
      </div>
    </section>
  );
}
