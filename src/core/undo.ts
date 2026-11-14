import type { BeltStep } from '../sim/commands';
import type { SimEvent } from '../sim/events';
import type { Simulation } from '../sim/simulation';

/** Was ein Bau- oder Abrissschritt verändert hat (genug, um es umzukehren). */
type Change =
  | { kind: 'added'; x: number; y: number }
  | { kind: 'removed'; type: number; x: number; y: number; rot: number; recipe: number }
  | { kind: 'replaced'; oldType: number; x: number; y: number; rot: number }
  | { kind: 'rotated'; type: number; x: number; y: number; oldRot: number };

const MAX_STEPS = 30;
/** Größere Schritte (z. B. der Aufbau der Stresstest-Welt) werden nicht gemerkt. */
const MAX_CHANGES = 3000;

/**
 * „Rückgängig“ (Strg + Z) für Bau- und Abrissschritte. Merkt sich, was die Befehle eines Bildes
 * verändert haben, und schickt zum Umkehren die passenden Gegenbefehle: Gebautes wird abgerissen
 * (volle Erstattung), Abgerissenes neu gebaut (mit Rezept, sofern bezahlbar).
 */
export class UndoManager {
  private readonly steps: Change[][] = [];
  /** Die Ereignisse des nächsten Bildes stammen vom Rückgängigmachen selbst. */
  private ignoreNext = false;

  clear(): void {
    this.steps.length = 0;
    this.ignoreNext = false;
  }

  get canUndo(): boolean {
    return this.steps.length > 0;
  }

  /** Einmal pro Bild mit den Ereignissen der Simulation aufrufen. */
  record(sim: Simulation, events: readonly SimEvent[]): void {
    if (this.ignoreNext) {
      this.ignoreNext = false;
      return;
    }
    let step: Change[] | null = null;
    const b = sim.buildings;
    for (const e of events) {
      let c: Change | null = null;
      if (e.type === 'buildingAdded') {
        c = { kind: 'added', x: b.x[e.id], y: b.y[e.id] };
      } else if (e.type === 'buildingRemoved') {
        c = { kind: 'removed', type: e.buildingType, x: e.x, y: e.y, rot: e.rot, recipe: e.recipe };
      } else if (e.type === 'buildingReplaced') {
        c = { kind: 'replaced', oldType: e.oldType, x: b.x[e.id], y: b.y[e.id], rot: b.rot[e.id] };
      } else if (e.type === 'buildingRotated') {
        c = { kind: 'rotated', type: b.type[e.id], x: b.x[e.id], y: b.y[e.id], oldRot: e.oldRot };
      }
      if (!c) continue;
      step ??= [];
      step.push(c);
    }
    if (!step || step.length > MAX_CHANGES) return;
    this.steps.push(step);
    if (this.steps.length > MAX_STEPS) this.steps.shift();
  }

  /** Macht den letzten Schritt rückgängig. Gibt die Zahl der Änderungen zurück (0 = nichts). */
  undo(sim: Simulation): number {
    const step = this.steps.pop();
    if (!step) return 0;
    for (let i = step.length - 1; i >= 0; i--) {
      const c = step[i];
      switch (c.kind) {
        case 'added':
          sim.enqueue({ type: 'demolish', x: c.x, y: c.y });
          break;
        case 'removed':
          sim.enqueue({
            type: 'build',
            building: c.type,
            x: c.x,
            y: c.y,
            rot: c.rot,
            recipe: c.recipe,
          });
          break;
        case 'replaced': {
          const path: BeltStep[] = [{ x: c.x, y: c.y, dir: c.rot }];
          sim.enqueue({ type: 'buildLine', building: c.oldType, path });
          break;
        }
        case 'rotated': {
          const path: BeltStep[] = [{ x: c.x, y: c.y, dir: c.oldRot }];
          sim.enqueue({ type: 'buildLine', building: c.type, path });
          break;
        }
      }
    }
    this.ignoreNext = true;
    return step.length;
  }
}
