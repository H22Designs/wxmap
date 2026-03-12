import type { CSSProperties } from 'react';
import { skeletonStyle } from '../styles/ui';

type LoadingSkeletonProps = {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  ariaLabel?: string;
};

export function LoadingSkeleton({ width, height, ariaLabel }: LoadingSkeletonProps): JSX.Element {
  return <div aria-label={ariaLabel} style={{ ...skeletonStyle, width, height }} />;
}
