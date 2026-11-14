import { TREES } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { ITEM_COUNT } from '../data/items';
import { MAX_RECIPE_INPUTS, MAX_RECIPE_OUTPUTS } from '../data/recipes';
import { TileType } from '../data/world';
import { footprintH, footprintW } from './buildings';
import { Simulation } from './simulation';
import { generateWorld } from './worldgen';

/**
 * Spielstand ⇄ Simulation. Gespeichert werden nur Abweichungen vom erzeugten Gelände
 * sowie der vollständige Zustand von Gebäuden, Bändern und Vorrat – genug, um exakt
 * weiterzuspielen. Kein Browser-Zugriff: das Speichern in IndexedDB und Dateien
 * übernimmt `src/core/storage.ts`.
 */

export const SAVE_FORMAT = 'wiesenwerk';
/** Bei jeder Änderung am Format erhöhen und eine Migration in `MIGRATIONS` ergänzen. */
export const SAVE_VERSION = 2;

/**
 * Werte pro Maschine in `machines.data`:
 * id, Rezept, Fortschritt, Zustand, seit, Auslastung, Eingang 0/1, Ausgang 0/1, Baum-Zeiger,
 * Brennstoff-Art, Brennstoff-Energie, voller Stromverbrauch (ab Version 2).
 */
const MACHINE_FIELDS = 14;

export interface SaveMeta {
  name: string;
  /** Zeitpunkt des Speicherns (ms seit 1970). */
  savedAt: number;
}

export interface SaveData {
  format: typeof SAVE_FORMAT;
  version: number;
  meta: SaveMeta;
  seed: number;
  size: number;
  tick: number;
  /** Kamera: x, z, sichtbare Höhe, Winkel. */
  camera: number[];
  inventory: number[];
  /** Geänderte Felder: [Feld, Art, …] */
  tiles: number[];
  trees: { wood: number[]; queue: number[] };
  buildings: { highWater: number; free: number[]; list: number[] };
  machines: {
    crafters: number[];
    extractors: number[];
    burners: number[];
    data: number[];
    treeLists: number[][];
    delivered: number;
  };
  belts: { free: number[]; segments: number[][] };
}

/** Verständlicher Fehler beim Laden. `code` wählt den Text in `TEXTS.save.errors`. */
export class SaveError extends Error {
  constructor(
    readonly code: 'notJson' | 'notWiesenwerk' | 'tooNew' | 'damaged',
    detail = '',
  ) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
  }
}

// ------------------------------------------------------------------ Speichern

export function serialize(sim: Simulation, meta: SaveMeta, camera: number[]): SaveData {
  if (!sim.world.generated)
    throw new Error(
      'Diese Welt wurde nicht aus einem Seed erzeugt und kann nicht gespeichert werden.',
    );
  sim.flushCommands();
  const { world, buildings: b, machines: m, belts, trees } = sim;

  const tiles: number[] = [];
  for (const t of [...world.changedTiles].sort((a, c) => a - c)) tiles.push(t, world.tiles[t]);

  const wood: number[] = [];
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] === TileType.Forest && trees.wood[i] !== TREES.woodPerTree)
      wood.push(i, trees.wood[i]);
  }

  const list: number[] = [];
  const data: number[] = [];
  const treeLists: number[][] = [];
  for (let id = 0; id < b.highWater; id++) {
    if (!b.alive[id]) continue;
    list.push(id, b.type[id], b.x[id], b.y[id], b.rot[id]);
    if (sim.isBelt(id)) continue;
    data.push(
      id,
      m.recipe[id],
      m.progress[id],
      m.state[id],
      m.stateSince[id],
      m.utilization[id],
      m.inBuf[id * MAX_RECIPE_INPUTS],
      m.inBuf[id * MAX_RECIPE_INPUTS + 1],
      m.outBuf[id * MAX_RECIPE_OUTPUTS],
      m.outBuf[id * MAX_RECIPE_OUTPUTS + 1],
      m.treeCursor[id],
      m.fuelItem[id],
      m.fuelEnergy[id],
      m.drawFull[id],
    );
    const tl = m.treeLists[id];
    if (tl) treeLists.push([id, ...tl]);
  }

  const segments: number[][] = [];
  belts.segments.forEach((seg, id) => {
    if (!seg) return;
    const entry = [id, seg.tiles[0], seg.active, seg.count];
    for (let k = 0; k < seg.count; k++) {
      const idx = seg.ring(k);
      entry.push(seg.items[idx], seg.gaps[idx]);
    }
    segments.push(entry);
  });

  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    meta,
    seed: world.seed,
    size: world.size,
    tick: sim.tick,
    camera,
    inventory: Array.from(sim.inventory.amounts),
    tiles,
    trees: { wood, queue: trees.queueEntries() },
    buildings: { highWater: b.highWater, free: [...b.free], list },
    machines: {
      crafters: [...m.crafters],
      extractors: [...m.extractors],
      burners: [...m.burners],
      data,
      treeLists,
      delivered: m.delivered,
    },
    belts: { free: [...belts.freeSegmentIds], segments },
  };
}

