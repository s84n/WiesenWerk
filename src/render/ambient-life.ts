import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RENDER_CONFIG } from '../data/config';
import { PALETTE } from '../data/palette';
import { TileType } from '../data/world';
import { hash3Float } from '../sim/rng';
import type { World } from '../sim/world';
import { FrameInstances } from './frame-instances';
import { colored, merge } from './geometry';
import type { ViewRect } from './machine-animations';

const m = new Matrix4();
const pos = new Vector3();
const scl = new Vector3();
const q = new Quaternion();
const UP = new Vector3(0, 1, 0);

const FLOCKS = 2;
const BIRDS_PER_FLOCK = 5;
const BUTTERFLIES = 10;
/** Höchstens so viele Enten auf der ganzen Karte. */
const MAX_DUCKS = 48;

/** Vogel als flaches V (Flügel), Blick nach +z. */
function bird(): BufferGeometry {
  return merge([
    colored(
      new BoxGeometry(0.34, 0.025, 0.09).rotateZ(0.35).translate(-0.15, 0.05, 0),
      PALETTE.bird,
    ),
    colored(
      new BoxGeometry(0.34, 0.025, 0.09).rotateZ(-0.35).translate(0.15, 0.05, 0),
      PALETTE.bird,
    ),
    colored(new BoxGeometry(0.06, 0.05, 0.18), PALETTE.bird),
  ]);
}

function butterfly(color: number): BufferGeometry {
  return merge([
    colored(new BoxGeometry(0.09, 0.008, 0.07).translate(-0.05, 0, 0), color),
    colored(new BoxGeometry(0.09, 0.008, 0.07).translate(0.05, 0, 0), color),
  ]);
}

function duck(): BufferGeometry {
  return merge([
    colored(new SphereGeometry(0.12, 6, 4).scale(1, 0.6, 1.4), PALETTE.duck),
    colored(new SphereGeometry(0.065, 6, 4).translate(0, 0.1, 0.14), PALETTE.duckHead),
    colored(
      new ConeGeometry(0.03, 0.08, 4).rotateX(Math.PI / 2).translate(0, 0.09, 0.22),
      PALETTE.beak,
    ),
  ]);
}

/**
 * Kleines Leben in der Landschaft (rein optisch, sehr wenige Instanzen): Vogelschwärme ziehen
 * über den Bildausschnitt, Schmetterlinge flattern über der Wiese, Enten drehen auf Seen Runden.
 * Vögel und Schmetterlinge nur tagsüber und ohne Regen.
 */
export class AmbientLife {
  readonly group = new Group();
  private readonly birds: FrameInstances;
  private readonly flyA: FrameInstances;
  private readonly flyB: FrameInstances;
  private readonly ducks: FrameInstances;
  /** Entenplätze (Feldmitten auf Wasser, gleichmäßig verteilt aus dem Seed). */
  private duckX = new Float32Array(0);
  private duckZ = new Float32Array(0);

  constructor(material: Material) {
    this.birds = new FrameInstances(bird(), material, this.group, 16);
    this.flyA = new FrameInstances(butterfly(PALETTE.butterflyA), material, this.group, 16);
    this.flyB = new FrameInstances(butterfly(PALETTE.butterflyB), material, this.group, 16);
    this.ducks = new FrameInstances(duck(), material, this.group, 16);
  }

  /** Neue Welt: Entenplätze auf offenen Wasserflächen auswählen. */
  setWorld(world: World): void {
    const xs: number[] = [];
    const zs: number[] = [];
    const size = world.size;
    const water = (x: number, y: number): boolean =>
      world.inBounds(x, y) && world.tiles[world.index(x, y)] === TileType.Water;
    for (let y = 2; y < size - 2 && xs.length < MAX_DUCKS; y += 3) {
      for (let x = 2; x < size - 2 && xs.length < MAX_DUCKS; x += 3) {
        // nur mitten auf dem Wasser (Nachbarn auch Wasser) und nur ab und zu
        if (
          !water(x, y) ||
          !water(x + 1, y) ||
          !water(x - 1, y) ||
          !water(x, y + 1) ||
          !water(x, y - 1)
        )
          continue;
        if (hash3Float(x, y, world.seed + 99) > 0.035) continue;
        xs.push(x + 0.5);
        zs.push(y + 0.5);
      }
    }
    this.duckX = Float32Array.from(xs);
    this.duckZ = Float32Array.from(zs);
  }

