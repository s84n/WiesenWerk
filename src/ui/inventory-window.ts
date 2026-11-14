import { BUILDINGS } from '../data/buildings';
import { RENDER_CONFIG } from '../data/config';
import { ITEMS, ITEM_COUNT } from '../data/items';
import { RECIPES, RECIPE_INPUTS, RECIPE_OUTPUTS } from '../data/recipes';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { amountsText, el, formatNumber, itemIcon, itemName } from './dom';
import { GameWindow } from './game-window';

/**
 * Vorratsfenster: alle Items mit Menge und Herkunft (Rohstoff oder Rezept mit Maschine).
 * Items, die man noch nicht hat, sind blasser.
 */
export class InventoryWindow {
  readonly window: GameWindow;
  private readonly rows: { row: HTMLElement; value: HTMLElement; source: HTMLElement }[] = [];
  private shownInventory = -1;
  private shownResearch = -1;
  private lastUpdate = 0;

  constructor(parent: HTMLElement) {
    this.window = new GameWindow(parent, TEXTS.inventory.title, 'inventory-window');
    this.window.onToggle = (open) => {
      if (open) this.shownInventory = -1;
    };
    const body = this.window.body;
    body.append(el('p', 'window-hint', TEXTS.inventory.hint));
    const list = el('div', 'inventory-list');
    for (let i = 0; i < ITEM_COUNT; i++) {
      const row = el('div', 'inventory-row');
      const icon = itemIcon(i);
      icon.classList.add('big');
      const text = el('div', 'inventory-text');
      const source = el('div', 'inventory-source');
      text.append(el('div', 'inventory-name', itemName(i)), source);
      const value = el('div', 'inventory-value');
      row.append(icon, text, value);
      list.append(row);
      this.rows.push({ row, value, source });
    }
    body.append(list);
  }

  invalidate(): void {
    this.shownInventory = -1;
    this.shownResearch = -1;
  }

  update(sim: Simulation, now: number): void {
    if (!this.window.isOpen) return;
    if (
      sim.inventory.version === this.shownInventory &&
      sim.research.version === this.shownResearch
    )
      return;
    if (now - this.lastUpdate < 1000 / RENDER_CONFIG.uiUpdatesPerSecond) return;
    this.lastUpdate = now;
    this.shownInventory = sim.inventory.version;
    if (this.shownResearch !== sim.research.version) {
      this.shownResearch = sim.research.version;
      for (let i = 0; i < ITEM_COUNT; i++) this.rows[i].source.textContent = sourceText(sim, i);
    }
    for (let i = 0; i < ITEM_COUNT; i++) {
      const n = sim.inventory.get(i);
      this.rows[i].value.textContent = formatNumber(n);
      this.rows[i].row.classList.toggle('none', n <= 0);
    }
  }
}

/** Woher ein Item kommt: Rohstoffquelle oder Maschine mit Zutaten. */
function sourceText(sim: Simulation, item: number): string {
  const raw = TEXTS.inventory.raw[ITEMS[item].key];
  if (raw) return raw;
  const parts: string[] = [];
  RECIPES.forEach((r, i) => {
    if (!RECIPE_OUTPUTS[i].some((o) => o.item === item)) return;
    const building = BUILDINGS.find(
      (b) => b.behavior.kind === 'crafter' && b.behavior.machine === r.machine,
    );
    const name = building ? TEXTS.buildings[building.key].name : r.machine;
    const lockedNote =
      sim.research.recipeUnlocked[i] &&
      building &&
      sim.research.buildingUnlocked[BUILDINGS.indexOf(building)]
        ? ''
        : ` ${TEXTS.inventory.locked}`;
    parts.push(TEXTS.inventory.made(name, amountsText(RECIPE_INPUTS[i])) + lockedNote);
  });
  return parts.join(' · ');
}
