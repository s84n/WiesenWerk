import { BUILDING_ID } from '../data/buildings';
import { RENDER_CONFIG } from '../data/config';
import type { ItemAmount } from '../data/items';
import { RECIPES, RECIPE_OUTPUTS } from '../data/recipes';
import { RESEARCH, RESEARCH_COSTS, RESEARCH_ID, UPGRADES, upgradeCost } from '../data/research';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el, formatNumber, itemIcon, itemName } from './dom';
import { GameWindow } from './game-window';

const COL_W = 222;
const ROW_H = 250;
const CARD_W = 196;

interface NodeView {
  card: HTMLElement;
  button: HTMLButtonElement;
  costBox: HTMLElement;
  costs: CostView[];
}

/** Eine Kostenzeile: Bild, Name, „vorhanden / benötigt“ und Balken. */
interface CostView {
  row: HTMLElement;
  have: HTMLElement;
  fill: HTMLElement;
  item: number;
  amount: number;
}

interface UpgradeView {
  level: HTMLElement;
  effect: HTMLElement;
  cost: HTMLElement;
  button: HTMLButtonElement;
  shownLevel: number;
}

/**
 * Forschungsbaum (Taste T): Knoten mit Verbindungen, Kosten und Zustand
 * (gesperrt, verfügbar, erforscht), darunter die wiederholbaren Verbesserungen.
 */
export class ResearchWindow {
  readonly window: GameWindow;
  private readonly nodes: NodeView[] = [];
  private readonly upgrades: UpgradeView[] = [];
  private readonly upgradesHint: HTMLElement;
  private shownResearch = -1;
  private shownInventory = -1;
  private lastUpdate = 0;

  constructor(
    parent: HTMLElement,
    private readonly getSim: () => Simulation,
    buildingIcons: readonly string[],
  ) {
    this.window = new GameWindow(parent, TEXTS.research.title, 'research-window');
    const body = this.window.body;
    body.append(el('p', 'window-hint', TEXTS.research.hint));

    // Baum: Karten absolut platziert, Verbindungslinien als SVG dahinter
    const cols = Math.max(...RESEARCH.map((r) => r.pos[0])) + 1;
    const rows = Math.max(...RESEARCH.map((r) => r.pos[1])) + 1;
    const tree = el('div', 'research-tree');
    tree.style.width = `${cols * COL_W}px`;
    tree.style.height = `${rows * ROW_H}px`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'research-lines');
    svg.setAttribute('width', String(cols * COL_W));
    svg.setAttribute('height', String(rows * ROW_H));
    for (const r of RESEARCH) {
      for (const req of r.requires) {
        const from = RESEARCH[RESEARCH_ID[req]].pos;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const x1 = from[0] * COL_W + CARD_W;
        const y1 = from[1] * ROW_H + 40;
        const x2 = r.pos[0] * COL_W;
        const y2 = r.pos[1] * ROW_H + 40;
        const mx = (x1 + x2) / 2;
        path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
        svg.appendChild(path);
      }
    }
    tree.appendChild(svg);

    RESEARCH.forEach((r, i) => {
      const card = el('div', 'research-card');
      card.style.left = `${r.pos[0] * COL_W}px`;
      card.style.top = `${r.pos[1] * ROW_H}px`;
      card.style.width = `${CARD_W}px`;
      card.append(el('div', 'research-name', TEXTS.research.nodes[r.key]));

      // Was freigeschaltet wird
      const unlocks = el('div', 'research-unlocks');
      for (const key of r.buildings ?? []) {
        const img = el('img', 'unlock-icon');
        img.src = buildingIcons[BUILDING_ID[key]] ?? '';
        img.alt = '';
        img.title = TEXTS.buildings[key].name;
        unlocks.appendChild(img);
      }
      for (const key of r.recipes ?? []) {
        const recipe = RECIPES.findIndex((x) => x.key === key);
        const out = RECIPE_OUTPUTS[recipe][0].item;
        const icon = itemIcon(out);
        icon.classList.add('unlock-item');
        icon.title = TEXTS.research.recipe(itemName(out));
        unlocks.appendChild(icon);
      }
      if (r.extractorUpgrade) {
        for (const key of ['miner', 'lumberjack']) {
          const img = el('img', 'unlock-icon');
          img.src = buildingIcons[BUILDING_ID[key]] ?? '';
          img.alt = '';
          img.title = TEXTS.research.extractorUpgrade;
          unlocks.appendChild(img);
        }
      }
      card.append(
        unlocks,
        el('div', 'research-unlock-text', unlockText(r.buildings, r.recipes, r.extractorUpgrade)),
      );

      const costBox = el('div', 'research-costs');
      costBox.appendChild(el('div', 'research-costs-title', TEXTS.research.costs));
      const costs = RESEARCH_COSTS[i].map((c): CostView => {
        const row = el('div', 'research-cost');
        const icon = itemIcon(c.item);
        icon.classList.add('research-cost-icon');
        const have = el('span', 'research-cost-have');
        const amounts = el('span', 'research-cost-amounts');
        amounts.append(have, document.createTextNode(` / ${formatNumber(c.amount)}`));
        const bar = el('div', 'research-cost-bar');
        const fill = el('div', 'research-cost-fill');
        bar.appendChild(fill);
        row.append(icon, el('span', 'research-cost-name', itemName(c.item)), amounts, bar);
        costBox.appendChild(row);
        return { row, have, fill, item: c.item, amount: c.amount };
      });
      card.appendChild(costBox);

      const button = el('button', 'button small research-button', TEXTS.research.research);
      button.addEventListener('click', () => {
        this.getSim().enqueue({ type: 'research', node: i });
        button.blur();
      });
      card.appendChild(button);
      tree.appendChild(card);
      this.nodes.push({ card, button, costBox, costs });
    });
    const scroller = el('div', 'research-scroll');
    scroller.appendChild(tree);
    body.appendChild(scroller);

