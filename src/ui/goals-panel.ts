import { CHAPTERS, CHAPTER_GOALS, CHAPTER_REWARDS, GOALS } from '../data/goals';
import { RENDER_CONFIG } from '../data/config';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el, formatNumber, itemIcon } from './dom';
import { closeButton } from './icons';

/**
 * Aufgabenliste am linken Rand: zeigt das aktuelle Kapitel mit seinen Aufgaben, Fortschritt bei
 * zählbaren Aufgaben und das Geschenk zum Abschluss. Lässt sich ausblenden (wird im Spielstand
 * gemerkt) und über einen kleinen Knopf wieder einblenden.
 */
export class GoalsPanel {
  private readonly panel: HTMLElement;
  private readonly title: HTMLElement;
  private readonly chapterLabel: HTMLElement;
  private readonly list: HTMLElement;
  private readonly reward: HTMLElement;
  private readonly done: HTMLElement;
  private readonly count: HTMLElement;
  private readonly showButton: HTMLButtonElement;
  private shownVersion = -1;
  private shownSim: Simulation | null = null;
  private shownChapter = -1;
  /** Aufgabe → Listeneintrag und Feld für den Fortschritt (aktuelles Kapitel). */
  private rows: { goal: number; li: HTMLElement; progress: HTMLElement }[] = [];
  private lastProgress = 0;

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
    this.title = el('h3', 'goals-title');
    head.append(this.title, this.count, hide);
    this.chapterLabel = el('div', 'goals-chapter');
    this.list = el('ul', 'goals-list');
    this.reward = el('div', 'goals-reward');
    this.done = el('p', 'goals-done', TEXTS.goals.allDone);
    this.panel.append(head, this.chapterLabel, this.list, this.reward, this.done);

    this.showButton = el('button', 'panel goals-show', TEXTS.goals.show);
    this.showButton.addEventListener('click', () => {
      this.getSim().enqueue({ type: 'setGoalsHidden', hidden: false });
      this.showButton.blur();
    });
    parent.append(this.panel, this.showButton);
  }

  /** Zeigt die Liste nur im laufenden Spiel. */
  update(sim: Simulation, inGame: boolean, now = performance.now()): void {
    const g = sim.goals;
    const version = inGame ? g.version : -2;
    if (version !== this.shownVersion || sim !== this.shownSim) {
      this.shownVersion = version;
      this.shownSim = sim;
      this.refresh(sim, inGame);
      this.lastProgress = 0;
    }
    // Fortschritt zählbarer Aufgaben (gesammelt, hergestellt …) einige Male pro Sekunde
    if (!inGame || g.hidden || now - this.lastProgress < 1000 / RENDER_CONFIG.uiUpdatesPerSecond)
      return;
    this.lastProgress = now;
    for (const r of this.rows) {
      const p = g.done[r.goal] ? null : g.progress(sim, r.goal);
      r.progress.textContent = p
        ? ` (${formatNumber(Math.min(p[0], p[1]))} / ${formatNumber(p[1])})`
        : '';
    }
  }

  private refresh(sim: Simulation, inGame: boolean): void {
    const g = sim.goals;
    this.panel.style.display = inGame && !g.hidden ? '' : 'none';
    this.showButton.style.display = inGame && g.hidden ? '' : 'none';
    const c = g.chapter;
    const finished = c >= CHAPTERS.length;
    const shown = finished ? CHAPTERS.length - 1 : c;
    if (shown !== this.shownChapter) this.buildChapter(shown);
    this.title.textContent = TEXTS.goals.chapters[CHAPTERS[shown].key];
    this.chapterLabel.textContent = TEXTS.goals.chapterOf(shown + 1, CHAPTERS.length);
    // Erledigte abhaken, die erste offene Aufgabe hervorheben
    let doneCount = 0;
    let current = -1;
    for (const r of this.rows) {
      const checked = g.done[r.goal] === 1;
      if (checked) doneCount++;
      else if (current < 0) current = r.goal;
      r.li.classList.toggle('checked', checked);
    }
    for (const r of this.rows) r.li.classList.toggle('current', r.goal === current);
    this.count.textContent = TEXTS.goals.count(doneCount, this.rows.length);
    this.done.style.display = finished ? '' : 'none';
    this.reward.style.display = finished ? 'none' : '';
  }

  private buildChapter(chapter: number): void {
    this.shownChapter = chapter;
    this.list.replaceChildren();
    this.rows = CHAPTER_GOALS[chapter].map((goal) => {
      const li = el('li', 'goal', TEXTS.goals.items[GOALS[goal].key]);
      const progress = el('span', 'goal-progress');
      li.append(progress);
      this.list.append(li);
      return { goal, li, progress };
    });
    this.reward.replaceChildren(el('span', 'goals-reward-label', TEXTS.goals.reward));
    for (const a of CHAPTER_REWARDS[chapter]) {
      const chip = el('span', 'cost-chip');
      chip.append(itemIcon(a.item), document.createTextNode(formatNumber(a.amount)));
      this.reward.append(chip);
    }
  }
}
