import { BUILDINGS } from '../data/buildings';
import type { BeltSystem } from './belts';
import { DIR_X, DIR_Y, rotateDir, rotateOffset, type BuildingStore } from './buildings';
import type { World } from './world';

const off = { x: 0, y: 0 };
/** Höchstzahl an Ein- bzw. Ausgängen eines Logistik-Gebäudes. */
export const MAX_PORTS = 3;

/** Je Gebäudetyp: Nummer des Eingangs (0, 1, 2) für jeden Anschluss in `ports` (−1 = Ausgang). */
const IN_SLOT: readonly number[][] = BUILDINGS.map((def) => {
  let n = 0;
  return def.ports.map((p) => (p.kind === 'in' ? n++ : -1));
});

/**
 * Verteiler, Zusammenführer, Bandbrücken und Lager. Sie nehmen Items vom Band an und geben
 * höchstens ein Item pro Ausgang und Tick an das Band davor weiter.
 *
 * Puffer `buf`: je Gebäude `MAX_PORTS` Plätze mit Item-ID + 1 (0 = leer).
 * - Verteiler: Platz 0, gibt reihum an freie Ausgänge ab (`cursor` = nächster Ausgang).
 * - Zusammenführer: ein Platz je Eingang, nimmt reihum (`cursor` = nächster Eingang).
 * - Bandbrücke: ein Platz je Spur (k-ter Eingang → k-ter Ausgang).
 * - Lager: Warteschlange (`queues`) in Ankunftsreihenfolge.
 */
export class LogisticsSystem {
  private cap = 0;
  buf = new Int32Array(0);
  cursor = new Uint8Array(0);
  /** Ausgänge: Bandfeld davor und Richtung, `outCount` Stück. */
  outTile = new Int32Array(0);
  outDir = new Uint8Array(0);
  outCount = new Uint8Array(0);
  /** Lager: Ringpuffer der Items. */
  readonly queues: (Uint16Array | null)[] = [];
  qHead = new Int32Array(0);
  qCount = new Int32Array(0);

  readonly splitters: number[] = [];
  readonly mergers: number[] = [];
  readonly bridges: number[] = [];
  readonly storages: number[] = [];
  /** Tunnel-Eingänge, nach ID sortiert (feste Reihenfolge, auch nach dem Laden). */
  readonly tunnels: number[] = [];
  /** Zu jedem Tunnel-Eingang der verbundene Ausgang und umgekehrt (−1 = keiner). */
  tunnelPair = new Int32Array(0);
  private pairsDirty = true;

  constructor(
    private readonly world: World,
    private readonly store: BuildingStore,
  ) {}

  setBelts(belts: BeltSystem): void {
    this.belts = belts;
  }
  private belts!: BeltSystem;

  /** Ist das ein Logistik-Gebäude (von diesem System betreut)? */
  static handles(kind: string): boolean {
    return (
      kind === 'splitter' ||
      kind === 'merger' ||
      kind === 'bridge' ||
      kind === 'storage' ||
      kind === 'tunnel'
    );
  }

  added(id: number): void {
    const def = BUILDINGS[this.store.type[id]];
    const b = def.behavior;
    if (!LogisticsSystem.handles(b.kind)) return;
    this.ensureCapacity(this.store.capacity);
    this.buf.fill(0, id * MAX_PORTS, (id + 1) * MAX_PORTS);
    this.cursor[id] = 0;
    this.queues[id] = null;
    this.qHead[id] = 0;
    this.qCount[id] = 0;
    // Ausgänge in der Reihenfolge der Anschlüsse
    let n = 0;
    const rot = this.store.rot[id];
    for (const port of def.ports) {
      if (port.kind !== 'out') continue;
      rotateOffset(def, rot, port.x, port.y, off);
      const d = rotateDir(port.dir, rot);
      const x = this.store.x[id] + off.x + DIR_X[d];
      const y = this.store.y[id] + off.y + DIR_Y[d];
      this.outTile[id * MAX_PORTS + n] = this.world.inBounds(x, y) ? this.world.index(x, y) : -1;
      this.outDir[id * MAX_PORTS + n] = d;
      n++;
    }
    this.outCount[id] = n;
    if (b.kind === 'splitter') this.splitters.push(id);
    else if (b.kind === 'merger') this.mergers.push(id);
    else if (b.kind === 'bridge') this.bridges.push(id);
    else if (b.kind === 'storage') {
      this.storages.push(id);
      this.queues[id] = new Uint16Array(b.capacity);
    } else if (b.kind === 'tunnel') {
      if (b.role === 'in') {
        let i = this.tunnels.length;
        while (i > 0 && this.tunnels[i - 1] > id) i--;
        this.tunnels.splice(i, 0, id);
      }
      this.pairsDirty = true;
    }
  }

