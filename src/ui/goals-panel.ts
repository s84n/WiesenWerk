import { GOALS } from '../data/goals';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el } from './dom';

/**
 * Aufgabenliste „Erste Schritte“ am linken Rand. Lässt sich ausblenden (wird im Spielstand
 * gemerkt) und über einen kleinen Knopf wieder einblenden.
 */
export class GoalsPanel {
  private readonly panel: HTMLElement;
  private readonly items: HTMLElement[] = [];
  private readonly done: HTMLElement;
  private readonly showButton: HTMLButtonElement;
  private shownVersion = -1;
  private shownSim: Simulation | null = null;

  constructor(
    parent: HTMLElement,
    private readonly getSim: () => Simulation,
  ) {
    this.panel = el('div', 'panel goals-panel');
    const head = el('div', 'goals-head');
    const hide = el('button', 'info-close', '×');
    hide.title = TEXTS.goals.hide;
    hide.addEventListener('click', () => {
      this.getSim().enqueue({ type: 'setGoalsHidden', hidden: true });
      hide.blur();
    });
    head.append(el('h3', 'goals-title', TEXTS.goals.title), hide);
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
    this.items.forEach((li, i) => li.classList.toggle('checked', g.done[i] === 1));
    this.done.style.display = g.allDone ? '' : 'none';
  }
}
