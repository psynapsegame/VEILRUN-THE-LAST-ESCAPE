// Prepares the 2D art for the game from assets-src/gemini/*.jpg:
//   node tools/build-art.mjs
// banners.webp   three banners cut out of their white background, side by side (alpha)
// frescoes.webp  mural (top half) and carved frieze (bottom half)
// panorama.webp  distant city, top and side edges faded out
// devourer.webp  the entity cut out of its sunset sky
// title.webp     key art for the loading screen
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'assets-src/gemini/', OUT = 'src/assets/art/';
mkdirSync(OUT, { recursive: true });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const raw = async (file, w, h) => {
  let s = sharp(SRC + file).ensureAlpha();
  if (w) s = s.resize(w, h, { fit: 'fill', kernel: 'lanczos3' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const save = (data, w, h, name, q = 88) => sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: q, alphaQuality: 92 }).toFile(OUT + name);

// ---- banners: flood-fill the white background from the borders, crop, resize, tile ----
{
  const TW = 256, TH = 768;
  const atlas = Buffer.alloc(TW * 3 * TH * 4);
  let i = 0;
  for (const f of ['banniere-violette.jpg', 'banniere-rouge.jpg', 'banniere-turquoise.jpg']) {
    const { data, w, h } = await raw(f);
    const bg = new Uint8Array(w * h), stack = [];
    const isWhite = p => data[p * 4] > 218 && data[p * 4 + 1] > 218 && data[p * 4 + 2] > 218;
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (isWhite(y * w + x)) stack.push(y * w + x);
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (isWhite(y * w + x)) stack.push(y * w + x);
    while (stack.length) {
      const p = stack.pop();
      if (bg[p] || !isWhite(p)) continue;
      bg[p] = 1;
      const x = p % w, y = (p / w) | 0;
      if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
    }
    // Eat the bright fringe: spread the background through pale pixels (catches specks enclosed by loose threads)...
    const pale = p => data[p * 4] > 185 && data[p * 4 + 1] > 185 && data[p * 4 + 2] > 185;
    for (let it = 0; it < 4; it++) {
      const add = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const p = y * w + x; if (!bg[p] && pale(p) && (bg[p - 1] || bg[p + 1] || bg[p - w] || bg[p + w])) add.push(p); }
      for (const p of add) bg[p] = 1;
    }
    // ...then one more pixel of any colour
    const grown = Uint8Array.from(bg);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const p = y * w + x; if (!bg[p] && (bg[p - 1] || bg[p + 1] || bg[p - w] || bg[p + w])) grown[p] = 1; }
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!grown[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const rgba = Buffer.alloc(w * h * 4);
    for (let p = 0; p < w * h; p++) { rgba.set(data.subarray(p * 4, p * 4 + 3), p * 4); rgba[p * 4 + 3] = grown[p] ? 0 : 255; }
    const tile = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).resize(TW, TH, { fit: 'fill' }).raw().toBuffer();
    for (let y = 0; y < TH; y++) tile.copy(atlas, (y * TW * 3 + i * TW) * 4, y * TW * 4, (y + 1) * TW * 4);
    console.log(f, 'crop', x1 - x0 + 1, 'x', y1 - y0 + 1);
    i++;
  }
  await save(atlas, TW * 3, TH, 'banners.webp', 90);
}

// ---- frescoes: mural over frieze in one 1024x512 sheet (each 1024x256) ----
{
  const a = await raw('fresque.jpg', 1024, 256), b = await raw('frise.jpg', 1024, 256);
  await save(Buffer.concat([a.data, b.data]), 1024, 512, 'frescoes.webp', 86);
}

// ---- panorama: keep the skyline, melt the sky and the sides into the dome ----
{
  const { data, w, h } = await raw('panorama.jpg', 2048, 508);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = smooth(0.2, 0.5, y / h) * smooth(0, 0.07, x / w) * smooth(1, 0.93, x / w);
    data[(y * w + x) * 4 + 3] = Math.round(255 * a);
  }
  await save(data, w, h, 'panorama.webp', 84);
}

// ---- devourer: dark smoke against a bright sky -> alpha from darkness, glowing eyes kept ----
{
  const { data, w, h } = await raw('devoreur.jpg');
  for (let p = 0; p < w * h; p++) {
    const y = ((p / w) | 0) / h, r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const cyan = Math.max(0, (g + b) / 2 - r) / 255;
    let a = Math.max(smooth(0.66, 0.26, lum), smooth(0.2, 0.42, cyan));
    const x = (p % w) / w;
    a *= smooth(0.93, 0.78, y); // the ground strip and the dust at the feet dissolve
    a *= smooth(0.08, 0.2, y) * smooth(0, 0.07, x) * smooth(1, 0.93, x); // no visible picture frame
    data[p * 4 + 3] = Math.round(255 * Math.min(1, a * 1.08));
  }
  await save(data, w, h, 'devourer.webp', 86);
}

// ---- title key art ----
{
  const { data, w, h } = await raw('titre.jpg');
  await save(data, w, h, 'title.webp', 84);
}
console.log('done');