  /** Vor dem Abriss: Inhalt zurückgeben (wird erstattet). */
  removed(id: number, refund: (item: number, amount: number) => void): void {
    const kind = BUILDINGS[this.store.type[id]].behavior.kind;
    if (!LogisticsSystem.handles(kind)) return;
    for (let j = 0; j < MAX_PORTS; j++) {
      const v = this.buf[id * MAX_PORTS + j];
      if (v > 0) refund(v - 1, 1);
      this.buf[id * MAX_PORTS + j] = 0;
    }
    const q = this.queues[id];
    if (q) {
      for (let k = 0; k < this.qCount[id]; k++) refund(q[(this.qHead[id] + k) % q.length], 1);
      this.queues[id] = null;
      this.qCount[id] = 0;
    }
    if (kind === 'tunnel') {
      this.pairsDirty = true;
      const t = this.tunnels.indexOf(id);
      if (t >= 0) this.tunnels.splice(t, 1);
      return;
    }
    const list =
      kind === 'splitter'
        ? this.splitters
        : kind === 'merger'
          ? this.mergers
          : kind === 'bridge'
            ? this.bridges
            : this.storages;
    const i = list.indexOf(id);
    if (i >= 0) {
      list[i] = list[list.length - 1];
      list.pop();
    }
  }

  /** Nimmt ein Item an Anschluss `port` (Index in `ports`) an. Rückgabe: angenommen? */
  accept(id: number, item: number, port: number): boolean {
    const type = this.store.type[id];
    const b = BUILDINGS[type].behavior;
    if (b.kind === 'storage') {
      const q = this.queues[id]!;
      if (this.qCount[id] >= q.length) return false;
      q[(this.qHead[id] + this.qCount[id]) % q.length] = item;
      this.qCount[id]++;
      return true;
    }
    const slot = b.kind === 'splitter' || b.kind === 'tunnel' ? 0 : IN_SLOT[type][port];
    if (slot < 0) return false;
    const i = id * MAX_PORTS + slot;
    if (this.buf[i] !== 0) return false;
    this.buf[i] = item + 1;
    return true;
  }

  update(): void {
    const buf = this.buf;
    // Verteiler: reihum an den nächsten freien Ausgang
    for (let n = 0; n < this.splitters.length; n++) {
      const id = this.splitters[n];
      const base = id * MAX_PORTS;
      if (buf[base] === 0) continue;
      const count = this.outCount[id];
      for (let k = 0; k < count; k++) {
        const o = (this.cursor[id] + k) % count;
        if (this.tryOutput(id, o, buf[base] - 1)) {
          buf[base] = 0;
          this.cursor[id] = (o + 1) % count;
          break;
        }
      }
    }
    // Zusammenführer: reihum vom nächsten belegten Eingang
    for (let n = 0; n < this.mergers.length; n++) {
      const id = this.mergers[n];
      const base = id * MAX_PORTS;
      for (let k = 0; k < MAX_PORTS; k++) {
        const j = (this.cursor[id] + k) % MAX_PORTS;
        if (buf[base + j] === 0) continue;
        if (this.tryOutput(id, 0, buf[base + j] - 1)) {
          buf[base + j] = 0;
          this.cursor[id] = (j + 1) % MAX_PORTS;
        }
        break;
      }
    }
    // Bandbrücken: jede Spur für sich
    for (let n = 0; n < this.bridges.length; n++) {
      const id = this.bridges[n];
      const base = id * MAX_PORTS;
      for (let j = 0; j < this.outCount[id]; j++) {
        if (buf[base + j] !== 0 && this.tryOutput(id, j, buf[base + j] - 1)) buf[base + j] = 0;
      }
    }
    // Tunnel: Eingang gibt direkt über den verbundenen Ausgang aufs Band
    if (this.pairsDirty) this.pairTunnels();
    for (let n = 0; n < this.tunnels.length; n++) {
      const id = this.tunnels[n];
      const base = id * MAX_PORTS;
      if (buf[base] === 0) continue;
      const exit = this.tunnelPair[id];
      if (exit >= 0 && this.tryOutput(exit, 0, buf[base] - 1)) buf[base] = 0;
    }
    // Lager: ältestes Item zuerst, reihum an die Ausgänge (je Ausgang höchstens 1 pro Tick)
    for (let n = 0; n < this.storages.length; n++) {
      const id = this.storages[n];
      const count = this.outCount[id];
      const q = this.queues[id]!;
      for (let k = 0; k < count && this.qCount[id] > 0; k++) {
        const o = (this.cursor[id] + k) % count;
        if (this.tryOutput(id, o, q[this.qHead[id]])) {
          this.qHead[id] = (this.qHead[id] + 1) % q.length;
          this.qCount[id]--;
          this.cursor[id] = (o + 1) % count;
        }
      }
    }
  }

