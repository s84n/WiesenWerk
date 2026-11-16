import { BUILDINGS, BUILDING_ID } from '../data/buildings';
import { CHAPTERS, CHAPTER_GOALS, CHAPTER_REWARDS, GOALS, GOAL_CHECK_TICKS } from '../data/goals';
import { ITEM_ID } from '../data/items';
import { RESEARCH_ID } from '../data/research';
import { MachineState } from './machines';
import type { Simulation } from './simulation';

const CHAPTER_PREFIX = 'chapter:';

/**
 * Aufgaben in Kapiteln: prüft regelmäßig die Bedingungen des aktuellen Kapitels
 * (`src/data/goals.ts`). Erledigt bleibt erledigt. Ist ein Kapitel komplett, gibt es das Geschenk
 * in den Vorrat und das nächste Kapitel beginnt.
 */
export class GoalSystem {
  readonly done = new Uint8Array(GOALS.length);
  readonly chapterDone = new Uint8Array(CHAPTERS.length);
  /** Liste ausgeblendet (vom Spieler). */
  hidden = false;
  /** Erhöht sich bei jeder Änderung (für die Oberfläche). */
  version = 0;

  /** Index des aktuellen Kapitels (= Zahl der fertigen; `CHAPTERS.length`, wenn alle fertig). */
  get chapter(): number {
    const i = this.chapterDone.indexOf(0);
    return i < 0 ? CHAPTERS.length : i;
  }

  get allDone(): boolean {
    return this.chapter >= CHAPTERS.length;
  }

  /**
   * Prüft die offenen Aufgaben des aktuellen Kapitels und meldet neu erledigte an `completed`.
   * Ein fertiges Kapitel wird an `chapterCompleted` gemeldet (Geschenk ist dann schon im Vorrat).
   */
  update(
    sim: Simulation,
    tick: number,
    completed: (goal: number) => void,
    chapterCompleted: (chapter: number) => void,
  ): void {
    if (tick % GOAL_CHECK_TICKS !== 0) return;
    const c = this.chapter;
    if (c >= CHAPTERS.length) return;
    const goals = CHAPTER_GOALS[c];
    let open = 0;
    for (let k = 0; k < goals.length; k++) {
      const g = goals[k];
      if (this.done[g]) continue;
      if (!this.check(sim, g)) {
        open++;
        continue;
      }
      this.done[g] = 1;
      this.version++;
      completed(g);
    }
    if (open > 0) return;
    this.chapterDone[c] = 1;
    sim.inventory.refund(CHAPTER_REWARDS[c]);
    this.version++;
    chapterCompleted(c);
  }

  /** Fortschritt einer zählbaren Aufgabe als [erreicht, Ziel] (sonst null). */
  progress(sim: Simulation, goal: number): [number, number] | null {
    const c = GOALS[goal].condition;
    switch (c.kind) {
      case 'harvest':
        return [sim.stats.harvested[ITEM_ID[c.item]], c.amount];
      case 'produced':
        return [sim.stats.totalProduced[ITEM_ID[c.item]], c.amount];
      case 'rate':
        return [Math.round(sim.stats.perMinute(sim.stats.produced, ITEM_ID[c.item])), c.perMinute];
      case 'landmark':
        return [sim.landmark.stage, c.stage];
      default:
        return null;
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
    CHAPTERS.forEach(
      (c, i) => (this.chapterDone[i] = done.includes(CHAPTER_PREFIX + c.key) ? 1 : 0),
    );
    this.hidden = hidden;
    this.version++;
  }

  /** Erledigte Aufgaben und Kapitel (Kapitel mit Vorsilbe `chapter:`). */
  doneKeys(): string[] {
    return [
      ...GOALS.filter((_, i) => this.done[i]).map((g) => g.key),
      ...CHAPTERS.filter((_, i) => this.chapterDone[i]).map((c) => CHAPTER_PREFIX + c.key),
    ];
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
      case 'researched':
        return sim.research.done[RESEARCH_ID[c.node]] === 1;
      case 'produced':
        return sim.stats.totalProduced[ITEM_ID[c.item]] >= c.amount;
      case 'rate':
        return sim.stats.perMinute(sim.stats.produced, ITEM_ID[c.item]) >= c.perMinute;
      case 'landmark':
        return sim.landmark.stage >= c.stage;
      case 'level': {
        const m = sim.machines;
        for (const list of [m.crafters, m.extractors])
          for (let k = 0; k < list.length; k++) if (m.upgraded[list[k]] >= c.level - 1) return true;
        return false;
      }
    }
  }
}
