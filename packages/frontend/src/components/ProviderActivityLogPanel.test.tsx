import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProviderActivityLogPanel } from './ProviderActivityLogPanel';

describe('ProviderActivityLogPanel', () => {
  it('renders empty state when no entries exist', () => {
    render(<ProviderActivityLogPanel entries={[]} onClear={vi.fn()} />);
    expect(screen.getByText('No live sync activity yet.')).toBeInTheDocument();
  });

  it('renders provider activity entries', () => {
    const onClear = vi.fn();

    render(
      <ProviderActivityLogPanel
        onClear={onClear}
        entries={[
          {
            provider: 'nws',
            state: 'ok',
            at: '2026-03-12T10:00:00.000Z',
            error: null
          },
          {
            provider: 'madis',
            state: 'error',
            at: '2026-03-12T10:01:00.000Z',
            error: 'timeout'
          }
        ]}
      />
    );

    expect(screen.getByText(/nws/i)).toBeInTheDocument();
    expect(screen.getByText(/madis/i)).toBeInTheDocument();
    expect(screen.getByText(/error: timeout/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear provider activity log' }));
    expect(onClear).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Show only provider errors'));
    expect(screen.queryByText(/nws/i)).not.toBeInTheDocument();
    expect(screen.getByText(/madis/i)).toBeInTheDocument();
  });
});
