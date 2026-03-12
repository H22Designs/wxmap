export type StoredProviderActivityEntry = {
  provider: string;
  state: 'idle' | 'running' | 'ok' | 'error';
  at: string;
  error: string | null;
};

const STORAGE_PREFIX = 'wxmap.providerActivity';
const MAX_STORED_ENTRIES = 100;

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

function isEntry(value: unknown): value is StoredProviderActivityEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;

  const isStateValid =
    entry.state === 'idle' ||
    entry.state === 'running' ||
    entry.state === 'ok' ||
    entry.state === 'error';

  return (
    typeof entry.provider === 'string' &&
    isStateValid &&
    typeof entry.at === 'string' &&
    (typeof entry.error === 'string' || entry.error === null)
  );
}

export function loadProviderActivity(userId: string): StoredProviderActivityEntry[] {
  const raw = window.localStorage.getItem(getStorageKey(userId));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isEntry).slice(0, MAX_STORED_ENTRIES);
  } catch {
    return [];
  }
}

export function saveProviderActivity(userId: string, entries: StoredProviderActivityEntry[]): void {
  const trimmed = entries.slice(0, MAX_STORED_ENTRIES);
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(trimmed));
}

export function clearProviderActivity(userId: string): void {
  window.localStorage.removeItem(getStorageKey(userId));
}
