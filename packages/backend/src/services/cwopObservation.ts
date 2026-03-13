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

function parseObservationFromPacket(packet: string): CwopObservation {
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
    observedAt: new Date().toISOString(),
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
