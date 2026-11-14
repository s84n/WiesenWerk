import { BELTS, MACHINES } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { RENDER_CONFIG, SIM_CONFIG } from '../data/config';
import {
  MAX_RECIPE_INPUTS,
  MAX_RECIPE_OUTPUTS,
  RECIPES,
  RECIPE_INPUTS,
  RECIPE_OUTPUTS,
} from '../data/recipes';
import { TEXTS } from '../data/texts';
import type { ToolController } from '../input/tools';
import { footprintH, footprintW } from '../sim/buildings';

import type { Simulation } from '../sim/simulation';
import { el, formatNumber, itemIcon, itemName } from './dom';

const STATE_CLASS = ['idle', 'working', 'waiting', 'blocked', 'norecipe', 'nopower'];

/**
 * Infofenster zu einem angeklickten Gebäude: Zustand, Rezeptwahl, Puffer und Auslastung.
 * Der Aufbau entsteht beim Öffnen; danach werden nur die Zahlen einige Male pro Sekunde aktualisiert.
 */
export class InfoPanel {
  private readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private readonly icon: HTMLImageElement;
  private shownId = -1;
  private shownRecipe = -2;
  private lastUpdate = 0;
  private updaters: ((sim: Simulation) => void)[] = [];

  constructor(
    parent: HTMLElement,
    private readonly tools: ToolController,
    private readonly buildingIcons: readonly string[],
  ) {
    this.el = el('div', 'panel info-panel');
    const head = el('div', 'info-head');
    this.icon = el('img', 'info-icon');
    this.title = el('h3', 'info-title');
    const close = el('button', 'info-close', '×');
    close.title = TEXTS.info.close;
    close.addEventListener('click', () => tools.select(-1));
    head.append(this.icon, this.title, close);
    this.body = el('div', 'info-body');
    this.el.append(head, this.body);
    this.el.style.display = 'none';
    parent.appendChild(this.el);
  }

  update(sim: Simulation, now: number): void {
    const id = this.tools.selected;
    if (id < 0 || !sim.buildings.alive[id]) {
      if (this.shownId >= 0) {
        this.el.style.display = 'none';
        this.shownId = -1;
      }
      return;
    }
    const recipe = sim.machines.recipe[id];
    if (id !== this.shownId || recipe !== this.shownRecipe) {
      this.build(sim, id);
      this.shownId = id;
      this.shownRecipe = recipe;
      this.lastUpdate = 0;
    }
    if (now - this.lastUpdate < 1000 / RENDER_CONFIG.uiUpdatesPerSecond) return;
    this.lastUpdate = now;
    for (const u of this.updaters) u(sim);
  }

  /** Baut den Inhalt für ein Gebäude neu auf. */
  private build(sim: Simulation, id: number): void {
    const type = sim.buildings.type[id];
    const def = BUILDINGS[type];
    const text = TEXTS.buildings[def.key];
    this.title.textContent = text.name;
    this.icon.src = this.buildingIcons[type] ?? '';
    this.body.replaceChildren();
    this.updaters = [];
    this.el.style.display = '';
    const b = def.behavior;

    if (b.kind === 'hq') {
      this.body.append(el('p', 'info-text', TEXTS.info.hq));
      const delivered = el('p', 'info-text soft');
      this.body.append(delivered);
      this.updaters.push(
        (s) => (delivered.textContent = TEXTS.info.delivered(s.machines.delivered)),
      );
      return;
    }

    if (b.kind === 'belt') {
      const perMinute = Math.round((b.tilesPerSecond * BELTS.unitsPerTile * 60) / BELTS.minSpacing);
      this.body.append(el('p', 'info-text', TEXTS.info.belt(perMinute)));
      const items = el('p', 'info-text soft');
      this.body.append(items);
      const tile = sim.world.index(sim.buildings.x[id], sim.buildings.y[id]);
      this.updaters.push((s) => {
        const seg = s.belts.segments[s.belts.tileSegment[tile]];
        items.textContent = seg ? TEXTS.info.beltItems(seg.count, seg.length) : '';
      });
      return;
    }

    // Zustand
    const stateRow = el('div', 'info-state');
    const dot = el('span', 'state-dot');
    const stateText = el('span');
    stateRow.append(dot, stateText);
    this.body.append(stateRow);
    this.updaters.push((s) => {
      const st = s.machines.state[id];
      dot.className = `state-dot ${STATE_CLASS[st]}`;
      stateText.textContent = TEXTS.info.states[st];
    });

    if (b.kind === 'crafter') this.buildCrafter(sim, id, b.machine);
    else this.buildExtractor(sim, id, b.kind === 'lumberjack');

    // Auslastung
    const util = el('div', 'info-section');
    util.append(el('div', 'info-label', TEXTS.info.utilization));
    const bar = el('div', 'util-bar');
    const fill = el('div', 'util-fill');
    const pct = el('span', 'util-text');
    bar.append(fill, pct);
    util.append(bar);
    this.body.append(util);
    this.updaters.push((s) => {
      const v = Math.round(s.machines.utilization[id] * 100);
      fill.style.width = `${v}%`;
      pct.textContent = `${v} %`;
    });
    for (const u of this.updaters) u(sim);
  }

