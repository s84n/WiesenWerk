import { describe, expect, it } from 'vitest';
import { BUILDING_ID } from '../src/data/buildings';
import { ITEM_ID } from '../src/data/items';
import { DEPOSITS, TileType, WORLD_GEN_VERSION } from '../src/data/world';
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
  sim.enqueue({ type: 'buildLine', building: B.beltMk1, path: line(mx, my + 2, 3) });
  sim.enqueue({ type: 'build', building: B.furnace, x: mx, y: my + 5, rot: 0 });
  sim.enqueue({ type: 'buildLine', building: B.beltMk1, path: line(mx, my + 7, 3) });
  sim.enqueue({ type: 'build', building: B.hq, x: mx - 1, y: my + 10, rot: 0 });
  sim.enqueue({ type: 'build', building: B.pole, x: mx + 2, y: my + 1, rot: 0 });
  sim.enqueue({ type: 'build', building: B.pole, x: mx + 2, y: my + 6, rot: 0 });
  sim.enqueue({ type: 'build', building: B.burner, x: mx + 3, y: my + 3, rot: 0 });
  sim.flushCommands();
  sim.enqueue({ type: 'refuel', building: sim.buildingAt(mx + 3, my + 3), item: ITEM_ID.wood });
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

  it('Version 7 → 8: Abstände auf Bändern verdoppeln sich, die Lage der Items bleibt', () => {
    const sim = new Simulation(generateWorld(4711, undefined, DEPOSITS));
    const { startX: x, startY: y } = sim.world;
    sim.enqueue({
      type: 'buildLine',
      building: BUILDING_ID.beltMk1,
      path: [0, 1, 2, 3, 4].map((k) => ({ x: x + 5 + k, y, dir: 1 })),
    });
    sim.flushCommands();
    const seg = sim.belts.tileSegment[sim.world.index(x + 5, y)];
    sim.belts.fill(seg, ITEM_ID.stone);
    for (let t = 0; t < 7; t++) sim.step();
    const v8 = serialize(sim, META, CAM);
    const v7 = JSON.parse(JSON.stringify(v8));
    v7.version = 7;
    v7.belts.segments = v7.belts.segments.map((s: number[]) =>
      s.map((v, k) => (k >= 5 && (k - 5) % 2 === 0 ? v / 2 : v)),
    );
    expect(migrate(v7)).toEqual(migrate(v8));
  });

  it('wandelt Spielstände der Versionen 1 bis 6 korrekt um', () => {
    // Eine Fabrik ohne Brenner mit vollem Tempo ergibt Werte, die sich verlustfrei zurückrechnen lassen.
    // Alte Spielstände stammen aus der Weltgenerierung Fassung 1.
    const sim = new Simulation(generateWorld(4711, undefined, DEPOSITS, 1));
    sim.power.factorOf = () => 1000;
    for (let i = 0; i < 14; i++) sim.inventory.add(i, 1000);
    const w = sim.world;
    for (let i = 0; i < w.tiles.length && sim.buildingCount === 0; i++) {
      if (w.resource[i] !== 2) continue;
      sim.enqueue({
        type: 'build',
        building: BUILDING_ID.miner,
        x: i % w.size,
        y: Math.floor(i / w.size),
        rot: 0,
      });
      sim.flushCommands();
    }
    sim.enqueue({ type: 'build', building: BUILDING_ID.furnace, x: w.startX, y: w.startY, rot: 0 });
    sim.flushCommands();
    const furnace = sim.buildingAt(w.startX, w.startY);
    sim.machines.accept(furnace, ITEM_ID.copperOre);
    sim.machines.accept(furnace, ITEM_ID.copperOre);
    for (let t = 0; t < 57; t++) sim.step(); // mitten in Durchläufen anhalten
    const v7 = serialize(sim, META, CAM);
    expect(sim.machines.progress[furnace]).toBeGreaterThan(0);
    expect(v7.worldGen).toBe(1);

    // Version 6 von Hand herstellen: ohne Uhrturm
    const v6 = JSON.parse(JSON.stringify(v7));
    v6.version = 6;
    delete v6.landmark;
    expect(migrate(v6)).toEqual(migrate(v7));
    expect(migrate(v6).landmark).toEqual({ stage: 0, delivered: {} });

    // Version 5 von Hand herstellen: ohne Fassung der Weltgenerierung
    const v5 = JSON.parse(JSON.stringify(v6));
    v5.version = 5;
    delete v5.worldGen;
    expect(migrate(v5)).toEqual(migrate(v6));

    // Version 4 von Hand herstellen: ohne Angabe der Vorkommen
    const v4 = JSON.parse(JSON.stringify(v5));
    v4.version = 4;
    delete v4.depositLayers;

    // Version 3 von Hand herstellen: Nachfüll-Schalter entfernen (es gibt hier keine Brenner)
    const v3 = JSON.parse(JSON.stringify(v4));
    v3.version = 3;
    v3.machines.data = [];
    for (let k = 0; k < v4.machines.data.length; k += 16)
      v3.machines.data.push(...v4.machines.data.slice(k, k + 15));

    // Version 2 von Hand herstellen: Forschung, Logistik, Statistik, Aufgaben und Stufe entfernen
    const v2 = JSON.parse(JSON.stringify(v3));
    v2.version = 2;
    for (const key of ['research', 'logistics', 'stats', 'goals']) delete v2[key];
    const data2: number[] = [];
    for (let k = 0; k < v3.machines.data.length; k += 15)
      data2.push(...v3.machines.data.slice(k, k + 14));
    v2.machines.data = data2;

    // Version 1: Strom-Felder entfernen, Fortschritt in ganzen Ticks
    const v1 = JSON.parse(JSON.stringify(v2));
    v1.version = 1;
    delete v1.machines.burners;
    const types = new Map<number, number>();
    for (let k = 0; k < v2.buildings.list.length; k += 5)
      types.set(v2.buildings.list[k], v2.buildings.list[k + 1]);
    const data1: number[] = [];
    for (let k = 0; k < data2.length; k += 14) {
      const rec = data2.slice(k, k + 11);
      const crafter = types.get(rec[0]) === BUILDING_ID.furnace;
      rec[2] = crafter ? (rec[2] === 0 ? 0 : (rec[2] - 1) / 1000 + 1) : rec[2] / 1000;
      data1.push(...rec);
    }
    v1.machines.data = data1;

    // Statistik und Aufgaben gab es vorher nicht; die Migration setzt Startwerte.
    const plain = (d: SaveData): SaveData => ({
      ...d,
      stats: { built: 0, produced: [], harvested: [] },
      goals: { done: [], hidden: false },
    });
    expect(migrate(v3)).toEqual(migrate(v4));
    expect(plain(migrate(v1))).toEqual(plain(migrate(v4)));
    expect(plain(migrate(v2))).toEqual(plain(migrate(v4)));
    expect(migrate(v2).stats.built).toBe(2);
    const loaded = deserialize(migrate(v1));
    expect(JSON.stringify(plain(serialize(loaded, META, CAM)))).toBe(
      JSON.stringify(plain(serialize(sim, META, CAM))),
    );
  });

  it('alte Spielstände behalten ihre Landschaft, neue Spiele haben weniger Wasser', () => {
    const water = (sim: Simulation): number =>
      sim.world.tiles.reduce((n, t) => n + (t === TileType.Water ? 1 : 0), 0);
    const old = new Simulation(generateWorld(4711, undefined, DEPOSITS, 1));
    const data = JSON.parse(JSON.stringify(serialize(old, META, CAM)));
    data.version = 5;
    delete data.worldGen;
    const loaded = deserialize(migrate(data));
    expect(loaded.world.genVersion).toBe(1);
    expect(water(loaded)).toBe(water(old));
    const fresh = new Simulation(generateWorld(4711));
    expect(fresh.world.genVersion).toBe(WORLD_GEN_VERSION);
    expect(water(fresh)).toBeLessThan(water(old) * 0.8);
    const again = deserialize(migrate(JSON.parse(JSON.stringify(serialize(fresh, META, CAM)))));
    expect(water(again)).toBe(water(fresh));
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
