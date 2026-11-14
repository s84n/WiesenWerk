import { describe, expect, it } from 'vitest';
import { BUILDING_ID } from '../src/data/buildings';
import { ITEM_ID } from '../src/data/items';
import { TileType } from '../src/data/world';
import { createStressSimulation } from '../src/dev/stress';
import {
  SAVE_VERSION,
  SaveError,
  deserialize,
  migrate,
  serialize,
  type SaveData,
} from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { generateWorld } from '../src/sim/worldgen';

const META = { name: 'Test', savedAt: 0 };
const CAM = [1, 2, 3, 4];

/** Vergleichbarer Zustand ohne Metadaten. */
function state(sim: Simulation): string {
  const d = serialize(sim, META, CAM);
  return JSON.stringify(d);
}

/** Eine kleine, laufende Fabrik auf einer echten Welt. */
function buildFactory(): Simulation {
  const sim = new Simulation(generateWorld(4711));
  const w = sim.world;
  for (let i = 0; i < 14; i++) sim.inventory.add(i, 1000);
  // Platz suchen: Kupfervorkommen mit freier Fläche darunter
  let mx = -1;
  let my = -1;
  const free = (x: number, y: number, dep: boolean): boolean => {
    if (!w.inBounds(x, y)) return false;
    const t = w.tiles[w.index(x, y)];
    return (
      w.building[w.index(x, y)] === 0 && (t === TileType.Meadow || (dep && t === TileType.Deposit))
    );
  };
  search: for (let y = 2; y < w.size - 16; y++)
    for (let x = 2; x < w.size - 4; x++) {
      if (w.resource[w.index(x, y)] !== 2) continue;
      let ok = true;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) ok &&= free(x + dx, y + dy, true);
      for (let k = 2; k < 5; k++) ok &&= free(x, y + k, true);
      for (let dy = 5; dy < 7; dy++)
        for (let dx = 0; dx < 2; dx++) ok &&= free(x + dx, y + dy, false);
      for (let k = 7; k < 10; k++) ok &&= free(x, y + k, true);
      for (let dy = 10; dy < 13; dy++)
        for (let dx = -1; dx < 2; dx++) ok &&= free(x + dx, y + dy, false);
      if (ok) {
        mx = x;
        my = y;
        break search;
      }
    }
  const B = BUILDING_ID;
  const line = (x: number, y: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({ x, y: y + i, dir: 2 }));
  sim.enqueue({ type: 'build', building: B.miner, x: mx, y: my, rot: 0 });
  sim.enqueue({ type: 'buildBelt', building: B.beltMk1, path: line(mx, my + 2, 3) });
  sim.enqueue({ type: 'build', building: B.furnace, x: mx, y: my + 5, rot: 0 });
  sim.enqueue({ type: 'buildBelt', building: B.beltMk1, path: line(mx, my + 7, 3) });
  sim.enqueue({ type: 'build', building: B.hq, x: mx - 1, y: my + 10, rot: 0 });
  // Holzfäller an den nächsten Wald, ein paar Bäume von Hand fällen, einen Ofen abreißen (freie ID)
  sim.enqueue({ type: 'build', building: B.furnace, x: w.startX - 3, y: w.startY - 3, rot: 1 });
  sim.flushCommands();
  sim.enqueue({ type: 'demolish', x: w.startX - 3, y: w.startY - 3 });
  sim.flushCommands();
  for (let i = 0; i < w.tiles.length && sim.trees.queueEntries().length < 6; i++) {
    if (w.tiles[i] === TileType.Forest)
      for (let k = 0; k < 4; k++)
        sim.enqueue({ type: 'harvest', x: i % w.size, y: Math.floor(i / w.size) });
    sim.flushCommands();
  }
  for (let t = 0; t < 1500; t++) sim.step();
  return sim;
}

describe('Speichern und Laden', () => {
  it('stellt eine laufende Fabrik exakt wieder her und spielt identisch weiter', () => {
    const original = buildFactory();
    expect(original.inventory.get(ITEM_ID.copperIngot)).toBeGreaterThan(1000);
    expect(original.itemCount).toBeGreaterThan(0);

    const data = serialize(original, META, CAM);
    const loaded = deserialize(migrate(JSON.parse(JSON.stringify(data))));
    expect(state(loaded)).toBe(state(original));

    // Beide 2000 Ticks weiterlaufen lassen: kein Unterschied
    for (let t = 0; t < 2000; t++) {
      original.step();
      loaded.step();
    }
    expect(state(loaded)).toBe(state(original));
  });

  it('übersteht Export und Import als gepackte Datei', async () => {
    const original = buildFactory();
    const json = JSON.stringify(serialize(original, META, CAM));
    const packed = await new Response(
      new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer();
    const unpacked = await new Response(
      new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')),
    ).text();
    const loaded = deserialize(migrate(JSON.parse(unpacked)));
    expect(state(loaded)).toBe(state(original));
    expect(packed.byteLength).toBeLessThan(json.length);
  });

  it('speichert gefällte Bäume, bebauten Wald und die Nachwachs-Warteschlange', () => {
    const original = buildFactory();
    const loaded = deserialize(migrate(serialize(original, META, CAM)));
    expect(Array.from(loaded.trees.wood)).toEqual(Array.from(original.trees.wood));
    expect(loaded.trees.queueEntries()).toEqual(original.trees.queueEntries());
  });

  it('bleibt für die Referenzfabrik unter 2 MB', () => {
    const { sim } = createStressSimulation(1);
    sim.world.generated = true; // Stresstest-Welt nur für die Größenmessung als speicherbar markieren
    for (let t = 0; t < 200; t++) sim.step();
    const json = JSON.stringify(serialize(sim, META, CAM));
    console.log(`Spielstand Referenzfabrik: ${(json.length / 1024).toFixed(0)} KB (ungepackt)`);
    expect(json.length).toBeLessThan(2 * 1024 * 1024);
  });

  it('meldet fremde, beschädigte und zu neue Dateien verständlich', () => {
    const good = serialize(buildFactory(), META, CAM);
    const code = (fn: () => unknown): string => {
      try {
        fn();
        return 'ok';
      } catch (e) {
        return e instanceof SaveError ? e.code : 'other';
      }
    };
    expect(code(() => migrate({ hallo: 'welt' }))).toBe('notWiesenwerk');
    expect(code(() => migrate(null))).toBe('notWiesenwerk');
    expect(code(() => migrate({ ...good, version: SAVE_VERSION + 1 }))).toBe('tooNew');
    expect(code(() => migrate({ ...good, inventory: 'viel' }))).toBe('damaged');
    expect(code(() => migrate({ ...good, size: 100 }))).toBe('damaged');
    const broken: SaveData = JSON.parse(JSON.stringify(good));
    broken.buildings.list[1] = 999; // unbekannter Gebäudetyp
    expect(code(() => deserialize(migrate(broken)))).toBe('damaged');
    const broken2: SaveData = JSON.parse(JSON.stringify(good));
    broken2.belts.segments[0][1] = 0; // Anfangsfeld passt nicht
    expect(code(() => deserialize(migrate(broken2)))).toBe('damaged');
  });

  it('verweigert das Speichern von Welten, die nicht aus einem Seed stammen', () => {
    const { sim } = createStressSimulation(0.05);
    expect(() => serialize(sim, META, CAM)).toThrow();
  });
});
