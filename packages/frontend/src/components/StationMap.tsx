import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { CurrentObservation, RadarFrame, RadarFrameDensity, Station } from '../services/api';
import { mapContainerStyle } from '../styles/ui';
import type { UnitSystem } from './UserExperiencePanel';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

type StationMapProps = {
  stations: Station[];
  currentByStationId: Record<string, CurrentObservation | undefined>;
  selectedMetric: MetricKey;
  mapViewMode: '2d' | '3d';
  unitSystem: UnitSystem;
  showRadarLayer: boolean;
  showStationLayer: boolean;
  radarFrames: RadarFrame[];
  radarFrameDensity: RadarFrameDensity;
  radarOpacity: number;
  radarSpeedMs: number;
  radarPlaying: boolean;
  darkMode: boolean;
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

function getMetricLabel(metric: MetricKey, value: number | null, unitSystem: UnitSystem): string {
  if (value === null) {
    return 'N/A';
  }

  if (metric === 'tempC') {
    return unitSystem === 'imperial'
      ? `${(value * 9 / 5 + 32).toFixed(1)} °F`
      : `${value.toFixed(1)} °C`;
  }

  if (metric === 'humidityPct') {
    return `${value.toFixed(0)} %`;
  }

  return unitSystem === 'imperial'
    ? `${(value * 2.23693629).toFixed(1)} mph`
    : `${value.toFixed(1)} m/s`;
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
  mapViewMode,
  unitSystem,
  showRadarLayer,
  showStationLayer,
  radarFrames,
  radarFrameDensity,
  radarOpacity,
  radarSpeedMs,
  radarPlaying,
  darkMode,
  selectedStationId,
  onStationSelect
}: StationMapProps): JSX.Element {
  const [frameCursor, setFrameCursor] = useState(0);
  const center = getCenter(stations);
  const hasFrames = radarFrames.length > 0;
  const frameCount = radarFrames.length;
  const safeCursor = hasFrames ? ((frameCursor % frameCount) + frameCount) % frameCount : 0;
  const baseFrameIndex = hasFrames ? Math.floor(safeCursor) % frameCount : -1;
  const nextFrameIndex = hasFrames ? (baseFrameIndex + 1) % frameCount : -1;
  const blendWeight =
    radarFrameDensity === 'ultra' && radarPlaying && frameCount > 1 ? safeCursor - Math.floor(safeCursor) : 0;

  useEffect(() => {
    if (!radarPlaying || radarFrames.length <= 1) {
      return;
    }

    if (radarFrameDensity === 'ultra') {
      let rafId = 0;
      let previousTime = performance.now();

      const animate = (time: number): void => {
        const deltaMs = time - previousTime;
        previousTime = time;

        setFrameCursor((previous) => (previous + deltaMs / radarSpeedMs) % radarFrames.length);
        rafId = window.requestAnimationFrame(animate);
      };

      rafId = window.requestAnimationFrame(animate);

      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    const timer = window.setInterval(() => {
      setFrameCursor((previous) => (Math.floor(previous) + 1) % radarFrames.length);
    }, radarSpeedMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [radarFrames.length, radarFrameDensity, radarPlaying, radarSpeedMs]);

  useEffect(() => {
    setFrameCursor(0);
  }, [radarFrames, radarFrameDensity]);

  const isGlobeMode = mapViewMode === '3d';
  const containerStyle: CSSProperties = {
    ...mapContainerStyle,
    position: 'relative',
    width: isGlobeMode ? 'min(100%, 560px)' : undefined,
    height: isGlobeMode ? 560 : mapContainerStyle.height,
    margin: isGlobeMode ? '8px auto 0' : undefined,
    borderRadius: isGlobeMode ? '50%' : mapContainerStyle.borderRadius,
    boxShadow: isGlobeMode
      ? '0 24px 46px rgba(15, 23, 42, 0.42), inset 0 0 0 1px rgba(148, 163, 184, 0.45)'
      : undefined,
    transform: isGlobeMode ? 'perspective(1200px) rotateX(18deg) scale(1.02)' : undefined,
    WebkitTransform: isGlobeMode ? 'perspective(1200px) rotateX(18deg) scale(1.02)' : undefined,
    transformOrigin: isGlobeMode ? 'center center' : undefined,
    background: isGlobeMode ? (darkMode ? '#020617' : '#dbeafe') : undefined
  };

  return (
    <div aria-label="Station map" style={containerStyle}>
      {isGlobeMode ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.26), rgba(255,255,255,0.05) 34%, rgba(0,0,0,0.2) 72%, rgba(0,0,0,0.38) 100%)',
            zIndex: 500
          }}
        />
      ) : null}
      <MapContainer
        center={center}
        zoom={5}
        style={{
          height: '100%',
          width: '100%',
          transform: isGlobeMode ? 'translateZ(0) scale(1.04)' : undefined,
          WebkitTransform: isGlobeMode ? 'translateZ(0) scale(1.04)' : undefined,
          filter: isGlobeMode ? 'saturate(1.08) contrast(1.03)' : undefined
        }}
      >
        <TileLayer
          attribution={
            darkMode
              ? '&copy; OpenStreetMap contributors &copy; CARTO'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
          url={
            darkMode
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
        />
        {showRadarLayer
          ? radarFrames.map((frame, frameIndex) => {
          const isBase = frameIndex === baseFrameIndex;
          const isNext = frameIndex === nextFrameIndex;
          const opacity =
            radarFrameDensity === 'ultra' && frameCount > 1
              ? isBase
                ? radarOpacity * (1 - blendWeight)
                : isNext
                  ? radarOpacity * blendWeight
                  : 0
              : isBase
                ? radarOpacity
                : 0;

          return (
            <TileLayer
              key={frame.id}
              attribution="Radar © RainViewer"
              url={frame.tileUrl}
              opacity={opacity}
              className="wx-radar-layer"
            />
          );
        })
          : null}
        {showStationLayer ? stations.map((station) => {
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
                Metric ({selectedMetric}): {getMetricLabel(selectedMetric, metricValue, unitSystem)}
                <br />
                Wind: {current?.windSpeedMs === null || current?.windSpeedMs === undefined
                  ? 'N/A'
                  : unitSystem === 'imperial'
                    ? `${(current.windSpeedMs * 2.23693629).toFixed(1)} mph`
                    : `${current.windSpeedMs.toFixed(1)} m/s`}
              </Popup>
            </CircleMarker>
          );
        }) : null}
      </MapContainer>
    </div>
  );
}
