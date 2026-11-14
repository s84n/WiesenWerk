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

  // Gebäude-Details
  glow: 0xffb347,
  windowLight: 0xffe39a,
  flag: 0xe0603e,
  metal: 0x8f99a3,
  metalDark: 0x5f6870,
  blade: 0xf6f1e4,
  pathStone: 0xcfc3a8,
  pathRed: 0xc77a5a,
  hedge: 0x5f9a42,
  smoke: 0xf2ece2,
  dust: 0xe6d6b8,
  workerShirt: 0x5f8fc0,
  workerPants: 0x6a5240,
  skin: 0xf0c9a0,
  hat: 0xd9a35b,

  // Items
  itemWood: 0xc98b4a,
  itemStone: 0xbdb5a5,
  itemCopperOre: 0xb0643a,
  itemCopperIngot: 0xeb9a5e,
  itemBrick: 0xc96f4a,
  itemCharcoal: 0x5a4c44,
  itemPlank: 0xe6c27a,
  itemWire: 0xf0b45e,
  itemSheet: 0xd98b4e,
  itemFrame: 0xa8743c,
  itemCoil: 0xd07a3c,
  itemCircuit: 0x5aa66a,
  itemMotor: 0x7f93ad,
  itemControl: 0x4fb3b0,
  itemIronOre: 0x8a6a5a,
  itemCoal: 0x3a3438,
  itemSand: 0xe8d29a,
  itemIronIngot: 0xa9b2ba,
  itemGlass: 0xbfe8f0,
  itemSteel: 0x6f7f8e,
  itemGear: 0x9aa4ac,

  // Neue Vorkommen
  iron: 0x9a6f5e,
  ironGround: 0x8f7466,
  coal: 0x3e383c,
  coalGround: 0x6e6258,
  sandGround: 0xe2cf98,
  sandOre: 0xf0e0b0,

  // Dorf
  houseWall: 0xf3e6c8,
  houseWallB: 0xe8d4b0,
  houseRoofA: 0xc96f4a,
  houseRoofB: 0x8e4b3a,
  houseRoofC: 0x6f8fa8,
  garden: 0x7a5a3a,
  villagerA: 0xd86a6a,
  villagerB: 0x6aa86a,
  villagerC: 0xe0b050,

  // Neue Stromgebäude
  solarCell: 0x2f4f7a,
  solarFrame: 0xd8dde2,
  battery: 0x5aa66a,
  waterWheel: 0x8a5a34,

  // Minikarte
  miniBuilding: 0xe0603e,
  miniBelt: 0x5f5048,
  miniView: 0xfff6d8,

  // Bänder
  beltFrame: 0x9a6a3c,
  beltSurface: 0x5f5048,
  beltArrow: 0xe6c27a,
  beltSlat: 0x8a7868,
  beltFrameMk2: 0x4f7fb0,
  beltArrowMk2: 0xa8d0f0,
  beltFrameMk3: 0x3f9a7a,
  beltArrowMk3: 0xb8f0c0,

  // Hinweise
  hintWait: 0xf6d04d,
  hintIdle: 0x9fb4d8,
  hintPower: 0xb59be0,
  powerOk: 0x8fe08a,
  powerLow: 0xf6d04d,
  powerNone: 0xf0806a,
  powerArea: 0x7fc3f0,
  cable: 0x3d3430,
  hintGood: 0x8fe08a,
  hintBad: 0xf0806a,
  highlight: 0xfff6d8,
  portIn: 0x6fb7e8,
  portOut: 0xf2a33a,
  portMarkerIn: 0x3f9ae0,
  portMarkerOut: 0xff8a1e,

  // Licht und Himmel
  sky: 0xbfe3f2,
  fog: 0xcfe7e6,
  sun: 0xffe2b0,
  hemiSky: 0xd6ecff,
  hemiGround: 0x8a7a5c,

  // Tagesverlauf (Nacht bleibt freundlich blau, Morgen und Abend warm)
  moon: 0xb4c8ff,
  nightSky: 0x8fa4ec,
  nightGround: 0x645c8c,
  nightFog: 0x3e4f8a,
  dawnSun: 0xffb08a,
  dawnSky: 0xd8b4d0,
  dawnGround: 0x7a6250,
  dawnFog: 0xf2c4ae,
  morningSun: 0xffe8c4,
  goldenSun: 0xffc47c,
  goldenSky: 0xf0dcc4,
  goldenFog: 0xf2dcb8,
  sunsetSun: 0xff9060,
  sunsetSky: 0xc08cb8,
  sunsetFog: 0xeaa892,

  // Wetter und Nacht
  rain: 0xd8eaf6,
  rainFog: 0xb8c8d2,
  firefly: 0xe0ff8a,
  lanternLight: 0xffc070,
  bird: 0x4a4048,
  butterflyA: 0xf6d04d,
  butterflyB: 0xfaf4e6,
  duck: 0xf3ecdc,
  duckHead: 0x3f7a4a,
  beak: 0xf2a33a,
  blobShadow: 0x3a3040,
} as const;

export type PaletteKey = keyof typeof PALETTE;
