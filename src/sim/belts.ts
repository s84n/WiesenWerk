import { BELTS } from '../data/balance';
import { BUILDINGS, type Dir } from '../data/buildings';
import { SIM_CONFIG } from '../data/config';
import { DIR_X, DIR_Y, rotateDir, rotateOffset } from './buildings';
import type { BuildingStore } from './buildings';
import type { World } from './world';

const UNIT = BELTS.unitsPerTile;
const SPACING = BELTS.minSpacing;
const NONE = -1;
const off = { x: 0, y: 0 };

/** Wohin ein Segment seine Items abgibt. */
const TargetKind = { None: 0, Building: 1, Segment: 2 } as const;

/**
 * Ein zusammenhängendes Stück Band von einem Anfang bis zu einem Ende.
 *
 * Items werden nicht als Objekte mit Position gespeichert, sondern als Abstände:
 * `gaps[vorderstes]` = Abstand des vordersten Items zum Bandende,
 * `gaps[k]` = Abstand von Item k zu Item k−1 (mindestens `SPACING`).
 * Pro Tick schrumpft nur der erste Abstand, der noch schrumpfen kann (`active`);
 * alle Items dahinter fahren dadurch automatisch mit. Ein gestautes Segment kostet fast nichts.
 * Die Arrays sind Ringpuffer: Index des k-ten Items von vorne = (head + k) % capacity.
 */
export class Segment {
  /** Feldindizes vom Anfang zum Ende. */
  readonly tiles: Int32Array;
  /** Laufrichtung je Feld (beim Verlassen). */
  readonly dirs: Uint8Array;
  /** Richtung, in der ein Item das Feld betritt (für Kurven). */
  readonly entryDirs: Uint8Array;
  readonly length: number;
  readonly lengthUnits: number;
  /** Tempo in Einheiten pro Tick. */
  readonly speed: number;
  readonly gaps: Int32Array;
  readonly items: Uint16Array;
  readonly capacity: number;
  head = 0;
  count = 0;
  /** Summe aller Abstände. Platz am Anfang = lengthUnits − total. */
  total = 0;
  /** Index (von vorne) des ersten Abstands, der noch schrumpfen kann. */
  active = 0;
  /** Ein Ring ohne Anfang und Ende. */
  readonly cyclic: boolean;
  /** Begrenzungsrechteck in Feldern (für die Darstellung). */
  minX = 1e9;
  minY = 1e9;
  maxX = -1;
  maxY = -1;

  // Zwischengespeichertes Ziel; wird bei Bauänderungen neu ermittelt.
  targetVersion = -1;
  targetKind: number = TargetKind.None;
  targetId = 0;
  /** Anschluss-Index (in `ports`) des Zielgebäudes. */
  targetPort = 0;

  constructor(
    tiles: number[],
    dirs: number[],
    entryDirs: number[],
    speed: number,
    cyclic: boolean,
    size: number,
  ) {
    this.length = tiles.length;
    this.tiles = Int32Array.from(tiles);
    this.dirs = Uint8Array.from(dirs);
    this.entryDirs = Uint8Array.from(entryDirs);
    this.lengthUnits = this.length * UNIT;
    this.speed = speed;
    this.cyclic = cyclic;
    this.capacity = Math.floor(this.lengthUnits / SPACING) + 1;
    this.gaps = new Int32Array(this.capacity);
    this.items = new Uint16Array(this.capacity);
    for (const t of tiles) {
      const x = t % size;
      const y = (t - x) / size;
      if (x < this.minX) this.minX = x;
      if (y < this.minY) this.minY = y;
      if (x > this.maxX) this.maxX = x;
      if (y > this.maxY) this.maxY = y;
    }
  }

  /** Ringpuffer-Index des k-ten Items von vorne. */
  ring(k: number): number {
    const i = this.head + k;
    return i >= this.capacity ? i - this.capacity : i;
  }

  canInsert(): boolean {
    return (
      this.count === 0 || (this.lengthUnits - this.total >= SPACING && this.count < this.capacity)
    );
  }

  /** Legt ein Item an den Anfang des Segments. Vorher `canInsert` prüfen. */
  insert(item: number): void {
    const gap = this.lengthUnits - this.total;
    const idx = this.ring(this.count);
    this.gaps[idx] = gap;
    this.items[idx] = item;
    this.count++;
    this.total += gap;
  }

