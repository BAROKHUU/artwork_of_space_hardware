import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { groqPlugin } from './server/groq.ts';
import { moonMailPlugin } from './server/moonMail.ts';
import react from '@vitejs/plugin-react';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { listMediaFiles } from './scripts/media-files.mjs';

/**
 * With Cloudinary on, the browser never asks the host for these files, so leave them out of dist/:
 * the Vercel deployment stays small. Without Cloudinary they are the only copy, so they stay.
 */
function cloudMediaOnly(cloud: string | undefined): Plugin {
  let outDir = 'dist';
  return {
    name: 'echo-cloud-media-only',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      if (!cloud?.trim()) return;
      const files = await listMediaFiles(resolve('public'));
      await Promise.all(files.map((path) => rm(join(outDir, path), { force: true })));
      this.info?.(`left ${files.length} media files out of ${outDir}; they load from Cloudinary`);
    },
  };
}

// `base: './'` lets the static build run from any host or sub-folder (GitHub Pages included).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  base: './',
  plugins: [react(), groqPlugin(env.GROQ_API_KEY, env.COHERE_API_KEY, env.GROQ_API_KEY_2), moonMailPlugin(env), cloudMediaOnly(env.VITE_CLOUDINARY_CLOUD_NAME)],
  server: { allowedHosts: ['identical-rev-reduce-jesus.trycloudflare.com', 'kurt-past-automobiles-jonathan.trycloudflare.com'] },
  // three.js alone is close to 1 MB before gzip; it loads only on 3D screens.
  build: { chunkSizeWarningLimit: 1100 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