  update(
    now: number,
    view: ViewRect,
    viewHeight: number,
    daylight: number,
    rain: number,
    details: boolean,
  ): void {
    const t = now / 1000;
    this.birds.begin();
    this.flyA.begin();
    this.flyB.begin();
    this.ducks.begin();
    const near = viewHeight <= RENDER_CONFIG.lodViewHeight;
    const cx = (view.minX + view.maxX) / 2;
    const cz = (view.minY + view.maxY) / 2;
    const w = view.maxX - view.minX;
    const h = view.maxY - view.minY;

    // Vogelschwärme: alle 40 s ein Zug quer durchs Bild, etwas versetzt
    if (daylight > 0.5 && rain < 0.3) {
      for (let f = 0; f < FLOCKS; f++) {
        const period = 40 + f * 13;
        const p = ((t + f * 21) % period) / period;
        if (p > 0.55) continue; // Pause zwischen den Zügen
        const u = p / 0.55;
        const sx = cx - w * 0.7 + u * w * 1.4;
        const sz = cz + h * (f === 0 ? -0.25 : 0.2) + Math.sin(u * 3 + f) * h * 0.05;
        const yaw = Math.PI / 2 + Math.sin(u * 3 + f) * 0.15;
        for (let b = 0; b < BIRDS_PER_FLOCK; b++) {
          const row = Math.ceil(b / 2);
          const side = b === 0 ? 0 : b % 2 === 0 ? 1 : -1;
          // V-Formation hinter dem Leitvogel
          pos.set(sx - row * 0.7, 7 + Math.sin(t * 2 + b) * 0.15, sz + side * row * 0.6);
          const flap = 0.55 + 0.45 * Math.abs(Math.sin(t * 9 + b * 1.3));
          q.setFromAxisAngle(UP, yaw);
          scl.set(1.6, 1.6 * flap, 1.6);
          this.birds.push(m.compose(pos, q, scl));
        }
      }
    }

    // Schmetterlinge in der Nähe des Blickpunkts (nur nah herangezoomt)
    if (near && details && daylight > 0.5 && rain < 0.1) {
      for (let i = 0; i < BUTTERFLIES; i++) {
        const bx = cx + (hash3Float(i, 1, 5) - 0.5) * w * 0.8;
        const bz = cz + (hash3Float(i, 2, 5) - 0.5) * h * 0.8;
        const ph = hash3Float(i, 3, 5) * 6.28;
        pos.set(
          bx + Math.sin(t * 0.5 + ph) * 1.2,
          0.35 + Math.abs(Math.sin(t * 1.3 + ph)) * 0.35,
          bz + Math.cos(t * 0.37 + ph) * 1.2,
        );
        const flap = 0.2 + 0.8 * Math.abs(Math.sin(t * 14 + ph));
        q.setFromAxisAngle(UP, t * 0.5 + ph);
        scl.set(1.4 * flap, 1.4, 1.4);
        (i % 3 === 0 ? this.flyB : this.flyA).push(m.compose(pos, q, scl));
      }
    }

    // Enten: ziehen gemächlich Kreise um ihren Platz
    if (near) {
      for (let i = 0; i < this.duckX.length; i++) {
        const x = this.duckX[i];
        const z = this.duckZ[i];
        if (x < view.minX || x > view.maxX || z < view.minY || z > view.maxY) continue;
        const ph = hash3Float(i, 7, 3) * 6.28;
        const a = t * 0.15 + ph;
        pos.set(
          x + Math.cos(a) * 0.8,
          RENDER_CONFIG.waterLevel + 0.02 + Math.sin(t * 2 + ph) * 0.01,
          z + Math.sin(a) * 0.8,
        );
        q.setFromAxisAngle(UP, -a); // Blick in Fahrtrichtung
        scl.set(1.5, 1.5, 1.5);
        this.ducks.push(m.compose(pos, q, scl));
      }
    }

    this.birds.end();
    this.flyA.end();
    this.flyB.end();
    this.ducks.end();
  }
}
