import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProviderStatusPanel } from './ProviderStatusPanel';

describe('ProviderStatusPanel', () => {
  it('renders provider rows and triggers reload', () => {
    const onReload = vi.fn();
    const onTriggerSync = vi.fn();
    const onSaveProviderConfig = vi.fn();

    render(
      <ProviderStatusPanel
        status="loaded (2)"
        isLoading={false}
        realtimeState="connected"
        syncingProvider={null}
        savingProviderConfig={null}
        onTriggerSync={onTriggerSync}
        onSaveProviderConfig={onSaveProviderConfig}
        onReload={onReload}
        providers={[
          {
            provider: 'nws',
            enabled: true,
            intervalMinutes: 10,
            state: 'ok',
            lastSyncAt: '2026-03-12T10:00:00.000Z',
            lastError: null,
            nextSyncAt: '2026-03-12T10:10:00.000Z'
          },
          {
            provider: 'madis',
            enabled: false,
            intervalMinutes: 10,
            state: 'idle',
            lastSyncAt: null,
            lastError: null,
            nextSyncAt: null
          }
        ]}
      />
    );

    expect(screen.getByText('loaded (2)')).toBeInTheDocument();
  expect(screen.getByText('Live connected')).toBeInTheDocument();
    expect(screen.getByText('nws')).toBeInTheDocument();
    expect(screen.getByText('madis')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reload provider statuses' }));
    expect(onReload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save config for nws' }));
    expect(onSaveProviderConfig).toHaveBeenCalledWith({
      provider: 'nws',
      enabled: true,
      intervalMinutes: 10
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger sync for nws' }));
    expect(onTriggerSync).toHaveBeenCalledWith('nws');
  });
});
