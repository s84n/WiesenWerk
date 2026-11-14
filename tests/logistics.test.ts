import { describe, expect, it } from 'vitest';
import { ITEM_ID } from '../src/data/items';
import { PlaceResult } from '../src/sim/placement';
import { B, belt, beltOf, build, line, makePoweredSim, run, unlockAll } from './helpers';

const ORE = ITEM_ID.copperOre;
const STONE = ITEM_ID.stone;

const makeSim = (size = 32) => unlockAll(makePoweredSim(size));

/** Items auf dem Segment, das am Feld (x, y) liegt. */
function itemsAt(sim: ReturnType<typeof makeSim>, x: number, y: number): number[] {
  const seg = sim.belts.segments[sim.belts.tileSegment[sim.world.index(x, y)]];
  if (!seg) return [];
  const out: number[] = [];
  for (let k = 0; k < seg.count; k++) out.push(seg.items[seg.ring(k)]);
  return out;
}

describe('Bandstufen', () => {
  it('Mk2 und Mk3 transportieren 120 und 240 Items pro Minute', () => {
    for (const [type, expected] of [
      [B.beltMk2, 120],
      [B.beltMk3, 240],
    ] as const) {
      const sim = makeSim(64);
      beltOf(sim, type, line(2, 2, 2, 40));
      build(sim, B.hq, 1, 42);
      sim.belts.fill(sim.belts.tileSegment[sim.world.index(2, 2)], ORE);
      const before = sim.inventory.get(ORE);
      run(sim, 300); // 15 Sekunden (das Band fasst nur 80 Items)
      const delivered = sim.inventory.get(ORE) - before;
      expect(delivered).toBeGreaterThanOrEqual(expected / 4 - 1);
      expect(delivered).toBeLessThanOrEqual(expected / 4 + 1);
    }
  });

  it('trennt Segmente an Stufenwechseln, Items fahren trotzdem weiter', () => {
    const sim = makeSim();
    belt(sim, line(2, 2, 2, 4)); // Mk1 (2,2)–(2,5)
    beltOf(sim, B.beltMk2, line(2, 6, 2, 4)); // Mk2 (2,6)–(2,9)
    expect(sim.belts.segmentCount).toBe(2);
    build(sim, B.hq, 1, 10);
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(2, 2)], ORE);
    const before = sim.inventory.get(ORE);
    run(sim, 400);
    expect(sim.inventory.get(ORE) - before).toBeGreaterThan(5);
  });

  it('wertet ein Band durch Überbauen auf: Items bleiben, Kosten werden verrechnet', () => {
    const sim = makeSim();
    belt(sim, line(2, 2, 2, 5));
    const seg = sim.belts.tileSegment[sim.world.index(2, 2)];
    sim.belts.fill(seg, ORE);
    const items = sim.belts.itemCount;
    const wood = sim.inventory.get(ITEM_ID.wood);
    const sheet = sim.inventory.get(ITEM_ID.copperSheet);
    beltOf(sim, B.beltMk2, line(2, 2, 2, 5));
    expect(sim.belts.itemCount).toBe(items);
    expect(sim.typeCount[B.beltMk2]).toBe(5);
    expect(sim.typeCount[B.beltMk1]).toBe(0);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood + 5);
    expect(sim.inventory.get(ITEM_ID.copperSheet)).toBe(sheet - 5);
    expect(sim.belts.segments[sim.belts.tileSegment[sim.world.index(2, 2)]]!.speed).toBe(6);
  });

  it('erlaubt gesperrte Gebäude erst nach der Forschung', () => {
    const sim = makePoweredSim();
    build(sim, B.merger, 3, 3);
    expect(sim.buildingCount).toBe(0);
    const failed = sim.events.find((e) => e.type === 'commandFailed');
    expect(failed && failed.type === 'commandFailed' && failed.reason).toBe(PlaceResult.Locked);
  });
});