  /** Entfernt das vorderste Item. */
  pop(): number {
    const idx = this.head;
    const item = this.items[idx];
    this.total -= this.gaps[idx];
    this.head = this.head + 1 === this.capacity ? 0 : this.head + 1;
    this.count--;
    this.active = 0;
    return item;
  }

  /** Fügt ein Item an einer bestimmten Position (Einheiten ab Anfang) ein. Nur beim Neuaufbau, von vorne nach hinten. */
  appendAt(item: number, pos: number): boolean {
    const frontPos = this.lengthUnits - this.total; // Position des bisher hintersten Items
    let gap = this.count === 0 ? this.lengthUnits - pos : frontPos - pos;
    if (this.count > 0 && gap < SPACING) gap = SPACING;
    if (this.count >= this.capacity || this.total + gap > this.lengthUnits) return false;
    const idx = this.ring(this.count);
    this.gaps[idx] = gap;
    this.items[idx] = item;
    this.count++;
    this.total += gap;
    return true;
  }

  /**
   * Fügt ein Item an Position `pos` (Einheiten ab Anfang) ein, wenn vor und hinter ihm genug
   * Abstand ist (Gebäude legt seitlich auf ein vorbeilaufendes Band). Rückgabe: geklappt?
   */
  insertAt(item: number, pos: number): boolean {
    if (this.count >= this.capacity) return false;
    // Items vor der Stelle überspringen (Positionen werden nach hinten kleiner)
    let cum = 0;
    let k = 0;
    for (; k < this.count; k++) {
      const g = this.gaps[this.ring(k)];
      if (this.lengthUnits - (cum + g) < pos) break;
      cum += g;
    }
    const ahead = this.lengthUnits - cum - pos; // Abstand zum Item davor bzw. zum Ende
    if (ahead < 0 || (k > 0 && ahead < SPACING)) return false;
    const hasBehind = k < this.count;
    let behind = 0;
    if (hasBehind) {
      behind = this.gaps[this.ring(k)] - ahead;
      if (behind < SPACING) return false;
    }
    // Items dahinter im Ringpuffer um eins nach hinten schieben
    for (let j = this.count; j > k; j--) {
      this.gaps[this.ring(j)] = this.gaps[this.ring(j - 1)];
      this.items[this.ring(j)] = this.items[this.ring(j - 1)];
    }
    this.gaps[this.ring(k)] = ahead;
    this.items[this.ring(k)] = item;
    if (hasBehind) this.gaps[this.ring(k + 1)] = behind;
    else this.total += ahead;
    this.count++;
    this.active = 0;
    return true;
  }

  /** Position (Einheiten ab Anfang) des k-ten Items von vorne. */
  positionOf(k: number): number {
    let d = 0;
    for (let j = 0; j <= k; j++) d += this.gaps[this.ring(j)];
    return this.lengthUnits - d;
  }
}

/** Gespeichertes Item beim Neuaufbau: Feld und Abstand vom Feldanfang. */
interface LooseItem {
  tile: number;
  offset: number;
  item: number;
}

/**
 * Alle Bänder der Welt. Kümmert sich um Segmente, Bewegung und Übergaben.
 */
export class BeltSystem {
  readonly segments: (Segment | null)[] = [];
  private readonly freeIds: number[] = [];
  /** Segment-ID je Feld (−1 = kein Band). */
  readonly tileSegment: Int32Array;
  /** Position des Feldes innerhalb seines Segments. */
  readonly tileIndex: Int32Array;
  /** Wird bei jeder Bauänderung erhöht; Segmente ermitteln ihr Ziel dann neu. */
  topologyVersion = 0;
  itemCount = 0;
  segmentCount = 0;

  constructor(
    private readonly world: World,
    private readonly buildings: BuildingStore,
    /** Nimmt ein Item am Anschluss `port` eines Gebäudes an (Rückgabe: angenommen?). */
    private readonly deliver: (building: number, item: number, port: number) => boolean,
  ) {
    const n = world.size * world.size;
    this.tileSegment = new Int32Array(n).fill(NONE);
    this.tileIndex = new Int32Array(n);
  }

