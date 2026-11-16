import { toAmounts, type ItemAmount, type ItemKey } from './items';
import type { MachineKind } from './recipes';

/** Richtungen: 0 = Norden (−y), 1 = Osten (+x), 2 = Süden (+y), 3 = Westen (−x). */
export type Dir = 0 | 1 | 2 | 3;

/** Anschlusspunkt für Bänder an der Kante eines Feldes des Gebäudes (ungedreht). */
export interface PortDef {
  x: number;
  y: number;
  dir: Dir;
  kind: 'in' | 'out';
}

/**
 * Eingang an jedem Randfeld in jede Richtung nach außen (Ecken haben zwei). Für Gebäude, die
 * nur annehmen (Zentrale, Depots): Bänder können dann von überall angeschlossen werden.
 */
function inputsOnAllSides(w: number, h: number): PortDef[] {
  const ports: PortDef[] = [];
  for (let x = 0; x < w; x++) ports.push({ x, y: 0, dir: 0, kind: 'in' });
  for (let y = 0; y < h; y++) ports.push({ x: w - 1, y, dir: 1, kind: 'in' });
  for (let x = w - 1; x >= 0; x--) ports.push({ x, y: h - 1, dir: 2, kind: 'in' });
  for (let y = h - 1; y >= 0; y--) ports.push({ x: 0, y, dir: 3, kind: 'in' });
  return ports;
}

/** Was ein Gebäude tut. Die Simulation kennt nur diese Arten, keine einzelnen Gebäude. */
export type Behavior =
  | { kind: 'hq' }
  | { kind: 'miner'; itemsPerMinute: number }
  | { kind: 'lumberjack'; itemsPerMinute: number; radius: number }
  | { kind: 'crafter'; machine: MachineKind }
  | { kind: 'belt'; tilesPerSecond: number; tier: number }
  /** Kraftwerk mit Brennstoff: erzeugt `powerKW` bei voller Last. */
  | { kind: 'burner'; powerKW: number; fuelBuffer: number }
  /** Strommast: versorgt Gebäude im Quadrat ± `supplyRadius`, verbindet sich bis `connectRange` Felder. */
  | { kind: 'pole'; supplyRadius: number; connectRange: number }
  /** Windrad: erzeugt im Mittel `powerKW` ohne Brennstoff, schwankt sanft (siehe `WIND`). */
  | { kind: 'wind'; powerKW: number }
  /** Verteiler: gibt reihum auf seine freien Ausgänge ab. */
  | { kind: 'splitter' }
  /** Zusammenführer: nimmt reihum von seinen Eingängen. */
  | { kind: 'merger' }
  /** Bandbrücke: der k-te Eingang gibt an den k-ten Ausgang weiter (Spuren mischen sich nicht). */
  | { kind: 'bridge' }
  /** Lager: puffert bis zu `capacity` Items in Ankunftsreihenfolge, gibt reihum an seine Ausgänge ab. */
  | { kind: 'storage'; capacity: number }
  /** Depot: alles, was ankommt, landet sofort im Vorrat (wie bei der Zentrale). */
  | { kind: 'depot' }
  /**
   * Ausgabestelle: legt das gewählte Item (in `machines.recipe`) aus dem Vorrat aufs Band,
   * höchstens `itemsPerMinute`. Gegenstück zum Depot.
   */
  | { kind: 'dispenser'; itemsPerMinute: number }
  /**
   * Tunnelband: Eingang (`in`) und Ausgang (`out`) in gleicher Richtung verbinden sich, wenn
   * höchstens `range` Felder dazwischen liegen. Die Ware läuft unterirdisch, darüber ist Platz.
   */
  | { kind: 'tunnel'; role: 'in' | 'out'; range: number }
  /** Wasserrad: erzeugt gleichmäßig `powerKW`, muss mit der Vorderseite (Süden, ungedreht) am Wasser stehen. */
  | { kind: 'water'; powerKW: number }
  /** Solarfeld: erzeugt `powerKW` bei voller Sonne, nachts nichts (Tageszeit aus der Spielzeit). */
  | { kind: 'solar'; powerKW: number }
  /** Akku-Haus: speichert bis `capacityKJ` überschüssigen Strom aus Wind, Wasser und Sonne, gibt bis `rateKW` ab. */
  | { kind: 'battery'; capacityKJ: number; rateKW: number }
  /** Dekoration: rein optisch. */
  | { kind: 'decor' }
  /**
   * Wahrzeichen (Uhrturm): nimmt die Waren für den aktuellen Bauabschnitt an (`src/data/landmark.ts`),
   * alles andere geht wie bei einem Depot in den Vorrat.
   */
  | { kind: 'landmark' };

