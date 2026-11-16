// Uploads media from /public to Cloudinary so the deployed site does not have to carry it.
// Each file keeps its path, so `public/intro/videos/1.mp4` becomes `<folder>/intro/videos/1`,
// which is exactly what src/media.ts asks for.
//
//   npm run media:upload                 # uploads every heavy folder (MEDIA_ROOTS in media-files.mjs)
//   npm run media:upload -- assets/models # uploads only the folders you name inside /public
//   npm run media:upload -- --dry-run    # lists what would be uploaded
//   npm run media:upload -- --organize   # files already uploaded: only move them into their folders
//
// Accounts with dynamic folders keep the Media Library folder (`asset_folder`) separate from the
// Public ID, so every file also gets `asset_folder` = its Public ID's directory. Without it the URLs
// still work but the files show up loose in Home instead of inside their folders.
//
// Needs CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD) or CLOUDINARY_CLOUD_NAME,
// CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env. The secret never goes to the browser.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { MEDIA_ROOTS, listMediaFiles } from './media-files.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const organizeOnly = args.includes('--organize');
const folders = args.filter((a) => !a.startsWith('--'));
const roots = folders.length ? folders : MEDIA_ROOTS;

const fromUrl = process.env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
const cloud = fromUrl?.[3] ?? process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = fromUrl?.[1] ?? process.env.CLOUDINARY_API_KEY;
const apiSecret = fromUrl?.[2] ?? process.env.CLOUDINARY_API_SECRET;
const folder = (process.env.VITE_CLOUDINARY_FOLDER || 'echo').replace(/^\/+|\/+$/g, '');

const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const VIDEO = new Set(['.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.m4a']);
// Cloudinary's free plan rejects larger single uploads; those need the chunked API.
const LIMIT = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024, raw: 10 * 1024 * 1024 };
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };

function plan(path, publicDir) {
  const file = join(publicDir, path);
  const ext = extname(path).toLowerCase();
  const type = IMAGE.has(ext) ? 'image' : VIDEO.has(ext) ? 'video' : 'raw';
  // Images and videos are addressed without their extension; raw files keep it.
  const id = type === 'raw' ? path : path.slice(0, -ext.length);
  const publicId = `${folder}/${id}`;
  return { file, type, path, publicId, assetFolder: publicId.slice(0, publicId.lastIndexOf('/')), ext };
}

async function upload({ file, type, publicId, assetFolder, ext }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { asset_folder: assetFolder, overwrite: 'true', public_id: publicId, timestamp: String(timestamp) };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const signature = createHash('sha1').update(toSign + apiSecret).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([await readFile(file)], { type: MIME[ext] ?? 'application/octet-stream' }), basename(file));
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', apiKey);
  form.append('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${type}/upload`, { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);
  return data.secure_url;
}

/** Admin API: moves an uploaded file into its Media Library folder without uploading it again. */
async function organize({ type, publicId, assetFolder }) {
  const form = new FormData();
  form.append('asset_folder', assetFolder);
  const id = publicId.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/${type}/upload/${id}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);
}

const publicDir = resolve('public');
const files = (await listMediaFiles(publicDir, roots, (dir) => console.warn(`  (skipping ${dir}: folder not found)`))).map((p) => plan(p, publicDir));
console.log(`${files.length} files from public/${roots.join(', public/')} -> Cloudinary folder "${folder}"`);

if (dryRun) {
  for (const f of files) console.log(`  ${f.type.padEnd(5)} ${f.path} -> ${f.publicId}`);
  process.exit(0);
}
if (!cloud || !apiKey || !apiSecret) {
  console.error('Missing Cloudinary credentials. Set CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET, in .env.');
  process.exit(1);
}

let failed = 0;
const queue = [...files];
async function worker() {
  for (let f = queue.shift(); f; f = queue.shift()) {
    if (organizeOnly) {
      try {
        await organize(f);
        console.log(`  OK    ${f.publicId} -> ${f.assetFolder}/`);
      } catch (error) {
        failed++;
        console.error(`  FAIL  ${f.publicId}: ${error.message}`);
      }
      continue;
    }
    const size = (await stat(f.file)).size;
    if (size > LIMIT[f.type]) {
      failed++;
      console.error(`  SKIP  ${f.path}: ${(size / 1048576).toFixed(1)} MB is over the ${f.type} upload limit`);
      continue;
    }
    try {
      await upload(f);
      console.log(`  OK    ${f.path}`);
    } catch (error) {
      failed++;
      console.error(`  FAIL  ${f.path}: ${error.message}`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(failed ? `${failed} file(s) failed.` : organizeOnly ? 'All files are in their folders.' : 'All files uploaded.');
process.exit(failed ? 1 : 0);
