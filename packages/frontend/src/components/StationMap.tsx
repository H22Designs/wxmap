import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { CurrentObservation, RadarFrame, Station } from '../services/api';
import { mapContainerStyle } from '../styles/ui';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

type StationMapProps = {
  stations: Station[];
  currentByStationId: Record<string, CurrentObservation | undefined>;
  selectedMetric: MetricKey;
  radarFrames: RadarFrame[];
  radarOpacity: number;
  radarSpeedMs: number;
  radarPlaying: boolean;
  selectedStationId: string | null;
  onStationSelect: (stationId: string) => void;
};

export type MetricKey = 'tempC' | 'humidityPct' | 'windSpeedMs';

function getColorForMetric(metric: MetricKey, value: number | null): string {
  if (value === null) {
    return '#6b7280';
  }

  if (metric === 'humidityPct') {
    if (value <= 30) {
      return '#f59e0b';
    }
    if (value <= 60) {
      return '#22c55e';
    }
    return '#0ea5e9';
  }

  if (metric === 'windSpeedMs') {
    if (value <= 2) {
      return '#22c55e';
    }
    if (value <= 8) {
      return '#f59e0b';
    }
    return '#ef4444';
  }

  if (value <= -5) {
    return '#1d4ed8';
  }

  if (value <= 5) {
    return '#0ea5e9';
  }

  if (value <= 15) {
    return '#22c55e';
  }

  if (value <= 25) {
    return '#f59e0b';
  }

  return '#ef4444';
}

function getMetricValue(metric: MetricKey, current: CurrentObservation | undefined): number | null {
  if (!current) {
    return null;
  }

  if (metric === 'tempC') {
    return current.tempC;
  }

  if (metric === 'humidityPct') {
    return current.humidityPct;
  }

  return current.windSpeedMs;
}

function getMetricLabel(metric: MetricKey, value: number | null): string {
  if (value === null) {
    return 'N/A';
  }

  if (metric === 'tempC') {
    return `${value.toFixed(1)} °C`;
  }

  if (metric === 'humidityPct') {
    return `${value.toFixed(0)} %`;
  }

  return `${value.toFixed(1)} m/s`;
}

function getCenter(stations: Station[]): [number, number] {
  if (stations.length === 0) {
    return [39.8283, -98.5795];
  }

  const totals = stations.reduce(
    (accumulator, station) => {
      return {
        lat: accumulator.lat + station.lat,
        lng: accumulator.lng + station.lng
      };
    },
    { lat: 0, lng: 0 }
  );

  return [totals.lat / stations.length, totals.lng / stations.length];
}

export function StationMap({
  stations,
  currentByStationId,
  selectedMetric,
  radarFrames,
  radarOpacity,
  radarSpeedMs,
  radarPlaying,
  selectedStationId,
  onStationSelect
}: StationMapProps): JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);
  const center = getCenter(stations);
  const activeFrame = radarFrames.length > 0 ? radarFrames[frameIndex % radarFrames.length] : null;

  useEffect(() => {
    if (!radarPlaying || radarFrames.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((previous) => (previous + 1) % radarFrames.length);
    }, radarSpeedMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [radarFrames.length, radarPlaying, radarSpeedMs]);

  useEffect(() => {
    setFrameIndex(0);
  }, [radarFrames]);

  return (
    <div aria-label="Station map" style={mapContainerStyle}>
      <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {radarFrames.map((frame) => {
          const isActive = activeFrame?.id === frame.id;

          return (
            <TileLayer
              key={frame.id}
              attribution="Radar © RainViewer"
              url={frame.tileUrl}
              opacity={isActive ? radarOpacity : 0}
            />
          );
        })}
        {stations.map((station) => {
          const current = currentByStationId[station.id];
          const metricValue = getMetricValue(selectedMetric, current);
          const isSelected = station.id === selectedStationId;

          return (
            <CircleMarker
              key={station.id}
              center={[station.lat, station.lng]}
              pathOptions={{
                color: isSelected ? '#7c3aed' : '#111827',
                weight: isSelected ? 3 : 1,
                fillColor: getColorForMetric(selectedMetric, metricValue),
                fillOpacity: 0.9
              }}
              radius={isSelected ? 10 : 8}
              eventHandlers={{
                click: () => onStationSelect(station.id)
              }}
            >
              <Popup>
                <strong>{station.name}</strong>
                <br />
                Provider: {station.provider}
                <br />
                Metric ({selectedMetric}): {getMetricLabel(selectedMetric, metricValue)}
                <br />
                Wind: {current?.windSpeedMs === null || current?.windSpeedMs === undefined
                  ? 'N/A'
                  : `${current.windSpeedMs.toFixed(1)} m/s`}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
