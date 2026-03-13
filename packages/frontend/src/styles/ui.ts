import type { CSSProperties } from 'react';

export const panelStyle: CSSProperties = {
  border: '1px solid var(--wx-border, #d1d5db)',
  borderRadius: 18,
  padding: 18,
  background:
    'linear-gradient(165deg, var(--wx-surface, #ffffff) 0%, var(--wx-surface-strong, #f8fafc) 100%)',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.14)',
  backdropFilter: 'blur(8px)'
};

export const mapContainerStyle: CSSProperties = {
  height: 420,
  borderRadius: 16,
  overflow: 'hidden',
  border: '1px solid var(--wx-border, #d1d5db)',
  boxShadow: '0 16px 36px rgba(15, 23, 42, 0.18)'
};

export const controlGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  padding: 14,
  border: '1px solid var(--wx-border, #d1d5db)',
  borderRadius: 16,
  background:
    'linear-gradient(165deg, var(--wx-surface, #ffffff) 0%, var(--wx-surface-strong, #f8fafc) 100%)',
  boxShadow: '0 10px 26px rgba(15, 23, 42, 0.1)'
};

export const sectionGridStyle: CSSProperties = {
  display: 'grid',
  gap: 16
};

export const twoColumnGridStyle: CSSProperties = {
  marginTop: 24,
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
};

export const skeletonStyle: CSSProperties = {
  height: 14,
  borderRadius: 8,
  background:
    'linear-gradient(90deg, var(--wx-skeleton-start, #f3f4f6) 25%, var(--wx-skeleton-mid, #e5e7eb) 37%, var(--wx-skeleton-start, #f3f4f6) 63%)',
  backgroundSize: '400% 100%',
  animation: 'wxmapPulse 1.4s ease infinite'
};
