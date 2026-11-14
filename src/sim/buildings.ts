import type { BuildingDef, Dir } from '../data/buildings';

/**
 * Alle Gebäude als „Struktur aus Arrays“: je Eigenschaft ein typisiertes Array, die ID ist der Index.
 * Freie IDs werden wiederverwendet. Es gibt keine Klasseninstanz pro Gebäude.
 */
export class BuildingStore {
  capacity: number;
  type: Uint16Array;
  x: Int16Array;
  y: Int16Array;
  rot: Uint8Array;
  alive: Uint8Array;
  /** Höchste je vergebene ID + 1 (Schleifen laufen bis hier). */
  highWater = 0;
  /** Anzahl lebender Gebäude. */
  count = 0;
  private readonly free: number[] = [];

  constructor(capacity = 256) {
    this.capacity = capacity;
    this.type = new Uint16Array(capacity);
    this.x = new Int16Array(capacity);
    this.y = new Int16Array(capacity);
    this.rot = new Uint8Array(capacity);
    this.alive = new Uint8Array(capacity);
  }

  add(type: number, x: number, y: number, rot: number): number {
    let id = this.free.pop();
    if (id === undefined) {
      if (this.highWater === this.capacity) this.grow();
      id = this.highWater++;
    }
    this.type[id] = type;
    this.x[id] = x;
    this.y[id] = y;
    this.rot[id] = rot;
    this.alive[id] = 1;
    this.count++;
    return id;
  }

  remove(id: number): void {
    if (!this.alive[id]) return;
    this.alive[id] = 0;
    this.free.push(id);
    this.count--;
  }

  private grow(): void {
    const cap = this.capacity * 2;
    const grow = <T extends Uint16Array | Int16Array | Uint8Array>(
      old: T,
      make: (n: number) => T,
    ): T => {
      const next = make(cap);
      next.set(old);
      return next;
    };
    this.type = grow(this.type, (n) => new Uint16Array(n));
    this.x = grow(this.x, (n) => new Int16Array(n));
    this.y = grow(this.y, (n) => new Int16Array(n));
    this.rot = grow(this.rot, (n) => new Uint8Array(n));
    this.alive = grow(this.alive, (n) => new Uint8Array(n));
    this.capacity = cap;
  }
}

/** Breite und Tiefe eines Gebäudes nach Drehung. */
export function footprintW(def: BuildingDef, rot: number): number {
  return rot & 1 ? def.size[1] : def.size[0];
}
export function footprintH(def: BuildingDef, rot: number): number {
  return rot & 1 ? def.size[0] : def.size[1];
}

/**
 * Dreht ein Feld (lx, ly) des ungedrehten Gebäudes im Uhrzeigersinn (von oben gesehen).
 * Gibt den Versatz zur oberen linken Ecke des gedrehten Gebäudes zurück.
 */
export function rotateOffset(
  def: BuildingDef,
  rot: number,
  lx: number,
  ly: number,
  out: { x: number; y: number },
): void {
  const w = def.size[0];
  const h = def.size[1];
  switch (rot & 3) {
    case 0:
      out.x = lx;
      out.y = ly;
      break;
    case 1:
      out.x = h - 1 - ly;
      out.y = lx;
      break;
    case 2:
      out.x = w - 1 - lx;
      out.y = h - 1 - ly;
      break;
    default:
      out.x = ly;
      out.y = w - 1 - lx;
  }
}

export function rotateDir(dir: Dir, rot: number): Dir {
  return ((dir + rot) & 3) as Dir;
}

/** Versatz eines Nachbarfeldes in Richtung `dir`. */
export const DIR_X = [0, 1, 0, -1] as const;
export const DIR_Y = [-1, 0, 1, 0] as const;