  /** Ist auf dem Feld ein Band? Gibt die Gebäude-ID zurück oder −1. */
  beltAt(tile: number): number {
    const id = this.world.building[tile] - 1;
    if (id < 0) return NONE;
    return BUILDINGS[this.buildings.type[id]].behavior.kind === 'belt' ? id : NONE;
  }

  dirAt(tile: number): Dir {
    return this.buildings.rot[this.world.building[tile] - 1] as Dir;
  }

  /** Bandstufe (Gebäudetyp) auf einem Bandfeld. */
  private typeAt(tile: number): number {
    return this.buildings.type[this.world.building[tile] - 1];
  }

  /** Nachbarfeld in Richtung `dir` oder −1 außerhalb der Karte. */
  neighbor(tile: number, dir: number): number {
    const size = this.world.size;
    const x = (tile % size) + DIR_X[dir];
    const y = Math.floor(tile / size) + DIR_Y[dir];
    return x < 0 || y < 0 || x >= size || y >= size ? NONE : y * size + x;
  }

  /**
   * Das Band, das in dieses Band liefert: bevorzugt das dahinter, sonst eines von der Seite.
   * Gibt das Feld zurück oder −1.
   */
  predecessor(tile: number): number {
    const dir = this.dirAt(tile);
    const back = this.neighbor(tile, (dir + 2) & 3);
    if (back >= 0 && this.beltAt(back) >= 0 && this.dirAt(back) === dir) return back;
    for (const side of [(dir + 3) & 3, (dir + 1) & 3]) {
      const n = this.neighbor(tile, side);
      if (n >= 0 && this.beltAt(n) >= 0 && this.dirAt(n) === ((side + 2) & 3)) return n;
    }
    return NONE;
  }

  /** Das Band, an das dieses Band liefert, oder −1. */
  successor(tile: number): number {
    const next = this.neighbor(tile, this.dirAt(tile));
    if (next < 0 || this.beltAt(next) < 0) return NONE;
    return this.predecessor(next) === tile ? next : NONE;
  }

  /** Richtung, in der Items das Feld betreten (Vorgänger, sonst einspeisendes Gebäude, sonst geradeaus). */
  entryDir(tile: number): Dir {
    const pred = this.predecessor(tile);
    if (pred >= 0) return this.dirAt(pred);
    const feeder = this.feederDir(tile);
    return feeder >= 0 ? (feeder as Dir) : this.dirAt(tile);
  }

  /** Richtung eines Gebäudeausgangs, der auf dieses Feld zeigt, oder −1. */
  feederDir(tile: number): number {
    for (let d = 0; d < 4; d++) {
      const n = this.neighbor(tile, d);
      if (n < 0) continue;
      const id = this.world.building[n] - 1;
      if (id < 0) continue;
      const def = BUILDINGS[this.buildings.type[id]];
      if (def.behavior.kind === 'belt') continue;
      for (const port of def.ports) {
        if (port.kind !== 'out') continue;
        const rot = this.buildings.rot[id];
        rotateOffset(def, rot, port.x, port.y, off);
        const pd = rotateDir(port.dir, rot);
        const px = this.buildings.x[id] + off.x + DIR_X[pd];
        const py = this.buildings.y[id] + off.y + DIR_Y[pd];
        if (py * this.world.size + px === tile) return pd;
      }
    }
    return NONE;
  }

  /**
   * Richtung zu einem Gebäudeeingang, der Items von diesem Feld annehmen würde, oder −1.
   * Hilft dem Bauwerkzeug, das letzte Bandfeld automatisch ins Gebäude zeigen zu lassen.
   */
  inputDirFor(tile: number): number {
    for (let d = 0; d < 4; d++) {
      const n = this.neighbor(tile, d);
      if (n < 0) continue;
      const id = this.world.building[n] - 1;
      if (id < 0) continue;
      const def = BUILDINGS[this.buildings.type[id]];
      if (def.behavior.kind === 'belt') continue;
      const rot = this.buildings.rot[id];
      for (const port of def.ports) {
        if (port.kind !== 'in') continue;
        rotateOffset(def, rot, port.x, port.y, off);
        const tx = this.buildings.x[id] + off.x;
        const ty = this.buildings.y[id] + off.y;
        if (ty * this.world.size + tx === n && rotateDir(port.dir, rot) === ((d + 2) & 3)) return d;
      }
    }
    return NONE;
  }

