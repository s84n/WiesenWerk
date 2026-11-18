import { TREES } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { GOALS } from '../data/goals';
import { ITEM_COUNT } from '../data/items';
import { MAX_RECIPE_INPUTS, MAX_RECIPE_OUTPUTS } from '../data/recipes';
import { DEPOSITS, TileType } from '../data/world';
import { footprintH, footprintW } from './buildings';
import { LogisticsSystem, MAX_PORTS } from './logistics';
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
export const SAVE_VERSION = 9;

/**
 * Werte pro Maschine in `machines.data`:
 * id, Rezept, Fortschritt, Zustand, seit, Auslastung, Eingang 0/1, Ausgang 0/1, Baum-Zeiger,
 * Brennstoff-Art, Brennstoff-Energie, voller Stromverbrauch (ab Version 2), Stufe 2 (ab Version 3),
 * Brenner füllt aus dem Vorrat nach (ab Version 4).
 */
const MACHINE_FIELDS = 16;
/** Werte pro Logistik-Gebäude in `logistics.data`: id, Zeiger, Puffer 0..2. */
const LOGISTICS_FIELDS = 2 + MAX_PORTS;

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
  /**
   * Ab Version 5: so viele Vorkommen (`DEPOSITS`) gab es beim Anlegen des Spiels. Neuere
   * Vorkommen werden unter bestehenden Gebäuden beim Laden wieder zu Wiese.
   */
  depositLayers: number;
  /** Ab Version 6: Fassung der Weltgenerierung (`WORLD_GEN_VERSION`), ältere Stände: 1. */
  worldGen: number;
  tick: number;
  /** Kamera: x, z, sichtbare Höhe, Winkel. */
  camera: number[];
  inventory: number[];
  /** Geänderte Felder: [Feld, Art, …] */
  tiles: number[];
  trees: { wood: number[]; queue: number[] };
  /** `built` (ab Version 9): Bau-Tick je Eintrag in `list`, in derselben Reihenfolge. */
  buildings: { highWater: number; free: number[]; list: number[]; built: number[] };
  machines: {
    crafters: number[];
    extractors: number[];
    burners: number[];
    data: number[];
    treeLists: number[][];
    delivered: number;
  };
  belts: { free: number[]; segments: number[][] };
  /** Ab Version 3. */
  research: { done: string[]; levels: Record<string, number> };
  logistics: {
    /** Reihenfolge der Listen: Verteiler, Zusammenführer, Brücken, Lager. */
    lists: number[][];
    data: number[];
    /** Lager: [id, Items in Reihenfolge …] */
    storage: number[][];
  };
  stats: { built: number; produced: number[]; harvested: number[] };
  goals: { done: string[]; hidden: boolean };
  /** Ab Version 7: Uhrturm (fertige Abschnitte, Geliefertes für den aktuellen nach Item-Schlüssel). */
  landmark: { stage: number; delivered: Record<string, number> };
  /** Ab Version 9: Hecken und Rosenbögen über Bändern: [Feld, Gebäudetyp, …]. */
  covers: number[];
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
  const built: number[] = [];
  const data: number[] = [];
  const treeLists: number[][] = [];
  const lg = sim.logistics;
  const logData: number[] = [];
  const storage: number[][] = [];
  for (let id = 0; id < b.highWater; id++) {
    if (!b.alive[id]) continue;
    list.push(id, b.type[id], b.x[id], b.y[id], b.rot[id]);
    built.push(b.built[id]);
    const kind = BUILDINGS[b.type[id]].behavior.kind;
    if (kind === 'belt' || kind === 'decor' || kind === 'beehive') continue;
    if (LogisticsSystem.handles(kind)) {
      logData.push(id, lg.cursor[id]);
      for (let j = 0; j < MAX_PORTS; j++) logData.push(lg.buf[id * MAX_PORTS + j]);
      if (kind === 'storage') storage.push([id, ...lg.storageItems(id)]);
      continue;
    }
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
      m.upgraded[id],
      m.autoRefill[id],
    );
    const tl = m.treeLists[id];
    if (tl) treeLists.push([id, ...tl]);
  }

  const covers: number[] = [];
  for (let t = 0; t < sim.covers.length; t++)
    if (sim.covers[t] > 0) covers.push(t, sim.covers[t] - 1);

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
    depositLayers: DEPOSITS.length,
    worldGen: world.genVersion,
    tick: sim.tick,
    camera,
    inventory: Array.from(sim.inventory.amounts),
    tiles,
    trees: { wood, queue: trees.queueEntries() },
    buildings: { highWater: b.highWater, free: [...b.free], list, built },
    machines: {
      crafters: [...m.crafters],
      extractors: [...m.extractors],
      burners: [...m.burners],
      data,
      treeLists,
      delivered: m.delivered,
    },
    belts: { free: [...belts.freeSegmentIds], segments },
    research: { done: sim.research.doneKeys(), levels: sim.research.levelMap() },
    logistics: {
      lists: [[...lg.splitters], [...lg.mergers], [...lg.bridges], [...lg.storages]],
      data: logData,
      storage,
    },
    stats: {
      built: sim.stats.buildingsBuilt,
      produced: Array.from(sim.stats.totalProduced),
      harvested: Array.from(sim.stats.harvested),
    },
    goals: { done: sim.goals.doneKeys(), hidden: sim.goals.hidden },
    landmark: { stage: sim.landmark.stage, delivered: sim.landmark.deliveredMap() },
    covers,
  };
}

