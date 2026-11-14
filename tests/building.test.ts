import { describe, expect, it } from 'vitest';
import { BUILDINGS, BUILDING_ID } from '../src/data/buildings';
import { ITEM_ID } from '../src/data/items';
import { TileType } from '../src/data/world';
import { rotateDir, rotateOffset } from '../src/sim/buildings';
import { PlaceResult, checkPlacement } from '../src/sim/placement';
import { Simulation } from '../src/sim/simulation';
import { World } from '../src/sim/world';

const HQ = BUILDING_ID.hq;
const MINER = BUILDING_ID.miner;
const FURNACE = BUILDING_ID.furnace;
const LUMBER = BUILDING_ID.lumberjack;

/** Kleine Testwelt: alles Wiese, mit einem Vorkommen und einem Waldstück. */
function makeSim(): Simulation {
  const w = new World(1, 32, 16);
  w.tiles.fill(TileType.Meadow);
  for (const [x, y] of [
    [20, 20],
    [21, 20],
  ]) {
    const i = w.index(x, y);
    w.tiles[i] = TileType.Deposit;
    w.resource[i] = 1; // Stein
    w.purity[i] = 2;
  }
  w.tiles[w.index(5, 25)] = TileType.Forest;
  return new Simulation(w);
}

function run(sim: Simulation): void {
  sim.flushCommands();
}

describe('Vorrat', () => {
  it('startet mit dem Startpaket', () => {
    const sim = makeSim();
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(30);
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(30);
    expect(sim.inventory.get(ITEM_ID.copperOre)).toBe(10);
  });
});

describe('Bauen und Abreißen', () => {
  it('baut ein Gebäude, belegt die Felder und zieht die Kosten ab', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'build', building: FURNACE, x: 4, y: 4, rot: 0 });
    run(sim);
    expect(sim.buildingCount).toBe(1);
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(10);
    for (const [x, y] of [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ])
      expect(sim.buildingAt(x, y)).toBe(0);
    expect(sim.buildingAt(6, 4)).toBe(-1);
    expect(sim.events.some((e) => e.type === 'buildingAdded')).toBe(true);
  });

  it('erstattet beim Abriss die vollen Kosten und gibt die Felder frei', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'build', building: LUMBER, x: 4, y: 4, rot: 1 });
    run(sim);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(20);
    sim.enqueue({ type: 'demolish', x: 5, y: 5 });
    run(sim);
    expect(sim.buildingCount).toBe(0);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(30);
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(30);
    expect(sim.buildingAt(4, 4)).toBe(-1);
  });

  it('verhindert Überlappung und Bauen außerhalb der Karte', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'build', building: HQ, x: 10, y: 10, rot: 0 });
    run(sim);
    expect(checkPlacement(sim, FURNACE, 11, 11, 0)).toBe(PlaceResult.Blocked);
    expect(checkPlacement(sim, FURNACE, 13, 10, 0)).toBe(PlaceResult.Ok);
    expect(checkPlacement(sim, FURNACE, 31, 0, 0)).toBe(PlaceResult.OutOfBounds);
    expect(checkPlacement(sim, FURNACE, -1, 0, 0)).toBe(PlaceResult.OutOfBounds);
  });

  it('erlaubt nur eine Zentrale', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'build', building: HQ, x: 0, y: 0, rot: 0 });
    run(sim);
    expect(checkPlacement(sim, HQ, 10, 10, 0)).toBe(PlaceResult.Unique);
    sim.enqueue({ type: 'demolish', x: 1, y: 1 });
    run(sim);
    expect(checkPlacement(sim, HQ, 10, 10, 0)).toBe(PlaceResult.Ok);
  });

  it('verlangt für das Bergwerk ein Vorkommen und erlaubt andere Gebäude nicht darauf', () => {
    const sim = makeSim();
    expect(checkPlacement(sim, MINER, 2, 2, 0)).toBe(PlaceResult.NeedsDeposit);
    expect(checkPlacement(sim, MINER, 20, 19, 0)).toBe(PlaceResult.Ok); // ein Feld reicht
    expect(checkPlacement(sim, FURNACE, 20, 19, 0)).toBe(PlaceResult.Blocked);
  });

  it('lehnt Bauten ab, die nicht bezahlbar sind, und meldet den Grund', () => {
    const sim = makeSim();
    // Werkstatt braucht Kupferbarren, die es zu Beginn nicht gibt
    sim.enqueue({ type: 'build', building: BUILDING_ID.workshop, x: 2, y: 2, rot: 0 });
    run(sim);
    expect(sim.buildingCount).toBe(0);
    const fail = sim.events.find((e) => e.type === 'commandFailed');
    expect(fail && fail.type === 'commandFailed' && fail.reason).toBe(PlaceResult.Cost);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(30);
  });

  it('reißt per Rahmen alle berührten Gebäude ab', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'build', building: FURNACE, x: 2, y: 2, rot: 0 });
    sim.enqueue({ type: 'build', building: LUMBER, x: 8, y: 2, rot: 0 });
    sim.enqueue({ type: 'build', building: LUMBER, x: 20, y: 2, rot: 0 });
    run(sim);
    expect(sim.buildingCount).toBe(3);
    sim.enqueue({ type: 'demolishArea', x0: 3, y0: 3, x1: 8, y1: 2 });
    run(sim);
    expect(sim.buildingCount).toBe(1);
  });

  it('verwendet freie Gebäude-IDs wieder', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'build', building: FURNACE, x: 2, y: 2, rot: 0 });
    sim.enqueue({ type: 'demolish', x: 2, y: 2 });
    sim.enqueue({ type: 'build', building: LUMBER, x: 10, y: 10, rot: 0 });
    run(sim);
    expect(sim.buildingAt(10, 10)).toBe(0);
    expect(sim.buildings.highWater).toBe(1);
  });
});

