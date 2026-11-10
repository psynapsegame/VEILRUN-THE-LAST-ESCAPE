import { Builder } from './build';

/** SOLARIS palette. Masonry tints multiply the photographed sandstone, so they stay close to white. */
export const PAL = {
  stone: 0xeedfc6,
  stoneDark: 0xb49a7c,
  stoneLight: 0xffffff,
  shadow: 0x3a2c22, // doorways, recesses
  gold: 0xffc04d,
  cyan: 0x5fe8ff, // Veil energy: only on things that can hurt the runner
  fire: 0xff7a2a,
  ember: 0xffe08a,
  cloth: 0x7a3fd0,
  clothRed: 0xb5432e,
  trunk: 0x8a5a34,
  trunkDark: 0x7a4a2a,
  leaf: 0x3f8f4a,
  leafLight: 0x56a85a,
  fog: 0xc9b4a8,
  skyTop: 0x16306e,
  skyMid: 0x5f93cc,
};

/** NEXUS, the neon metropolis: facades with lit windows, trim metal, glowing neon, plain dark parts. */
export const NX = {
  steel: 0x262f50, dark: 0x10131f, trim: 0x7f8db8,
  cyan: 0x2fe8ff, magenta: 0xff3fd2, amber: 0xffb02e, red: 0xff3a4a, white: 0xdff6ff,
};
const NX_GLOW = new Set([NX.cyan, NX.magenta, NX.amber, NX.red, NX.white]);
const GLOW = new Set([PAL.cyan, PAL.fire, PAL.ember]);
const PLAIN = new Set([PAL.cloth, PAL.clothRed, PAL.trunk, PAL.trunkDark, PAL.leaf, PAL.leafLight, PAL.shadow]);
Builder.classify = c => (c === PAL.gold || c === NX.trim ? 1 : GLOW.has(c) || NX_GLOW.has(c) ? 2 : PLAIN.has(c) || c === NX.dark ? 3 : 0);
