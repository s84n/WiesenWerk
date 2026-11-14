import { BUILDINGS, BUILDING_COSTS, CATEGORIES, type BuildCategory } from '../data/buildings';
import { RENDER_CONFIG } from '../data/config';
import { TEXTS } from '../data/texts';
import type { ToolController } from '../input/tools';
import type { Simulation } from '../sim/simulation';
import { el, formatNumber, itemIcon } from './dom';

/**
 * Bauleiste unten: Kategorien, Gebäude mit Bild, Name und Kosten, Abrissknopf.
 * Nicht bezahlbare Gebäude sind ausgegraut.
 */
export class BuildBar {
  private readonly entries: { type: number; button: HTMLButtonElement }[] = [];
  private readonly tabs = new Map<BuildCategory, HTMLButtonElement>();
  private readonly list: HTMLElement;
  private readonly demolishButton: HTMLButtonElement;
  private readonly modeHint: HTMLElement;
  private category: BuildCategory;
  private shownVersion = -1;
  private shownResearch = -1;
  private lastUpdate = 0;

  constructor(
    parent: HTMLElement,
    private readonly tools: ToolController,
    icons: readonly string[],
  ) {
    const wrap = el('div', 'build-wrap');
    this.modeHint = el('div', 'panel mode-hint');
    this.modeHint.style.display = 'none';

    const bar = el('div', 'panel build-bar');
    const tabRow = el('div', 'build-tabs');
    // Alle Gebäude bekommen einen Eintrag; gesperrte bleiben bis zur Forschung unsichtbar.
    const available = BUILDINGS.map((_, i) => i);
    this.category = CATEGORIES[0];
    for (const c of CATEGORIES) {
      const tab = el('button', 'build-tab', TEXTS.categories[c]);
      tab.addEventListener('click', () => {
        this.category = c;
        this.refreshCategory();
        tab.blur();
      });
      tabRow.appendChild(tab);
      this.tabs.set(c, tab);
    }
    this.demolishButton = el('button', 'build-tab demolish', TEXTS.build.demolishButton);
    this.demolishButton.addEventListener('click', () => {
      tools.toggleDemolish();
      this.demolishButton.blur();
    });
    tabRow.appendChild(this.demolishButton);

    this.list = el('div', 'build-list');
    for (const type of available) {
      const def = BUILDINGS[type];
      const text = TEXTS.buildings[def.key];
      const button = el('button', 'build-entry');
      const hotkey = tools.hotbar.indexOf(type);
      button.title = `${text.name} – ${text.description}\n${TEXTS.build.size(def.size[0], def.size[1])}${
        hotkey >= 0 ? `\n${TEXTS.build.hotkey(hotkey + 1)}` : ''
      }`;
      if (hotkey >= 0) button.appendChild(el('span', 'build-key', String(hotkey + 1)));
      const img = el('img', 'build-icon');
      img.src = icons[type] ?? '';
      img.alt = '';
      const cost = el('div', 'build-cost');
      const costs = BUILDING_COSTS[type];
      if (costs.length === 0) cost.textContent = TEXTS.build.free;
      if (def.behavior.kind === 'belt') cost.title = TEXTS.build.perTile;
      for (const c of costs) {
        const chip = el('span', 'cost-chip');
        chip.append(itemIcon(c.item), document.createTextNode(formatNumber(c.amount)));
        cost.appendChild(chip);
      }
      button.append(img, el('div', 'build-name', text.name), cost);
      button.addEventListener('click', () => {
        tools.selectBuilding(type);
        button.blur();
      });
      this.list.appendChild(button);
      this.entries.push({ type, button });
    }

    bar.append(tabRow, this.list);
    wrap.append(this.modeHint, bar);
    parent.appendChild(wrap);
    this.refreshCategory();
    this.refreshMode();
  }

  /** Nach jeder Änderung von Modus oder Auswahl aufrufen. */
  refreshMode(): void {
    const t = this.tools;
    for (const e of this.entries)
      e.button.classList.toggle('selected', t.mode === 'build' && t.buildType === e.type);
    this.demolishButton.classList.toggle('selected', t.mode === 'demolish');
    if (t.mode === 'build') {
      const cat = BUILDINGS[t.buildType].category;
      if (cat !== this.category) {
        this.category = cat;
        this.refreshCategory();
      }
      const def = BUILDINGS[t.buildType];
      const name = TEXTS.buildings[def.key].name;
      this.modeHint.textContent =
        def.behavior.kind === 'belt'
          ? TEXTS.build.modeBelt
          : def.behavior.kind === 'pole'
            ? TEXTS.build.modePole
            : def.line
              ? TEXTS.build.modeLine(name)
              : TEXTS.build.modeBuild(name);
      this.modeHint.style.display = '';
    } else if (t.mode === 'demolish') {
      this.modeHint.textContent = TEXTS.build.modeDemolish;
      this.modeHint.style.display = '';
    } else {
      this.modeHint.style.display = 'none';
    }
  }

  /** Graut nicht bezahlbare Gebäude aus (nur bei Änderungen am Vorrat) und zeigt erforschte. */
  update(sim: Simulation, now: number): void {
    if (sim.research.version !== this.shownResearch) {
      this.shownResearch = sim.research.version;
      this.unlocked = sim.research.buildingUnlocked;
      this.refreshCategory();
    }
    if (sim.inventory.version === this.shownVersion) return;
    if (now - this.lastUpdate < 1000 / RENDER_CONFIG.uiUpdatesPerSecond) return;
    this.lastUpdate = now;
    this.shownVersion = sim.inventory.version;
    for (const e of this.entries) {
      e.button.classList.toggle('unaffordable', !sim.inventory.canAfford(BUILDING_COSTS[e.type]));
    }
  }

  invalidate(): void {
    this.shownVersion = -1;
    this.shownResearch = -1;
    this.lastUpdate = 0;
  }

  /** Freigeschaltete Gebäude (aus der Forschung). */
  private unlocked: Uint8Array = Uint8Array.from(BUILDINGS, (b) => (b.availableFromStart ? 1 : 0));

  private refreshCategory(): void {
    // Kategorien ohne freigeschaltete Gebäude ausblenden
    for (const [c, tab] of this.tabs) {
      const any = this.entries.some(
        (e) => this.unlocked[e.type] && BUILDINGS[e.type].category === c,
      );
      tab.style.display = any ? '' : 'none';
      if (!any && c === this.category) this.category = CATEGORIES[0];
    }
    for (const [c, tab] of this.tabs) tab.classList.toggle('selected', c === this.category);
    for (const e of this.entries)
      e.button.style.display =
        this.unlocked[e.type] && BUILDINGS[e.type].category === this.category ? '' : 'none';
  }
}
