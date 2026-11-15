import { GOALS } from '../data/goals';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el } from './dom';
import { closeButton } from './icons';

/**
 * Aufgabenliste „Erste Schritte“ am linken Rand. Lässt sich ausblenden (wird im Spielstand
 * gemerkt) und über einen kleinen Knopf wieder einblenden.
 */
export class GoalsPanel {
  private readonly panel: HTMLElement;
  private readonly items: HTMLElement[] = [];
  private readonly done: HTMLElement;
  private readonly count: HTMLElement;
  private readonly showButton: HTMLButtonElement;
  private shownVersion = -1;
  private shownSim: Simulation | null = null;

  constructor(
    parent: HTMLElement,
    private readonly getSim: () => Simulation,
  ) {
    this.panel = el('div', 'panel goals-panel');
    const head = el('div', 'goals-head');
    const hide = closeButton(TEXTS.goals.hide, () =>
      this.getSim().enqueue({ type: 'setGoalsHidden', hidden: true }),
    );
    this.count = el('span', 'goals-count');
    head.append(el('h3', 'goals-title', TEXTS.goals.title), this.count, hide);
    const list = el('ul', 'goals-list');
    for (const g of GOALS) {
      const li = el('li', 'goal', TEXTS.goals.items[g.key]);
      list.append(li);
      this.items.push(li);
    }
    this.done = el('p', 'goals-done', TEXTS.goals.allDone);
    this.panel.append(head, list, this.done);

    this.showButton = el('button', 'panel goals-show', TEXTS.goals.show);
    this.showButton.addEventListener('click', () => {
      this.getSim().enqueue({ type: 'setGoalsHidden', hidden: false });
      this.showButton.blur();
    });
    parent.append(this.panel, this.showButton);
  }

  /** Zeigt die Liste nur im laufenden Spiel. */
  update(sim: Simulation, inGame: boolean): void {
    const g = sim.goals;
    const version = inGame ? g.version : -2;
    if (version === this.shownVersion && sim === this.shownSim) return;
    this.shownVersion = version;
    this.shownSim = sim;
    this.panel.style.display = inGame && !g.hidden ? '' : 'none';
    this.showButton.style.display = inGame && g.hidden ? '' : 'none';
    // Erledigte abhaken, die erste offene Aufgabe hervorheben
    let doneCount = 0;
    let current = -1;
    this.items.forEach((li, i) => {
      const checked = g.done[i] === 1;
      if (checked) doneCount++;
      else if (current < 0) current = i;
      li.classList.toggle('checked', checked);
    });
    this.items.forEach((li, i) => li.classList.toggle('current', i === current));
    this.count.textContent = TEXTS.goals.count(doneCount, this.items.length);
    this.done.style.display = g.allDone ? '' : 'none';
  }
}
