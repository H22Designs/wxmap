import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { UnitSystem } from './UserExperiencePanel';
import type { Observation } from '../services/api';
import { panelStyle } from '../styles/ui';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type HistoryMetricKey = 'tempC' | 'humidityPct' | 'windSpeedMs' | 'pressureHpa' | 'precipMm';

type StationHistoryChartProps = {
  stationName: string;
  observations: Observation[];
  metric: HistoryMetricKey;
  unitSystem: UnitSystem;
  chartMode?: 'line' | 'area';
  weatherVisualTone?: 'balanced' | 'vivid' | 'minimal';
  animated?: boolean;
  maxPoints?: number;
  showPoints?: boolean;
  smoothing?: 'raw' | 'smooth';
  height?: number;
};

function getMetricValue(metric: HistoryMetricKey, observation: Observation, unitSystem: UnitSystem): number | null {
  if (metric === 'tempC') {
    if (observation.tempC === null) {
      return null;
    }

    return unitSystem === 'imperial'
      ? observation.tempC * 9 / 5 + 32
      : observation.tempC;
  }

  if (metric === 'humidityPct') {
    return observation.humidityPct;
  }

  if (metric === 'pressureHpa') {
    return observation.pressureHpa;
  }

  if (metric === 'precipMm') {
    if (observation.precipMm === null) {
      return null;
    }

    return unitSystem === 'imperial'
      ? observation.precipMm / 25.4
      : observation.precipMm;
  }

  if (observation.windSpeedMs === null) {
    return null;
  }

  return unitSystem === 'imperial'
    ? observation.windSpeedMs * 2.23693629
    : observation.windSpeedMs;
}

function getMetricLabel(metric: HistoryMetricKey, unitSystem: UnitSystem): string {
  if (metric === 'tempC') {
    return unitSystem === 'imperial' ? 'Temperature (°F)' : 'Temperature (°C)';
  }

  if (metric === 'humidityPct') {
    return 'Humidity (%)';
  }

  if (metric === 'pressureHpa') {
    return 'Pressure (hPa)';
  }

  if (metric === 'precipMm') {
    return unitSystem === 'imperial' ? 'Precipitation (in)' : 'Precipitation (mm)';
  }

  return unitSystem === 'imperial' ? 'Wind speed (mph)' : 'Wind speed (m/s)';
}

function getMetricColor(metric: HistoryMetricKey): string {
  if (metric === 'tempC') {
    return '#ef4444';
  }

  if (metric === 'humidityPct') {
    return '#0ea5e9';
  }

  if (metric === 'windSpeedMs') {
    return '#14b8a6';
  }

  if (metric === 'pressureHpa') {
    return '#7c3aed';
  }

  return '#2563eb';
}

function getToneAlpha(tone: 'balanced' | 'vivid' | 'minimal'): number {
  if (tone === 'vivid') {
    return 0.34;
  }

  if (tone === 'minimal') {
    return 0.12;
  }

  return 0.22;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '');
  const parsed = Number.parseInt(raw, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255
  };
}

export function StationHistoryChart({
  stationName,
  observations,
  metric,
  unitSystem,
  chartMode = 'line',
  weatherVisualTone = 'balanced',
  animated = false,
  maxPoints = 240,
  showPoints = true,
  smoothing = 'smooth',
  height = 280
}: StationHistoryChartProps): JSX.Element {
  const safeMaxPoints = Math.max(24, Math.min(maxPoints, 720));
  const points = [...observations].slice(0, safeMaxPoints).reverse();
  const color = getMetricColor(metric);
  const rgb = hexToRgb(color);
  const alpha = getToneAlpha(weatherVisualTone);
  const backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  const isArea = chartMode === 'area';

  const chartData = {
    labels: points.map((observation) => new Date(observation.observedAt).toLocaleTimeString()),
    datasets: [
      {
        label: getMetricLabel(metric, unitSystem),
        data: points.map((observation) => getMetricValue(metric, observation, unitSystem)),
        borderColor: color,
        backgroundColor,
        fill: isArea,
        pointRadius: showPoints ? 2 : 0,
        pointHoverRadius: showPoints ? 4 : 0,
        tension: smoothing === 'smooth' ? 0.3 : 0,
        borderWidth: weatherVisualTone === 'minimal' ? 1.8 : 2.4,
        spanGaps: true
      }
    ]
  };

  return (
    <section aria-label="Station history chart" style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>History · {stationName}</h3>
      {points.length === 0 ? (
        <p>No observations available yet.</p>
      ) : (
        <div style={{ height }}>
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: animated
                ? {
                    duration: 360,
                    easing: 'easeOutQuart'
                  }
                : false,
              plugins: {
                legend: {
                  display: true
                }
              }
            }}
          />
        </div>
      )}
    </section>
  );
}