  // ---------------------------------------------------------------- Bauänderungen

  /** Nach dem Bau eines Bandfeldes. */
  beltAdded(tile: number): void {
    this.rebuildAround(tile, null);
  }

  /** Nach Drehen eines Bandfeldes (Items bleiben erhalten). */
  beltChanged(tile: number): void {
    this.rebuildAround(tile, null);
  }

  /**
   * Vor dem Abriss eines Bandfeldes: Items darauf werden an `refund` gegeben.
   * Muss aufgerufen werden, nachdem das Feld aus `world.building` entfernt wurde.
   */
  beltRemoved(tile: number, refund: (item: number) => void): void {
    this.rebuildAround(tile, refund);
  }

  /** Gebäude wurde gebaut oder abgerissen: Ziele neu ermitteln. */
  buildingChanged(): void {
    this.topologyVersion++;
  }

  private rebuildAround(tile: number, refund: ((item: number) => void) | null): void {
    this.topologyVersion++;
    const loose: LooseItem[] = [];
    const dirty: number[] = [tile];
    const seeds = [tile];
    for (let d = 0; d < 4; d++) {
      const n = this.neighbor(tile, d);
      if (n >= 0) seeds.push(n);
    }
    for (const t of seeds) {
      const s = this.tileSegment[t];
      if (s >= 0) this.dissolve(s, loose, dirty);
    }

    // Neue Segmente aus allen betroffenen Feldern bilden (sortiert, damit es deterministisch bleibt)
    dirty.sort((a, b) => a - b);
    for (const t of dirty) {
      if (this.tileSegment[t] === NONE && this.beltAt(t) >= 0) this.buildChain(t, loose, dirty);
    }

    // Items wieder einsetzen, nach Segment gruppiert und von vorne nach hinten
    const bySegment = new Map<number, { pos: number; item: number }[]>();
    for (const it of loose) {
      const s = this.beltAt(it.tile) >= 0 ? this.tileSegment[it.tile] : NONE;
      if (s === NONE) {
        refund?.(it.item);
        this.itemCount--;
        continue;
      }
      const pos = this.tileIndex[it.tile] * UNIT + it.offset;
      let list = bySegment.get(s);
      if (!list) bySegment.set(s, (list = []));
      list.push({ pos, item: it.item });
    }
    for (const [s, list] of bySegment) {
      const seg = this.segments[s]!;
      list.sort((a, b) => b.pos - a.pos);
      for (const it of list) {
        if (!seg.appendAt(it.item, it.pos)) {
          refund?.(it.item);
          this.itemCount--;
        }
      }
      seg.active = 0;
    }
  }

  /** Löst ein Segment auf; seine Items und Felder werden gesammelt. */
  private dissolve(id: number, loose: LooseItem[], dirty: number[]): void {
    const seg = this.segments[id];
    if (!seg) return;
    for (let k = 0; k < seg.count; k++) {
      const pos = seg.positionOf(k);
      const ti = Math.min(seg.length - 1, Math.floor(pos / UNIT));
      loose.push({ tile: seg.tiles[ti], offset: pos - ti * UNIT, item: seg.items[seg.ring(k)] });
    }
    for (let i = 0; i < seg.length; i++) {
      const t = seg.tiles[i];
      this.tileSegment[t] = NONE;
      dirty.push(t);
    }
    this.segments[id] = null;
    this.freeIds.push(id);
    this.segmentCount--;
  }

