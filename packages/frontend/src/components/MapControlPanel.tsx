import type { MetricKey } from './StationMap';
import { controlGridStyle } from '../styles/ui';

type MapControlPanelProps = {
  selectedMetric: MetricKey;
  selectedProvider: string;
  providerOptions: string[];
  radarHours: 1 | 3 | 6 | 12;
  radarSpeedMs: number;
  radarOpacity: number;
  radarPlaying: boolean;
  radarStatus: string;
  filteredCount: number;
  totalCount: number;
  onMetricChange: (metric: MetricKey) => void;
  onProviderChange: (provider: string) => void;
  onRadarHoursChange: (hours: 1 | 3 | 6 | 12) => void;
  onRadarSpeedChange: (speedMs: number) => void;
  onRadarOpacityChange: (opacity: number) => void;
  onToggleRadarPlaying: () => void;
};

export function MapControlPanel({
  selectedMetric,
  selectedProvider,
  providerOptions,
  radarHours,
  radarSpeedMs,
  radarOpacity,
  radarPlaying,
  radarStatus,
  filteredCount,
  totalCount,
  onMetricChange,
  onProviderChange,
  onRadarHoursChange,
  onRadarSpeedChange,
  onRadarOpacityChange,
  onToggleRadarPlaying
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
          <option value={700}>Normal</option>
          <option value={350}>Fast</option>
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
      <div>
        Radar status: <strong>{radarStatus}</strong>
      </div>
    </div>
  );
}
