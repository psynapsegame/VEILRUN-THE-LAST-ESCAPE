// Bundles the whole game into one self-contained HTML file (no server needed):
//   dist/veilrun.html   — standalone page, can be opened or hosted anywhere
//   dist/artifact.html  — same game as a body fragment for preview publishing
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const r = await build({ entryPoints: ['src/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none', loader: { '.glb': 'binary', '.hdr': 'binary', '.webp': 'dataurl' } });
const js = r.outputFiles[0].text;
const base = 'html,body{height:100%;margin:0;background:#07060b;color:#f4ecdc}:root{color-scheme:dark}';
mkdirSync('dist', { recursive: true });
writeFileSync('dist/veilrun.html',
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>VEILRUN — The Last Escape</title><style>${base}</style></head><body><script>${js}</script></body></html>`);
writeFileSync('dist/artifact.html',
  `<title>VEILRUN The Last Escape</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&display=swap">\n<style>${base}</style>\n<script>${js}</script>\n`);
console.log(`single-file build: ${(js.length / 1024).toFixed(0)} kB`);