  /** Verbundenes Gegenstück eines Tunnels (−1 = keins). */
  pairOf(id: number): number {
    if (this.pairsDirty) this.pairTunnels();
    return this.tunnelPair[id] ?? -1;
  }

  /**
   * Verbindet jeden Tunnel-Eingang mit dem ersten Ausgang gleicher Richtung geradeaus in
   * Reichweite. Ein weiterer Eingang gleicher Richtung dazwischen beendet die Suche.
   */
  private pairTunnels(): void {
    this.pairsDirty = false;
    if (this.tunnelPair.length < this.store.capacity)
      this.tunnelPair = new Int32Array(this.store.capacity);
    this.tunnelPair.fill(-1);
    const size = this.world.size;
    for (const id of this.tunnels) {
      const b = BUILDINGS[this.store.type[id]].behavior;
      if (b.kind !== 'tunnel') continue;
      const rot = this.store.rot[id];
      for (let k = 1; k <= b.range + 1; k++) {
        const x = this.store.x[id] + DIR_X[rot] * k;
        const y = this.store.y[id] + DIR_Y[rot] * k;
        if (!this.world.inBounds(x, y)) break;
        const other = this.world.building[y * size + x] - 1;
        if (other < 0) continue;
        const ob = BUILDINGS[this.store.type[other]].behavior;
        if (ob.kind !== 'tunnel' || this.store.rot[other] !== rot) continue;
        if (ob.role === 'in') break;
        if (this.tunnelPair[other] >= 0) break;
        this.tunnelPair[id] = other;
        this.tunnelPair[other] = id;
        break;
      }
    }
  }

  /** Inhalt eines Lagers je Item (für das Infofenster). */
  storageContents(id: number, out: Int32Array): void {
    out.fill(0);
    const q = this.queues[id];
    if (!q) return;
    for (let k = 0; k < this.qCount[id]; k++) out[q[(this.qHead[id] + k) % q.length]]++;
  }

  /** Lagerinhalt in Reihenfolge (für den Spielstand). */
  storageItems(id: number): number[] {
    const q = this.queues[id];
    if (!q) return [];
    const out: number[] = [];
    for (let k = 0; k < this.qCount[id]; k++) out.push(q[(this.qHead[id] + k) % q.length]);
    return out;
  }

  /** Lagerinhalt aus dem Spielstand übernehmen. */
  restoreStorage(id: number, items: readonly number[]): void {
    const q = this.queues[id];
    if (!q || items.length > q.length) throw new Error('Lagerinhalt passt nicht');
    q.set(items);
    this.qHead[id] = 0;
    this.qCount[id] = items.length;
  }

  private tryOutput(id: number, out: number, item: number): boolean {
    const i = id * MAX_PORTS + out;
    return this.belts.insertFromBuilding(this.outTile[i], this.outDir[i], item);
  }

  private ensureCapacity(cap: number): void {
    if (cap <= this.cap) return;
    const grow = <T extends Int32Array | Uint8Array>(old: T, n: number): T => {
      const next = new (old.constructor as new (n: number) => T)(n);
      next.set(old);
      return next;
    };
    this.buf = grow(this.buf, cap * MAX_PORTS);
    this.cursor = grow(this.cursor, cap);
    this.outTile = grow(this.outTile, cap * MAX_PORTS);
    this.outDir = grow(this.outDir, cap * MAX_PORTS);
    this.outCount = grow(this.outCount, cap);
    this.qHead = grow(this.qHead, cap);
    this.qCount = grow(this.qCount, cap);
    this.cap = cap;
  }
}