  /** Bildet die Kette, zu der `start` gehört, und legt sie als Segment an. */
  private buildChain(seed: number, loose: LooseItem[], dirty: number[]): void {
    // Rückwärts zum Anfang laufen
    let first = seed;
    let cyclic = false;
    const type = this.typeAt(seed);
    for (let guard = 0; ; guard++) {
      const p = this.predecessor(first);
      // Segmente enden, wo die Bandstufe wechselt (jedes Segment hat ein Tempo)
      if (p < 0 || this.typeAt(p) !== type) break;
      if (p === seed || guard > this.tileSegment.length) {
        cyclic = true;
        first = seed;
        break;
      }
      if (this.tileSegment[p] !== NONE) this.dissolve(this.tileSegment[p], loose, dirty);
      first = p;
    }
    // Vorwärts sammeln
    const tiles: number[] = [];
    const dirs: number[] = [];
    let cur = first;
    for (;;) {
      if (this.tileSegment[cur] !== NONE) this.dissolve(this.tileSegment[cur], loose, dirty);
      tiles.push(cur);
      dirs.push(this.dirAt(cur));
      const next = this.successor(cur);
      if (next < 0 || next === first || this.typeAt(next) !== type) break;
      cur = next;
    }
    const entry = tiles.map((t, i) => (i === 0 ? this.entryDir(t) : dirs[i - 1]));
    const def = BUILDINGS[this.buildings.type[this.world.building[first] - 1]];
    const tps = def.behavior.kind === 'belt' ? def.behavior.tilesPerSecond : 0.5;
    const speed = Math.round((tps * UNIT) / SIM_CONFIG.ticksPerSecond);
    const seg = new Segment(tiles, dirs, entry, speed, cyclic, this.world.size);
    const id = this.freeIds.pop() ?? this.segments.length;
    this.segments[id] = seg;
    this.segmentCount++;
    for (let i = 0; i < tiles.length; i++) {
      this.tileSegment[tiles[i]] = id;
      this.tileIndex[tiles[i]] = i;
    }
  }

  // ---------------------------------------------------------------- Simulation

  /**
   * Legt ein Item von einem Gebäudeausgang auf das Band am Feld `tile`.
   * `dir` = Richtung vom Gebäude zum Band. Beginnt das Band dort, kommt das Item an den Anfang;
   * läuft es vorbei, wird es seitlich in die Feldmitte eingefädelt, sobald dort Platz ist.
   * Ein Band, das ins Gebäude zeigt, nimmt nichts an. Rückgabe: angenommen?
   */
  insertFromBuilding(tile: number, dir: number, item: number): boolean {
    if (tile < 0) return false;
    const id = this.tileSegment[tile];
    if (id < 0) return false;
    const seg = this.segments[id]!;
    const i = this.tileIndex[tile];
    if (seg.dirs[i] === ((dir + 2) & 3)) return false;
    if (i === 0 && !seg.cyclic) {
      if (!seg.canInsert()) return false;
      seg.insert(item);
    } else if (!seg.insertAt(item, i * UNIT + UNIT / 2)) {
      return false;
    }
    this.itemCount++;
    return true;
  }

