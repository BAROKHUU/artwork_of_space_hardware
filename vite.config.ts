import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` lets the static build run from any host or sub-folder (GitHub Pages included).
export default defineConfig({
  base: './',
  plugins: [react()],
  // three.js alone is close to 1 MB before gzip; it loads only on 3D screens.
  build: { chunkSizeWarningLimit: 1100 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