  private buildCrafter(sim: Simulation, id: number, machine: string): void {
    const section = el('div', 'info-section');
    section.append(el('div', 'info-label', TEXTS.info.recipe));
    const current = sim.machines.recipe[id];
    for (let r = 0; r < RECIPES.length; r++) {
      const def = RECIPES[r];
      if (def.machine !== machine || !def.availableFromStart) continue;
      const button = el('button', `recipe${r === current ? ' selected' : ''}`);
      for (const a of RECIPE_INPUTS[r]) button.append(amountChip(a.item, a.amount));
      button.append(el('span', 'recipe-arrow', '→'));
      for (const a of RECIPE_OUTPUTS[r]) button.append(amountChip(a.item, a.amount));
      button.append(el('span', 'recipe-time', TEXTS.info.seconds(def.seconds)));
      const perMin = RECIPE_OUTPUTS[r].map(
        (a) => `${TEXTS.info.perMinute((a.amount * 60) / def.seconds)} ${itemName(a.item)}`,
      );
      button.title = perMin.join(', ');
      button.addEventListener('click', () => {
        sim.enqueue({ type: 'setRecipe', building: id, recipe: r === current ? -1 : r });
        button.blur();
      });
      section.append(button);
    }
    if (current < 0) section.append(el('p', 'info-text soft', TEXTS.info.recipeHint));
    this.body.append(section);

    if (current < 0) return;
    const buffers = el('div', 'info-section buffers');
    const add = (
      label: string,
      item: number,
      slot: number,
      limit: number,
      isInput: boolean,
    ): void => {
      const row = el('div', 'buffer-row');
      const value = el('span', 'buffer-value');
      row.append(
        el('span', 'info-label', label),
        itemIcon(item),
        el('span', 'buffer-name', itemName(item)),
        value,
      );
      buffers.append(row);
      this.updaters.push((s) => {
        const n = isInput ? s.machines.inBuf[slot] : s.machines.outBuf[slot];
        value.textContent = `${n} / ${limit}`;
      });
    };
    RECIPE_INPUTS[current].forEach((a, j) =>
      add(
        TEXTS.info.input,
        a.item,
        id * MAX_RECIPE_INPUTS + j,
        a.amount * MACHINES.inputBufferCycles,
        true,
      ),
    );
    RECIPE_OUTPUTS[current].forEach((a, j) =>
      add(
        TEXTS.info.output,
        a.item,
        id * MAX_RECIPE_OUTPUTS + j,
        a.amount * MACHINES.outputBufferCycles,
        false,
      ),
    );
    this.body.append(buffers);
  }

  private buildExtractor(sim: Simulation, id: number, lumberjack: boolean): void {
    const section = el('div', 'info-section');
    const item = sim.machines.extractItem[id];
    if (item < 0) {
      section.append(el('p', 'info-text', TEXTS.info.noDeposit));
      this.body.append(section);
      return;
    }
    const perMinute = Math.round((60 * SIM_CONFIG.ticksPerSecond) / sim.machines.extractTicks[id]);
    const row = el('div', 'buffer-row');
    row.append(
      el('span', 'info-label', TEXTS.info.extracts),
      itemIcon(item),
      el('span', 'buffer-name', itemName(item)),
      el('span', 'buffer-value', TEXTS.info.perMinute(perMinute)),
    );
    section.append(row);
    if (lumberjack) {
      const trees = el('p', 'info-text soft');
      section.append(trees);
      const list = sim.machines.treeLists[id];
      this.updaters.push((s) => {
        if (!list) return;
        let ready = 0;
        for (const t of list) if (s.trees.hasTree(t)) ready++;
        trees.textContent = TEXTS.info.trees(ready, list.length);
      });
    } else {
      section.append(el('p', 'info-text soft', TEXTS.info.purity[this.minerPurity(sim, id)] ?? ''));
    }
    const out = el('div', 'buffer-row');
    const value = el('span', 'buffer-value');
    out.append(
      el('span', 'info-label', TEXTS.info.output),
      itemIcon(item),
      el('span', 'buffer-name', itemName(item)),
      value,
    );
    section.append(out);
    this.updaters.push(
      (s) =>
        (value.textContent = `${s.machines.outBuf[id * MAX_RECIPE_OUTPUTS]} / ${MACHINES.extractorBuffer}`),
    );
    this.body.append(section);
  }

  private minerPurity(sim: Simulation, id: number): number {
    const b = sim.buildings;
    const def = BUILDINGS[b.type[id]];
    let best = 0;
    for (let y = b.y[id]; y < b.y[id] + footprintH(def, b.rot[id]); y++)
      for (let x = b.x[id]; x < b.x[id] + footprintW(def, b.rot[id]); x++)
        best = Math.max(best, sim.world.purity[sim.world.index(x, y)]);
    return best;
  }
}

function amountChip(item: number, amount: number): HTMLElement {
  const chip = el('span', 'cost-chip');
  chip.append(itemIcon(item), document.createTextNode(formatNumber(amount)));
  return chip;
}