  /** Ein Tick: Items bewegen und am Ende abgeben. */
  tick(): void {
    const segs = this.segments;
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      if (seg === null || seg.count === 0) continue;

      // Bewegung: nur der erste schrumpfbare Abstand wird kleiner
      if (seg.active < seg.count) {
        const k = seg.active;
        const idx = seg.ring(k);
        const min = k === 0 ? 0 : SPACING;
        const old = seg.gaps[idx];
        let g = old - seg.speed;
        if (g <= min) {
          g = min;
          seg.active++;
          // Bereits zusammengeschobene Items dahinter überspringen
          while (seg.active < seg.count && seg.gaps[seg.ring(seg.active)] <= SPACING) seg.active++;
        }
        seg.gaps[idx] = g;
        seg.total -= old - g;
      }

      // Abgabe am Ende
      if (seg.gaps[seg.head] === 0) this.output(seg);
    }
  }

  private output(seg: Segment): void {
    if (seg.targetVersion !== this.topologyVersion) this.resolveTarget(seg);
    if (seg.targetKind === TargetKind.Building) {
      if (this.deliver(seg.targetId, seg.items[seg.head], seg.targetPort)) {
        seg.pop();
        this.itemCount--;
      }
    } else if (seg.targetKind === TargetKind.Segment) {
      const next = this.segments[seg.targetId];
      if (next && next.canInsert()) next.insert(seg.pop());
    }
  }

  /** Ermittelt, wohin das Segment liefert: Gebäudeeingang, anderes Segment oder nichts. */
  private resolveTarget(seg: Segment): void {
    seg.targetVersion = this.topologyVersion;
    seg.targetKind = TargetKind.None;
    const end = seg.tiles[seg.length - 1];
    const d = seg.dirs[seg.length - 1];
    const next = this.neighbor(end, d);
    if (next < 0) return;
    if (seg.cyclic) {
      seg.targetKind = TargetKind.Segment;
      seg.targetId = this.tileSegment[end];
      return;
    }
    const id = this.world.building[next] - 1;
    if (id < 0) return;
    const def = BUILDINGS[this.buildings.type[id]];
    if (def.behavior.kind === 'belt') {
      const nextSeg = this.tileSegment[next];
      if (
        nextSeg >= 0 &&
        this.segments[nextSeg]!.tiles[0] === next &&
        this.predecessor(next) === end
      ) {
        seg.targetKind = TargetKind.Segment;
        seg.targetId = nextSeg;
      }
      return;
    }
    const rot = this.buildings.rot[id];
    for (let p = 0; p < def.ports.length; p++) {
      const port = def.ports[p];
      if (port.kind !== 'in') continue;
      rotateOffset(def, rot, port.x, port.y, off);
      const tx = this.buildings.x[id] + off.x;
      const ty = this.buildings.y[id] + off.y;
      if (ty * this.world.size + tx === next && rotateDir(port.dir, rot) === ((d + 2) & 3)) {
        seg.targetKind = TargetKind.Building;
        seg.targetId = id;
        seg.targetPort = p;
        return;
      }
    }
  }

  /**
   * Baut alle Segmente aus den vorhandenen Bandfeldern neu auf (beim Laden).
   * Danach können Segment-IDs und Items mit `restoreSegments` übernommen werden.
   */
  rebuildAll(): void {
    this.segments.length = 0;
    this.freeIds.length = 0;
    this.segmentCount = 0;
    this.itemCount = 0;
    this.tileSegment.fill(NONE);
    this.topologyVersion++;
    const loose: LooseItem[] = [];
    const dirty: number[] = [];
    for (let t = 0; t < this.tileSegment.length; t++) {
      if (this.tileSegment[t] === NONE && this.beltAt(t) >= 0) this.buildChain(t, loose, dirty);
    }
  }

  /**
   * Ordnet die neu gebildeten Segmente ihren gespeicherten IDs zu (über das Anfangsfeld),
   * damit die Reihenfolge der Bearbeitung exakt wie vor dem Speichern ist.
   */
  remapSegments(saved: readonly { id: number; start: number }[], freeIds: readonly number[]): void {
    const next: (Segment | null)[] = [];
    const used = new Set<Segment>();
    for (const { id, start } of saved) {
      const current = this.tileSegment[start];
      const seg = current >= 0 ? this.segments[current] : null;
      if (!seg) throw new Error(`Bandsegment ${id} passt nicht zu den Bändern.`);
      next[id] = seg;
      used.add(seg);
    }
    // Segmente ohne gespeicherten Eintrag (sollte nicht vorkommen) hinten anhängen
    for (const seg of this.segments) if (seg && !used.has(seg)) next.push(seg);
    this.segments.length = 0;
    for (let i = 0; i < next.length; i++) this.segments.push(next[i] ?? null);
    this.freeIds.length = 0;
    this.freeIds.push(...freeIds.filter((id) => id < next.length && !next[id]));
    for (let i = 0; i < next.length; i++)
      if (!next[i] && !this.freeIds.includes(i)) this.freeIds.push(i);
    for (let id = 0; id < this.segments.length; id++) {
      const seg = this.segments[id];
      if (!seg) continue;
      for (let i = 0; i < seg.length; i++) {
        this.tileSegment[seg.tiles[i]] = id;
        this.tileIndex[seg.tiles[i]] = i;
      }
    }
  }

  /** Freie Segment-IDs (für den Spielstand). */
  get freeSegmentIds(): readonly number[] {
    return this.freeIds;
  }

  /** Füllt ein Segment vollständig mit einem Item (Stresstest). */
  fill(id: number, item: number): void {
    const seg = this.segments[id];
    if (!seg) return;
    while (
      seg.count < seg.capacity - 1 &&
      seg.appendAt(item, seg.lengthUnits - seg.total - SPACING)
    ) {
      this.itemCount++;
    }
  }
}
