import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapControlPanel } from './MapControlPanel';

describe('MapControlPanel', () => {
  it('calls handlers when controls are changed', () => {
    const onMetricChange = vi.fn();
    const onProviderChange = vi.fn();
    const onMapViewModeChange = vi.fn();
    const onRadarHoursChange = vi.fn();
    const onRadarFrameDensityChange = vi.fn();
    const onRadarSpeedChange = vi.fn();
    const onRadarOpacityChange = vi.fn();
    const onToggleRadarPlaying = vi.fn();
    const onToggleDarkMode = vi.fn();
    const onRefreshData = vi.fn();
    const onAutoRefreshSecondsChange = vi.fn();

    render(
      <MapControlPanel
        selectedMetric="tempC"
        selectedProvider="all"
        mapViewMode="2d"
        providerOptions={['all', 'nws']}
        radarHours={3}
        radarFrameDensity="normal"
        radarSpeedMs={550}
        radarOpacity={0.45}
        radarPlaying={true}
        darkMode={false}
        radarStatus="loaded"
        isDataRefreshing={false}
        lastDataRefreshLabel="10:00:00 AM"
        autoRefreshSeconds={60}
        filteredCount={3}
        totalCount={4}
        onMetricChange={onMetricChange}
        onProviderChange={onProviderChange}
        onMapViewModeChange={onMapViewModeChange}
        onRadarHoursChange={onRadarHoursChange}
        onRadarFrameDensityChange={onRadarFrameDensityChange}
        onRadarSpeedChange={onRadarSpeedChange}
        onRadarOpacityChange={onRadarOpacityChange}
        onToggleRadarPlaying={onToggleRadarPlaying}
        onToggleDarkMode={onToggleDarkMode}
        onRefreshData={onRefreshData}
        onAutoRefreshSecondsChange={onAutoRefreshSecondsChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Select weather metric'), { target: { value: 'humidityPct' } });
    fireEvent.change(screen.getByLabelText('Filter by provider'), { target: { value: 'nws' } });
    fireEvent.change(screen.getByLabelText('Select map view mode'), { target: { value: '3d' } });
    fireEvent.change(screen.getByLabelText('Select radar time range'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Select radar frame density'), { target: { value: 'ultra' } });
    fireEvent.change(screen.getByLabelText('Select radar playback speed'), { target: { value: '350' } });
    fireEvent.change(screen.getByLabelText('Adjust radar opacity'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Select auto refresh interval'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle radar playback' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh weather data' }));

    expect(onMetricChange).toHaveBeenCalledWith('humidityPct');
    expect(onProviderChange).toHaveBeenCalledWith('nws');
    expect(onMapViewModeChange).toHaveBeenCalledWith('3d');
    expect(onRadarHoursChange).toHaveBeenCalledWith(6);
    expect(onRadarFrameDensityChange).toHaveBeenCalledWith('ultra');
    expect(onRadarSpeedChange).toHaveBeenCalledWith(350);
    expect(onRadarOpacityChange).toHaveBeenCalledWith(0.7);
    expect(onAutoRefreshSecondsChange).toHaveBeenCalledWith(120);
    expect(onToggleRadarPlaying).toHaveBeenCalledTimes(1);
    expect(onToggleDarkMode).toHaveBeenCalledTimes(1);
    expect(onRefreshData).toHaveBeenCalledTimes(1);
  });
});
