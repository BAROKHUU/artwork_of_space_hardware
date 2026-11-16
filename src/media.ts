/**
 * Heavy media (intro videos, images, music) can live on Cloudinary instead of in the repo.
 * Set VITE_CLOUDINARY_CLOUD_NAME to serve them from Cloudinary; leave it empty to serve the
 * same paths from /public. `scripts/upload-cloudinary.mjs` uploads /public files to matching IDs.
 */
export type MediaOptions = { cloud?: string; folder?: string; base?: string };

const VIDEO = /\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i;
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;

/** Maps a path inside /public (for example `intro/videos/1.mp4`) to the URL the browser should load. */
export function buildMediaUrl(path: string, { cloud, folder = 'echo', base = '/' }: MediaOptions = {}): string {
  const clean = path.replace(/^\/+/, '');
  const encoded = clean.split('/').map(encodeURIComponent).join('/');
  if (!cloud) return `${base}${encoded}`;
  const prefix = folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : '';
  // Cloudinary groups uploads by resource type: images, video (also audio), and raw for anything else.
  if (IMAGE.test(clean)) return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto/${prefix}${encoded}`;
  if (VIDEO.test(clean)) return `https://res.cloudinary.com/${cloud}/video/upload/${prefix}${encoded}`;
  return `https://res.cloudinary.com/${cloud}/raw/upload/${prefix}${encoded}`;
}

/**
 * Cloudinary URL of an image folder inside /public, ending in `/`, or '' when Cloudinary is off.
 * Static pages (the watercolor book) prefix their own relative image paths with it.
 */
export function buildImageBase(dir: string, { cloud, folder = 'echo' }: MediaOptions = {}): string {
  if (!cloud) return '';
  const prefix = folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : '';
  const encoded = dir.replace(/^\/+|\/+$/g, '').split('/').map(encodeURIComponent).join('/');
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto/${prefix}${encoded}/`;
}

const options: MediaOptions = {
  cloud: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || undefined,
  folder: import.meta.env.VITE_CLOUDINARY_FOLDER?.trim() || 'echo',
  base: import.meta.env.BASE_URL,
};

export const mediaUrl = (path: string) => buildMediaUrl(path, options);
export const imageBase = (dir: string) => buildImageBase(dir, options);
