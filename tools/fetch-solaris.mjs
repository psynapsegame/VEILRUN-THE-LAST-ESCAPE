// Downloads the CC0 Poly Haven sources for SOLARIS and prepares mobile-sized files:
//   node tools/fetch-solaris.mjs
// Output: src/assets/solaris/<name>_{diff,nor,arm}.webp and sky.hdr (256x128, sun turned to face the runner).
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const UA = 'veilrun-asset-fetch';
const OUT = 'src/assets/solaris/';
const TEX = { wall: 'sandstone_blocks_08', rough: 'sandstone_blocks_05', road: 'marble_01' };
const HDRI = 'rogland_sunset';
/** Direction the sun must come from in game space (matches the sky shader and fog). */
const SUN = [-0.18, 0.2, -1];

// curl honours the system proxy settings, which Node's fetch does not.
const get = async url => execFileSync('curl', ['-fsSL', '-A', UA, url], { maxBuffer: 1 << 28 });
mkdirSync(OUT, { recursive: true });

for (const [name, id] of Object.entries(TEX)) {
  const base = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${id}/${id}`;
  for (const [map, out, size, q] of [['diff', 'diff', 1024, 80], ['nor_gl', 'nor', 1024, 82], ['arm', 'arm', 512, 75]]) {
    const buf = await sharp(await get(`${base}_${map}_1k.jpg`)).resize(size, size).webp({ quality: q }).toBuffer();
    writeFileSync(`${OUT}${name}_${out}.webp`, buf);
    console.log(`${name}_${out}.webp`, (buf.length / 1024) | 0, 'kB');
  }
}

// --- HDRI: decode Radiance RGBE, shrink, rotate so the sun sits where the game expects it ---
const hdr = await get(`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${HDRI}_1k.hdr`);
let p = 0;
const line = () => { const s = p; while (hdr[p] !== 10) p++; return hdr.toString('latin1', s, p++); };
let l;
while ((l = line()) !== '');
const [, H, W] = /-Y (\d+) \+X (\d+)/.exec(line()).map(Number);
const lin = new Float32Array(W * H * 3);
const scan = new Uint8Array(W * 4);
for (let y = 0; y < H; y++) {
  if (hdr[p] !== 2 || hdr[p + 1] !== 2) throw new Error('unsupported HDR encoding');
  p += 4;
  for (let c = 0; c < 4; c++) {
    let x = 0;
    while (x < W) {
      let n = hdr[p++];
      if (n > 128) { n -= 128; const v = hdr[p++]; while (n--) scan[x++ * 4 + c] = v; }
      else while (n--) scan[x++ * 4 + c] = hdr[p++];
    }
  }
  for (let x = 0; x < W; x++) {
    const e = scan[x * 4 + 3], f = e ? Math.pow(2, e - 136) : 0, o = (y * W + x) * 3;
    lin[o] = scan[x * 4] * f; lin[o + 1] = scan[x * 4 + 1] * f; lin[o + 2] = scan[x * 4 + 2] * f;
  }
}
const w = 256, h = 128, k = W / w;
const small = new Float32Array(w * h * 3);
let best = 0, sunX = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const o = (y * w + x) * 3;
  for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
    const s = ((y * k + dy) * W + x * k + dx) * 3;
    small[o] += lin[s]; small[o + 1] += lin[s + 1]; small[o + 2] += lin[s + 2];
  }
  for (let c = 0; c < 3; c++) small[o + c] = Math.min(small[o + c] / (k * k), 90); // tame the sun disc
  const lum = small[o] + small[o + 1] + small[o + 2];
  if (lum > best) { best = lum; sunX = x; }
}
const wantU = Math.atan2(SUN[2], SUN[0]) / (2 * Math.PI) + 0.5;
const shift = Math.round(wantU * w - sunX);
const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'latin1');
const out = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const s = (y * w + (((x - shift) % w) + w) % w) * 3, o = (y * w + x) * 4;
  const m = Math.max(small[s], small[s + 1], small[s + 2]);
  if (m < 1e-32) continue;
  const e = Math.ceil(Math.log2(m)), f = 256 / Math.pow(2, e);
  out[o] = Math.min(255, small[s] * f); out[o + 1] = Math.min(255, small[s + 1] * f); out[o + 2] = Math.min(255, small[s + 2] * f); out[o + 3] = e + 128;
}
if (out[0] === 2 && out[1] === 2) out[0] = 3; // never look like an RLE scanline header
writeFileSync(`${OUT}sky.hdr`, Buffer.concat([head, out]));
console.log('sky.hdr', ((head.length + out.length) / 1024) | 0, 'kB, sun column', sunX, '->', sunX + shift);
