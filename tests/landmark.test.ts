import { describe, expect, it } from 'vitest';
import { ITEM_ID } from '../src/data/items';
import { LANDMARK_NEEDS, LANDMARK_STAGES } from '../src/data/landmark';
import { POWER } from '../src/data/balance';
import { deserialize, migrate, serialize } from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { generateWorld } from '../src/sim/worldgen';
import { DEPOSITS } from '../src/data/world';
import { B, belt, build, line, makeSim, run } from './helpers';

/** Liefert alles für den aktuellen Abschnitt aus dem Vorrat. */
function contribute(sim: Simulation): void {
  sim.enqueue({ type: 'contributeLandmark' });
  sim.flushCommands();
}

describe('Uhrturm', () => {
  it('ist von Anfang an baubar, aber nur einmal', () => {
    const sim = makeSim();
    build(sim, B.clockTower, 2, 2);
    expect(sim.typeCount[B.clockTower]).toBe(1);
    build(sim, B.clockTower, 10, 10);
    expect(sim.typeCount[B.clockTower]).toBe(1);
  });

  it('nimmt Gebrauchtes vom Band für den Abschnitt, anderes geht in den Vorrat', () => {
    const sim = makeSim();
    build(sim, B.clockTower, 10, 10);
    const tower = sim.buildingAt(10, 10);
    const stone = ITEM_ID.stone;
    const copper = ITEM_ID.copperOre;
    const stoneBefore = sim.inventory.get(stone);
    const copperBefore = sim.inventory.get(copper);
    expect(sim.machines.accept(tower, stone)).toBe(true);
    expect(sim.machines.accept(tower, copper)).toBe(true);
    expect(sim.landmark.delivered[stone]).toBe(1);
    expect(sim.inventory.get(stone)).toBe(stoneBefore);
    expect(sim.inventory.get(copper)).toBe(copperBefore + 1);
  });

  it('nimmt Items über ein Band an', () => {
    const sim = makeSim();
    build(sim, B.clockTower, 10, 10);
    build(sim, B.dispenser, 10, 3);
    const disp = sim.buildingAt(10, 3);
    sim.enqueue({ type: 'setRecipe', building: disp, recipe: ITEM_ID.wood });
    // Ausgang der Ausgabestelle: Feld (10, 5) nach Süden, Band bis an den Turm
    belt(sim, line(10, 5, 2, 5));
    run(sim, 20 * 30);
    expect(sim.landmark.delivered[ITEM_ID.wood]).toBeGreaterThan(5);
  });

  it('schließt Abschnitte ab, schaltet Belohnungen frei und endet nach dem letzten', () => {
    const sim = makeSim();
    build(sim, B.clockTower, 10, 10);
    const events: number[] = [];
    expect(sim.research.buildingUnlocked[B.fountain]).toBe(0);
    const speed0 = sim.research.extractorSpeed;
    contribute(sim);
    for (const e of sim.events) if (e.type === 'landmarkStage') events.push(e.stage);
    expect(sim.landmark.stage).toBe(1);
    expect(sim.research.extractorSpeed).toBe(speed0 + POWER.scale * 0.05);
    contribute(sim);
    expect(sim.research.buildingUnlocked[B.fountain]).toBe(1);
    for (let k = 2; k < LANDMARK_STAGES.length; k++) contribute(sim);
    expect(sim.landmark.finished).toBe(true);
    expect(sim.research.buildingUnlocked[B.bandstand]).toBe(1);
    expect(events).toEqual([1]);
    // Nach dem Ende wird nichts mehr angenommen (geht in den Vorrat)
    contribute(sim);
    expect(sim.landmark.stage).toBe(LANDMARK_STAGES.length);
  });

  it('nimmt aus dem Vorrat nur, was da ist und noch fehlt', () => {
    const sim = makeSim();
    sim.inventory.amounts.fill(0);
    sim.inventory.add(ITEM_ID.stone, 30);
    sim.inventory.add(ITEM_ID.wood, 500);
    contribute(sim);
    const need = LANDMARK_NEEDS[0].find((a) => a.item === ITEM_ID.wood)!.amount;
    expect(sim.landmark.delivered[ITEM_ID.stone]).toBe(30);
    expect(sim.landmark.delivered[ITEM_ID.wood]).toBe(need);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(500 - need);
    expect(sim.landmark.stage).toBe(0);
  });

  it('behält den Fortschritt beim Abriss und beim Speichern', () => {
    const sim = new Simulation(generateWorld(4711, undefined, DEPOSITS));
    sim.inventory.add(ITEM_ID.stone, 1000);
    sim.inventory.add(ITEM_ID.wood, 1000);
    sim.inventory.add(ITEM_ID.stoneBrick, 40);
    contribute(sim); // Abschnitt 1 fertig
    contribute(sim); // 40 Ziegel für Abschnitt 2
    const { startX: x, startY: y } = sim.world;
    sim.enqueue({ type: 'build', building: B.clockTower, x: x + 4, y, rot: 0 });
    sim.enqueue({ type: 'demolish', x: x + 4, y });
    sim.flushCommands();
    expect(sim.landmark.stage).toBe(1);
    const data = serialize(sim, { name: 't', savedAt: 0 }, [0, 0, 10, 0]);
    const loaded = deserialize(migrate(JSON.parse(JSON.stringify(data))));
    expect(loaded.landmark.stage).toBe(1);
    expect(loaded.landmark.delivered[ITEM_ID.stoneBrick]).toBe(40);
    expect(loaded.research.extractorSpeed).toBe(sim.research.extractorSpeed);
  });
});
