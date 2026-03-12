import { describe, expect, it } from 'vitest';
import { parseProviderSyncMessage } from './realtime';

describe('parseProviderSyncMessage', () => {
  it('returns provider status payload for collector.provider-sync event', () => {
    const result = parseProviderSyncMessage(
      JSON.stringify({
        event: 'collector.provider-sync',
        payload: {
          provider: 'nws',
          enabled: true,
          intervalMinutes: 10,
          state: 'ok',
          lastSyncAt: '2026-03-12T10:00:00.000Z',
          lastError: null,
          nextSyncAt: '2026-03-12T10:10:00.000Z'
        }
      })
    );

    expect(result).not.toBeNull();
    expect(result?.provider).toBe('nws');
    expect(result?.state).toBe('ok');
  });

  it('returns null for unrelated or invalid payloads', () => {
    expect(parseProviderSyncMessage(JSON.stringify({ event: 'system.connected', payload: {} }))).toBeNull();
    expect(parseProviderSyncMessage(JSON.stringify({ event: 'collector.provider-sync', payload: {} }))).toBeNull();
    expect(parseProviderSyncMessage('not-json')).toBeNull();
  });
});
