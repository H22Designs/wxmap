import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
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

function MapViewportController(input: {
  selectedStation: Station | null;
  fallbackCenter: [number, number];
  fallbackZoom: number;
  focusZoom: number;
  minZoom: number;
  maxZoom: number;
}): null {
  const map = useMap();

  function clampZoom(value: number): number {
    return Math.max(input.minZoom, Math.min(input.maxZoom, value));
  }

  useEffect(() => {
    if (input.selectedStation) {
      map.flyTo([input.selectedStation.lat, input.selectedStation.lng], clampZoom(input.focusZoom), {
        animate: true,
        duration: 0.65
      });
      return;
    }

    map.setView(input.fallbackCenter, clampZoom(input.fallbackZoom), {
      animate: false
    });
  }, [
    map,
    input.selectedStation?.id,
    input.selectedStation?.lat,
    input.selectedStation?.lng,
    input.fallbackCenter,
    input.fallbackZoom,
    input.focusZoom
    ,input.minZoom,
    input.maxZoom
  ]);

  return null;
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
  const center = useMemo(() => getCenter(stations), [stations]);
  const selectedStation = selectedStationId
    ? stations.find((station) => station.id === selectedStationId) ?? null
    : null;
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
  const minZoom = 3;
  const maxZoom = 10;
  const defaultZoom = isGlobeMode ? 4 : 5;
  const selectedStationZoom = isGlobeMode ? 5 : 7;
  const lightX = 32;
  const lightY = 21;
  const cloudRotationDeg = hasFrames ? (safeCursor * 1.6) % 360 : 0;
  const terminatorAngleDeg = 108;

  const containerStyle: CSSProperties = {
    ...mapContainerStyle,
    position: 'relative',
    width: isGlobeMode ? 'min(100%, 560px)' : undefined,
    height: isGlobeMode ? 560 : mapContainerStyle.height,
    margin: isGlobeMode ? '8px auto 0' : undefined,
    borderRadius: isGlobeMode ? '50%' : mapContainerStyle.borderRadius,
    boxShadow: isGlobeMode
      ? '0 34px 66px rgba(2, 6, 23, 0.58), inset 0 0 0 1px rgba(148, 163, 184, 0.5)'
      : undefined,
    transform: isGlobeMode ? 'perspective(1200px) rotateX(17deg) scale(1.025)' : undefined,
    WebkitTransform: isGlobeMode ? 'perspective(1200px) rotateX(17deg) scale(1.025)' : undefined,
    transformOrigin: isGlobeMode ? 'center center' : undefined,
    background: isGlobeMode ? (darkMode ? '#020617' : '#bfdbfe') : undefined
  };

  return (
    <div aria-label="Station map" style={containerStyle}>
      {isGlobeMode ? (
        <>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -24,
            width: '72%',
            height: 46,
            transform: 'translateX(-50%)',
            borderRadius: '999px',
            background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.42) 0%, rgba(15, 23, 42, 0) 74%)',
            filter: 'blur(2px)',
            pointerEvents: 'none',
            zIndex: 480
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '50%',
            background:
              `radial-gradient(circle at ${lightX}% ${lightY}%, rgba(255,255,255,0.34), rgba(255,255,255,0.09) 30%, rgba(0,0,0,0.22) 72%, rgba(0,0,0,0.48) 100%)`,
            zIndex: 520
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 52% 52%, rgba(6, 182, 212, 0.09) 0%, rgba(37, 99, 235, 0.04) 38%, rgba(0, 0, 0, 0) 72%)',
            zIndex: 525
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '50%',
            background:
              `linear-gradient(${terminatorAngleDeg}deg, rgba(15,23,42,0.06) 0%, rgba(15,23,42,0) 44%, rgba(2,6,23,0.28) 70%, rgba(2,6,23,0.52) 100%)`,
            zIndex: 526
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '50%',
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 26px)',
            mixBlendMode: darkMode ? 'screen' : 'soft-light',
            opacity: darkMode ? 0.26 : 0.2,
            zIndex: 530
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '50%',
            backgroundImage:
              'radial-gradient(circle at 18% 34%, rgba(255,255,255,0.23) 0 8%, rgba(255,255,255,0) 20%), radial-gradient(circle at 65% 26%, rgba(255,255,255,0.17) 0 8%, rgba(255,255,255,0) 22%), radial-gradient(circle at 72% 66%, rgba(255,255,255,0.16) 0 9%, rgba(255,255,255,0) 22%), radial-gradient(circle at 34% 74%, rgba(255,255,255,0.15) 0 10%, rgba(255,255,255,0) 23%)',
            transform: `rotate(${cloudRotationDeg}deg) scale(1.02)`,
            opacity: darkMode ? 0.18 : 0.14,
            mixBlendMode: 'screen',
            zIndex: 535
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -3,
            pointerEvents: 'none',
            borderRadius: '50%',
            border: darkMode ? '1px solid rgba(125, 211, 252, 0.5)' : '1px solid rgba(14, 165, 233, 0.36)',
            boxShadow: darkMode
              ? '0 0 0 2px rgba(8, 145, 178, 0.14), 0 0 18px rgba(56, 189, 248, 0.3)'
              : '0 0 0 2px rgba(59, 130, 246, 0.12), 0 0 14px rgba(56, 189, 248, 0.22)',
            zIndex: 540
          }}
        />
        </>
      ) : null}
      {isGlobeMode ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '10%',
            left: '17%',
            width: '40%',
            height: '26%',
            pointerEvents: 'none',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0.22) 38%, rgba(255,255,255,0) 72%)',
            transform: 'rotate(-16deg)',
            zIndex: 545
          }}
        />
      ) : null}
      <MapContainer
        center={center}
        zoom={defaultZoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        style={{
          height: '100%',
          width: '100%',
          transform: isGlobeMode ? 'translateZ(0) scale(1.04)' : undefined,
          WebkitTransform: isGlobeMode ? 'translateZ(0) scale(1.04)' : undefined,
          filter: isGlobeMode ? 'saturate(1.08) contrast(1.03)' : undefined
        }}
      >
        <MapViewportController
          selectedStation={selectedStation}
          fallbackCenter={center}
          fallbackZoom={defaultZoom}
          focusZoom={selectedStationZoom}
          minZoom={minZoom}
          maxZoom={maxZoom}
        />
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
              maxNativeZoom={10}
              maxZoom={10}
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