// ------------------------------------------------------------------ Laden

/** Migrationen: Eintrag `n` macht aus einem Spielstand der Version n einen der Version n + 1. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  1: migrate1to2,
  2: migrate2to3,
  3: migrate3to4,
  4: migrate4to5,
  5: migrate5to6,
  6: migrate6to7,
  7: migrate7to8,
  8: migrate8to9,
};

/**
 * Version 8 → 9: Gebäude merken sich ihren Bau-Tick (sie bewachsen mit der Zeit), neu sind
 * Hecken und Rosenbögen über Bändern. Ältere Gebäude gelten als zu Spielbeginn gebaut.
 */
function migrate8to9(d: Record<string, unknown>): Record<string, unknown> {
  const buildings = d.buildings as { list?: unknown } | undefined;
  if (!buildings || !Array.isArray(buildings.list)) throw new SaveError('damaged', 'Migration 8');
  const built = new Array<number>(buildings.list.length / 5).fill(0);
  return { ...d, buildings: { ...buildings, built }, covers: [] };
}

/**
 * Version 7 → 8: Bänder rechnen in 240 statt 120 Einheiten je Feld (damit Mk1 0,75 Felder/s
 * fahren kann). Die Abstände der Items auf den Bändern verdoppeln sich, ihre Lage bleibt gleich.
 */
function migrate7to8(d: Record<string, unknown>): Record<string, unknown> {
  const belts = d.belts as { segments?: unknown } | undefined;
  if (!belts || !Array.isArray(belts.segments)) throw new SaveError('damaged', 'Migration 7');
  const segments = (belts.segments as number[][]).map((s) =>
    s.map((v, k) => (k >= 5 && (k - 5) % 2 === 0 ? v * 2 : v)),
  );
  return { ...d, belts: { ...belts, segments } };
}

/** Version 6 → 7: neu ist der Uhrturm; ältere Spielstände fangen bei ihm von vorn an. */
function migrate6to7(d: Record<string, unknown>): Record<string, unknown> {
  return { ...d, landmark: { stage: 0, delivered: {} } };
}

/**
 * Version 5 → 6: Die Weltgenerierung hat Fassungen (weniger Wasser ab Fassung 2). Ältere
 * Spielstände wurden mit Fassung 1 erzeugt und behalten so ihre Landschaft.
 */
function migrate5to6(d: Record<string, unknown>): Record<string, unknown> {
  return { ...d, worldGen: 1 };
}

/**
 * Version 4 → 5: neue Vorkommen (Eisen, Kohle, Sand). Ältere Spielstände kannten nur Stein und
 * Kupfer; die neuen Vorkommen erscheinen beim Laden auf freier Wiese und im Wald, unter
 * bestehenden Gebäuden bleibt Wiese.
 */
