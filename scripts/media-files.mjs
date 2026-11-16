// The heavy files that live on Cloudinary. Shared by the upload script (what to send) and the
// Vite build (what to leave out of dist/ when the site loads media from Cloudinary), so the two
// lists cannot drift apart.
import { readdir } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';

/** Folders inside /public that src/media.ts serves from Cloudinary. Fonts and page code stay on the site. */
export const MEDIA_ROOTS = ['intro', 'assets', 'moon-stories-watercolor/assets'];
const SKIP = new Set(['.ttf', '.otf', '.woff', '.woff2', '.txt', '.md', '.zip', '.blend', '.blend1']);

/** Media files under `publicDir/<root>`, as paths relative to `publicDir` with `/` separators. */
export async function listMediaFiles(publicDir, roots = MEDIA_ROOTS, onMissing = () => {}) {
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      onMissing(relative(publicDir, dir));
      return [];
    });
    const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])));
    return files.flat().filter((f) => !basename(f).startsWith('.') && !SKIP.has(extname(f).toLowerCase()));
  }
  const files = (await Promise.all(roots.map((root) => walk(join(publicDir, root))))).flat();
  return files.map((f) => relative(publicDir, f).split(sep).join('/'));
}
