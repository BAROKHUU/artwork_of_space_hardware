import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { groqPlugin } from './server/groq.ts';
import react from '@vitejs/plugin-react';

// `base: './'` lets the static build run from any host or sub-folder (GitHub Pages included).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  base: './',
  plugins: [react(), groqPlugin(env.GROQ_API_KEY, env.GROQ_CHAT_PASSWORD)],
  server: { allowedHosts: ['identical-rev-reduce-jesus.trycloudflare.com', 'kurt-past-automobiles-jonathan.trycloudflare.com'] },
  // three.js alone is close to 1 MB before gzip; it loads only on 3D screens.
  build: { chunkSizeWarningLimit: 1100 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