describe('Verteiler, Zusammenführer, Brücke und Lager', () => {
  it('Verteiler gibt reihum auf alle drei Ausgänge ab', () => {
    const sim = makeSim();
    belt(sim, line(5, 1, 2, 4)); // (5,1)–(5,4) nach Süden in den Verteiler
    build(sim, B.splitter, 5, 5);
    belt(sim, line(4, 5, 3, 3)); // West
    belt(sim, line(5, 6, 2, 3)); // Süd
    belt(sim, line(6, 5, 1, 3)); // Ost
    const seg = sim.belts.tileSegment[sim.world.index(5, 1)];
    sim.belts.fill(seg, ORE);
    run(sim, 300);
    const w = itemsAt(sim, 4, 5).length;
    const s = itemsAt(sim, 5, 6).length;
    const e = itemsAt(sim, 6, 5).length;
    expect(w).toBeGreaterThan(2);
    expect(Math.max(w, s, e) - Math.min(w, s, e)).toBeLessThanOrEqual(1);
  });

  it('Verteiler nutzt freie Ausgänge, wenn einer verstopft ist', () => {
    const sim = makeSim();
    belt(sim, line(5, 1, 2, 14));
    build(sim, B.splitter, 5, 15);
    belt(sim, line(4, 15, 3, 1)); // West: nur 1 Feld, ist schnell voll
    belt(sim, line(6, 15, 1, 8)); // Ost; Süden hat kein Band
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(5, 1)], ORE);
    run(sim, 600);
    expect(itemsAt(sim, 4, 15).length).toBe(3);
    expect(itemsAt(sim, 6, 15).length).toBeGreaterThan(12);
  });

  it('Zusammenführer nimmt reihum von seinen Eingängen', () => {
    const sim = makeSim(48);
    belt(sim, line(1, 15, 1, 14)); // von Westen nach Osten
    belt(sim, line(15, 1, 2, 14)); // von Norden nach Süden
    build(sim, B.merger, 15, 15);
    belt(sim, line(15, 16, 2, 4));
    build(sim, B.hq, 14, 20);
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(1, 15)], ORE);
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(15, 1)], STONE);
    const ore = sim.inventory.get(ORE);
    const stone = sim.inventory.get(STONE);
    run(sim, 1000);
    const dOre = sim.inventory.get(ORE) - ore;
    const dStone = sim.inventory.get(STONE) - stone;
    expect(dOre + dStone).toBeGreaterThan(20);
    expect(Math.abs(dOre - dStone)).toBeLessThanOrEqual(1);
  });

  it('Bandbrücke lässt zwei Bänder kreuzen, ohne dass sich Items mischen', () => {
    const sim = makeSim();
    belt(sim, line(5, 1, 2, 4)); // Nord → Süd
    belt(sim, line(1, 5, 1, 4)); // West → Ost
    build(sim, B.bridge, 5, 5);
    belt(sim, line(5, 6, 2, 6));
    belt(sim, line(6, 5, 1, 6));
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(5, 1)], ORE);
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(1, 5)], STONE);
    run(sim, 600);
    const south = itemsAt(sim, 5, 6);
    const east = itemsAt(sim, 6, 5);
    expect(south.length).toBeGreaterThan(3);
    expect(east.length).toBeGreaterThan(3);
    expect(south.every((i) => i === ORE)).toBe(true);
    expect(east.every((i) => i === STONE)).toBe(true);
  });

  it('Lager puffert in Ankunftsreihenfolge und gibt beim Abriss alles zurück', () => {
    const sim = makeSim();
    belt(sim, line(3, 1, 2, 2)); // (3,1)–(3,2) in den Eingang oben links
    build(sim, B.storage, 3, 3);
    // Zuerst Erz, dann Stein
    for (let k = 0; k < 5; k++) sim.logistics.accept(sim.buildingAt(3, 3), ORE, 0);
    for (let k = 0; k < 5; k++) sim.logistics.accept(sim.buildingAt(3, 3), STONE, 0);
    const id = sim.buildingAt(3, 3);
    expect(sim.logistics.qCount[id]).toBe(10);
    belt(sim, line(3, 5, 2, 12));
    run(sim, 300);
    expect(itemsAt(sim, 3, 5)).toEqual([
      ORE,
      ORE,
      ORE,
      ORE,
      ORE,
      STONE,
      STONE,
      STONE,
      STONE,
      STONE,
    ]);

    // Voll: nimmt nichts mehr an
    for (let k = 0; k < 1000; k++) sim.logistics.accept(id, ORE, 0);
    expect(sim.logistics.qCount[id]).toBe(1000);
    expect(sim.logistics.accept(id, ORE, 0)).toBe(false);
    const ore = sim.inventory.get(ORE);
    sim.enqueue({ type: 'demolish', x: 3, y: 3 });
    sim.flushCommands();
    expect(sim.inventory.get(ORE) - ore).toBe(1000);
  });
});

describe('Depots und Lager-Varianten', () => {
  it('Depot zahlt alles direkt in den Vorrat ein (ab Spielbeginn)', () => {
    const sim = makePoweredSim();
    belt(sim, line(5, 1, 2, 3)); // (5,1)–(5,3) nach Süden in den Eingang oben links
    build(sim, B.depot, 5, 4);
    expect(sim.buildingCount).toBe(4);
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(5, 1)], ORE);
    const before = sim.inventory.get(ORE);
    run(sim, 400);
    expect(sim.inventory.get(ORE) - before).toBeGreaterThanOrEqual(5);
  });

  it('Verteillager gibt abwechselnd an zwei Ausgänge ab, Sammellager nimmt von zwei Eingängen', () => {
    const sim = makeSim();
    build(sim, B.storageSplit, 4, 4);
    const id = sim.buildingAt(4, 4);
    for (let k = 0; k < 20; k++) sim.logistics.accept(id, ORE, 0);
    belt(sim, line(4, 6, 2, 6));
    belt(sim, line(5, 6, 2, 6));
    run(sim, 200);
    const a = itemsAt(sim, 4, 6).length;
    const b = itemsAt(sim, 5, 6).length;
    expect(a).toBeGreaterThan(3);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

    build(sim, B.storageMerge, 10, 4);
    const m = sim.buildingAt(10, 4);
    expect(sim.logistics.accept(m, ORE, 0)).toBe(true);
    expect(sim.logistics.accept(m, STONE, 1)).toBe(true);
    expect(sim.logistics.qCount[m]).toBe(2);
  });

  it('Großlager fasst 5.000 Items', () => {
    const sim = makeSim();
    build(sim, B.storageLarge, 4, 4);
    const id = sim.buildingAt(4, 4);
    for (let k = 0; k < 5100; k++) sim.logistics.accept(id, ORE, k % 2);
    expect(sim.logistics.qCount[id]).toBe(5000);
  });
});
