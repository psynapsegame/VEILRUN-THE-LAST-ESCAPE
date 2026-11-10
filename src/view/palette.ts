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

const GLOW = new Set([PAL.cyan, PAL.fire, PAL.ember]);
const PLAIN = new Set([PAL.cloth, PAL.clothRed, PAL.trunk, PAL.trunkDark, PAL.leaf, PAL.leafLight, PAL.shadow]);
Builder.classify = c => (c === PAL.gold ? 1 : GLOW.has(c) ? 2 : PLAIN.has(c) ? 3 : 0);