export type BuildCategory = 'extraction' | 'production' | 'logistics' | 'energy' | 'decoration';

export interface BuildingDef {
  key: string;
  /** Größe in Feldern (ungedreht): Breite in x, Tiefe in y. */
  size: readonly [number, number];
  category: BuildCategory;
  cost: Partial<Record<ItemKey, number>>;
  /**
   * 'ground' = freie Wiese oder gefällter Wald, 'deposit' = mindestens ein Feld auf einem Vorkommen,
   * 'groundOrDeposit' = beides erlaubt (Bänder), 'shore' = wie 'ground', aber die Vorderseite
   * (ungedreht Süden) grenzt an Wasser.
   */
  placement: 'ground' | 'deposit' | 'groundOrDeposit' | 'shore';
  behavior: Behavior;
  /** Stromverbrauch in kW bei der Arbeit (wartend: 10 %). 0 = braucht keinen Strom. */
  power: number;
  /** Höchstens ein Gebäude dieser Art pro Welt. */
  unique?: boolean;
  ports: readonly PortDef[];
  /** Name des 3D-Modells in `src/render/building-models.ts`. */
  model: string;
  /** Von Spielbeginn an verfügbar (sonst per Forschung, siehe `src/data/research.ts`). */
  availableFromStart: boolean;
  /** Wird mit gedrückter Maustaste in einer Linie gebaut (Bänder, Wege, Zäune). */
  line?: boolean;
  /**
   * Ausgemustert: nicht mehr baubar (keine Forschung schaltet es frei), gebaute Exemplare aus
   * alten Spielständen arbeiten aber weiter. Einträge nie löschen, sonst verschieben sich die IDs.
   */
  retired?: boolean;
}

/**
 * Gebäude in fester Reihenfolge. Neue Einträge hinten anhängen (Index = Typ-ID im Spielstand).
 */
