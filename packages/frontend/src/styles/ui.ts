import type { CSSProperties } from 'react';

export const panelStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 12,
  padding: 12
};

export const mapContainerStyle: CSSProperties = {
  height: 420,
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid #d1d5db'
};

export const controlGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  padding: 12,
  border: '1px solid #d1d5db',
  borderRadius: 12
};

export const sectionGridStyle: CSSProperties = {
  display: 'grid',
  gap: 16
};

export const twoColumnGridStyle: CSSProperties = {
  marginTop: 24,
  display: 'grid',
  gap: 16,
  gridTemplateColumns: '1fr 1fr'
};

export const skeletonStyle: CSSProperties = {
  height: 14,
  borderRadius: 8,
  background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%)',
  backgroundSize: '400% 100%',
  animation: 'wxmapPulse 1.4s ease infinite'
};
