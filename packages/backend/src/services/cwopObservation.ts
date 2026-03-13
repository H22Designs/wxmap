type CwopObservation = {
  observedAt: string;
  tempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  windDirDeg: number | null;
  precipMm: number | null;
  rawJson: string | null;
};

const WIND_MPH_TO_MS = 0.44704;
const HUNDREDTHS_INCH_TO_MM = 0.254;

function parseTokenInt(packet: string, token: string, size: number): number | null {
  const match = packet.match(new RegExp(`${token}(\\d{${size}})`));

  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseObservationFromPacket(packet: string, observedAt?: string): CwopObservation {
  const tempF = parseTokenInt(packet, 't', 3);
  const humidity = parseTokenInt(packet, 'h', 2);
  const pressureTenthHpa = parseTokenInt(packet, 'b', 5);
  const windDir = parseTokenInt(packet, '_', 3);
  const windMph = parseTokenInt(packet, '/(\\d{3})g', 3);
  const precipHundredthsInch = parseTokenInt(packet, 'p', 3);

  const tempC = tempF === null ? null : (tempF - 32) * (5 / 9);
  const pressureHpa = pressureTenthHpa === null ? null : pressureTenthHpa / 10;
  const windSpeedMs = windMph === null ? null : windMph * WIND_MPH_TO_MS;
  const precipMm = precipHundredthsInch === null ? null : precipHundredthsInch * HUNDREDTHS_INCH_TO_MM;

  return {
    observedAt: observedAt ?? new Date().toISOString(),
    tempC,
    humidityPct: humidity,
    pressureHpa,
    windSpeedMs,
    windDirDeg: windDir,
    precipMm,
    rawJson: JSON.stringify({
      source: 'wxqa-cwop',
      packet
    })
  };
}

function parsePacketZuluTimestamp(packet: string): { day: number; hour: number; minute: number } | null {
  const match = packet.match(/@(\d{2})(\d{2})(\d{2})z/i);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);

  if (!Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  if (day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { day, hour, minute };
}

function resolveRecentUtcTimestamp(parts: { day: number; hour: number; minute: number }, now = new Date()): string {
  const nowUtc = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth()
  };

  const candidates = [0, -1, 1].map((offset) => {
    const base = new Date(Date.UTC(nowUtc.year, nowUtc.month + offset, parts.day, parts.hour, parts.minute, 0));
    return base;
  });

  const chosen = candidates
    .sort((left, right) => Math.abs(now.getTime() - left.getTime()) - Math.abs(now.getTime() - right.getTime()))[0];

  return chosen.toISOString();
}

function extractRawwxPackets(html: string, externalId: string): string[] {
  const id = externalId.trim().toUpperCase();

  if (!id) {
    return [];
  }

  const normalized = html.replace(/<br\s*\/?>/gi, '\n');
  const lines = normalized.split(/\r?\n/);

  return lines
    .map((line) => line.replace(/<[^>]+>/g, '').trim())
    .filter((line) => line.includes(`${id}>APRS`));
}

function extractLatestPacket(html: string, externalId: string): string | null {
  const id = externalId.trim().toUpperCase();

  if (!id) {
    return null;
  }

  const start = html.indexOf(`${id}>APRS`);

  if (start < 0) {
    return null;
  }

  const tail = html.slice(start, Math.min(html.length, start + 320));
  const endToken = 'AmbientCWOP.com';
  const end = tail.indexOf(endToken);

  if (end < 0) {
    return tail.replace(/\s+/g, ' ').trim();
  }

  return tail.slice(0, end + endToken.length).replace(/\s+/g, ' ').trim();
}

export async function fetchLatestCwopLikeObservation(input: {
  provider: string;
  externalId: string;
}): Promise<CwopObservation | null> {
  const provider = input.provider.trim().toLowerCase();
  const externalId = input.externalId.trim().toUpperCase();

  if (!externalId) {
    return null;
  }

  if (provider !== 'cwop' && provider !== 'findu') {
    return null;
  }

  const url = `http://www.wxqa.com/sss/search1.cgi?keyword=${encodeURIComponent(externalId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const packet = extractLatestPacket(html, externalId);

  if (!packet) {
    return null;
  }

  return parseObservationFromPacket(packet);
}

export async function fetchBackfillCwopLikeObservations(input: {
  provider: string;
  externalId: string;
  days: number;
}): Promise<CwopObservation[]> {
  const provider = input.provider.trim().toLowerCase();
  const externalId = input.externalId.trim().toUpperCase();
  const days = Math.max(1, Math.min(Math.floor(input.days), 10));

  if (!externalId || (provider !== 'cwop' && provider !== 'findu')) {
    return [];
  }

  const hours = Math.max(24, Math.min(days * 24, 240));
  const url = `http://www.findu.com/cgi-bin/rawwx.cgi?call=${encodeURIComponent(externalId)}&last=${hours}`;
  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const packets = extractRawwxPackets(html, externalId);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const parsed = packets
    .map((packet) => {
      const zulu = parsePacketZuluTimestamp(packet);
      const observedAt = zulu ? resolveRecentUtcTimestamp(zulu) : new Date().toISOString();
      return parseObservationFromPacket(packet, observedAt);
    })
    .filter((sample) => {
      const observedAtMs = new Date(sample.observedAt).getTime();
      return Number.isFinite(observedAtMs) && observedAtMs >= cutoff;
    })
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));

  const dedupedByTimestamp = new Map<string, CwopObservation>();
  for (const sample of parsed) {
    dedupedByTimestamp.set(sample.observedAt, sample);
  }

  return [...dedupedByTimestamp.values()];
}
