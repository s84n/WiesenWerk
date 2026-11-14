import {
  Group,
  IcosahedronGeometry,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  TetrahedronGeometry,
  Vector3,
  type Material,
} from 'three';
import { PALETTE } from '../data/palette';
import { FrameInstances } from './frame-instances';
import { colored, merge } from './geometry';

const POOL = 700;
const KIND_DUST = 0;
const KIND_LEAF = 1;
const KIND_SPARKLE = 2;

const m = new Matrix4();
const pos = new Vector3();
const scl = new Vector3();
const q = new Quaternion();
const axis = new Vector3(0.3, 1, 0.2).normalize();

/**
 * Kurzlebige Partikel aus einem festen Vorrat (keine Speicherzuweisungen im Betrieb):
 * Staubwölkchen beim Bauen und Abreißen, fallende Blätter beim Fällen, Funkeln bei Forschung.
 */
export class Effects {
  readonly group = new Group();
  private readonly px = new Float32Array(POOL);
  private readonly py = new Float32Array(POOL);
  private readonly pz = new Float32Array(POOL);
  private readonly vx = new Float32Array(POOL);
  private readonly vy = new Float32Array(POOL);
  private readonly vz = new Float32Array(POOL);
  private readonly age = new Float32Array(POOL);
  private readonly life = new Float32Array(POOL);
  private readonly size = new Float32Array(POOL);
  private readonly kind = new Uint8Array(POOL);
  private next = 0;
  private last = -1;
  /** Anteil der Partikel aus der Grafikstufe (0..1). */
  amount = 1;
  private readonly meshes: FrameInstances[];

  constructor(material: Material) {
    this.meshes = [
      new FrameInstances(
        merge([colored(new IcosahedronGeometry(0.14, 0), PALETTE.dust)]),
        material,
        this.group,
        128,
      ),
      new FrameInstances(
        merge([colored(new TetrahedronGeometry(0.06, 0).scale(1, 0.3, 1), PALETTE.leafLight)]),
        material,
        this.group,
        128,
      ),
      new FrameInstances(
        merge([colored(new OctahedronGeometry(0.05, 0), PALETTE.glow)]),
        material,
        this.group,
        64,
      ),
    ];
    for (let i = 0; i < POOL; i++) this.life[i] = 0;
  }

  /** Staub rund um eine Grundfläche (Bauen, Abreißen). */
  dust(x: number, z: number, w: number, h: number, strong: boolean): void {
    const n = Math.round((strong ? 10 : 4) * Math.min(1, (w + h) / 4 + 0.4) * this.amount);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const i = this.spawn(KIND_DUST, 0.7 + Math.random() * 0.4);
      this.px[i] = x + w / 2 + Math.cos(a) * w * 0.5;
      this.pz[i] = z + h / 2 + Math.sin(a) * h * 0.5;
      this.py[i] = 0.05;
      this.vx[i] = Math.cos(a) * 0.9;
      this.vz[i] = Math.sin(a) * 0.9;
      this.vy[i] = 0.4 + Math.random() * 0.4;
      this.size[i] = 0.7 + Math.random() * 0.6;
    }
  }

  /** Blätter, die von einem gefällten Baum rieseln. */
  leaves(x: number, z: number): void {
    const n = Math.round(7 * this.amount);
    for (let k = 0; k < n; k++) {
      const i = this.spawn(KIND_LEAF, 1.6 + Math.random() * 0.8);
      this.px[i] = x + Math.random() * 0.8 - 0.4;
      this.pz[i] = z + Math.random() * 0.8 - 0.4;
      this.py[i] = 0.9 + Math.random() * 0.6;
      this.vx[i] = Math.random() * 0.4 - 0.2;
      this.vz[i] = Math.random() * 0.4 - 0.2;
      this.vy[i] = -0.45;
      this.size[i] = 1;
    }
  }

  /** Funkeln über einem Punkt (Forschung, Aufgabe erledigt). */
  sparkle(x: number, z: number): void {
    const n = Math.round(24 * this.amount);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const i = this.spawn(KIND_SPARKLE, 1 + Math.random() * 0.6);
      this.px[i] = x;
      this.pz[i] = z;
      this.py[i] = 1.5;
      this.vx[i] = Math.cos(a) * (0.6 + Math.random());
      this.vz[i] = Math.sin(a) * (0.6 + Math.random());
      this.vy[i] = 1.5 + Math.random() * 1.5;
      this.size[i] = 1;
    }
  }

  update(now: number): void {
    const dt = this.last < 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    for (const mesh of this.meshes) mesh.begin();
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const f = this.age[i] / this.life[i];
      if (f >= 1) {
        this.life[i] = 0;
        continue;
      }
      const k = this.kind[i];
      if (k === KIND_DUST) {
        this.vx[i] *= 1 - dt * 2.5;
        this.vz[i] *= 1 - dt * 2.5;
      } else if (k === KIND_LEAF) {
        this.vx[i] = Math.sin(t * 3 + i) * 0.35;
      } else {
        this.vy[i] -= dt * 4;
      }
      this.px[i] += this.vx[i] * dt;
      this.py[i] = Math.max(0.02, this.py[i] + this.vy[i] * dt);
      this.pz[i] += this.vz[i] * dt;
      const s =
        k === KIND_DUST ? this.size[i] * (0.6 + f) * (1 - f * f) : k === KIND_LEAF ? 1 : 1 - f;
      pos.set(this.px[i], this.py[i], this.pz[i]);
      q.setFromAxisAngle(axis, t * 2 + i);
      scl.set(s, s, s);
      this.meshes[k].push(m.compose(pos, q, scl));
    }
    for (const mesh of this.meshes) mesh.end();
  }

  private spawn(kind: number, life: number): number {
    const i = this.next;
    this.next = (this.next + 1) % POOL;
    this.kind[i] = kind;
    this.age[i] = 0;
    this.life[i] = life;
    return i;
  }
}
