import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { modelUrl } from '../data';

const state = vi.hoisted(() => ({ quality: 'high' }));
vi.mock('../state/store', () => ({ useGame: (select: (s: typeof state) => unknown) => select(state) }));
vi.mock('@react-three/drei', async () => {
  const { Group, Mesh, BoxGeometry, MeshStandardMaterial } = await import('three');
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(2, 1, 3), new MeshStandardMaterial()));
  return { useGLTF: vi.fn(() => ({ scene })) };
});
const ctx = Object.fromEntries(['fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill'].map((name) => [name, () => {}]));
vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) });
const { HardwareModel } = await import('./models');
const { useGLTF } = await import('@react-three/drei');
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });
afterAll(() => vi.unstubAllGlobals());

it('loads the bundled LRV on high graphics, skips the GLB on low graphics', () => {
  // React DOM does not recognize Three scene tags; only loader selection is exercised here.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.quality = 'high';
  renderToStaticMarkup(createElement(HardwareModel, { id: 'lrv' }));
  expect(useGLTF).toHaveBeenCalledWith(modelUrl('lrv'), false, true);
  expect(modelUrl('lrv')).not.toContain('cloudinary.com');
  vi.mocked(useGLTF).mockClear();
  renderToStaticMarkup(createElement(HardwareModel, { id: 'lrv', variant: 'home' }));
  expect(useGLTF).toHaveBeenCalledWith(modelUrl('lrv-home'), false, true);
  expect(modelUrl('lrv-home')).not.toBe(modelUrl('lrv'));
  expect(modelUrl('lrv-home')).not.toContain('cloudinary.com');
  vi.mocked(useGLTF).mockClear();
  state.quality = 'low';
  renderToStaticMarkup(createElement(HardwareModel, { id: 'lrv' }));
  renderToStaticMarkup(createElement(HardwareModel, { id: 'lrv', variant: 'home' }));
  expect(useGLTF).not.toHaveBeenCalled();
});
