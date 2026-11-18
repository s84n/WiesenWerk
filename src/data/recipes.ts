import { SIM_CONFIG } from './config';
import { toAmounts, type ItemAmount, type ItemKey } from './items';

/** Maschinenarten, die Rezepte ausführen. */
export type MachineKind = 'furnace' | 'workshop' | 'assembler' | 'foundry' | 'bakery' | 'composter';

export interface RecipeDef {
  key: string;
  machine: MachineKind;
  inputs: Partial<Record<ItemKey, number>>;
  outputs: Partial<Record<ItemKey, number>>;
  /** Dauer eines Durchlaufs in Sekunden (ganze Ticks). */
  seconds: number;
  /** Von Spielbeginn an freigeschaltet (sonst per Forschung, ab Phase 6). */
  availableFromStart: boolean;
}

/**
 * Rezepte in fester Reihenfolge (Index = Rezept-ID im Spielstand). Neue Einträge hinten anhängen.
 */
export const RECIPES: readonly RecipeDef[] = [
  {
    key: 'copperIngot',
    machine: 'furnace',
    inputs: { copperOre: 1 },
    outputs: { copperIngot: 1 },
    seconds: 2,
    availableFromStart: true,
  },
  {
    key: 'stoneBrick',
    machine: 'furnace',
    inputs: { stone: 2 },
    outputs: { stoneBrick: 1 },
    seconds: 4,
    availableFromStart: true,
  },
  {
    key: 'charcoal',
    machine: 'furnace',
    inputs: { wood: 2 },
    outputs: { charcoal: 1 },
    seconds: 4,
    availableFromStart: false,
  },
  {
    key: 'plank',
    machine: 'workshop',
    inputs: { wood: 1 },
    outputs: { plank: 2 },
    seconds: 4,
    availableFromStart: true,
  },
  {
    key: 'copperWire',
    machine: 'workshop',
    inputs: { copperIngot: 1 },
    outputs: { copperWire: 2 },
    seconds: 4,
    availableFromStart: true,
  },
  {
    key: 'copperSheet',
    machine: 'workshop',
    inputs: { copperIngot: 2 },
    outputs: { copperSheet: 1 },
    seconds: 4,
    availableFromStart: false,
  },
  {
    key: 'frame',
    machine: 'assembler',
    inputs: { plank: 2, stoneBrick: 2 },
    outputs: { frame: 1 },
    seconds: 4,
    availableFromStart: false,
  },
  {
    key: 'coil',
    machine: 'assembler',
    inputs: { copperWire: 4, plank: 1 },
    outputs: { coil: 1 },
    seconds: 4,
    availableFromStart: false,
  },
  {
    key: 'circuit',
    machine: 'assembler',
    inputs: { copperSheet: 1, copperWire: 2 },
    outputs: { circuit: 1 },
    seconds: 4,
    availableFromStart: false,
  },
  {
    key: 'motor',
    machine: 'assembler',
    inputs: { frame: 1, coil: 1 },
    outputs: { motor: 1 },
    seconds: 8,
    availableFromStart: false,
  },
  {
    key: 'controlUnit',
    machine: 'assembler',
    inputs: { frame: 1, circuit: 1 },
    outputs: { controlUnit: 1 },
    seconds: 8,
    availableFromStart: false,
  },
  // Erweiterung nach Phase 7
  {
    key: 'ironIngot',
    machine: 'furnace',
    inputs: { ironOre: 1 },
    outputs: { ironIngot: 1 },
    seconds: 3,
    availableFromStart: false,
  },
  {
    key: 'glass',
    machine: 'furnace',
    inputs: { sand: 2 },
    outputs: { glass: 1 },
    seconds: 3,
    availableFromStart: false,
  },
  {
    key: 'gear',
    machine: 'workshop',
    inputs: { ironIngot: 1 },
    outputs: { gear: 1 },
    seconds: 2,
    availableFromStart: false,
  },
  {
    key: 'steel',
    machine: 'foundry',
    inputs: { ironIngot: 2, coal: 1 },
    outputs: { steel: 1 },
    seconds: 6,
    availableFromStart: false,
  },
  // Ausbaurunde Spielspaß: Endprodukte aus Eisen, Glas und Stahl
  {
    key: 'ironPlate',
    machine: 'workshop',
    inputs: { ironIngot: 2 },
    outputs: { ironPlate: 1 },
    seconds: 3,
    availableFromStart: false,
  },
  {
    key: 'lens',
    machine: 'workshop',
    inputs: { glass: 2 },
    outputs: { lens: 1 },
    seconds: 3,
    availableFromStart: false,
  },
  {
    key: 'clockwork',
    machine: 'assembler',
    inputs: { gear: 4, ironPlate: 1 },
    outputs: { clockwork: 1 },
    seconds: 6,
    availableFromStart: false,
  },
  {
    key: 'steelFrame',
    machine: 'assembler',
    inputs: { steel: 2, frame: 1 },
    outputs: { steelFrame: 1 },
    seconds: 6,
    availableFromStart: false,
  },
  {
    key: 'instrument',
    machine: 'assembler',
    inputs: { clockwork: 1, lens: 2 },
    outputs: { instrument: 1 },
    seconds: 10,
    availableFromStart: false,
  },
  // Ausbaurunde Gemütlichkeit: Backstube und Komposter
  {
    key: 'cake',
    machine: 'bakery',
    inputs: { apple: 2, honey: 1 },
    outputs: { cake: 1 },
    seconds: 6,
    availableFromStart: false,
  },
  {
    key: 'compost',
    machine: 'composter',
    inputs: { wood: 2 },
    outputs: { compost: 1 },
    seconds: 4,
    availableFromStart: true,
  },
  {
    key: 'compostVegetable',
    machine: 'composter',
    inputs: { vegetable: 2 },
    outputs: { compost: 1 },
    seconds: 4,
    availableFromStart: true,
  },
];

/** Eingänge, Ausgänge und Dauer in Ticks mit numerischen IDs (Index = Rezept-ID). */
export const RECIPE_INPUTS: readonly ItemAmount[][] = RECIPES.map((r) => toAmounts(r.inputs));
export const RECIPE_OUTPUTS: readonly ItemAmount[][] = RECIPES.map((r) => toAmounts(r.outputs));
export const RECIPE_TICKS: readonly number[] = RECIPES.map((r) =>
  Math.round(r.seconds * SIM_CONFIG.ticksPerSecond),
);

/** Höchstzahl an Eingängen bzw. Ausgängen eines Rezepts. */
export const MAX_RECIPE_INPUTS = 2;
export const MAX_RECIPE_OUTPUTS = 2;
