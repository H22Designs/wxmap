import { panelStyle } from '../styles/ui';

export type UnitSystem = 'metric' | 'imperial';

type UserExperiencePanelProps = {
  darkMode: boolean;
  mapViewMode: '2d' | '3d';
  unitSystem: UnitSystem;
  showRadarLayer: boolean;
  showStationLayer: boolean;
  providerOptions: string[];
  visibleProviders: string[];
  onToggleDarkMode: () => void;
  onMapViewModeChange: (mode: '2d' | '3d') => void;
  onUnitSystemChange: (unitSystem: UnitSystem) => void;
  onShowRadarLayerChange: (value: boolean) => void;
  onShowStationLayerChange: (value: boolean) => void;
  onVisibleProvidersChange: (providers: string[]) => void;
};

export function UserExperiencePanel({
  darkMode,
  mapViewMode,
  unitSystem,
  showRadarLayer,
  showStationLayer,
  providerOptions,
  visibleProviders,
  onToggleDarkMode,
  onMapViewModeChange,
  onUnitSystemChange,
  onShowRadarLayerChange,
  onShowStationLayerChange,
  onVisibleProvidersChange
}: UserExperiencePanelProps): JSX.Element {
  const providers = providerOptions.filter((provider) => provider !== 'all');

  return (
    <section style={panelStyle} aria-label="User customization panel">
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>Customize your experience</h3>
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
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>Visible station sources</strong>
        {providers.length === 0 ? (
          <p style={{ marginBottom: 0 }}>No station providers available yet.</p>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {providers.map((provider) => {
              const checked = visibleProviders.includes(provider);
              return (
                <label key={provider} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
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
                  {provider}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
