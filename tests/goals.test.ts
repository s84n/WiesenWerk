import { describe, expect, it } from 'vitest';
import { CHAPTERS, CHAPTER_REWARDS, GOALS, GOAL_ID } from '../src/data/goals';
import { ITEM_ID } from '../src/data/items';
import { RESEARCH_ID } from '../src/data/research';
import { BUILDING_ID } from '../src/data/buildings';
import { TEXTS } from '../src/data/texts';
import { makeSim, run } from './helpers';

describe('Aufgaben in Kapiteln', () => {
  it('jede Aufgabe gehört zu genau einem Kapitel und hat einen Text', () => {
    const all = CHAPTERS.flatMap((c) => c.goals);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(GOALS.map((g) => g.key).sort());
    for (const g of GOALS) expect(TEXTS.goals.items[g.key]).toBeTruthy();
    for (const c of CHAPTERS) expect(TEXTS.goals.chapters[c.key]).toBeTruthy();
    // Verweise auf Forschung, Gebäude und Items gibt es wirklich
    for (const g of GOALS) {
      const c = g.condition;
      if (c.kind === 'researched') expect(RESEARCH_ID[c.node]).toBeDefined();
      if (c.kind === 'build') for (const b of c.buildings) expect(BUILDING_ID[b]).toBeDefined();
      if (c.kind === 'produced' || c.kind === 'rate') expect(ITEM_ID[c.item]).toBeDefined();
    }
  });

  it('prüft nur das aktuelle Kapitel und verschenkt die Belohnung genau einmal', () => {
    const sim = makeSim();
    // Kapitel 1 gilt als erledigt; Aufgaben aus Kapitel 3 zählen noch nicht
    sim.goals.restore(CHAPTERS[0].goals, false);
    sim.landmark.stage = 1; // Fundament schon fertig (gehört zu Kapitel 3)
    const plank = sim.inventory.get(ITEM_ID.plank);
    const wood0 = sim.inventory.get(ITEM_ID.wood);
    run(sim, 20);
    expect(sim.goals.chapter).toBe(1); // Kapitel 1 abgeschlossen, Geschenk gezahlt
    expect(sim.goals.done[GOAL_ID.towerFoundation]).toBe(0);
    const wood = CHAPTER_REWARDS[0].find((a) => a.item === ITEM_ID.wood)!.amount;
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood0 + wood);
    run(sim, 200);
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood0 + wood); // nicht doppelt
    expect(sim.inventory.get(ITEM_ID.plank)).toBe(plank);

    // Kapitel 2 von Hand erfüllen
    sim.stats.totalProduced[ITEM_ID.copperIngot] = 100;
    sim.research.restore(['logistics1'], {});
    sim.enqueue({ type: 'build', building: BUILDING_ID.clockTower, x: 10, y: 10, rot: 0 });
    sim.flushCommands();
    for (const key of ['furnaceWorking', 'workshopWorking']) sim.goals.done[GOAL_ID[key]] = 1;
    run(sim, 20);
    expect(sim.goals.chapter).toBe(2);
    expect(sim.inventory.get(ITEM_ID.plank)).toBeGreaterThan(plank);
    // Jetzt zählt das schon fertige Fundament für Kapitel 3
    run(sim, 20);
    expect(sim.goals.done[GOAL_ID.towerFoundation]).toBe(1);
    expect(sim.goals.doneKeys()).toContain('chapter:smelting');
  });

  it('zeigt Fortschritt bei zählbaren Aufgaben', () => {
    const sim = makeSim();
    sim.stats.totalProduced[ITEM_ID.copperIngot] = 42;
    expect(sim.goals.progress(sim, GOAL_ID.produceIngots)).toEqual([42, 100]);
    expect(sim.goals.progress(sim, GOAL_ID.buildTower)).toBeNull();
  });

  it('alte Spielstände ohne Kapitel: Kapitel 1 wird beim nächsten Prüfen abgeschlossen', () => {
    const sim = makeSim();
    sim.goals.restore(
      CHAPTERS[0].goals.map((k) => k),
      false,
    );
    expect(sim.goals.chapter).toBe(0);
    run(sim, 20);
    expect(sim.goals.chapter).toBe(1);
    expect(sim.events.filter((e) => e.type === 'chapterCompleted')).toHaveLength(1);
  });
});
