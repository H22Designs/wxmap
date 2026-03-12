import { Router } from 'express';

export const radarRouter = Router();

type RainViewerFrame = {
  time: number;
  path: string;
};

type RainViewerMapsResponse = {
  host?: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
};

const DEFAULT_RAINVIEWER_HOST = 'https://tilecache.rainviewer.com';

function parseNumber(input: unknown): number | null {
  if (typeof input !== 'string' || !input.trim()) {
    return null;
  }

  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function parseHours(input: unknown): number {
  const parsed = parseNumber(input);
  if (parsed === null) {
    return 3;
  }

  const rounded = Math.floor(parsed);
  if (rounded <= 1) {
    return 1;
  }
  if (rounded <= 3) {
    return 3;
  }
  if (rounded <= 6) {
    return 6;
  }
  return 12;
}

function parseFrameDensity(input: unknown): 'normal' | 'dense' {
  if (typeof input !== 'string') {
    return 'normal';
  }

  return input.trim().toLowerCase() === 'dense' ? 'dense' : 'normal';
}

function buildTileUrl(host: string, path: string): string {
  const normalizedHost = host.endsWith('/') ? host.slice(0, -1) : host;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedHost}${normalizedPath}/256/{z}/{x}/{y}/2/1_1.png`;
}

radarRouter.get('/frames', async (req, res) => {
  const { lat, lng, hours, frameDensity } = req.query;
  const parsedLat = parseNumber(lat);
  const parsedLng = parseNumber(lng);
  const selectedHours = parseHours(hours);
  const selectedFrameDensity = parseFrameDensity(frameDensity);
  const windowStartUnixSeconds = Math.floor(Date.now() / 1000) - selectedHours * 3600;
  const targetFrameCount =
    selectedFrameDensity === 'dense'
      ? Math.min(48, Math.max(12, selectedHours * 12))
      : Math.min(20, Math.max(6, selectedHours * 4));

  let frames: Array<{ id: string; observedAt: string; tileUrl: string }> = [];

  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
      signal: AbortSignal.timeout(7_000)
    });

    if (!response.ok) {
      throw new Error(`RainViewer metadata request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as RainViewerMapsResponse;
    const host = payload.host && payload.host.trim() ? payload.host : DEFAULT_RAINVIEWER_HOST;
    const allFrames =
      selectedFrameDensity === 'dense'
        ? [...(payload.radar?.past ?? []), ...(payload.radar?.nowcast ?? [])]
        : payload.radar?.past ?? [];

    frames = allFrames
      .filter((frame) => Number.isFinite(frame.time) && frame.time >= windowStartUnixSeconds && !!frame.path)
      .sort((a, b) => a.time - b.time)
      .slice(-targetFrameCount)
      .map((frame) => ({
        id: `rv-${frame.time}`,
        observedAt: new Date(frame.time * 1000).toISOString(),
        tileUrl: buildTileUrl(host, frame.path)
      }));
  } catch {
    frames = [];
  }

  res.status(200).json({
    location: {
      lat: parsedLat,
      lng: parsedLng
    },
    frameIntervalMinutes: 5,
    selectedHours,
    frameDensity: selectedFrameDensity,
    frames
  });
});
