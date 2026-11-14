import { BUILDINGS, BUILDING_ID } from '../data/buildings';
import { GOALS, GOAL_CHECK_TICKS } from '../data/goals';
import { ITEM_ID } from '../data/items';
import { MachineState } from './machines';
import type { Simulation } from './simulation';

/**
 * Aufgabenliste „Erste Schritte“: prüft regelmäßig die Bedingungen aus `src/data/goals.ts`.
 * Erledigt bleibt erledigt, auch wenn die Bedingung später nicht mehr gilt.
 */
export class GoalSystem {
  readonly done = new Uint8Array(GOALS.length);
  /** Liste ausgeblendet (vom Spieler). */
  hidden = false;
  /** Erhöht sich bei jeder Änderung (für die Oberfläche). */
  version = 0;

  get allDone(): boolean {
    return this.done.every((d) => d === 1);
  }

  /** Prüft die offenen Aufgaben und meldet neu erledigte an `completed`. */
  update(sim: Simulation, tick: number, completed: (goal: number) => void): void {
    if (tick % GOAL_CHECK_TICKS !== 0) return;
    for (let g = 0; g < GOALS.length; g++) {
      if (this.done[g] || !this.check(sim, g)) continue;
      this.done[g] = 1;
      this.version++;
      completed(g);
    }
  }

  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    this.version++;
  }

  restore(done: readonly string[], hidden: boolean): void {
    this.done.fill(0);
    GOALS.forEach((g, i) => (this.done[i] = done.includes(g.key) ? 1 : 0));
    this.hidden = hidden;
    this.version++;
  }

  doneKeys(): string[] {
    return GOALS.filter((_, i) => this.done[i]).map((g) => g.key);
  }

  private check(sim: Simulation, goal: number): boolean {
    const c = GOALS[goal].condition;
    switch (c.kind) {
      case 'harvest':
        return sim.stats.harvested[ITEM_ID[c.item]] >= c.amount;
      case 'build':
        return c.buildings.every((key) => sim.typeCount[BUILDING_ID[key]] > 0);
      case 'working': {
        const type = BUILDING_ID[c.building];
        const kind = BUILDINGS[type].behavior.kind;
        const m = sim.machines;
        const list = kind === 'crafter' ? m.crafters : m.extractors;
        return list.some(
          (id) => sim.buildings.type[id] === type && m.state[id] === MachineState.Working,
        );
      }
      case 'delivered':
        return sim.machines.delivered >= c.amount;
      case 'research':
        return sim.research.doneCount >= c.count;
    }
  }
}
