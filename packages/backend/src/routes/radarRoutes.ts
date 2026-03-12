import { Router } from 'express';

export const radarRouter = Router();

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

radarRouter.get('/frames', (req, res) => {
  const { lat, lng, hours } = req.query;
  const parsedLat = parseNumber(lat);
  const parsedLng = parseNumber(lng);
  const selectedHours = parseHours(hours);
  const frameCount = Math.max(4, selectedHours * 2);
  const now = Date.now();
  const frameStepMs = 5 * 60 * 1000;

  const frames = Array.from({ length: frameCount }).map((_, index) => {
    const frameTimeMs = now - (frameCount - 1 - index) * frameStepMs;
    const unixSeconds = Math.floor(frameTimeMs / 1000);

    return {
      id: `rv-${unixSeconds}`,
      observedAt: new Date(frameTimeMs).toISOString(),
      tileUrl: `https://tilecache.rainviewer.com/v2/radar/${unixSeconds}/256/{z}/{x}/{y}/2/1_1.png`
    };
  });

  res.status(200).json({
    location: {
      lat: parsedLat,
      lng: parsedLng
    },
    frameIntervalMinutes: 5,
    selectedHours,
    frames
  });
});
