import { BUILDINGS, BUILDING_ID } from '../data/buildings';
import { ITEMS } from '../data/items';
import { RECIPES, RECIPE_INPUTS, RECIPE_OUTPUTS } from '../data/recipes';
import { RESEARCH } from '../data/research';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';
import { el, formatNumber, itemIcon, itemName } from './dom';

/** Abstand des Tooltips zum Element und zum Bildrand (px). */
const GAP = 10;

/**
 * Rezeptvorschau: Fährt die Maus über ein Item-Bild (überall in der Oberfläche, erkannt am
 * Attribut `data-item`), erscheint ein Kästchen mit Name, Vorrat, woher das Item kommt
 * (Rohstoffquelle oder Rezepte mit Zutaten, Maschine, Dauer und nötiger Forschung) und wofür es
 * gebraucht wird. Ein einziger Listener am Dokument, Inhalt wird nur beim Wechsel neu gebaut.
 */
export class ItemTooltip {
  private readonly el = el('div', 'item-tooltip panel');
  private item = -1;
  private anchor: HTMLElement | null = null;
  private shownVersion = -1;

  constructor(
    parent: HTMLElement,
    private readonly getSim: () => Simulation,
    private readonly buildingIcons: readonly string[],
  ) {
    this.el.style.display = 'none';
    parent.appendChild(this.el);
    document.addEventListener('pointerover', (e) => {
      const target = (e.target as Element | null)?.closest<HTMLElement>('[data-item]');
      if (!target || this.el.contains(target)) {
        if (!target) this.hide();
        return;
      }
      this.show(target, Number(target.dataset.item));
    });
    document.addEventListener('pointerdown', () => this.hide(), true);
    document.addEventListener('wheel', () => this.hide(), { passive: true, capture: true });
  }

  /** Einmal pro Bild: verschwindet das Element (Fenster zu, neu aufgebaut), geht der Tooltip mit. */
  update(): void {
    if (this.anchor && !this.anchor.isConnected) this.hide();
  }

  private hide(): void {
    if (this.item < 0) return;
    this.item = -1;
    this.anchor = null;
    this.el.style.display = 'none';
  }

  private show(anchor: HTMLElement, item: number): void {
    if (!Number.isInteger(item) || item < 0 || item >= ITEMS.length) return;
    const sim = this.getSim();
    const version = sim.research.version * 100_000 + sim.inventory.get(item);
    if (item !== this.item || version !== this.shownVersion) this.build(sim, item);
    this.item = item;
    this.anchor = anchor;
    this.shownVersion = version;
    this.el.style.display = '';
    this.place(anchor);
  }

  private place(anchor: HTMLElement): void {
    const r = anchor.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    let y = r.bottom + GAP;
    if (y + h > innerHeight - GAP) y = r.top - h - GAP; // passt unten nicht: darüber
    x = Math.max(GAP, Math.min(innerWidth - w - GAP, x));
    y = Math.max(GAP, y);
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }

  private build(sim: Simulation, item: number): void {
    const t = TEXTS.itemTip;
    const head = el('div', 'tip-head');
    head.append(
      plainIcon(item, 'tip-icon'),
      el('span', 'tip-name', itemName(item)),
      el('span', 'tip-stock', t.stock(formatNumber(sim.inventory.get(item)))),
    );
    const parts: HTMLElement[] = [head];

    // Woher?
    parts.push(el('div', 'tip-label', t.howTo));
    const raw = TEXTS.inventory.raw[ITEMS[item].key];
    if (raw) parts.push(el('div', 'tip-text', raw));
    RECIPES.forEach((recipe, r) => {
      if (!RECIPE_OUTPUTS[r].some((o) => o.item === item)) return;
      const machine = BUILDINGS.findIndex(
        (b) => b.behavior.kind === 'crafter' && b.behavior.machine === recipe.machine,
      );
      const row = el('div', 'tip-recipe');
      const line = el('div', 'tip-recipe-line');
      for (const a of RECIPE_INPUTS[r]) line.append(chip(a.item, a.amount));
      line.append(el('span', 'tip-arrow', '→'));
      for (const a of RECIPE_OUTPUTS[r]) line.append(chip(a.item, a.amount));
      row.append(line);
      const where = el('div', 'tip-where');
      if (machine >= 0) {
        const img = el('img', 'tip-building');
        img.src = this.buildingIcons[machine] ?? '';
        img.alt = '';
        where.append(img, document.createTextNode(TEXTS.buildings[BUILDINGS[machine].key].name));
      }
      where.append(el('span', 'tip-time', t.seconds(recipe.seconds)));
      row.append(where);
      // Freigeschaltet? Sonst: welche Forschung fehlt
      const missing: string[] = [];
      if (!sim.research.recipeUnlocked[r]) {
        const node = RESEARCH.find((n) => n.recipes?.includes(recipe.key));
        if (node) missing.push(TEXTS.research.nodes[node.key]);
      }
      if (machine >= 0 && !sim.research.buildingUnlocked[machine]) {
        const node = RESEARCH.find((n) => n.buildings?.includes(BUILDINGS[machine].key));
        const name = node ? TEXTS.research.nodes[node.key] : '';
        if (name && !missing.includes(name)) missing.push(name);
      }
      if (missing.length > 0)
        row.append(el('div', 'tip-locked', t.needsResearch(missing.join(', '))));
      parts.push(row);
    });

    // Wofür?
    const uses = new Set<number>();
    RECIPES.forEach((_, r) => {
      if (!RECIPE_INPUTS[r].some((a) => a.item === item)) return;
      for (const o of RECIPE_OUTPUTS[r]) if (o.item !== item) uses.add(o.item);
    });
    const fuel = ITEMS[item].fuelValue > 0;
    if (uses.size > 0 || fuel) {
      parts.push(el('div', 'tip-label', t.usedFor));
      const list = el('div', 'tip-uses');
      for (const u of uses) {
        const use = el('span', 'tip-use');
        use.append(plainIcon(u, 'tip-use-icon'), document.createTextNode(itemName(u)));
        list.append(use);
      }
      if (fuel) {
        const use = el('span', 'tip-use');
        const img = el('img', 'tip-use-icon');
        img.src = this.buildingIcons[BUILDING_ID.burner] ?? '';
        img.alt = '';
        use.append(img, document.createTextNode(t.fuel));
        list.append(use);
      }
      parts.push(list);
    }
    this.el.replaceChildren(...parts);
  }
}

/** Item-Bild ohne `data-item` (im Tooltip selbst soll kein neuer Tooltip aufgehen). */
function plainIcon(item: number, cls: string): HTMLElement {
  const icon = itemIcon(item);
  delete icon.dataset.item;
  icon.classList.add(cls);
  return icon;
}

function chip(item: number, amount: number): HTMLElement {
  const c = el('span', 'tip-chip');
  c.append(
    plainIcon(item, 'tip-chip-icon'),
    document.createTextNode(`${amount} ${itemName(item)}`),
  );
  return c;
}