describe('Drehen', () => {
  it('dreht Felder und Anschlüsse im Uhrzeigersinn', () => {
    const def = BUILDINGS[FURNACE]; // 2 × 2, Eingang Norden bei (0,0), Ausgang Süden bei (0,1)
    const out = { x: 0, y: 0 };
    rotateOffset(def, 1, 0, 0, out);
    expect(out).toEqual({ x: 1, y: 0 });
    rotateOffset(def, 1, 0, 1, out);
    expect(out).toEqual({ x: 0, y: 0 });
    expect(rotateDir(0, 1)).toBe(1); // Norden → Osten
    expect(rotateDir(2, 1)).toBe(3); // Süden → Westen
    expect(rotateDir(3, 2)).toBe(1);
  });

  it('tauscht bei 3 × 1-Formen Breite und Tiefe', () => {
    const def = { ...BUILDINGS[FURNACE], size: [3, 1] as const };
    const out = { x: 0, y: 0 };
    rotateOffset(def, 1, 2, 0, out);
    expect(out).toEqual({ x: 0, y: 2 });
    rotateOffset(def, 3, 2, 0, out);
    expect(out).toEqual({ x: 0, y: 0 });
  });
});

describe('Abbau von Hand', () => {
  it('liefert Holz, fällt den Baum nach 4 Klicks und lässt ihn nachwachsen', () => {
    const sim = makeSim();
    const tile = sim.world.index(5, 25);
    for (let k = 0; k < 4; k++) sim.enqueue({ type: 'harvest', x: 5, y: 25 });
    run(sim);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(34);
    expect(sim.trees.hasTree(tile)).toBe(false);
    // weiterer Klick bringt nichts
    sim.enqueue({ type: 'harvest', x: 5, y: 25 });
    run(sim);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(34);
    // nach 120 s (2400 Ticks) wächst er nach
    for (let t = 0; t < 2399; t++) sim.step();
    expect(sim.trees.hasTree(tile)).toBe(false);
    sim.step();
    expect(sim.trees.hasTree(tile)).toBe(true);
  });

  it('rodet stehenden Wald beim Bauen (Holz in den Vorrat); bebautes Feld wächst nicht nach', () => {
    const sim = makeSim();
    const forest = [sim.world.index(5, 24), sim.world.index(5, 25)].filter((i) =>
      sim.trees.hasTree(i),
    ).length;
    expect(forest).toBeGreaterThan(0);
    expect(checkPlacement(sim, FURNACE, 5, 24, 0)).toBe(PlaceResult.Ok);
    const wood = sim.inventory.get(ITEM_ID.wood);
    let standing = 0;
    for (let y = 24; y < 26; y++)
      for (let x = 5; x < 7; x++) standing += sim.trees.wood[sim.world.index(x, y)];
    sim.enqueue({ type: 'build', building: FURNACE, x: 5, y: 24, rot: 0 });
    run(sim);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood + standing);
    for (let t = 0; t < 2500; t++) sim.step();
    expect(sim.trees.hasTree(sim.world.index(5, 25))).toBe(false);
  });

  it('liefert auf Vorkommen unbegrenzt den passenden Rohstoff', () => {
    const sim = makeSim();
    for (let k = 0; k < 50; k++) sim.enqueue({ type: 'harvest', x: 20, y: 20 });
    run(sim);
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(80);
  });

  it('liefert auf Wiese und unter Gebäuden nichts', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'harvest', x: 1, y: 1 });
    sim.enqueue({ type: 'build', building: MINER, x: 20, y: 20, rot: 0 });
    sim.enqueue({ type: 'harvest', x: 20, y: 20 });
    run(sim);
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(20); // 30 − 10 Baukosten, kein Abbau
  });
});
