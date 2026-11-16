import { BUILDINGS } from '../data/buildings';
import { RENDER_CONFIG } from '../data/config';
import { PALETTE } from '../data/palette';
import { TEXTS } from '../data/texts';
import { stateColor } from '../render/bottleneck-view';
import { Bottleneck, findBottlenecks, type BottleneckGroup } from '../sim/bottlenecks';
import type { Simulation } from '../sim/simulation';
import { el, hex, itemIcon, itemName } from './dom';
import { closeButton } from './icons';

/** Legende: Farbe, Text (Reihenfolge wie in der Anzeige). */
const LEGEND: readonly [number, keyof typeof TEXTS.bottlenecks.legend][] = [
  [PALETTE.hintGood, 'working'],
  [PALETTE.hintWait, 'waiting'],
  [PALETTE.hintBad, 'blocked'],
  [PALETTE.hintPower, 'noPower'],
  [PALETTE.hintIdle, 'noRecipe'],
];

/** Höchstens so viele Gruppen in der Liste (die größten). */
const MAX_GROUPS = 8;

/**
 * Engpass-Fenster neben der Engpass-Ansicht (Taste B): wie viele Maschinen arbeiten bzw. warten,
 * und die größten Probleme zusammengefasst („3 × Werkstatt wartet auf Kupferbarren“). Ein Klick
 * springt der Reihe nach zu den betroffenen Maschinen und öffnet ihr Infofenster.
 */
export class BottleneckPanel {
  private readonly panel: HTMLElement;
  private readonly counts: HTMLElement[] = [];
  private readonly list: HTMLElement;
  private lastUpdate = 0;
  private shown = false;
  /** Inhalt der Liste beim letzten Aufbau (nur bei Änderung neu, damit Klicks nicht verloren gehen). */
  private shownList = '';
  /** Aktuelle Gruppen je Schlüssel (Klick nimmt immer die neuesten IDs). */
  private groups = new Map<string, BottleneckGroup>();
  /** Zeiger je Gruppe für „nächste Maschine“ beim wiederholten Klicken. */
  private readonly cursor = new Map<string, number>();

  constructor(
    parent: HTMLElement,
    private readonly buildingIcons: readonly string[],
    private readonly jump: (id: number) => void,
    close: () => void,
  ) {
    this.panel = el('div', 'panel bottleneck-panel');
    const head = el('div', 'bottleneck-head');
    head.append(
      el('h3', 'bottleneck-title', TEXTS.bottlenecks.title),
      closeButton(TEXTS.bottlenecks.close, close),
    );
    const legend = el('div', 'bottleneck-legend');
    for (const [color, key] of LEGEND) {
      const item = el('span', 'bottleneck-legend-item');
      const dot = el('span', 'bottleneck-dot');
      dot.style.background = hex(color);
      const count = el('span', 'bottleneck-count', '0');
      item.append(dot, el('span', '', TEXTS.bottlenecks.legend[key]), count);
      legend.append(item);
      this.counts.push(count);
    }
    this.list = el('div', 'bottleneck-list');
    this.panel.append(head, legend, this.list);
    this.panel.style.display = 'none';
    parent.append(this.panel);
  }

