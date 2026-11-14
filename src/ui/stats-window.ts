import { SIM_CONFIG } from '../data/config';
import { ITEM_COUNT } from '../data/items';
import { RESEARCH } from '../data/research';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el, formatNumber, itemIcon, itemName } from './dom';
import { GameWindow } from './game-window';

const UPDATE_MS = 1000;

/**
 * Statistikfenster (Taste I): Produktion, Verbrauch und Anlieferung je Item pro Minute
 * sowie Gesamtzahlen. Aktualisiert sich einmal pro Sekunde, solange es offen ist.
 */
export class StatsWindow {
  readonly window: GameWindow;
  private readonly rows: { row: HTMLElement; cells: HTMLElement[] }[] = [];
  private readonly empty: HTMLElement;
  private readonly totals: HTMLElement;
  private lastUpdate = -Infinity;

  constructor(parent: HTMLElement) {
    this.window = new GameWindow(parent, TEXTS.stats.title, 'stats-window');
    this.window.onToggle = (open) => {
      if (open) this.lastUpdate = -Infinity;
    };
    const body = this.window.body;
    body.append(el('p', 'window-hint', TEXTS.stats.perMinute));
    const table = el('table', 'stats-table');
    const head = el('tr');
    for (const t of [
      TEXTS.stats.item,
      TEXTS.stats.produced,
      TEXTS.stats.consumed,
      TEXTS.stats.delivered,
    ])
      head.append(el('th', '', t));
    table.append(head);
    for (let i = 0; i < ITEM_COUNT; i++) {
      const row = el('tr');
      const name = el('td', 'stats-item');
      name.append(itemIcon(i), document.createTextNode(itemName(i)));
      const cells = [el('td', 'num'), el('td', 'num'), el('td', 'num')];
      row.append(name, ...cells);
      table.append(row);
      this.rows.push({ row, cells });
    }
    this.empty = el('p', 'info-text soft', TEXTS.stats.empty);
    body.append(table, this.empty);
    body.append(el('h3', 'window-subtitle', TEXTS.stats.totals));
    this.totals = el('div', 'stats-totals');
    body.append(this.totals);
  }

  update(sim: Simulation, now: number): void {
    if (!this.window.isOpen || now - this.lastUpdate < UPDATE_MS) return;
    this.lastUpdate = now;
    const s = sim.stats;
    let shown = 0;
    const fmt = (v: number): string => (v > 0 ? formatNumber(Math.round(v * 10) / 10) : '–');
    for (let i = 0; i < ITEM_COUNT; i++) {
      const p = s.perMinute(s.produced, i);
      const c = s.perMinute(s.consumed, i);
      const d = s.perMinute(s.delivered, i);
      const visible = p > 0 || c > 0 || d > 0 || s.totalProduced[i] > 0;
      this.rows[i].row.style.display = visible ? '' : 'none';
      if (!visible) continue;
      shown++;
      this.rows[i].cells[0].textContent = fmt(p);
      this.rows[i].cells[1].textContent = fmt(c);
      this.rows[i].cells[2].textContent = fmt(d);
    }
    this.empty.style.display = shown > 0 ? 'none' : '';

    const lines: [string, string][] = [
      [TEXTS.stats.playTime, playTime(sim.tick)],
      [TEXTS.stats.built, formatNumber(s.buildingsBuilt)],
      [TEXTS.stats.standing, formatNumber(sim.buildingCount)],
      [TEXTS.stats.deliveredTotal, formatNumber(sim.machines.delivered)],
      [TEXTS.stats.researched, `${sim.research.doneCount} / ${RESEARCH.length}`],
    ];
    this.totals.replaceChildren(
      ...lines.map(([k, v]) => {
        const row = el('div', 'stats-total');
        row.append(el('span', '', k), el('span', 'buffer-value', v));
        return row;
      }),
    );
  }
}

/** Spielzeit als „1 h 05 min“ bzw. „12 min“. */
export function playTime(tick: number): string {
  const minutes = Math.floor(tick / SIM_CONFIG.ticksPerSecond / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
