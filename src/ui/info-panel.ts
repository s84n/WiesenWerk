import { BELTS, MACHINES, POWER } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { RENDER_CONFIG, SIM_CONFIG } from '../data/config';
import { ITEMS } from '../data/items';
import { PALETTE } from '../data/palette';
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
import { el, formatNumber, hex, itemIcon, itemName } from './dom';

const kw = (w: number): string => (w / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 });

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

    if (b.kind === 'pole') {
      this.buildPole(id);
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
    const isBurner = b.kind === 'burner';
    this.updaters.push((s) => {
      const st = s.machines.state[id];
      dot.className = `state-dot ${STATE_CLASS[st]}`;
      stateText.textContent = (isBurner ? TEXTS.info.burnerStates : TEXTS.info.states)[st];
    });

    if (b.kind === 'burner') this.buildBurner(sim, id, b.fuelBuffer, b.powerKW);
    else if (b.kind === 'crafter') this.buildCrafter(sim, id, b.machine);
    else this.buildExtractor(sim, id, b.kind === 'lumberjack');
    if (def.power > 0) this.buildPowerUse(id, def.power);

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

  /** Stromverbrauch und Versorgung einer Maschine. */
  private buildPowerUse(id: number, power: number): void {
    const section = el('div', 'info-section');
    section.append(el('div', 'info-label', TEXTS.info.power));
    const use = el('p', 'info-text', TEXTS.info.powerUse(power));
    const status = el('p', 'info-text soft');
    section.append(use, status);
    this.body.append(section);
    this.updaters.push((s) => {
      s.power.ensure();
      const f = s.power.factorOf(id);
      if (s.power.gridOf[id] < 0) {
        status.textContent = TEXTS.info.noGrid;
        status.className = 'info-text warn';
      } else {
        status.textContent = TEXTS.info.powerSpeed(Math.round((f / POWER.scale) * 100));
        status.className = f >= POWER.scale ? 'info-text soft' : 'info-text warn';
      }
    });
  }

  private buildBurner(sim: Simulation, id: number, buffer: number, powerKW: number): void {
    const section = el('div', 'info-section');
    section.append(el('div', 'info-label', TEXTS.info.fuel));
    const row = el('div', 'buffer-row');
    const iconSlot = el('span');
    const name = el('span', 'buffer-name');
    const value = el('span', 'buffer-value');
    row.append(iconSlot, name, value);
    const burnBar = el('div', 'util-bar');
    const burnFill = el('div', 'util-fill fuel');
    const burnText = el('span', 'util-text');
    burnBar.append(burnFill, burnText);
    const output = el('p', 'info-text soft');
    section.append(row, burnBar, output);

    // Nachfüllen aus dem Vorrat
    const buttons = el('div', 'refill-row');
    const fuels = ITEMS.map((item, i) => ({ item, i })).filter((f) => f.item.fuelValue > 0);
    const refill: { b: HTMLButtonElement; item: number }[] = [];
    for (const f of fuels) {
      const button = el('button', 'recipe refill');
      button.append(itemIcon(f.i), el('span', '', TEXTS.info.refill(itemName(f.i))));
      button.addEventListener('click', () => {
        sim.enqueue({ type: 'refuel', building: id, item: f.i });
        button.blur();
      });
      buttons.append(button);
      refill.push({ b: button, item: f.i });
    }
    section.append(buttons);
    this.body.append(section);

    let shownItem = -2;
    this.updaters.push((s) => {
      const m = s.machines;
      const item = m.fuelItem[id];
      if (item !== shownItem) {
        shownItem = item;
        iconSlot.replaceChildren(...(item >= 0 ? [itemIcon(item)] : []));
        name.textContent = item >= 0 ? itemName(item) : '–';
      }
      value.textContent = `${m.inBuf[id * MAX_RECIPE_INPUTS]} / ${buffer}`;
      const total = item >= 0 ? ITEMS[item].fuelValue * 1000 : 1;
      const pct = Math.round(Math.min(1, m.fuelEnergy[id] / total) * 100);
      burnFill.style.width = `${pct}%`;
      burnText.textContent = `${TEXTS.info.burning} ${pct} %`;
      const g = s.power.gridOf[id];
      const load =
        g >= 0 && s.power.capacity[g] > 0 ? s.power.production[g] / s.power.capacity[g] : 0;
      output.textContent = TEXTS.info.burnerOutput(
        m.fuelEnergy[id] > 0 ? kw(powerKW * 1000 * load) : '0',
      );
      for (const r of refill) {
        const inBuf = m.inBuf[id * MAX_RECIPE_INPUTS];
        r.b.disabled =
          s.inventory.get(r.item) <= 0 || inBuf >= buffer || (inBuf > 0 && item !== r.item);
      }
    });
  }

  /** Mast: Werte seines Netzes und ein kleines Verlaufsdiagramm. */
  private buildPole(id: number): void {
    const section = el('div', 'info-section');
    section.append(el('div', 'info-label', TEXTS.info.gridTitle));
    const line = el('p', 'info-text');
    const counts = el('p', 'info-text soft');
    const speed = el('p', 'info-text soft');
    const canvas = el('canvas', 'power-chart');
    canvas.width = 260;
    canvas.height = 70;
    const legend = el('p', 'info-text soft small', TEXTS.info.chartLegend);
    section.append(line, counts, speed, canvas, legend);
    this.body.append(section);
    this.updaters.push((s) => {
      const p = s.power;
      p.ensure();
      const g = p.gridOf[id];
      if (g < 0) {
        line.textContent = TEXTS.info.noPoleGrid;
        return;
      }
      line.textContent = TEXTS.info.gridLine(
        kw(p.production[g]),
        kw(p.demand[g]),
        kw(p.capacity[g]),
      );
      counts.textContent = TEXTS.info.gridBuildings(p.consumers[g].length, p.burners[g].length);
      speed.textContent = TEXTS.info.gridSpeed(Math.round((p.factor[g] / POWER.scale) * 100));
      drawChart(canvas, p.history[g], p.historyPos, p.capacity[g]);
    });
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

/** Zeichnet Erzeugung (grün) und Verbrauch (orange) der letzten Sekunden. */
function drawChart(
  canvas: HTMLCanvasElement,
  history: Float64Array,
  pos: number,
  capacity: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const n = history.length / 2;
  let max = capacity;
  for (let i = 0; i < history.length; i++) max = Math.max(max, history[i]);
  if (max <= 0) max = 1;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, w, h);
  const line = (offset: number, color: number, width: number): void => {
    ctx.strokeStyle = hex(color);
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const idx = (pos + 1 + k) % n; // älteste zuerst
      const v = history[idx * 2 + offset];
      const x = (k / (n - 1)) * (w - 4) + 2;
      const y = h - 3 - (v / max) * (h - 8);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  // Erzeugung breit darunter, Verbrauch schmal darüber: bei Gleichstand bleiben beide sichtbar
  line(0, PALETTE.powerOk, 4);
  line(1, PALETTE.portOut, 1.5);
}
