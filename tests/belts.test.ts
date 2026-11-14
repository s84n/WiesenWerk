import { describe, expect, it } from 'vitest';
import { ITEM_ID } from '../src/data/items';
import { B, belt, build, line, makePoweredSim as makeSim, run } from './helpers';

const ORE = ITEM_ID.copperOre;

describe('Bandsegmente', () => {
  it('fasst zusammenhängende Bandfelder zu einem Segment zusammen', () => {
    const sim = makeSim();
    belt(sim, line(2, 2, 2, 5));
    expect(sim.belts.segmentCount).toBe(1);
    // getrenntes Band daneben ist ein eigenes Segment
    belt(sim, line(10, 2, 2, 3));
    expect(sim.belts.segmentCount).toBe(2);
  });

  it('verbindet Segmente, wenn die Lücke geschlossen wird, und trennt sie beim Abriss', () => {
    const sim = makeSim();
    belt(sim, line(2, 2, 2, 3)); // (2,2)–(2,4)
    belt(sim, line(2, 6, 2, 3)); // (2,6)–(2,8)
    expect(sim.belts.segmentCount).toBe(2);
    belt(sim, line(2, 5, 2, 1));
    expect(sim.belts.segmentCount).toBe(1);
    sim.enqueue({ type: 'demolish', x: 2, y: 5 });
    sim.flushCommands();
    expect(sim.belts.segmentCount).toBe(2);
  });

  it('erkennt Kurven: ein seitlich zulaufendes Band setzt das Segment fort', () => {
    const sim = makeSim();
    belt(sim, [...line(2, 2, 1, 3), ...line(5, 2, 2, 3)]); // nach Osten, dann nach Süden
    expect(sim.belts.segmentCount).toBe(1);
    const seg = sim.belts.segments.find((s) => s)!;
    expect(seg.length).toBe(6);
    expect(sim.belts.entryDir(sim.world.index(5, 2))).toBe(1); // betritt die Ecke nach Osten fahrend
  });

  it('transportiert höchstens 60 Items pro Minute (Band Mk1)', () => {
    const sim = makeSim(64);
    belt(sim, line(2, 2, 2, 40)); // (2,2)–(2,41)
    build(sim, B.hq, 1, 42); // Eingang Norden bei (2,42)
    const id = sim.belts.tileSegment[sim.world.index(2, 2)];
    sim.belts.fill(id, ORE);
    const before = sim.inventory.get(ORE);
    run(sim, 1200); // 60 Sekunden
    const delivered = sim.inventory.get(ORE) - before;
    expect(delivered).toBeGreaterThanOrEqual(58);
    expect(delivered).toBeLessThanOrEqual(61);
  });

  it('staut Items am Ende ohne Ziel, ohne welche zu verlieren', () => {
    const sim = makeSim();
    belt(sim, line(2, 2, 2, 4));
    const id = sim.belts.tileSegment[sim.world.index(2, 2)];
    sim.belts.fill(id, ORE);
    const count = sim.belts.itemCount;
    run(sim, 2000);
    expect(sim.belts.itemCount).toBe(count);
    const seg = sim.belts.segments[id]!;
    expect(seg.gaps[seg.head]).toBe(0); // vorderstes Item steht am Ende
    expect(seg.active).toBe(seg.count); // nichts bewegt sich mehr
  });

  it('erstattet Items auf abgerissenen Bandfeldern', () => {
    const sim = makeSim();
    belt(sim, line(2, 2, 2, 4));
    const id = sim.belts.tileSegment[sim.world.index(2, 2)];
    sim.belts.fill(id, ORE);
    const onBelt = sim.belts.itemCount;
    const before = sim.inventory.get(ORE);
    sim.enqueue({ type: 'demolishArea', x0: 2, y0: 2, x1: 2, y1: 5 });
    sim.flushCommands();
    expect(sim.belts.itemCount).toBe(0);
    expect(sim.inventory.get(ORE) - before).toBe(onBelt);
  });

  it('behält Items beim Drehen eines Bandfeldes', () => {
    const sim = makeSim();
    belt(sim, line(2, 2, 2, 6));
    const id = sim.belts.tileSegment[sim.world.index(2, 2)];
    sim.belts.fill(id, ORE);
    const count = sim.belts.itemCount;
    belt(sim, [{ x: 2, y: 4, dir: 1 }]); // ein Feld zur Seite drehen
    expect(sim.belts.segmentCount).toBe(2);
    expect(sim.belts.itemCount).toBe(count);
  });

  it('lässt Items auf einem geschlossenen Ring endlos kreisen', () => {
    const sim = makeSim();
    belt(sim, [...line(2, 2, 1, 4), ...line(6, 2, 2, 4), ...line(6, 6, 3, 4), ...line(2, 6, 0, 4)]);
    expect(sim.belts.segmentCount).toBe(1);
    const id = sim.belts.tileSegment[sim.world.index(2, 2)];
    const seg = sim.belts.segments[id]!;
    expect(seg.cyclic).toBe(true);
    sim.belts.fill(id, ORE);
    sim.belts.segments[id]!.pop(); // eine Lücke lassen, damit sich etwas bewegt
    sim.belts.itemCount--;
    const count = sim.belts.itemCount;
    const firstBefore = seg.items[seg.head];
    run(sim, 500);
    expect(sim.belts.itemCount).toBe(count);
    expect(seg.count).toBe(count);
    expect(firstBefore).toBe(ORE);
  });
});

