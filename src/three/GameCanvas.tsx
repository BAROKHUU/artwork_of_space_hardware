import { Component, Suspense, type ReactNode } from 'react';
import { Canvas, type CanvasProps } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/store';

let webglOk: boolean | null = null;
export function hasWebGL(): boolean {
  if (webglOk !== null) return webglOk;
  try {
    webglOk = !!document.createElement('canvas').getContext('webgl2');
  } catch {
    webglOk = false;
  }
  return webglOk;
}

export const use3D = () => useGame((s) => s.quality) !== 'off' && hasWebGL();
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props extends Omit<CanvasProps, 'children'> {
  children: ReactNode;
  /** Shown when 3D is off, unsupported, or crashes. */
  fallback?: ReactNode;
}

export function GameCanvas({ children, fallback, ...rest }: Props) {
  const { t } = useTranslation();
  const quality = useGame((s) => s.quality);
  const failure = fallback ?? <div className="no3d">{t('mission.no3d')}</div>;
  if (!use3DStatic(quality)) return <>{failure}</>;
  return (
    <CanvasBoundary fallback={failure}>
      <Canvas shadows={quality === 'high' ? 'percentage' : false} dpr={quality === 'high' ? [1, 1.75] : 1} gl={{ antialias: quality === 'high' }} {...rest}>
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </CanvasBoundary>
  );
}

const use3DStatic = (quality: string) => quality !== 'off' && hasWebGL();
