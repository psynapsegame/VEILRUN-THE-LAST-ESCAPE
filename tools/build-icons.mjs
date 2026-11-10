// Generates every launcher icon and launch screen from assets-src/gemini/icone.jpg:
//   node tools/build-icons.mjs
// Android: legacy square/round icons, adaptive foreground (art padded so the system mask never cuts the runner),
//          dark launch screens with the icon. Web: favicon and home-screen icons. iOS: resources/icon-1024.png.
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';

const RES = 'android/app/src/main/res/';
const SRC = 'assets-src/gemini/icone.jpg';
mkdirSync('public', { recursive: true });
mkdirSync('resources', { recursive: true });

// The source has rounded white corners: keep the inner square only.
const meta = await sharp(SRC).metadata();
const inset = Math.round(meta.width * 0.06);
const art = await sharp(SRC).extract({ left: inset, top: inset, width: meta.width - 2 * inset, height: meta.height - 2 * inset }).toBuffer();
const square = (n) => sharp(art).resize(n, n, { kernel: 'lanczos3' });
const mask = (n, r) => Buffer.from(`<svg width="${n}" height="${n}"><rect width="${n}" height="${n}" rx="${r}" ry="${r}"/></svg>`);

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const d of Object.keys(legacy)) {
  const n = legacy[d];
  await square(n).composite([{ input: mask(n, n * 0.2), blend: 'dest-in' }]).png().toFile(`${RES}mipmap-${d}/ic_launcher.png`);
  await square(n).composite([{ input: mask(n, n / 2), blend: 'dest-in' }]).png().toFile(`${RES}mipmap-${d}/ic_launcher_round.png`);
  // Adaptive foreground: the art at 78% over a blurred, darkened copy of itself, so any mask shape looks intentional
  const c = adaptive[d], inner = Math.round(c * 0.78);
  const back = await sharp(art).resize(c, c).blur(c / 14).modulate({ brightness: 0.7 }).toBuffer();
  const fg = await sharp(art).resize(inner, inner, { kernel: 'lanczos3' })
    .composite([{ input: Buffer.from(`<svg width="${inner}" height="${inner}"><rect x="${inner * 0.02}" y="${inner * 0.02}" width="${inner * 0.96}" height="${inner * 0.96}" rx="${inner * 0.12}" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
  await sharp(back).composite([{ input: fg, left: Math.round((c - inner) / 2), top: Math.round((c - inner) / 2) }]).png().toFile(`${RES}mipmap-${d}/ic_launcher_foreground.png`);
}
writeFileSync(`${RES}values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2A1646</color>\n</resources>\n`);

// Launch screens: near-black with the icon in the middle (the web splash then fades in over it)
for (const dir of readdirSync(RES).filter(d => d.startsWith('drawable') && statSync(`${RES}${d}/splash.png`, { throwIfNoEntry: false })?.isFile())) {
  const { width: w, height: h } = await sharp(`${RES}${dir}/splash.png`).metadata();
  const s = Math.round(Math.min(w, h) * 0.3);
  const icon = await square(s).composite([{ input: mask(s, s * 0.22), blend: 'dest-in' }]).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: '#07060b' } }).composite([{ input: icon, left: Math.round((w - s) / 2), top: Math.round((h - s) / 2) }]).png().toFile(`${RES}${dir}/splash.png`);
}

// Web and iOS
for (const [file, n] of [['public/icon-512.png', 512], ['public/icon-192.png', 192], ['public/apple-touch-icon.png', 180], ['public/favicon.png', 64]])
  await square(n).composite([{ input: mask(n, n * 0.2), blend: 'dest-in' }]).png({ palette: true, quality: 82, compressionLevel: 9 }).toFile(file);
await square(1024).png().toFile('resources/icon-1024.png'); // iOS wants a full-bleed square: the system rounds it
console.log('icons done');
