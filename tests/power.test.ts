import { describe, expect, it } from 'vitest';
import { ITEM_ID } from '../src/data/items';
import { MachineState } from '../src/sim/machines';
import type { Simulation } from '../src/sim/simulation';
import { B, build, makeSim, run } from './helpers';

const WOOD = ITEM_ID.wood;
const ORE = ITEM_ID.copperOre;

/** Ofen mit dauerhaftem Erz-Nachschub: pro Tick so viel nachlegen, wie der Puffer fasst. */
function feed(sim: Simulation, ids: number[]): void {
  for (const id of ids) while (sim.machines.accept(id, ORE));
}

function stepFed(sim: Simulation, ids: number[], ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    feed(sim, ids);
    sim.step();
  }
}

describe('Stromnetz', () => {
  it('Maschinen ohne Strom arbeiten nicht', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    const f = sim.buildingAt(4, 4);
    stepFed(sim, [f], 100);
    expect(sim.machines.state[f]).toBe(MachineState.NoPower);
    expect(sim.machines.outBuf[f * 2]).toBe(0);
  });

  it('Brenner mit Holz und ein Mast versorgen eine Maschine mit vollem Tempo', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    build(sim, B.pole, 6, 4); // versorgt x 4..8, y 2..6
    build(sim, B.burner, 7, 4);
    const f = sim.buildingAt(4, 4);
    const burner = sim.buildingAt(7, 4);
    sim.enqueue({ type: 'refuel', building: burner, item: WOOD });
    sim.flushCommands();
    expect(sim.machines.inBuf[burner * 2]).toBe(10); // Puffer voll, Rest bleibt im Vorrat
    stepFed(sim, [f], 401);
    expect(sim.power.factorOf(f)).toBe(1000);
    // Ofen gibt nicht aus (kein Band), also 2 Barren im Ausgang: Zeit für mindestens 2 Durchläufe
    expect(sim.machines.outBuf[f * 2]).toBe(2);
    expect(sim.power.gridCount).toBe(1);
  });

  it('Brenner verbraucht nur so viel Brennstoff, wie das Netz abruft', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    build(sim, B.pole, 6, 4);
    build(sim, B.burner, 7, 4);
    const f = sim.buildingAt(4, 4);
    const burner = sim.buildingAt(7, 4);
    sim.machines.addFuel(burner, WOOD, 1, 10);
    stepFed(sim, [f], 40); // anlaufen, Ofen arbeitet voll (4 kW von 30 kW)
    const before = sim.machines.fuelEnergy[burner];
    stepFed(sim, [f], 20); // eine Sekunde
    const used = before - sim.machines.fuelEnergy[burner];
    // 4 kW eine Sekunde lang ≈ 4.000 J (Rundung auf ganze Tausendstel der Last)
    expect(used).toBeGreaterThan(3900);
    expect(used).toBeLessThan(4200);
  });

  it('ein Holz reicht bei voller Last 4 Sekunden, Holzkohle 12 Sekunden', () => {
    expect((120 * 1000) / 30_000).toBe(4);
    expect((360 * 1000) / 30_000).toBe(12);
  });

  it('bei zu wenig Strom laufen alle Maschinen gleichmäßig langsamer', () => {
    const sim = makeSim(64);
    // 15 Öfen à 4 kW = 60 kW, ein Brenner = 30 kW → halbes Tempo
    const furnaces: number[] = [];
    for (let k = 0; k < 15; k++) {
      const x = 2 + (k % 5) * 3;
      const y = 2 + Math.floor(k / 5) * 3;
      build(sim, B.furnace, x, y);
      furnaces.push(sim.buildingAt(x, y));
    }
    for (const [x, y] of [
      [4, 4],
      [10, 4],
      [16, 4],
      [4, 9],
      [10, 9],
      [16, 9],
    ])
      build(sim, B.pole, x, y);
    build(sim, B.burner, 20, 4);
    build(sim, B.pole, 19, 7);
    const burner = sim.buildingAt(20, 4);
    sim.machines.addFuel(burner, WOOD, 10, 10);
    expect(furnaces.every((f) => f >= 0)).toBe(true);
    stepFed(sim, furnaces, 60);
    expect(sim.power.gridCount).toBe(1);
    expect(sim.power.demand[0]).toBe(60_000);
    expect(sim.power.factorOf(furnaces[0])).toBe(500);
    // Ausgang leeren und zählen: 400 Ticks bei halbem Tempo = 5 Durchläufe statt 10
    for (const f of furnaces) sim.machines.outBuf[f * 2] = 0;
    let made = 0;
    for (let t = 0; t < 400; t++) {
      feed(sim, furnaces);
      sim.step();
      made += sim.machines.outBuf[furnaces[0] * 2];
      for (const f of furnaces) sim.machines.outBuf[f * 2] = 0; // alle Ausgänge leeren, damit alle arbeiten
    }
    expect(made).toBeGreaterThanOrEqual(4);
    expect(made).toBeLessThanOrEqual(6);
  });

  it('ohne Brennstoff gibt es keinen Strom', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    build(sim, B.pole, 6, 4);
    build(sim, B.burner, 7, 4);
    sim.enqueue({ type: 'setAutoRefill', building: sim.buildingAt(7, 4), on: false });
    const f = sim.buildingAt(4, 4);
    stepFed(sim, [f], 30);
    expect(sim.power.factorOf(f)).toBe(0);
    expect(sim.machines.state[f]).toBe(MachineState.NoPower);
    expect(sim.machines.state[sim.buildingAt(7, 4)]).toBe(MachineState.WaitingInput);
  });

  it('Brenner holen sich Brennstoff selbst aus dem Vorrat (abschaltbar)', () => {
    const sim = makeSim();
    // ohne Verbraucher: nichts holen
    build(sim, B.pole, 16, 4);
    build(sim, B.burner, 17, 4);
    run(sim, 60);
    expect(sim.machines.inBuf[sim.buildingAt(17, 4) * 2]).toBe(0);
    build(sim, B.furnace, 4, 4);
    build(sim, B.pole, 6, 4);
    build(sim, B.burner, 7, 4);
    const burner = sim.buildingAt(7, 4);
    const f = sim.buildingAt(4, 4);
    const wood = sim.inventory.get(ITEM_ID.wood);
    stepFed(sim, [f], 30);
    expect(sim.machines.fuelItem[burner]).toBe(ITEM_ID.wood);
    // nur ein kleiner Vorrat im Brenner, der Rest bleibt in der Zentrale
    const taken = wood - sim.inventory.get(ITEM_ID.wood);
    expect(taken).toBeGreaterThan(0);
    expect(taken).toBeLessThanOrEqual(3);
    expect(sim.machines.inBuf[burner * 2]).toBeLessThanOrEqual(2);
    expect(sim.power.factorOf(f)).toBe(1000);
    // aus: es wird nichts mehr nachgeholt
    sim.enqueue({ type: 'setAutoRefill', building: burner, on: false });
    sim.machines.inBuf[burner * 2] = 0;
    const before = sim.inventory.get(ITEM_ID.wood);
    stepFed(sim, [f], 40);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(before);
    // leerer Vorrat: an, aber nichts da
    sim.enqueue({ type: 'setAutoRefill', building: burner, on: true });
    sim.inventory.amounts.fill(0);
    stepFed(sim, [f], 40);
    expect(sim.machines.inBuf[burner * 2]).toBe(0);
  });

  it('wartende Maschinen ziehen nur 10 % ihres Verbrauchs', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    build(sim, B.pole, 6, 4);
    build(sim, B.burner, 7, 4);
    sim.machines.addFuel(sim.buildingAt(7, 4), WOOD, 5, 10);
    run(sim, 5);
    expect(sim.power.demand[0]).toBe(400);
  });

  it('Masten verbinden sich bis 8 Felder weit zu einem Netz', () => {
    const sim = makeSim();
    build(sim, B.pole, 2, 2);
    build(sim, B.pole, 10, 2); // genau 8 Felder
    build(sim, B.pole, 19, 2); // 9 Felder vom zweiten
    sim.power.ensure();
    expect(sim.power.gridCount).toBe(2);
    expect(sim.power.cables.length / 2).toBe(1);
    build(sim, B.pole, 15, 2);
    sim.power.ensure();
    expect(sim.power.gridCount).toBe(1);
    sim.enqueue({ type: 'demolish', x: 15, y: 2 });
    sim.flushCommands();
    sim.power.ensure();
    expect(sim.power.gridCount).toBe(2);
  });

  it('Brenner nimmt Holz vom Band an, aber nur eine Brennstoffart gleichzeitig', () => {
    const sim = makeSim();
    build(sim, B.burner, 4, 4);
    const id = sim.buildingAt(4, 4);
    expect(sim.machines.accept(id, WOOD)).toBe(true);
    expect(sim.machines.accept(id, ITEM_ID.charcoal)).toBe(false);
    expect(sim.machines.accept(id, ORE)).toBe(false);
    const before = sim.inventory.get(WOOD);
    sim.enqueue({ type: 'demolish', x: 4, y: 4 });
    sim.flushCommands();
    expect(sim.inventory.get(WOOD)).toBe(before + 1);
  });
});
