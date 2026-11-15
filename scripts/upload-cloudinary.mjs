// Uploads media from /public to Cloudinary so the deployed site does not have to carry it.
// Each file keeps its path, so `public/intro/Video/1.mp4` becomes `<folder>/intro/Video/1`,
// which is exactly what src/media.ts asks for.
//
//   npm run media:upload                 # uploads public/intro
//   npm run media:upload -- intro assets # uploads several folders inside /public
//   npm run media:upload -- --dry-run    # lists what would be uploaded
//
// Needs CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD) or CLOUDINARY_CLOUD_NAME,
// CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env. The secret never goes to the browser.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const folders = args.filter((a) => !a.startsWith('--'));
const roots = folders.length ? folders : ['intro'];

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

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])));
  return files.flat().filter((f) => !basename(f).startsWith('.'));
}

function plan(file, publicDir) {
  const ext = extname(file).toLowerCase();
  const type = IMAGE.has(ext) ? 'image' : VIDEO.has(ext) ? 'video' : 'raw';
  const path = relative(publicDir, file).split(sep).join('/');
  // Images and videos are addressed without their extension; raw files keep it.
  const id = type === 'raw' ? path : path.slice(0, -ext.length);
  return { file, type, path, publicId: `${folder}/${id}`, ext };
}

async function upload({ file, type, publicId, ext }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { overwrite: 'true', public_id: publicId, timestamp: String(timestamp) };
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

const publicDir = resolve('public');
const files = (await Promise.all(roots.map((r) => walk(join(publicDir, r))))).flat().map((f) => plan(f, publicDir));
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
console.log(failed ? `${failed} file(s) failed.` : 'All files uploaded.');
process.exit(failed ? 1 : 0);