function migrate4to5(d: Record<string, unknown>): Record<string, unknown> {
  return { ...d, depositLayers: 2 };
}

/**
 * Version 3 → 4: Brenner können sich selbst aus dem Vorrat nachfüllen. Bestehende Brenner
 * bleiben, wie sie waren (aus), damit sich laufende Fabriken nicht unbemerkt ändern.
 */
function migrate3to4(d: Record<string, unknown>): Record<string, unknown> {
  const machines = d.machines as Record<string, unknown> | undefined;
  if (!machines || !Array.isArray(machines.data)) throw new SaveError('damaged', 'Migration 3');
  const old = machines.data as number[];
  const next: number[] = [];
  for (let k = 0; k + 14 < old.length; k += 15) next.push(...old.slice(k, k + 15), 0);
  return { ...d, machines: { ...machines, data: next } };
}

/**
 * Version 2 → 3 (Phase 6, Forschung und Ausbau): je Maschine kommt die Stufe hinzu (alle 1);
 * neu sind Forschung, Logistik-Gebäude, Statistik und die Aufgabenliste.
 * Bisherige Spielstände haben das Startgebiet schon hinter sich: Die Sammel-Aufgaben gelten als
 * erledigt, alle anderen prüft das Spiel beim nächsten Tick selbst.
 */
