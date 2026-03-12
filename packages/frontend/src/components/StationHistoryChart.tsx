import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { MetricKey } from './StationMap';
import type { Observation } from '../services/api';
import { panelStyle } from '../styles/ui';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type StationHistoryChartProps = {
  stationName: string;
  observations: Observation[];
  metric: MetricKey;
};

function getMetricValue(metric: MetricKey, observation: Observation): number | null {
  if (metric === 'tempC') {
    return observation.tempC;
  }

  if (metric === 'humidityPct') {
    return observation.humidityPct;
  }

  return observation.windSpeedMs;
}

function getMetricLabel(metric: MetricKey): string {
  if (metric === 'tempC') {
    return 'Temperature (°C)';
  }

  if (metric === 'humidityPct') {
    return 'Humidity (%)';
  }

  return 'Wind speed (m/s)';
}

export function StationHistoryChart({ stationName, observations, metric }: StationHistoryChartProps): JSX.Element {
  const points = [...observations].reverse();

  const chartData = {
    labels: points.map((observation) => new Date(observation.observedAt).toLocaleTimeString()),
    datasets: [
      {
        label: getMetricLabel(metric),
        data: points.map((observation) => getMetricValue(metric, observation)),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.18)',
        pointRadius: 2,
        tension: 0.3,
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
        <div style={{ height: 280 }}>
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
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
