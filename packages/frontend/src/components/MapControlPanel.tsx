import type { MetricKey } from './StationMap';
import type { RadarFrameDensity } from '../services/api';
import { controlGridStyle } from '../styles/ui';

type MapControlPanelProps = {
  selectedMetric: MetricKey;
  selectedProvider: string;
  mapViewMode: '2d' | '3d';
  providerOptions: string[];
  radarHours: 1 | 3 | 6 | 12;
  radarFrameDensity: RadarFrameDensity;
  radarSpeedMs: number;
  radarOpacity: number;
  radarPlaying: boolean;
  darkMode: boolean;
  radarStatus: string;
  isDataRefreshing: boolean;
  lastDataRefreshLabel: string;
  autoRefreshSeconds: 0 | 30 | 60 | 120 | 300;
  filteredCount: number;
  totalCount: number;
  onMetricChange: (metric: MetricKey) => void;
  onProviderChange: (provider: string) => void;
  onMapViewModeChange: (mode: '2d' | '3d') => void;
  onRadarHoursChange: (hours: 1 | 3 | 6 | 12) => void;
  onRadarFrameDensityChange: (density: RadarFrameDensity) => void;
  onRadarSpeedChange: (speedMs: number) => void;
  onRadarOpacityChange: (opacity: number) => void;
  onToggleRadarPlaying: () => void;
  onToggleDarkMode: () => void;
  onRefreshData: () => void;
  onAutoRefreshSecondsChange: (seconds: 0 | 30 | 60 | 120 | 300) => void;
};

export function MapControlPanel({
  selectedMetric,
  selectedProvider,
  mapViewMode,
  providerOptions,
  radarHours,
  radarFrameDensity,
  radarSpeedMs,
  radarOpacity,
  radarPlaying,
  darkMode,
  radarStatus,
  isDataRefreshing,
  lastDataRefreshLabel,
  autoRefreshSeconds,
  filteredCount,
  totalCount,
  onMetricChange,
  onProviderChange,
  onMapViewModeChange,
  onRadarHoursChange,
  onRadarFrameDensityChange,
  onRadarSpeedChange,
  onRadarOpacityChange,
  onToggleRadarPlaying,
  onToggleDarkMode,
  onRefreshData,
  onAutoRefreshSecondsChange
}: MapControlPanelProps): JSX.Element {
  return (
    <div style={controlGridStyle}>
      <label style={{ display: 'grid', gap: 4 }}>
        Metric
        <select
          aria-label="Select weather metric"
          value={selectedMetric}
          onChange={(event) => onMetricChange(event.target.value as MetricKey)}
        >
          <option value="tempC">Temperature</option>
          <option value="humidityPct">Humidity</option>
          <option value="windSpeedMs">Wind speed</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        Provider
        <select
          aria-label="Filter by provider"
          value={selectedProvider}
          onChange={(event) => onProviderChange(event.target.value)}
        >
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>
              {provider === 'all' ? 'All providers' : provider}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        Map view
        <select
          aria-label="Select map view mode"
          value={mapViewMode}
          onChange={(event) => onMapViewModeChange(event.target.value as '2d' | '3d')}
        >
          <option value="2d">2D flat</option>
          <option value="3d">3D globe-style</option>
        </select>
      </label>
      <div>
        Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> stations
      </div>
      <label style={{ display: 'grid', gap: 4 }}>
        Radar range
        <select
          aria-label="Select radar time range"
          value={radarHours}
          onChange={(event) => onRadarHoursChange(Number(event.target.value) as 1 | 3 | 6 | 12)}
        >
          <option value={1}>1 hour</option>
          <option value={3}>3 hours</option>
          <option value={6}>6 hours</option>
          <option value={12}>12 hours</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        Radar speed
        <select
          aria-label="Select radar playback speed"
          value={radarSpeedMs}
          onChange={(event) => onRadarSpeedChange(Number(event.target.value))}
        >
          <option value={1200}>Slow</option>
          <option value={550}>Normal</option>
          <option value={350}>Fast</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        Radar frame density
        <select
          aria-label="Select radar frame density"
          value={radarFrameDensity}
          onChange={(event) => onRadarFrameDensityChange(event.target.value as RadarFrameDensity)}
        >
          <option value="normal">Normal</option>
          <option value="dense">Smooth (more frames)</option>
          <option value="ultra">Ultra smooth (interpolated)</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        Radar opacity: {(radarOpacity * 100).toFixed(0)}%
        <input
          aria-label="Adjust radar opacity"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(radarOpacity * 100)}
          onChange={(event) => onRadarOpacityChange(Number(event.target.value) / 100)}
        />
      </label>
      <button type="button" onClick={onToggleRadarPlaying} aria-label="Toggle radar playback">
        {radarPlaying ? 'Pause radar' : 'Play radar'}
      </button>
      <button type="button" onClick={onToggleDarkMode} aria-label="Toggle dark mode">
        {darkMode ? 'Use light mode' : 'Use dark mode'}
      </button>
      <label style={{ display: 'grid', gap: 4 }}>
        Auto refresh
        <select
          aria-label="Select auto refresh interval"
          value={autoRefreshSeconds}
          onChange={(event) => onAutoRefreshSecondsChange(Number(event.target.value) as 0 | 30 | 60 | 120 | 300)}
        >
          <option value={0}>Off</option>
          <option value={30}>Every 30s</option>
          <option value={60}>Every 60s</option>
          <option value={120}>Every 2m</option>
          <option value={300}>Every 5m</option>
        </select>
      </label>
      <button
        type="button"
        onClick={onRefreshData}
        aria-label="Refresh weather data"
        disabled={isDataRefreshing}
      >
        {isDataRefreshing ? 'Refreshing…' : 'Refresh now'}
      </button>
      <div>
        Radar status: <strong>{radarStatus}</strong>
      </div>
      <div>
        Last updated: <strong>{lastDataRefreshLabel}</strong>
      </div>
    </div>
  );
}
