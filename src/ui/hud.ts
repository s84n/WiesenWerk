import { ITEMS, ITEM_COUNT, ITEM_ID } from '../data/items';
import { PALETTE } from '../data/palette';
import { DAY_CONFIG, RENDER_CONFIG, SEASON_CONFIG, SIM_CONFIG } from '../data/config';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el, formatNumber, hex, itemIcon } from './dom';
import { icon, type IconName } from './icons';

/** Spielminuten je Jahreszeit (bei 1-facher Geschwindigkeit). */
const SEASON_MINUTES = (SEASON_CONFIG.daysPerSeason * DAY_CONFIG.daySeconds) / 60;
const SEASON_ICONS: readonly IconName[] = ['blossom', 'sun', 'leaf', 'snowflake'];

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
    windows: {
      research: () => void;
      stats: () => void;
      inventory: () => void;
      minimap: () => void;
      bottlenecks: () => void;
      photo: () => void;
      sound: { toggle: () => void; muted: () => boolean };
    },
  ) {
    const bar = el('div', 'panel hud');
    const items = el('div', 'hud-items');
    // Klick auf die Mengen öffnet den Vorrat mit allen Items
    items.title = TEXTS.inventory.tooltip;
    items.addEventListener('click', () => windows.inventory());
    for (let i = 0; i < ITEM_COUNT; i++) {
      const chip = el('span', 'hud-chip');
      chip.dataset.item = String(i); // Rezeptvorschau beim Darüberfahren
      const value = el('span', 'hud-value', '0');
      // Farbiger Kreis hinter dem Item-Bild (Item-Farbe, aufgehellt)
      const disc = el('span', 'hud-disc');
      disc.style.background = `${hex(PALETTE[ITEMS[i].color])}66`;
      disc.append(itemIcon(i));
      chip.append(disc, value);
      chip.style.display = ALWAYS_SHOWN.includes(i) ? '' : 'none';
      items.appendChild(chip);
      this.chips.push(chip);
      this.values.push(value);
    }

    this.powerChip = el('span', 'hud-power none');
    this.powerChip.title = TEXTS.hud.powerTooltip;
    this.powerText = el('span', 'hud-value', TEXTS.hud.noPower);
    this.powerChip.append(icon('bolt', 20), this.powerText);

    // Jahreszeit: kleines rundes Symbol, Name und Restzeit im Tooltip
    this.seasonChip = el('span', 'hud-season');

    const speeds = el('div', 'hud-speed');
    this.pauseButton = el('button', 'hud-button');
    this.pauseButton.append(icon('pause', 14));
    this.pauseButton.title = TEXTS.hud.pauseTooltip;
    this.pauseButton.setAttribute('aria-label', TEXTS.hud.pauseTooltip);
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

    const extra = el('div', 'hud-extra');
    for (const [symbol, tip, fn] of [
      ['box', TEXTS.inventory.tooltip, windows.inventory],
      ['flask', TEXTS.research.tooltip, windows.research],
      ['chart', TEXTS.stats.tooltip, windows.stats],
      ['gauge', TEXTS.bottlenecks.tooltip, windows.bottlenecks],
      ['map', TEXTS.minimap.tooltip, windows.minimap],
      ['camera', TEXTS.photo.tooltip, windows.photo],
    ] as [IconName, string, () => void][]) {
      const b = el('button', 'hud-button hud-menu');
      b.append(icon(symbol));
      b.title = tip;
      b.setAttribute('aria-label', tip);
      b.addEventListener('click', () => {
        b.blur();
        fn();
      });
      extra.appendChild(b);
    }

    const sound = el('button', 'hud-button hud-menu');
    const showSound = (): void => {
      const muted = windows.sound.muted();
      sound.replaceChildren(icon(muted ? 'soundOff' : 'soundOn'));
      sound.title = muted ? TEXTS.sound.off : TEXTS.sound.on;
      sound.setAttribute('aria-label', sound.title);
    };
    showSound();
    sound.addEventListener('click', () => {
      windows.sound.toggle();
      showSound();
      sound.blur();
    });
    extra.appendChild(sound);

    const menu = el('button', 'hud-button hud-menu plain');
    menu.append(icon('menu'));
    menu.title = TEXTS.menu.menuTooltip;
    menu.setAttribute('aria-label', TEXTS.menu.menuTooltip);
    menu.addEventListener('click', () => {
      menu.blur();
      onMenu();
    });
    extra.appendChild(menu);

    // Vorrat in der Mitte, Strom und Knöpfe in einem eigenen Feld oben rechts
    bar.append(items);
    const controls = el('div', 'panel hud-controls');
    const row = el('div', 'hud-row');
    row.append(this.seasonChip, this.powerChip, speeds);
    controls.append(row, extra);
    parent.append(bar, controls);
  }

  private readonly seasonChip: HTMLElement;
  private shownSeason = -1;
  private shownSeasonMinutes = -1;

  /** Jahreszeit (`seasonAt`) im runden Feld; Tooltip mit Restzeit bis zur nächsten. */
  private updateSeason(season: number, enabled: boolean): void {
    const i = Math.floor(season) % 4;
    const left = (1 - (season - Math.floor(season))) * SEASON_MINUTES;
    const minutes = enabled ? Math.ceil(left) : -2;
    if (i === this.shownSeason && minutes === this.shownSeasonMinutes) return;
    if (i !== this.shownSeason) {
      this.seasonChip.replaceChildren(icon(SEASON_ICONS[i], 20));
      this.seasonChip.dataset.season = String(i);
    }
    this.shownSeason = i;
    this.shownSeasonMinutes = minutes;
    const names = TEXTS.seasons.names;
    this.seasonChip.title = enabled
      ? TEXTS.seasons.tooltip(names[i], names[(i + 1) % 4], minutes)
      : TEXTS.seasons.fixed;
  }

  update(sim: Simulation, now: number, season = 1.5, seasons = false): void {
    this.updateSeason(season, seasons);
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