describe('Gebäude und Bänder', () => {
  it('Bergwerk liefert über ein Band 30 Erz pro Minute an die Zentrale', () => {
    const sim = makeSim();
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ])
      setDepositHere(sim, x, y);
    build(sim, B.miner, 2, 2); // Ausgang Süden: Band ab (2,4)
    belt(sim, line(2, 4, 2, 6)); // (2,4)–(2,9)
    build(sim, B.hq, 1, 10); // Eingang Norden bei (2,10)
    run(sim, 1200); // Anlaufzeit
    const before = sim.inventory.get(ORE);
    run(sim, 1200);
    expect(sim.inventory.get(ORE) - before).toBeGreaterThanOrEqual(29);
    expect(sim.inventory.get(ORE) - before).toBeLessThanOrEqual(31);
  });

  it('Abnahme Phase 3: Bergwerk → Schmelzofen → Zentrale füllt den Vorrat mit Kupferbarren', () => {
    const sim = makeSim();
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ])
      setDepositHere(sim, x, y);
    build(sim, B.miner, 2, 2);
    belt(sim, line(2, 4, 2, 4)); // (2,4)–(2,7)
    build(sim, B.furnace, 2, 8); // Eingang Norden (2,8), Ausgang Süden → (2,10)
    belt(sim, line(2, 10, 2, 4)); // (2,10)–(2,13)
    build(sim, B.hq, 1, 14);
    const ingot = ITEM_ID.copperIngot;
    const start = sim.inventory.get(ingot);
    run(sim, 1200);
    expect(sim.inventory.get(ingot)).toBeGreaterThan(start);
    // Rezept wurde automatisch gewählt
    const furnace = sim.buildingAt(2, 8);
    expect(sim.machines.recipe[furnace]).toBe(0);
    const mid = sim.inventory.get(ingot);
    run(sim, 1200);
    const perMinute = sim.inventory.get(ingot) - mid;
    expect(perMinute).toBeGreaterThanOrEqual(29);
    expect(perMinute).toBeLessThanOrEqual(31);
  });

  it('legt keine Items mitten auf ein Band und nicht auf ein Band, das ins Gebäude zeigt', () => {
    const sim = makeSim();
    belt(sim, line(5, 2, 2, 5)); // (5,2)–(5,6) nach Süden
    const middle = sim.world.index(5, 4);
    expect(sim.belts.insertFromBuilding(middle, 1)).toBeNull();
    const start = sim.world.index(5, 2);
    expect(sim.belts.insertFromBuilding(start, 0)).toBeNull(); // Band zeigt Richtung Gebäude
    expect(sim.belts.insertFromBuilding(start, 2)).not.toBeNull();
  });

  it('ist deterministisch: gleiche Befehle ergeben gleichen Zustand', () => {
    const play = () => {
      const sim = makeSim();
      for (const [x, y] of [
        [2, 2],
        [3, 2],
      ])
        setDepositHere(sim, x, y);
      build(sim, B.miner, 2, 2);
      belt(sim, line(2, 4, 2, 4));
      build(sim, B.furnace, 2, 8);
      belt(sim, line(2, 10, 2, 8));
      run(sim, 3000);
      const seg = sim.belts.segments.filter((s) => s).map((s) => [s!.count, s!.total, s!.active]);
      return JSON.stringify([seg, Array.from(sim.inventory.amounts), sim.machines.progress[1]]);
    };
    expect(play()).toBe(play());
  });
});

function setDepositHere(sim: ReturnType<typeof makeSim>, x: number, y: number): void {
  const i = sim.world.index(x, y);
  sim.world.tiles[i] = 2;
  sim.world.resource[i] = 2; // Kupfer
  sim.world.purity[i] = 2;
}