    // Wiederholbare Verbesserungen
    body.append(el('h3', 'window-subtitle', TEXTS.research.upgradesTitle));
    this.upgradesHint = el('p', 'window-hint', TEXTS.research.upgradesLocked);
    body.append(this.upgradesHint);
    const list = el('div', 'upgrade-list');
    UPGRADES.forEach((u, i) => {
      const row = el('div', 'upgrade-row');
      const text = el('div', 'upgrade-text');
      const level = el('span', 'upgrade-level');
      const name = el('div', 'research-name');
      name.append(document.createTextNode(TEXTS.research.upgrades[u.key].name + ' '), level);
      const effect = el('div', 'upgrade-effect');
      text.append(name, effect);
      const cost = el('div', 'research-costs-inline');
      const button = el('button', 'button small', TEXTS.research.buy);
      button.addEventListener('click', () => {
        this.getSim().enqueue({ type: 'buyUpgrade', upgrade: i });
        button.blur();
      });
      row.append(text, cost, button);
      list.appendChild(row);
      this.upgrades.push({ level, effect, cost, button, shownLevel: -1 });
    });
    body.appendChild(list);
  }

  /** Nach neuer Welt alles neu anzeigen. */
  invalidate(): void {
    this.shownResearch = -1;
    this.shownInventory = -1;
  }

  update(sim: Simulation, now: number): void {
    if (!this.window.isOpen) return;
    const research = sim.research;
    if (research.version === this.shownResearch && sim.inventory.version === this.shownInventory)
      return;
    if (now - this.lastUpdate < 1000 / RENDER_CONFIG.uiUpdatesPerSecond) return;
    this.lastUpdate = now;
    this.shownResearch = research.version;
    this.shownInventory = sim.inventory.version;
    const inv = sim.inventory;

    this.nodes.forEach((n, i) => {
      const done = research.done[i] === 1;
      const available = research.isAvailable(i);
      const affordable = inv.canAfford(RESEARCH_COSTS[i]);
      n.card.className = `research-card ${done ? 'done' : available ? 'available' : 'locked'}`;
      n.button.disabled = done || !available || !affordable;
      n.button.textContent = done ? TEXTS.research.done : TEXTS.research.research;
      n.button.title = done
        ? ''
        : !available
          ? TEXTS.research.locked
          : !affordable
            ? TEXTS.research.missing
            : '';
      n.costBox.hidden = done;
      for (const c of n.costs) {
        const have = inv.get(c.item);
        const ok = have >= c.amount;
        c.row.classList.toggle('missing', !ok);
        c.row.classList.toggle('enough', ok);
        c.have.textContent = formatNumber(Math.min(have, 999_999));
        c.fill.style.width = `${Math.min(100, (have / c.amount) * 100)}%`;
        c.row.title = TEXTS.research.costTooltip(
          itemName(c.item),
          formatNumber(have),
          formatNumber(c.amount),
        );
      }
    });

    let anyAvailable = false;
    this.upgrades.forEach((u, i) => {
      const def = UPGRADES[i];
      const level = research.levels[i];
      const available = research.isUpgradeAvailable(i);
      const unlocked = research.done[RESEARCH_ID[def.requires]] === 1;
      anyAvailable ||= unlocked;
      if (u.shownLevel !== level) {
        u.shownLevel = level;
        u.level.textContent = TEXTS.research.level(level);
        const pct = Math.round(def.perLevel * 100 * Math.max(1, level));
        u.effect.textContent =
          TEXTS.research.upgrades[def.key].effect(Math.round(def.perLevel * 100)) +
          (level > 0 ? ` (${TEXTS.research.level(level)}: ${pct} %)` : '');
      }
      const cost: ItemAmount[] = level < def.maxLevel ? upgradeCost(i, level) : [];
      u.cost.replaceChildren(
        ...cost.map((c) => {
          const chip = el('span', `cost-chip${inv.get(c.item) < c.amount ? ' missing' : ''}`);
          chip.append(itemIcon(c.item), document.createTextNode(formatNumber(c.amount)));
          return chip;
        }),
      );
      u.button.disabled = !available || !inv.canAfford(cost);
      u.button.textContent = level >= def.maxLevel ? TEXTS.research.maxLevel : TEXTS.research.buy;
    });
    this.upgradesHint.style.display = anyAvailable ? 'none' : '';
  }
}

function unlockText(
  buildings: readonly string[] | undefined,
  recipes: readonly string[] | undefined,
  extractor: boolean | undefined,
): string {
  const parts = [
    ...(buildings ?? []).map((k) => TEXTS.buildings[k].name),
    ...(recipes ?? []).map((k) => {
      const r = RECIPES.findIndex((x) => x.key === k);
      return TEXTS.research.recipe(itemName(RECIPE_OUTPUTS[r][0].item));
    }),
    ...(extractor ? [TEXTS.research.extractorUpgrade] : []),
  ];
  return parts.join(', ');
}
