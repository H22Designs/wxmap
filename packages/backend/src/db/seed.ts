import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

function shouldBootstrapDevAdmin(): boolean {
  return (process.env.DEV_BOOTSTRAP_ADMIN ?? '').trim().toLowerCase() === 'true';
}

function bootstrapDevAdmin(db: Database.Database): void {
  if (!shouldBootstrapDevAdmin()) {
    return;
  }

  const username = (process.env.DEV_ADMIN_USERNAME ?? '').trim();
  const email = (process.env.DEV_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = (process.env.DEV_ADMIN_PASSWORD ?? '').trim();

  if (!username || !email || password.length < 8) {
    console.warn(
      'DEV_BOOTSTRAP_ADMIN=true but DEV_ADMIN_USERNAME/DEV_ADMIN_EMAIL/DEV_ADMIN_PASSWORD are invalid. Skipping dev admin bootstrap.'
    );
    return;
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const insertAdminUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, email, password_hash, role)
    VALUES (?, ?, ?, ?, 'admin')
  `);

  insertAdminUser.run('dev-admin-user', username, email, hashedPassword);
}

export function seedDatabase(db: Database.Database): void {
  const upsertSetting = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `);

  const insertStation = db.prepare(`
    INSERT OR IGNORE INTO stations (
      id, provider, external_id, name, lat, lng, elevation_m, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertObservation = db.prepare(`
    INSERT OR IGNORE INTO observations (
      id, station_id, observed_at, temp_c, humidity_pct, pressure_hpa,
      wind_speed_ms, wind_dir_deg, precip_mm, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialSettings: Array<[string, string]> = [
    ['collector.interval.pws.minutes', '5'],
    ['collector.interval.nws.minutes', '10']
  ];

  for (const [key, value] of initialSettings) {
    upsertSetting.run(key, value);
  }

  insertStation.run(
    'station-nws-sample-1',
    'nws',
    'KSEA',
    'Seattle-Tacoma Intl (Sample)',
    47.4489,
    -122.3094,
    132,
    1
  );

  insertObservation.run(
    'obs-station-nws-sample-1-latest',
    'station-nws-sample-1',
    new Date().toISOString(),
    10.3,
    78,
    1012.5,
    4.3,
    210,
    0,
    JSON.stringify({ source: 'seed' })
  );

  bootstrapDevAdmin(db);
}
