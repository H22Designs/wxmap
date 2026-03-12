import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapControlPanel } from './MapControlPanel';

describe('MapControlPanel', () => {
  it('calls handlers when controls are changed', () => {
    const onMetricChange = vi.fn();
    const onProviderChange = vi.fn();
    const onRadarHoursChange = vi.fn();
    const onRadarSpeedChange = vi.fn();
    const onRadarOpacityChange = vi.fn();
    const onToggleRadarPlaying = vi.fn();

    render(
      <MapControlPanel
        selectedMetric="tempC"
        selectedProvider="all"
        providerOptions={['all', 'nws']}
        radarHours={3}
        radarSpeedMs={700}
        radarOpacity={0.45}
        radarPlaying={true}
        radarStatus="loaded"
        filteredCount={3}
        totalCount={4}
        onMetricChange={onMetricChange}
        onProviderChange={onProviderChange}
        onRadarHoursChange={onRadarHoursChange}
        onRadarSpeedChange={onRadarSpeedChange}
        onRadarOpacityChange={onRadarOpacityChange}
        onToggleRadarPlaying={onToggleRadarPlaying}
      />
    );

    fireEvent.change(screen.getByLabelText('Select weather metric'), { target: { value: 'humidityPct' } });
    fireEvent.change(screen.getByLabelText('Filter by provider'), { target: { value: 'nws' } });
    fireEvent.change(screen.getByLabelText('Select radar time range'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Select radar playback speed'), { target: { value: '350' } });
    fireEvent.change(screen.getByLabelText('Adjust radar opacity'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle radar playback' }));

    expect(onMetricChange).toHaveBeenCalledWith('humidityPct');
    expect(onProviderChange).toHaveBeenCalledWith('nws');
    expect(onRadarHoursChange).toHaveBeenCalledWith(6);
    expect(onRadarSpeedChange).toHaveBeenCalledWith(350);
    expect(onRadarOpacityChange).toHaveBeenCalledWith(0.7);
    expect(onToggleRadarPlaying).toHaveBeenCalledTimes(1);
  });
});
