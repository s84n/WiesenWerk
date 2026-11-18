import { describe, expect, it } from 'vitest';
import { ITEM_COUNT, ITEM_ID } from '../src/data/items';
import { DEPOSITS } from '../src/data/world';
import { PlaceResult, checkPlacement } from '../src/sim/placement';
import { deserialize, migrate, serialize } from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { generateWorld } from '../src/sim/worldgen';
import { B, belt, build, line, makeSim, run, unlockAll } from './helpers';

const META = { name: 'Test', savedAt: 0 };
const CAM = [0, 0, 20, 0];

function covered(sim: Simulation, x: number, y: number): number {
  return sim.covers[sim.world.index(x, y)] - 1;
}

describe('Hecken und Rosenbögen über Bändern', () => {
  it('kommen nur über Bänder und kosten Material', () => {
    const sim = makeSim();
    belt(sim, line(2, 5, 1, 6));
    expect(checkPlacement(sim, B.hedgeCover, 2, 8, 0)).toBe(PlaceResult.NeedsBelt);
    const wood = sim.inventory.get(ITEM_ID.wood);
    sim.enqueue({ type: 'buildLine', building: B.hedgeCover, path: line(1, 5, 1, 9) });
    sim.flushCommands();
    // 6 Bandfelder bekommen eine Hecke, die Felder ohne Band werden übersprungen
    for (let x = 2; x < 8; x++) expect(covered(sim, x, 5)).toBe(B.hedgeCover);
    expect(covered(sim, 1, 5)).toBe(-1);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood - 6);
    // gleiche Verkleidung noch einmal: nichts passiert
    expect(checkPlacement(sim, B.hedgeCover, 2, 5, 0)).toBe(PlaceResult.Blocked);
  });

  it('Rosenbögen erst mit „Gartenbau“, ersetzen eine Hecke und erstatten sie', () => {
    const sim = makeSim();
    belt(sim, line(2, 5, 1, 3));
    expect(checkPlacement(sim, B.roseArch, 2, 5, 0)).toBe(PlaceResult.Locked);
    build(sim, B.hedgeCover, 2, 5);
    unlockAll(sim);
    const wood = sim.inventory.get(ITEM_ID.wood);
    build(sim, B.roseArch, 2, 5);
    expect(covered(sim, 2, 5)).toBe(B.roseArch);
    // Hecke (1 Holz) zurück, Rosenbogen (1 Holz, 1 Brett) bezahlt
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood);
  });

  it('ändern nichts am Warenfluss', () => {
    const plain = makeSim();
    const hedged = makeSim();
    for (const sim of [plain, hedged]) {
      build(sim, B.dispenser, 4, 2);
      const d = sim.buildingAt(4, 2);
      sim.enqueue({ type: 'setRecipe', building: d, recipe: ITEM_ID.stone });
      belt(sim, line(4, 4, 2, 8));
      build(sim, B.depot, 4, 12);
    }
    hedged.enqueue({ type: 'buildLine', building: B.hedgeCover, path: line(4, 4, 2, 8) });
    hedged.flushCommands();
    run(plain, 600);
    run(hedged, 600);
    expect(hedged.machines.delivered).toBe(plain.machines.delivered);
    expect(hedged.machines.delivered).toBeGreaterThan(0);
  });

  it('Einzelklick beim Abriss entfernt erst die Hecke, ein Rahmen beides', () => {
    const sim = makeSim();
    belt(sim, line(2, 5, 1, 3));
    sim.enqueue({ type: 'buildLine', building: B.hedgeCover, path: line(2, 5, 1, 3) });
    sim.flushCommands();
    const wood = sim.inventory.get(ITEM_ID.wood);
    sim.enqueue({ type: 'demolishArea', x0: 2, y0: 5, x1: 2, y1: 5 });
    sim.flushCommands();
    expect(covered(sim, 2, 5)).toBe(-1);
    expect(sim.buildingAt(2, 5)).toBeGreaterThanOrEqual(0);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood + 1);
    sim.enqueue({ type: 'demolishArea', x0: 3, y0: 5, x1: 4, y1: 5 });
    sim.flushCommands();
    expect(sim.buildingAt(3, 5)).toBe(-1);
    expect(covered(sim, 3, 5)).toBe(-1);
    // Hecken (2) und Bänder (2) zurück
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood + 5);
  });
});

describe('Baujahr und Spielstand', () => {
  function factory(): Simulation {
    const sim = new Simulation(generateWorld(4711, undefined, DEPOSITS));
    for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 1000);
    const { startX: x, startY: y } = sim.world;
    sim.enqueue({
      type: 'buildLine',
      building: B.beltMk1,
      path: [0, 1, 2, 3].map((k) => ({ x: x + 5 + k, y, dir: 1 })),
    });
    sim.flushCommands();
    run(sim, 50);
    sim.enqueue({ type: 'build', building: B.furnace, x: x + 5, y: y + 2, rot: 0 });
    sim.enqueue({
      type: 'buildLine',
      building: B.hedgeCover,
      path: [0, 1, 2].map((k) => ({ x: x + 5 + k, y, dir: 1 })),
    });
    sim.flushCommands();
    return sim;
  }

  it('Gebäude merken sich ihren Bau-Tick, Hecken bleiben beim Laden erhalten', () => {
    const sim = factory();
    const { startX: x, startY: y } = sim.world;
    const furnace = sim.buildingAt(x + 5, y + 2);
    expect(sim.buildings.built[furnace]).toBe(50);
    expect(sim.buildings.built[sim.buildingAt(x + 5, y)]).toBe(0);
    const loaded = deserialize(migrate(JSON.parse(JSON.stringify(serialize(sim, META, CAM)))));
    expect(loaded.buildings.built[furnace]).toBe(50);
    expect(Array.from(loaded.covers)).toEqual(Array.from(sim.covers));
    expect(JSON.stringify(serialize(loaded, META, CAM))).toBe(
      JSON.stringify(serialize(sim, META, CAM)),
    );
  });

  it('Version 8 → 9: alte Gebäude gelten als zu Spielbeginn gebaut, keine Hecken', () => {
    const sim = factory();
    const v9 = serialize(sim, META, CAM);
    const v8 = JSON.parse(JSON.stringify(v9));
    v8.version = 8;
    delete v8.covers;
    delete v8.buildings.built;
    const migrated = migrate(v8);
    expect(migrated.covers).toEqual([]);
    expect(migrated.buildings.built.every((t: number) => t === 0)).toBe(true);
    expect(migrated.buildings.built.length * 5).toBe(migrated.buildings.list.length);
    const loaded = deserialize(migrated);
    expect(loaded.covers.every((c) => c === 0)).toBe(true);
  });

  it('erkennt beschädigte Hecken-Einträge', () => {
    const sim = factory();
    const data = JSON.parse(JSON.stringify(serialize(sim, META, CAM)));
    // Hecke auf einem Feld ohne Band
    data.covers.push(0, B.hedgeCover);
    expect(() => deserialize(migrate(data))).toThrow();
  });
});