export const BUILDINGS: readonly BuildingDef[] = [
  {
    key: 'hq',
    power: 0,
    size: [3, 3],
    category: 'logistics',
    cost: {},
    placement: 'ground',
    unique: true,
    behavior: { kind: 'hq' },
    ports: inputsOnAllSides(3, 3),
    model: 'hq',
    availableFromStart: true,
  },
  {
    key: 'lumberjack',
    // Muskelkraft: braucht keinen Strom, damit Holz (Brennstoff der Brenner) ohne Strom entsteht
    power: 0,
    size: [2, 2],
    category: 'extraction',
    cost: { wood: 10, stone: 5 },
    placement: 'ground',
    behavior: { kind: 'lumberjack', itemsPerMinute: 30, radius: 4 },
    ports: [{ x: 0, y: 1, dir: 2, kind: 'out' }],
    model: 'lumberjack',
    availableFromStart: true,
  },
  {
    key: 'miner',
    power: 5,
    size: [2, 2],
    category: 'extraction',
    cost: { wood: 10, stone: 10 },
    placement: 'deposit',
    behavior: { kind: 'miner', itemsPerMinute: 30 },
    ports: [{ x: 0, y: 1, dir: 2, kind: 'out' }],
    model: 'miner',
    availableFromStart: true,
  },
  {
    key: 'furnace',
    power: 4,
    size: [2, 2],
    category: 'production',
    cost: { stone: 20 },
    placement: 'ground',
    behavior: { kind: 'crafter', machine: 'furnace' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 1, dir: 2, kind: 'out' },
    ],
    model: 'furnace',
    availableFromStart: true,
  },
  {
    key: 'workshop',
    power: 4,
    size: [2, 2],
    category: 'production',
    cost: { wood: 15, copperIngot: 5 },
    placement: 'ground',
    behavior: { kind: 'crafter', machine: 'workshop' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 1, dir: 2, kind: 'out' },
    ],
    model: 'workshop',
    availableFromStart: true,
  },
  {
    key: 'beltMk1',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    cost: { wood: 1 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'belt', tilesPerSecond: 0.5, tier: 1 },
    ports: [],
    model: 'belt',
    availableFromStart: true,
    line: true,
  },
  {
    key: 'burner',
    power: 0,
    size: [2, 2],
    category: 'energy',
    cost: { stone: 15, copperOre: 5 },
    placement: 'ground',
    behavior: { kind: 'burner', powerKW: 30, fuelBuffer: 10 },
    ports: [{ x: 0, y: 0, dir: 0, kind: 'in' }],
    model: 'burner',
    availableFromStart: true,
  },
  {
    key: 'pole',
    power: 0,
    size: [1, 1],
    category: 'energy',
    cost: { wood: 3, copperOre: 1 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'pole', supplyRadius: 6, connectRange: 14 },
    ports: [],
    model: 'pole',
    availableFromStart: true,
  },
  // ---------------------------------------------------------------- ab Phase 6 (Forschung)
  {
    key: 'assembler',
    power: 15,
    size: [3, 3],
    category: 'production',
    cost: { plank: 30, stoneBrick: 30, copperSheet: 20 },
    placement: 'ground',
    behavior: { kind: 'crafter', machine: 'assembler' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 2, y: 0, dir: 0, kind: 'in' },
      { x: 1, y: 2, dir: 2, kind: 'out' },
    ],
    model: 'assembler',
    availableFromStart: false,
  },
  {
    key: 'storage',
    power: 0,
    size: [2, 2],
    category: 'logistics',
    cost: { plank: 30, stoneBrick: 10 },
    placement: 'ground',
    behavior: { kind: 'storage', capacity: 1000 },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 1, dir: 2, kind: 'out' },
    ],
    model: 'storage',
    availableFromStart: false,
  },
  {
    key: 'splitter',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    // ab Spielbeginn und günstig: teilt Holz zwischen Brenner und Zentrale auf (Überlauf)
    cost: { wood: 4, stone: 2 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'splitter' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 0, dir: 3, kind: 'out' },
      { x: 0, y: 0, dir: 2, kind: 'out' },
      { x: 0, y: 0, dir: 1, kind: 'out' },
    ],
    model: 'splitter',
    availableFromStart: true,
  },
  {
    key: 'merger',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    cost: { plank: 5, copperWire: 5 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'merger' },
    ports: [
      { x: 0, y: 0, dir: 3, kind: 'in' },
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 0, dir: 1, kind: 'in' },
      { x: 0, y: 0, dir: 2, kind: 'out' },
    ],
    model: 'merger',
    availableFromStart: false,
  },
  {
    key: 'bridge',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    cost: { frame: 5 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'bridge' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 0, dir: 3, kind: 'in' },
      { x: 0, y: 0, dir: 2, kind: 'out' },
      { x: 0, y: 0, dir: 1, kind: 'out' },
    ],
    model: 'bridge',
    availableFromStart: false,
  },
  {
    key: 'beltMk2',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    cost: { copperSheet: 1 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'belt', tilesPerSecond: 1, tier: 2 },
    ports: [],
    model: 'beltMk2',
    availableFromStart: false,
    line: true,
  },
  {
    key: 'beltMk3',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    cost: { circuit: 1 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'belt', tilesPerSecond: 2, tier: 3 },
    ports: [],
    model: 'beltMk3',
    availableFromStart: false,
    line: true,
  },
  {
    key: 'windTurbine',
    power: 0,
    size: [2, 2],
    category: 'energy',
    cost: { frame: 10, coil: 10 },
    placement: 'ground',
    behavior: { kind: 'wind', powerKW: 10 },
    ports: [],
    model: 'windTurbine',
    availableFromStart: false,
  },
  {
    key: 'bigPole',
    power: 0,
    size: [2, 2],
    category: 'energy',
    cost: { frame: 5, coil: 10 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'pole', supplyRadius: 3, connectRange: 32 },
    ports: [],
    model: 'bigPole',
    availableFromStart: false,
  },
  {
    key: 'path',
    power: 0,
    size: [1, 1],
    category: 'decoration',
    cost: { stoneBrick: 1 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'path',
    availableFromStart: false,
    line: true,
  },
  {
    key: 'lantern',
    power: 0,
    size: [1, 1],
    category: 'decoration',
    cost: { plank: 2, stoneBrick: 1 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'lantern',
    availableFromStart: false,
  },
  {
    key: 'flowerbed',
    power: 0,
    size: [1, 1],
    category: 'decoration',
    cost: { stoneBrick: 2 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'flowerbed',
    availableFromStart: false,
  },
  {
    key: 'fence',
    power: 0,
    size: [1, 1],
    category: 'decoration',
    cost: { plank: 2 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'fence',
    availableFromStart: false,
    line: true,
  },
  {
    key: 'bench',
    power: 0,
    size: [1, 1],
    category: 'decoration',
    cost: { plank: 4 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'bench',
    availableFromStart: false,
  },
  {
    key: 'ornamentalTree',
    power: 0,
    size: [1, 1],
    category: 'decoration',
    cost: { stoneBrick: 3, plank: 2 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'ornamentalTree',
    availableFromStart: false,
  },
  {
    key: 'pathColored',
    power: 0,
    size: [1, 1],
    category: 'decoration',
    cost: { stoneBrick: 2 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'pathColored',
    availableFromStart: false,
    line: true,
  },
  // ---------------------------------------------------------------- Lager und Depots (nach Phase 7)
  {
    key: 'depot',
    power: 0,
    size: [2, 2],
    category: 'logistics',
    cost: { wood: 15, stone: 10 },
    placement: 'ground',
    behavior: { kind: 'depot' },
    ports: inputsOnAllSides(2, 2),
    model: 'depot',
    availableFromStart: true,
  },
  {
    key: 'storageSplit',
    power: 0,
    size: [2, 2],
    category: 'logistics',
    cost: { plank: 40, stoneBrick: 15 },
    placement: 'ground',
    behavior: { kind: 'storage', capacity: 1500 },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 1, dir: 2, kind: 'out' },
      { x: 1, y: 1, dir: 2, kind: 'out' },
    ],
    model: 'storageSplit',
    availableFromStart: false,
    // Seit der Ausgabestelle überflüssig (Auftraggeber: aufräumen)
    retired: true,
  },
  {
    key: 'storageMerge',
    power: 0,
    size: [2, 2],
    category: 'logistics',
    cost: { plank: 40, stoneBrick: 15 },
    placement: 'ground',
    behavior: { kind: 'storage', capacity: 1500 },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 1, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 1, dir: 2, kind: 'out' },
    ],
    model: 'storageMerge',
    availableFromStart: false,
    // Seit der Ausgabestelle überflüssig (ein Depot hat 8 Eingänge)
    retired: true,
  },
  {
    key: 'storageLarge',
    power: 0,
    size: [3, 3],
    category: 'logistics',
    cost: { frame: 20, stoneBrick: 60 },
    placement: 'ground',
    behavior: { kind: 'storage', capacity: 5000 },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 2, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 2, dir: 2, kind: 'out' },
      { x: 2, y: 2, dir: 2, kind: 'out' },
    ],
    model: 'storageLarge',
    availableFromStart: false,
  },
  {
    key: 'depotLarge',
    power: 0,
    size: [3, 3],
    category: 'logistics',
    cost: { frame: 15, plank: 60, stoneBrick: 40 },
    placement: 'ground',
    behavior: { kind: 'depot' },
    ports: inputsOnAllSides(3, 3),
    model: 'depotLarge',
    availableFromStart: false,
  },
  {
    key: 'tunnelIn',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    cost: { plank: 6, stoneBrick: 4 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'tunnel', role: 'in', range: 6 },
    ports: [{ x: 0, y: 0, dir: 2, kind: 'in' }],
    model: 'tunnelIn',
    availableFromStart: false,
  },
  {
    key: 'tunnelOut',
    power: 0,
    size: [1, 1],
    category: 'logistics',
    cost: { plank: 6, stoneBrick: 4 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'tunnel', role: 'out', range: 6 },
    ports: [{ x: 0, y: 0, dir: 0, kind: 'out' }],
    model: 'tunnelOut',
    availableFromStart: false,
  },
  // ---------------------------------------------------------------- Eisen, Stahl, neue Stromarten
  {
    key: 'foundry',
    power: 20,
    size: [3, 3],
    category: 'production',
    cost: { stoneBrick: 60, ironIngot: 30, copperSheet: 10 },
    placement: 'ground',
    behavior: { kind: 'crafter', machine: 'foundry' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 2, y: 0, dir: 0, kind: 'in' },
      { x: 1, y: 2, dir: 2, kind: 'out' },
    ],
    model: 'foundry',
    availableFromStart: false,
  },
  {
    key: 'waterWheel',
    power: 0,
    size: [2, 2],
    category: 'energy',
    cost: { plank: 30, gear: 20, stoneBrick: 20 },
    placement: 'shore',
    behavior: { kind: 'water', powerKW: 25 },
    ports: [],
    model: 'waterWheel',
    availableFromStart: false,
  },
  {
    key: 'solarPanel',
    power: 0,
    size: [2, 2],
    category: 'energy',
    cost: { glass: 20, copperWire: 20, frame: 5 },
    placement: 'ground',
    behavior: { kind: 'solar', powerKW: 20 },
    ports: [],
    model: 'solarPanel',
    availableFromStart: false,
  },
  {
    key: 'battery',
    power: 0,
    size: [2, 2],
    category: 'energy',
    cost: { steel: 20, coil: 20, circuit: 10 },
    placement: 'ground',
    behavior: { kind: 'battery', capacityKJ: 20000, rateKW: 60 },
    ports: [],
    model: 'battery',
    availableFromStart: false,
  },
  // ---------------------------------------------------------------- Ausgabe aus dem Vorrat
  {
    key: 'dispenser',
    power: 0,
    size: [2, 2],
    category: 'logistics',
    cost: { wood: 15, stone: 10 },
    placement: 'ground',
    behavior: { kind: 'dispenser', itemsPerMinute: 60 },
    ports: [{ x: 0, y: 1, dir: 2, kind: 'out' }],
    model: 'dispenser',
    availableFromStart: true,
  },
  // ---------------------------------------------------------------- Wahrzeichen
  {
    key: 'clockTower',
    power: 0,
    size: [3, 3],
    category: 'decoration',
    cost: { wood: 20, stone: 20 },
    placement: 'ground',
    unique: true,
    behavior: { kind: 'landmark' },
    ports: inputsOnAllSides(3, 3),
    model: 'clockTower',
    availableFromStart: true,
  },
  /** Belohnungen des Uhrturms (keine Forschung, siehe `LANDMARK_STAGES`). */
  {
    key: 'fountain',
    power: 0,
    size: [2, 2],
    category: 'decoration',
    cost: { stoneBrick: 20, copperSheet: 2 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'fountain',
    availableFromStart: false,
  },
  {
    key: 'bandstand',
    power: 0,
    size: [3, 3],
    category: 'decoration',
    cost: { plank: 40, copperSheet: 20, stoneBrick: 20 },
    placement: 'ground',
    behavior: { kind: 'decor' },
    ports: [],
    model: 'bandstand',
    availableFromStart: false,
  },
];

/** Gebäude, bei denen `machines.recipe` eine Auswahl des Spielers ist (Rezept bzw. Item). */
export function hasSetting(kind: Behavior['kind']): boolean {
  return kind === 'crafter' || kind === 'dispenser';
}

/** Erzeuger ohne Brennstoff (Wind, Wasser, Sonne). */
export const FREE_GENERATOR_KINDS: readonly Behavior['kind'][] = ['wind', 'water', 'solar'];

export const BUILDING_ID = Object.fromEntries(BUILDINGS.map((b, i) => [b.key, i])) as Record<
  string,
  number
>;

/** Baukosten jedes Gebäudetyps mit numerischen Item-IDs (Index = Typ-ID). */
export const BUILDING_COSTS: readonly ItemAmount[][] = BUILDINGS.map((b) => toAmounts(b.cost));

export const CATEGORIES: readonly BuildCategory[] = [
  'extraction',
  'production',
  'logistics',
  'energy',
  'decoration',
];
