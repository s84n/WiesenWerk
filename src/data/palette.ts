/**
 * Farbpalette von Wiesenwerk: sonnig-warm, gedämpfte Grüntöne, honigfarbenes Holz,
 * Terrakotta-Ziegel, türkises Wasser. Kräftige Farben nur für Blumen, Items und Hinweise.
 * Alle Farben im Spiel kommen aus dieser Datei.
 */
export const PALETTE = {
  // Gelände
  meadow: 0x9cc65a,
  meadowLight: 0xb4d46c,
  meadowDark: 0x84b04a,
  forestFloor: 0x76a447,
  sand: 0xead7a0,
  soil: 0xa9825a,
  soilDark: 0x7d5c3e,
  rock: 0xc7b89c,
  rockDark: 0x9f8f78,
  waterBed: 0xd8c891,
  water: 0x4fc6c4,
  waterDeep: 0x2a9fb0,

  // Natur
  leaf: 0x6fa84a,
  leafLight: 0x8cbf55,
  leafDark: 0x4f8a3c,
  trunk: 0x8a5a34,

  // Baustoffe (für Gebäude ab Phase 2)
  wood: 0xd9a35b,
  woodDark: 0xa8743c,
  brick: 0xc96f4a,
  roof: 0x8e4b3a,
  cream: 0xf3e6c8,
  copper: 0xd98b4e,
  stone: 0xd2c8b3,

  // Akzente (Blumen)
  flowerYellow: 0xf6d04d,
  flowerPink: 0xee8fb0,
  flowerWhite: 0xfaf4e6,
  flowerViolet: 0xa98fd8,

  // Licht und Himmel
  sky: 0xbfe3f2,
  fog: 0xcfe7e6,
  sun: 0xffe2b0,
  hemiSky: 0xd6ecff,
  hemiGround: 0x8a7a5c,
} as const;

export type PaletteKey = keyof typeof PALETTE;
