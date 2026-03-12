import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearProviderActivity,
  loadProviderActivity,
  saveProviderActivity
} from './providerActivityStorage';

const userId = 'user-1';
const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string): string | null => (storage.has(key) ? storage.get(key) ?? null : null),
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
  clear: (): void => {
    storage.clear();
  }
};

describe('providerActivityStorage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true
    });

    window.localStorage.clear();
  });

  it('saves and loads provider activity entries', () => {
    const entries = [
      {
        provider: 'nws',
        state: 'ok' as const,
        at: '2026-03-12T10:00:00.000Z',
        error: null
      }
    ];

    saveProviderActivity(userId, entries);
    const loaded = loadProviderActivity(userId);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.provider).toBe('nws');
  });

  it('returns empty array for invalid stored payloads', () => {
    window.localStorage.setItem('wxmap.providerActivity.user-1', '{invalid json}');
    expect(loadProviderActivity(userId)).toEqual([]);

    window.localStorage.setItem('wxmap.providerActivity.user-1', JSON.stringify({ foo: 'bar' }));
    expect(loadProviderActivity(userId)).toEqual([]);
  });

  it('clears stored activity entries', () => {
    saveProviderActivity(userId, [
      {
        provider: 'madis',
        state: 'error',
        at: '2026-03-12T10:01:00.000Z',
        error: 'timeout'
      }
    ]);

    clearProviderActivity(userId);
    expect(loadProviderActivity(userId)).toEqual([]);
  });
});