// ------------------------------------------------------------------ Laden

/** Migrationen: Eintrag `n` macht aus einem Spielstand der Version n einen der Version n + 1. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  1: migrate1to2,
};

/**
 * Version 1 → 2 (Phase 5, Strom): Fortschritt wird in Tausendstel-Ticks gezählt, damit Maschinen
 * bei Strommangel langsamer laufen können; je Maschine kommen Brennstoff-Art, Brennstoff-Energie
 * und Stromverbrauch hinzu; es gibt eine Liste der Brenner.
 */
function migrate1to2(d: Record<string, unknown>): Record<string, unknown> {
  const machines = d.machines as Record<string, unknown> | undefined;
  const buildings = d.buildings as { list?: unknown } | undefined;
  if (!machines || !Array.isArray(machines.data) || !Array.isArray(buildings?.list)) {
    throw new SaveError('damaged', 'Migration 1');
  }
  const list = buildings.list as number[];
  const typeOf = new Map<number, number>();
  for (let k = 0; k + 4 < list.length; k += 5) typeOf.set(list[k], list[k + 1]);
  const old = machines.data as number[];
  const next: number[] = [];
  for (let k = 0; k + 10 < old.length; k += 11) {
    const rec = old.slice(k, k + 11);
    const kind = BUILDINGS[typeOf.get(rec[0]) ?? -1]?.behavior.kind;
    const p = rec[2];
    if (kind === 'crafter') rec[2] = p === 0 ? 0 : 1 + (p - 1) * 1000;
    else rec[2] = p * 1000;
    // Voller Stromverbrauch, wenn die Maschine gerade arbeitete (Zustand 1 = „Arbeitet“)
    next.push(...rec, -1, 0, rec[3] === 1 ? 1 : 0);
  }
  return { ...d, machines: { ...machines, data: next, burners: [] } };
}

/** Prüft Grundform und Version und bringt ältere Spielstände auf den aktuellen Stand. */
export function migrate(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) throw new SaveError('notWiesenwerk');
  let data = raw as Record<string, unknown>;
  if (data.format !== SAVE_FORMAT) throw new SaveError('notWiesenwerk');
  let version = data.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new SaveError('damaged', 'version');
  if (version > SAVE_VERSION) throw new SaveError('tooNew');
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveError('damaged', `Migration ${version}`);
    data = step(data);
    version++;
    data.version = version;
  }
  validate(data);
  return data as unknown as SaveData;
}

function validate(d: Record<string, unknown>): void {
  const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
  const nums = (v: unknown): boolean => Array.isArray(v) && v.every(num);
  const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const ok =
    num(d.seed) &&
    num(d.size) &&
    (d.size as number) % 16 === 0 &&
    (d.size as number) >= 16 &&
    (d.size as number) <= 2048 &&
    num(d.tick) &&
    nums(d.camera) &&
    nums(d.inventory) &&
    nums(d.tiles) &&
    obj(d.meta) &&
    obj(d.trees) &&
    nums(d.trees.wood) &&
    nums(d.trees.queue) &&
    obj(d.buildings) &&
    num(d.buildings.highWater) &&
    nums(d.buildings.free) &&
    nums(d.buildings.list) &&
    obj(d.machines) &&
    nums(d.machines.crafters) &&
    nums(d.machines.extractors) &&
    nums(d.machines.burners) &&
    nums(d.machines.data) &&
    Array.isArray(d.machines.treeLists) &&
    (d.machines.treeLists as unknown[]).every(nums) &&
    obj(d.belts) &&
    nums(d.belts.free) &&
    Array.isArray(d.belts.segments) &&
    (d.belts.segments as unknown[]).every(nums);
  if (!ok) throw new SaveError('damaged', 'Aufbau');
}

/** Baut aus einem (geprüften) Spielstand eine Simulation. Wirft `SaveError` bei Unstimmigkeiten. */
export function deserialize(data: SaveData): Simulation {
  try {
    return restore(data);
  } catch (err) {
    if (err instanceof SaveError) throw err;
    throw new SaveError('damaged', err instanceof Error ? err.message : String(err));
  }
}