function migrate2to3(d: Record<string, unknown>): Record<string, unknown> {
  const machines = d.machines as Record<string, unknown> | undefined;
  const buildings = d.buildings as { list?: unknown } | undefined;
  if (!machines || !Array.isArray(machines.data) || !Array.isArray(buildings?.list)) {
    throw new SaveError('damaged', 'Migration 2');
  }
  const old = machines.data as number[];
  const next: number[] = [];
  for (let k = 0; k + 13 < old.length; k += 14) next.push(...old.slice(k, k + 14), 0);
  const count = (buildings.list as number[]).length / 5;
  return {
    ...d,
    machines: { ...machines, data: next },
    research: { done: [], levels: {} },
    logistics: { lists: [[], [], [], []], data: [], storage: [] },
    stats: {
      built: count,
      produced: new Array<number>(ITEM_COUNT).fill(0),
      harvested: new Array<number>(ITEM_COUNT).fill(0),
    },
    goals: {
      done: count > 0 ? GOALS.filter((g) => g.condition.kind === 'harvest').map((g) => g.key) : [],
      hidden: false,
    },
  };
}

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
    num(d.depositLayers) &&
    num(d.worldGen) &&
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
    nums(d.buildings.built) &&
    (d.buildings.built as number[]).length * 5 === (d.buildings.list as number[]).length &&
    nums(d.covers) &&
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
    (d.belts.segments as unknown[]).every(nums) &&
    obj(d.research) &&
    Array.isArray(d.research.done) &&
    d.research.done.every((k) => typeof k === 'string') &&
    obj(d.research.levels) &&
    obj(d.logistics) &&
    Array.isArray(d.logistics.lists) &&
    d.logistics.lists.length === 4 &&
    (d.logistics.lists as unknown[]).every(nums) &&
    nums(d.logistics.data) &&
    Array.isArray(d.logistics.storage) &&
    (d.logistics.storage as unknown[]).every(nums) &&
    obj(d.stats) &&
    num(d.stats.built) &&
    nums(d.stats.produced) &&
    nums(d.stats.harvested) &&
    obj(d.goals) &&
    Array.isArray(d.goals.done) &&
    typeof d.goals.hidden === 'boolean' &&
    obj(d.landmark) &&
    num(d.landmark.stage) &&
    obj(d.landmark.delivered) &&
    Object.values(d.landmark.delivered).every(num);
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
  const world = generateWorld(d.seed, d.size, DEPOSITS, d.worldGen);
  const n = world.size * world.size;
  const tileOk = (t: number): boolean => Number.isInteger(t) && t >= 0 && t < n;

  for (let k = 0; k < d.tiles.length; k += 2) {
    if (!tileOk(d.tiles[k])) throw new SaveError('damaged', 'Feld');
    const t = d.tiles[k];
    world.tiles[t] = d.tiles[k + 1];
    world.changedTiles.add(t);
    if (world.tiles[t] !== TileType.Deposit) {
      world.resource[t] = 0;
      world.purity[t] = 0;
    }
  }

  const sim = new Simulation(world);
  sim.tick = d.tick;
  // Forschung zuerst: sie bestimmt, welche Rezepte und Tempo-Faktoren gelten
  sim.research.restore(d.research.done, d.research.levels);
  sim.inventory.amounts.fill(0);
  for (let i = 0; i < Math.min(ITEM_COUNT, d.inventory.length); i++)
    sim.inventory.amounts[i] = d.inventory[i];
  sim.inventory.flowIn.fill(0); // Laden ist kein Zufluss
  sim.inventory.flowOut.fill(0);
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
    b.restore(id, type, x, y, rot, d.buildings.built[k / 5]);
    for (let ty = y; ty < y + footprintH(def, rot); ty++) {
      for (let tx = x; tx < x + footprintW(def, rot); tx++) {
        if (!world.inBounds(tx, ty)) throw new SaveError('damaged', 'Gebäudeposition');
        const t = world.index(tx, ty);
        world.building[t] = id + 1;
        // Vorkommen, die es beim Anlegen des Spiels noch nicht gab, nicht unter Gebäude schieben
        if (world.resource[t] > d.depositLayers && def.placement !== 'groundOrDeposit') {
          world.tiles[t] = TileType.Meadow;
          world.resource[t] = 0;
          world.purity[t] = 0;
          world.changedTiles.add(t);
        }
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
  const lg = sim.logistics;
  for (let id = 0; id < b.highWater; id++) {
    if (!b.alive[id] || sim.isBelt(id)) continue;
    m.added(id);
    lg.added(id);
  }
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
    m.upgraded[id] = md[k + 14];
    m.autoRefill[id] = md[k + 15];
  }
  for (const [id, ...tiles] of d.machines.treeLists) m.treeLists[id] = Int32Array.from(tiles);
  m.delivered = d.machines.delivered;

  // Logistik: Listen in gespeicherter Reihenfolge, Puffer und Lagerinhalt
  const lists = [lg.splitters, lg.mergers, lg.bridges, lg.storages];
  d.logistics.lists.forEach((saved, i) => {
    for (const id of saved) if (!b.alive[id]) throw new SaveError('damaged', 'Logistik');
    lists[i].length = 0;
    lists[i].push(...saved);
  });
  const ld = d.logistics.data;
  for (let k = 0; k < ld.length; k += LOGISTICS_FIELDS) {
    const id = ld[k];
    if (!b.alive[id]) throw new SaveError('damaged', 'Logistik');
    lg.cursor[id] = ld[k + 1];
    for (let j = 0; j < MAX_PORTS; j++) lg.buf[id * MAX_PORTS + j] = ld[k + 2 + j];
  }
  for (const [id, ...items] of d.logistics.storage) lg.restoreStorage(id, items);

  // Statistik und Aufgaben
  sim.stats.buildingsBuilt = d.stats.built;
  for (let i = 0; i < Math.min(ITEM_COUNT, d.stats.produced.length); i++)
    sim.stats.totalProduced[i] = d.stats.produced[i];
  for (let i = 0; i < Math.min(ITEM_COUNT, d.stats.harvested.length); i++)
    sim.stats.harvested[i] = d.stats.harvested[i];
  sim.goals.restore(d.goals.done, d.goals.hidden);
  sim.landmark.restore(d.landmark.stage, d.landmark.delivered);

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

  // Hecken und Rosenbögen (nur über Bändern)
  for (let k = 0; k < d.covers.length; k += 2) {
    const t = d.covers[k];
    const type = d.covers[k + 1];
    if (!tileOk(t) || BUILDINGS[type]?.behavior.kind !== 'cover' || sim.belts.beltAt(t) < 0)
      throw new SaveError('damaged', 'Hecke');
    sim.covers[t] = type + 1;
  }
  return sim;
}
