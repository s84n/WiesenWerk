import { describe, expect, it } from 'vitest';
import { ITEM_ID } from '../src/data/items';
import { TileType } from '../src/data/world';
import { copyArea } from '../src/sim/blueprint';
import { MachineState } from '../src/sim/machines';
import { deserialize, migrate, serialize } from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { generateWorld } from '../src/sim/worldgen';
import { B, belt, build, line, makeSim, run } from './helpers';

const WOOD = ITEM_ID.wood;
const PLANK = ITEM_ID.plank;

/** Ausgabestelle bei (4,4); Ausgang vorn links → Band ab (4,6) nach Süden. */
function setup(stock: number) {
  const sim = makeSim();
  build(sim, B.dispenser, 4, 4);
  const id = sim.buildingAt(4, 4);
  belt(sim, line(4, 6, 2, 20));
  sim.inventory.amounts[WOOD] = stock;
  sim.enqueue({ type: 'setRecipe', building: id, recipe: WOOD });
  sim.flushCommands();
  return { sim, id };
}

describe('Ausgabestelle', () => {
  it('legt das gewählte Item aus dem Vorrat aufs Band, 60 pro Minute', () => {
    const { sim } = setup(1000);
    const before = sim.inventory.get(WOOD);
    run(sim, 20 * 30); // 30 Sekunden
    const taken = before - sim.inventory.get(WOOD);
    expect(taken).toBeGreaterThanOrEqual(29);
    expect(taken).toBeLessThanOrEqual(31);
    expect(sim.belts.itemCount).toBeGreaterThanOrEqual(taken - 2);
  });

  it('meldet „Vorrat leer“, wenn nichts mehr da ist', () => {
    const { sim, id } = setup(3);
    run(sim, 20 * 10);
    expect(sim.inventory.get(WOOD)).toBe(0);
    expect(sim.belts.itemCount).toBe(3);
    expect(sim.machines.state[id]).toBe(MachineState.WaitingInput);
  });

  it('ohne gewähltes Item passiert nichts', () => {
    const sim = makeSim();
    build(sim, B.dispenser, 4, 4);
    const id = sim.buildingAt(4, 4);
    belt(sim, line(4, 6, 2, 5));
    run(sim, 200);
    expect(sim.belts.itemCount).toBe(0);
    expect(sim.machines.state[id]).toBe(MachineState.NoRecipe);
  });

  it('versorgt eine Werkstatt: Holz aus dem Vorrat wird zu Brettern', () => {
    const sim = makeSim();
    sim.power.factorOf = () => 1000;
    build(sim, B.dispenser, 4, 2);
    const id = sim.buildingAt(4, 2);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: WOOD });
    belt(sim, line(4, 4, 2, 3)); // (4,4)–(4,6) in den Eingang der Werkstatt
    build(sim, B.workshop, 4, 7);
    const ws = sim.buildingAt(4, 7);
    run(sim, 20 * 20);
    expect(sim.machines.recipe[ws]).toBeGreaterThanOrEqual(0);
    const plankSlot = ws * 2;
    expect(sim.machines.outBuf[plankSlot]).toBeGreaterThan(0);
    expect(sim.inventory.get(PLANK)).toBeGreaterThan(0);
  });

  it('Abriss und Itemwechsel geben Bereitliegendes zurück', () => {
    const sim = makeSim();
    build(sim, B.dispenser, 4, 4); // ohne Band: Ausgang bleibt voll
    const id = sim.buildingAt(4, 4);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: WOOD });
    sim.flushCommands();
    const start = sim.inventory.get(WOOD);
    run(sim, 200);
    expect(sim.inventory.get(WOOD)).toBe(start - 2); // Puffer fasst 2
    sim.enqueue({ type: 'setRecipe', building: id, recipe: ITEM_ID.stone });
    sim.flushCommands();
    expect(sim.inventory.get(WOOD)).toBe(start);
    run(sim, 200);
    const stone = sim.inventory.get(ITEM_ID.stone);
    sim.enqueue({ type: 'demolish', x: 4, y: 4 });
    sim.flushCommands();
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(stone + 2 + 10); // Puffer + Baukosten
  });

  it('Vorrats-Fluss: Ausgabestelle −60/min, Lieferung ins Depot als Zufluss', () => {
    const sim = makeSim();
    build(sim, B.dispenser, 4, 4);
    const id = sim.buildingAt(4, 4);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: WOOD });
    belt(sim, line(4, 6, 2, 3)); // (4,6)–(4,8) ins Depot
    build(sim, B.depot, 4, 9);
    run(sim, 20 * 70); // etwas mehr als eine Minute
    const s = sim.stats;
    const out = s.perMinute(s.stockOut, WOOD);
    const inn = s.perMinute(s.stockIn, WOOD); // kommt im Kreis zurück
    expect(out).toBeGreaterThanOrEqual(58);
    expect(out).toBeLessThanOrEqual(61);
    expect(inn).toBeGreaterThanOrEqual(56);
    expect(inn).toBeLessThanOrEqual(61);
    expect(sim.machines.dispensersOf(WOOD)).toBe(1);
    expect(s.perMinute(s.stockIn, PLANK)).toBe(0);
  });

  it('Blaupause übernimmt das gewählte Item', () => {
    const { sim } = setup(100);
    const bp = copyArea(sim, 4, 4, 5, 5);
    expect(bp?.entries[0].recipe).toBe(WOOD);
  });

  it('bleibt nach Speichern und Laden gleich und spielt identisch weiter', () => {
    const sim = new Simulation(generateWorld(4711));
    const w = sim.world;
    sim.inventory.add(WOOD, 500);
    sim.inventory.add(ITEM_ID.stone, 500);
    const x0 = w.startX + 8;
    const y0 = w.startY + 8;
    for (let y = y0; y < y0 + 12; y++)
      for (let x = x0; x < x0 + 4; x++) {
        const i = w.index(x, y);
        w.tiles[i] = TileType.Meadow;
        w.resource[i] = 0;
        w.changedTiles.add(i);
      }
    build(sim, B.dispenser, x0, y0);
    build(sim, B.dispenser, x0 + 2, y0);
    for (const dx of [0, 2]) {
      const id = sim.buildingAt(x0 + dx, y0);
      sim.enqueue({ type: 'setRecipe', building: id, recipe: WOOD });
      belt(sim, line(x0 + dx, y0 + 2, 2, 8));
    }
    run(sim, 300);
    const data = JSON.parse(
      JSON.stringify(serialize(sim, { name: 't', savedAt: 0 }, [0, 0, 0, 0])),
    );
    const loaded = deserialize(migrate(data));
    expect(loaded.machines.recipe[loaded.buildingAt(x0, y0)]).toBe(WOOD);
    expect(loaded.machines.dispensers).toEqual(sim.machines.dispensers);
    run(sim, 600);
    run(loaded, 600);
    const a = serialize(sim, { name: 't', savedAt: 0 }, [0, 0, 0, 0]);
    const b = serialize(loaded, { name: 't', savedAt: 0 }, [0, 0, 0, 0]);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