  update(sim: Simulation, now: number, on: boolean): void {
    if (on !== this.shown) {
      this.shown = on;
      this.shownList = '-';
      this.panel.style.display = on ? '' : 'none';
      this.lastUpdate = 0;
    }
    if (!on || now - this.lastUpdate < 1000 / RENDER_CONFIG.uiUpdatesPerSecond) return;
    this.lastUpdate = now;

    // Zählung nach Farbe (gleiche Regel wie in der Ansicht)
    const tally = new Array<number>(LEGEND.length).fill(0);
    const m = sim.machines;
    for (const list of [m.crafters, m.extractors, m.burners, m.dispensers]) {
      for (let k = 0; k < list.length; k++) {
        const i = LEGEND.findIndex(([c]) => c === stateColor(sim, list[k]));
        if (i >= 0) tally[i]++;
      }
    }
    tally.forEach((n, i) => (this.counts[i].textContent = String(n)));

    const groups = findBottlenecks(sim);
    this.groups = new Map(groups.map((g) => [`${g.type}/${g.reason}/${g.item}`, g]));
    const signature = groups
      .slice(0, MAX_GROUPS)
      .map((g) => `${g.type}/${g.reason}/${g.item}:${g.ids.length}`)
      .join(' ');
    if (signature === this.shownList && groups.length > 0) return;
    this.shownList = signature;
    if (groups.length === 0) {
      this.list.replaceChildren(el('p', 'bottleneck-ok', TEXTS.bottlenecks.allGood));
      return;
    }
    const rows = groups.slice(0, MAX_GROUPS).map((g) => this.row(g));
    if (groups.length > MAX_GROUPS)
      rows.push(el('p', 'bottleneck-more', TEXTS.bottlenecks.more(groups.length - MAX_GROUPS)));
    this.list.replaceChildren(...rows);
  }

  private row(g: BottleneckGroup): HTMLElement {
    const key = `${g.type}/${g.reason}/${g.item}`;
    const row = el('button', 'bottleneck-row');
    const img = el('img', 'bottleneck-icon');
    img.src = this.buildingIcons[g.type] ?? '';
    img.alt = '';
    const text = el('div', 'bottleneck-text');
    const name = TEXTS.buildings[BUILDINGS[g.type].key].name;
    const line = el('div', 'bottleneck-line');
    line.append(
      el('strong', '', `${g.ids.length} × ${name}`),
      document.createTextNode(` ${reasonText(g)}`),
    );
    if (g.reason === Bottleneck.Missing && g.item >= 0) line.append(itemIcon(g.item));
    text.append(line, el('div', 'bottleneck-hint', hintText(g)));
    const color =
      g.reason === Bottleneck.Missing
        ? PALETTE.hintWait
        : g.reason === Bottleneck.NoPower
          ? PALETTE.hintPower
          : g.reason === Bottleneck.NoRecipe
            ? PALETTE.hintIdle
            : PALETTE.hintBad;
    row.style.borderLeftColor = hex(color);
    row.append(img, text);
    row.title = TEXTS.bottlenecks.jump;
    row.addEventListener('click', () => {
      const ids = this.groups.get(key)?.ids ?? g.ids;
      const n = (this.cursor.get(key) ?? -1) + 1;
      this.cursor.set(key, n);
      this.jump(ids[n % ids.length]);
      row.blur();
    });
    return row;
  }
}

function reasonText(g: BottleneckGroup): string {
  const T = TEXTS.bottlenecks.reasons;
  switch (g.reason) {
    case Bottleneck.Missing:
      return g.item >= 0 ? T.missing(itemName(g.item)) : T.missingAny;
    case Bottleneck.NoBelt:
      return T.noBelt;
    case Bottleneck.WrongWay:
      return T.wrongWay;
    case Bottleneck.BeltFull:
      return T.beltFull;
    case Bottleneck.NoPower:
      return T.noPower;
    default:
      return T.noRecipe;
  }
}

function hintText(g: BottleneckGroup): string {
  const T = TEXTS.bottlenecks.hints;
  const kind = BUILDINGS[g.type].behavior.kind;
  switch (g.reason) {
    case Bottleneck.Missing:
      if (kind === 'miner' || kind === 'lumberjack') return T.extractor;
      if (kind === 'burner') return T.fuel;
      if (kind === 'dispenser') return T.stock;
      return T.missing;
    case Bottleneck.NoBelt:
      return T.noBelt;
    case Bottleneck.WrongWay:
      return T.wrongWay;
    case Bottleneck.BeltFull:
      return T.beltFull;
    case Bottleneck.NoPower:
      return T.noPower;
    default:
      return T.noRecipe;
  }
}
