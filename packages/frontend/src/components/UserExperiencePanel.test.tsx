import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UserExperiencePanel } from './UserExperiencePanel';

function renderPanel(overrides: Partial<ComponentProps<typeof UserExperiencePanel>> = {}) {
  const onToggleDarkMode = vi.fn();
  const onMapViewModeChange = vi.fn();
  const onUnitSystemChange = vi.fn();
  const onShowRadarLayerChange = vi.fn();
  const onShowStationLayerChange = vi.fn();
  const onWeatherVisualToneChange = vi.fn();
  const onShowWeatherAnimationsChange = vi.fn();
  const onShowMiniChartsChange = vi.fn();
  const onEssentialModeChange = vi.fn();
  const onHistoryChartModeChange = vi.fn();
  const onVisibleProvidersChange = vi.fn();

  render(
    <UserExperiencePanel
      darkMode={false}
      mapViewMode="2d"
      unitSystem="metric"
      showRadarLayer={true}
      showStationLayer={true}
      weatherVisualTone="balanced"
      showWeatherAnimations={true}
      showMiniCharts={true}
      essentialMode={false}
      historyChartMode="line"
      providerOptions={['all', 'nws', 'noaa', 'metar']}
      visibleProviders={['noaa', 'nws']}
      onToggleDarkMode={onToggleDarkMode}
      onMapViewModeChange={onMapViewModeChange}
      onUnitSystemChange={onUnitSystemChange}
      onShowRadarLayerChange={onShowRadarLayerChange}
      onShowStationLayerChange={onShowStationLayerChange}
      onWeatherVisualToneChange={onWeatherVisualToneChange}
      onShowWeatherAnimationsChange={onShowWeatherAnimationsChange}
      onShowMiniChartsChange={onShowMiniChartsChange}
      onEssentialModeChange={onEssentialModeChange}
      onHistoryChartModeChange={onHistoryChartModeChange}
      onVisibleProvidersChange={onVisibleProvidersChange}
      persistenceState="saved"
      {...overrides}
    />
  );

  return {
    onToggleDarkMode,
    onMapViewModeChange,
    onUnitSystemChange,
    onShowRadarLayerChange,
    onShowStationLayerChange,
    onVisibleProvidersChange
  };
}

describe('UserExperiencePanel', () => {
  it('adds and removes visible providers', () => {
    const { onVisibleProvidersChange } = renderPanel();

    fireEvent.click(screen.getByLabelText('Toggle provider metar'));
    fireEvent.click(screen.getByLabelText('Toggle provider nws'));

    expect(onVisibleProvidersChange).toHaveBeenNthCalledWith(1, ['noaa', 'nws', 'metar']);
    expect(onVisibleProvidersChange).toHaveBeenNthCalledWith(2, ['noaa']);
  });

  it('reorders visible providers with priority arrows', () => {
    const { onVisibleProvidersChange } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Move noaa down' }));

    expect(onVisibleProvidersChange).toHaveBeenCalledWith(['nws', 'noaa']);
  });

  it('disables up/down controls at list boundaries', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Move noaa up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move nws down' })).toBeDisabled();
  });
});
