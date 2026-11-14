import { ITEM_COUNT, ITEM_ID } from '../data/items';
import { RENDER_CONFIG, SIM_CONFIG } from '../data/config';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el, formatNumber, itemIcon, itemName } from './dom';

export interface SpeedControl {
  isPaused(): boolean;
  togglePause(): void;
  getSpeed(): number;
  setSpeed(speed: number): void;
}

/** Diese Items stehen immer in der Kopfzeile, alle anderen erst, wenn sie vorhanden sind. */
const ALWAYS_SHOWN = [ITEM_ID.wood, ITEM_ID.stone, ITEM_ID.copperOre];

/**
 * Kopfzeile: Vorratsmengen und Spielgeschwindigkeit.
 * Aktualisiert sich nur bei Änderungen und höchstens einige Male pro Sekunde.
 */
export class Hud {
  private readonly chips: HTMLElement[] = [];
  private readonly values: HTMLElement[] = [];
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly pauseButton: HTMLButtonElement;
  private readonly powerChip: HTMLElement;
  private readonly powerText: HTMLElement;
  private lastPower = 0;
  private shownVersion = -1;
  private lastUpdate = 0;
  private shownSpeed = -1;
  private shownPaused: boolean | null = null;

  constructor(
    parent: HTMLElement,
    private readonly speed: SpeedControl,
    onMenu: () => void,
    windows: { research: () => void; stats: () => void },
  ) {
    const bar = el('div', 'panel hud');
    const items = el('div', 'hud-items');
    for (let i = 0; i < ITEM_COUNT; i++) {
      const chip = el('span', 'hud-chip');
      chip.title = itemName(i);
      const value = el('span', 'hud-value', '0');
      chip.append(itemIcon(i), value);
      chip.style.display = ALWAYS_SHOWN.includes(i) ? '' : 'none';
      items.appendChild(chip);
      this.chips.push(chip);
      this.values.push(value);
    }

    this.powerChip = el('span', 'hud-power none');
    this.powerChip.title = TEXTS.hud.powerTooltip;
    this.powerText = el('span', 'hud-value', TEXTS.hud.noPower);
    this.powerChip.append(el('span', 'hud-bolt', '⚡'), this.powerText);

    const speeds = el('div', 'hud-speed');
    this.pauseButton = el('button', 'hud-button', '❚❚');
    this.pauseButton.title = TEXTS.hud.pauseTooltip;
    this.pauseButton.addEventListener('click', () => {
      this.speed.togglePause();
      this.pauseButton.blur();
    });
    speeds.appendChild(this.pauseButton);
    for (const s of SIM_CONFIG.speeds) {
      const b = el('button', 'hud-button', `${s}×`);
      b.title = TEXTS.hud.speedTooltip(s);
      b.addEventListener('click', () => {
        if (this.speed.isPaused()) this.speed.togglePause();
        this.speed.setSpeed(s);
        b.blur();
      });
      speeds.appendChild(b);
      this.speedButtons.push(b);
    }

    for (const [label, tip, fn] of [
      ['🔬', TEXTS.research.tooltip, windows.research],
      ['📊', TEXTS.stats.tooltip, windows.stats],
    ] as const) {
      const b = el('button', 'hud-button hud-menu', label);
      b.title = tip;
      b.addEventListener('click', () => {
        b.blur();
        fn();
      });
      speeds.appendChild(b);
    }

    const menu = el('button', 'hud-button hud-menu', '☰');
    menu.title = TEXTS.menu.menuTooltip;
    menu.addEventListener('click', () => {
      menu.blur();
      onMenu();
    });
    speeds.appendChild(menu);

    bar.append(items, this.powerChip, speeds);
    parent.appendChild(bar);
  }

  update(sim: Simulation, now: number): void {
    const paused = this.speed.isPaused();
    const speed = this.speed.getSpeed();
    if (paused !== this.shownPaused || speed !== this.shownSpeed) {
      this.pauseButton.classList.toggle('active', paused);
      SIM_CONFIG.speeds.forEach((s, i) =>
        this.speedButtons[i].classList.toggle('active', !paused && s === speed),
      );
      this.shownPaused = paused;
      this.shownSpeed = speed;
    }

    if (now - this.lastPower >= 1000 / RENDER_CONFIG.uiUpdatesPerSecond) {
      this.lastPower = now;
      const p = sim.power;
      const g = p.largestGrid();
      if (g < 0) {
        this.powerText.textContent = TEXTS.hud.noPower;
        this.powerChip.className = 'hud-power none';
      } else {
        this.powerText.textContent = TEXTS.hud.power(
          Math.round(p.demand[g] / 1000),
          Math.round(p.capacity[g] / 1000),
        );
        this.powerChip.className = `hud-power ${p.factor[g] >= 1000 && p.capacity[g] > 0 ? 'ok' : p.factor[g] > 0 ? 'low' : 'none'}`;
      }
    }

    const inv = sim.inventory;
    if (inv.version === this.shownVersion) return;
    if (now - this.lastUpdate < 1000 / RENDER_CONFIG.uiUpdatesPerSecond) return;
    this.lastUpdate = now;
    this.shownVersion = inv.version;
    for (let i = 0; i < ITEM_COUNT; i++) {
      const amount = inv.get(i);
      this.values[i].textContent = formatNumber(amount);
      if (!ALWAYS_SHOWN.includes(i)) this.chips[i].style.display = amount > 0 ? '' : 'none';
    }
  }

  /** Erzwingt eine Aktualisierung (z. B. nach neuer Welt). */
  invalidate(): void {
    this.shownVersion = -1;
    this.lastUpdate = 0;
  }
}
