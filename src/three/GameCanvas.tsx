import { Component, Suspense, useState, type ReactNode } from 'react';
import { PerformanceMonitor } from '@react-three/drei';
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
  // Lowers render resolution when the measured frame rate drops, and restores it when there is headroom.
  const [scale, setScale] = useState(1);
  const baseDpr = quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : 1;
  const failure = fallback ?? <div className="no3d">{t('mission.no3d')}</div>;
  if (!use3DStatic(quality)) return <>{failure}</>;
  return (
    <CanvasBoundary fallback={failure}>
      <Canvas shadows={quality === 'high' ? 'percentage' : false} dpr={Math.max(0.6, baseDpr * scale)} gl={{ antialias: quality === 'high' }} {...rest}>
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setScale((s) => Math.max(0.6, s - 0.15))}
          onIncline={() => setScale((s) => Math.min(1, s + 0.1))}
          onFallback={() => setScale(0.7)}
        />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </CanvasBoundary>
  );
}

const use3DStatic = (quality: string) => quality !== 'off' && hasWebGL();
