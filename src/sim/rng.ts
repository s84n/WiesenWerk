/**
 * Deterministischer Zufall. Gleicher Startwert ergibt immer die gleiche Zahlenfolge,
 * in jedem Browser. `Math.random` wird im Spiel nie für die Welt benutzt.
 */

/** Wandelt einen Text in eine 32-Bit-Zahl (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mischt bis zu drei ganze Zahlen zu einer gut verteilten 32-Bit-Zahl. */
export function hash3(a: number, b: number, c = 0): number {
  let h =
    Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Wie `hash3`, aber als Kommazahl von 0 (inklusive) bis 1 (exklusive). */
export function hash3Float(a: number, b: number, c = 0): number {
  return hash3(a, b, c) / 4294967296;
}

/** Leitet aus einem Welt-Seed einen eigenen Seed für eine benannte Ebene ab. */
export function deriveSeed(seed: number, key: string): number {
  return hash3(seed, hashString(key));
}

/** Kleiner, schneller Zufallsgenerator (Mulberry32). */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Ganze Zahl von 0 bis 2^32 - 1. */
  nextU32(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Kommazahl von 0 (inklusive) bis 1 (exklusive). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Kommazahl von `min` bis `max`. */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Ganze Zahl von 0 bis `n - 1`. */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}

/** Würfelt einen neuen Seed für den Spieler (1 bis 999 999 999). */
export function randomSeed(source: () => number): number {
  return 1 + Math.floor(source() * 999_999_999);
}