function restore(d: SaveData): Simulation {
  const world = generateWorld(d.seed, d.size);
  const n = world.size * world.size;
  const tileOk = (t: number): boolean => Number.isInteger(t) && t >= 0 && t < n;

  for (let k = 0; k < d.tiles.length; k += 2) {
    if (!tileOk(d.tiles[k])) throw new SaveError('damaged', 'Feld');
    world.tiles[d.tiles[k]] = d.tiles[k + 1];
    world.changedTiles.add(d.tiles[k]);
  }

  const sim = new Simulation(world);
  sim.tick = d.tick;
  sim.inventory.amounts.fill(0);
  for (let i = 0; i < Math.min(ITEM_COUNT, d.inventory.length); i++)
    sim.inventory.amounts[i] = d.inventory[i];
  sim.inventory.version++;

  // Bäume
  for (let k = 0; k < d.trees.wood.length; k += 2) {
    if (!tileOk(d.trees.wood[k])) throw new SaveError('damaged', 'Baum');
    sim.trees.wood[d.trees.wood[k]] = d.trees.wood[k + 1];
  }
  sim.trees.restoreQueue(d.trees.queue);

  // Gebäude mit ihren ursprünglichen IDs
  const b = sim.buildings;
  const list = d.buildings.list;
  for (let k = 0; k < list.length; k += 5) {
    const [id, type, x, y, rot] = list.slice(k, k + 5);
    const def = BUILDINGS[type];
    if (!def) throw new SaveError('damaged', 'Gebäudetyp');
    b.restore(id, type, x, y, rot);
    for (let ty = y; ty < y + footprintH(def, rot); ty++) {
      for (let tx = x; tx < x + footprintW(def, rot); tx++) {
        if (!world.inBounds(tx, ty)) throw new SaveError('damaged', 'Gebäudeposition');
        world.building[world.index(tx, ty)] = id + 1;
      }
    }
    sim.typeCount[type]++;
  }
  b.highWater = Math.max(b.highWater, d.buildings.highWater);
  b.free.length = 0;
  b.free.push(...d.buildings.free);

  // Maschinen: Grunddaten neu berechnen, dann gespeicherten Zustand übernehmen
  const m = sim.machines;
  m.tick = d.tick;
  for (let id = 0; id < b.highWater; id++) if (b.alive[id] && !sim.isBelt(id)) m.added(id);
  m.crafters.length = 0;
  m.crafters.push(...d.machines.crafters);
  m.extractors.length = 0;
  m.extractors.push(...d.machines.extractors);
  m.burners.length = 0;
  m.burners.push(...d.machines.burners);
  const md = d.machines.data;
  for (let k = 0; k < md.length; k += MACHINE_FIELDS) {
    const id = md[k];
    if (!b.alive[id]) throw new SaveError('damaged', 'Maschine');
    m.recipe[id] = md[k + 1];
    m.progress[id] = md[k + 2];
    m.state[id] = md[k + 3];
    m.stateSince[id] = md[k + 4];
    m.utilization[id] = md[k + 5];
    m.inBuf[id * MAX_RECIPE_INPUTS] = md[k + 6];
    m.inBuf[id * MAX_RECIPE_INPUTS + 1] = md[k + 7];
    m.outBuf[id * MAX_RECIPE_OUTPUTS] = md[k + 8];
    m.outBuf[id * MAX_RECIPE_OUTPUTS + 1] = md[k + 9];
    m.treeCursor[id] = md[k + 10];
    m.fuelItem[id] = md[k + 11];
    m.fuelEnergy[id] = md[k + 12];
    m.drawFull[id] = md[k + 13];
  }
  for (const [id, ...tiles] of d.machines.treeLists) m.treeLists[id] = Int32Array.from(tiles);
  m.delivered = d.machines.delivered;

  // Bänder: Segmente neu bilden, IDs zuordnen, Items einsetzen
  const belts = sim.belts;
  belts.rebuildAll();
  belts.remapSegments(
    d.belts.segments.map((s) => ({ id: s[0], start: s[1] })),
    d.belts.free,
  );
  let items = 0;
  for (const s of d.belts.segments) {
    const seg = belts.segments[s[0]];
    if (!seg || seg.tiles[0] !== s[1]) throw new SaveError('damaged', 'Bandsegment');
    const count = s[3];
    if (count > seg.capacity) throw new SaveError('damaged', 'Bandinhalt');
    seg.head = 0;
    seg.count = count;
    seg.total = 0;
    for (let k = 0; k < count; k++) {
      seg.items[k] = s[4 + k * 2];
      seg.gaps[k] = s[5 + k * 2];
      seg.total += seg.gaps[k];
    }
    if (seg.total > seg.lengthUnits) throw new SaveError('damaged', 'Bandabstände');
    seg.active = s[2];
    items += count;
  }
  belts.itemCount = items;
  return sim;
}
