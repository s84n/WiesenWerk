import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { BUILDINGS } from '../data/buildings';
import { LIFE_CONFIG, VILLAGE_CONFIG } from '../data/config';
import { PALETTE } from '../data/palette';
import { TileType } from '../data/world';
import type { SimEvent } from '../sim/events';
import { hash3Float } from '../sim/rng';
import type { Simulation } from '../sim/simulation';
import { bulb, bulbWarm, campfire } from './animal-models';
import { FrameInstances } from './frame-instances';
import { colored, merge } from './geometry';
import type { ViewRect } from './machine-animations';
import { ITEM_ID } from '../data/items';

const CAKE = ITEM_ID.cake;

const C = VILLAGE_CONFIG;
const m = new Matrix4();
const pos = new Vector3();
const scl = new Vector3(1, 1, 1);
const q = new Quaternion();
const UP = new Vector3(0, 1, 0);

function box(w: number, h: number, d: number, x: number, y: number, z: number, c: number) {
  return colored(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
}

/** Kleines Wohnhaus (1 Feld) mit Satteldach, Tür, Fenster, Schornstein und Blumenkasten. */
function house(wall: number, roof: number, variant: number): BufferGeometry {
  const roofGeo = new CylinderGeometry(1, 1, 0.78, 3)
    .rotateX(-Math.PI / 2)
    .rotateY(Math.PI / 2)
    .translate(0, 0.5, 0)
    .scale(1, 0.3 / 1.5, 0.7 / Math.sqrt(3));
  const parts = [
    box(0.62, 0.48, 0.52, 0, 0, -0.04, wall),
    colored(roofGeo.translate(0, 0.48, -0.04), roof),
    box(0.14, 0.24, 0.02, -0.12, 0, 0.23, PALETTE.woodDark),
    box(0.13, 0.11, 0.02, 0.15, 0.22, 0.23, PALETTE.windowLight),
    box(0.02, 0.11, 0.13, 0.32, 0.22, -0.04, PALETTE.windowLight),
    box(0.09, 0.22, 0.09, 0.18, 0.62, -0.12, PALETTE.brick),
    // Blumenkasten bzw. kleines Beet vor dem Haus
    box(0.3, 0.05, 0.1, 0.15, 0, 0.36, PALETTE.garden),
    box(
      0.06,
      0.06,
      0.06,
      0.06,
      0.05,
      0.36,
      variant === 0 ? PALETTE.flowerPink : PALETTE.flowerYellow,
    ),
    box(
      0.06,
      0.06,
      0.06,
      0.24,
      0.05,
      0.36,
      variant === 2 ? PALETTE.flowerViolet : PALETTE.flowerWhite,
    ),
  ];
  return merge(parts);
}

function villager(shirt: number): BufferGeometry {
  return merge([
    box(0.07, 0.1, 0.05, 0, 0, 0, PALETTE.workerPants),
    box(0.1, 0.12, 0.07, 0, 0.1, 0, shirt),
    colored(new SphereGeometry(0.045, 6, 4).translate(0, 0.27, 0), PALETTE.skin),
  ]);
}

const HOUSE_LOOKS: readonly [number, number][] = [
  [PALETTE.houseWall, PALETTE.houseRoofA],
  [PALETTE.houseWallB, PALETTE.houseRoofB],
  [PALETTE.houseWall, PALETTE.houseRoofC],
];
const SHIRTS = [PALETTE.villagerA, PALETTE.villagerB, PALETTE.villagerC];

/**
 * Das Dorf: Je größer die Fabrik, desto mehr kleine Häuser stehen auf freier Wiese rund um die
 * Zentrale. Rein optisch – die Simulation kennt sie nicht. Wird ein Feld bebaut, verschwindet
 * das Haus dort und ein anderes entsteht auf dem nächsten freien Platz. Tagsüber spazieren die
 * Bewohner um ihr Haus oder zur Zentrale, nachts leuchten die Fenster.
 */
export class Village {
  readonly group = new Group();
  private readonly houses: InstancedMesh[];
  private readonly people: FrameInstances[];
  /** Mögliche Hausplätze (Feldindex), nach Abstand zur Zentrale sortiert. */
  private candidates: number[] = [];
  private hq = -1;
  private hqX = 0;
  private hqZ = 0;
  /** Gewählte Plätze: Feldindex und Aussehen. */
  private placed: number[] = [];
  private dirty = true;
  private lastRefresh = -1e9;
  /** Familien, die wegen der Kuchen eingezogen sind (bei Änderung neu verteilen). */
  private cakes = 0;
  /** Dorffest: läuft gerade (von außen gesetzt, siehe `festivalAt`). */
  festival = false;
  /** Feststelle (Feldindex, −1 = keine): freier Platz nahe der Zentrale. */
  private festSpot = -1;
  private garlands: { tile: number; d: number }[] = [];
  private readonly bulbs: FrameInstances;
  private readonly bulbsWarm: FrameInstances;
  private readonly fire: FrameInstances;

  /** Feldindizes der Häuser (für Hühner und das Fest). */
  get housesPlaced(): readonly number[] {
    return this.placed;
  }

  constructor(material: Material) {
    this.houses = HOUSE_LOOKS.map(([wall, roof], k) => {
      const mesh = new InstancedMesh(house(wall, roof, k), material, C.maxHouses);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    });
    this.people = SHIRTS.map((c) => new FrameInstances(villager(c), material, this.group, 16));
    this.bulbs = new FrameInstances(bulb(), material, this.group, 64);
    this.bulbsWarm = new FrameInstances(bulbWarm(), material, this.group, 64);
    this.fire = new FrameInstances(campfire(), material, this.group, 1);
  }

  /** Neue Simulation: alles neu berechnen. */
  reset(): void {
    this.hq = -1;
    this.candidates = [];
    this.placed = [];
    this.dirty = true;
    for (const mesh of this.houses) mesh.count = 0;
  }

  handleEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'buildingAdded' || e.type === 'buildingRemoved') this.dirty = true;
    }
  }

  update(sim: Simulation, now: number, view: ViewRect, near: boolean, daylight: number): void {
    if (Math.floor(sim.stats.totalProduced[CAKE] / C.cakesPerHouse) !== this.cakes)
      this.dirty = true;
    if (this.dirty && now - this.lastRefresh >= C.refreshMs) {
      this.dirty = false;
      this.lastRefresh = now;
      this.refresh(sim);
    }
    for (const p of this.people) p.begin();
    this.bulbs.begin();
    this.bulbsWarm.begin();
    this.fire.begin();
    if (this.festival && this.festSpot >= 0) this.celebrate(sim, now / 1000, view);
    else if (near && daylight > 0.45 && this.placed.length > 0) this.walk(sim, now / 1000, view);
    for (const p of this.people) p.end();
    this.bulbs.end();
    this.bulbsWarm.end();
    this.fire.end();
  }

  private refresh(sim: Simulation): void {
    const hqType = BUILDINGS.findIndex((d) => d.behavior.kind === 'hq');
    if (this.hq < 0 || !sim.buildings.alive[this.hq] || sim.buildings.type[this.hq] !== hqType) {
      this.hq = -1;
      const b = sim.buildings;
      for (let id = 0; id < b.highWater && this.hq < 0; id++)
        if (b.alive[id] && b.type[id] === hqType) this.hq = id;
      this.computeCandidates(sim);
    }
    this.placed = [];
    // Apfelkuchen machen das Dorf glücklich: je `cakesPerHouse` gebackene zieht eine Familie ein
    this.cakes = Math.floor(sim.stats.totalProduced[CAKE] / C.cakesPerHouse);
    if (this.hq >= 0) {
      let factory = 0;
      sim.typeCount.forEach((n, type) => {
        const k = BUILDINGS[type].behavior.kind;
        if (k !== 'belt' && k !== 'decor' && k !== 'pole' && k !== 'tunnel' && k !== 'hq')
          factory += n;
      });
      const want = Math.min(C.maxHouses, Math.floor(factory / C.buildingsPerHouse) + this.cakes);
      const w = sim.world;
      const taken = new Set<number>();
      for (const t of this.candidates) {
        if (this.placed.length >= want) break;
        if (w.tiles[t] !== TileType.Meadow || !this.freeAround(sim, t, taken)) continue;
        this.placed.push(t);
        taken.add(t);
      }
    }
    // Feststelle: der nächste freie Platz zur Zentrale, der kein Haus trägt
    this.festSpot = -1;
    if (this.hq >= 0) {
      const taken = new Set(this.placed);
      for (const t of this.candidates) {
        if (sim.world.tiles[t] !== TileType.Meadow || !this.freeAround(sim, t, taken)) continue;
        this.festSpot = t;
        break;
      }
    }
    // Lichterketten: zu den nächsten Häusern (nur hier berechnet, nicht jedes Bild)
    this.garlands = [];
    if (this.festSpot >= 0) {
      const size = sim.world.size;
      const fx = (this.festSpot % size) + 0.5;
      const fz = Math.floor(this.festSpot / size) + 0.5;
      this.garlands = this.placed
        .map((tile) => ({
          tile,
          d: Math.hypot((tile % size) + 0.5 - fx, Math.floor(tile / size) + 0.5 - fz),
        }))
        .sort((a, c) => a.d - c.d)
        .slice(0, LIFE_CONFIG.festivalGarlands);
    }
    // Instanzen setzen: Aussehen fest je Feld, Blick zur Zentrale
    const counts = [0, 0, 0];
    const size = sim.world.size;
    for (const t of this.placed) {
      const x = (t % size) + 0.5;
      const z = Math.floor(t / size) + 0.5;
      const look = Math.floor(hash3Float(t, 3, sim.world.seed) * HOUSE_LOOKS.length);
      // Tür grob zur Zentrale, in Vierteldrehungen
      const yaw =
        Math.round(Math.atan2(this.hqX - x, this.hqZ - z) / (Math.PI / 2)) * (Math.PI / 2);
      q.setFromAxisAngle(UP, yaw);
      pos.set(x, 0, z);
      scl.set(1.3, 1.3, 1.3);
      this.houses[look].setMatrixAt(counts[look]++, m.compose(pos, q, scl));
    }
    this.houses.forEach((mesh, k) => {
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  /** Das Feld und seine 8 Nachbarn sind frei von Gebäuden und anderen Häusern. */
  private freeAround(sim: Simulation, t: number, taken: Set<number>): boolean {
    const w = sim.world;
    const x = t % w.size;
    const y = Math.floor(t / w.size);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!w.inBounds(x + dx, y + dy)) return false;
        const i = w.index(x + dx, y + dy);
        if (w.building[i] !== 0 || taken.has(i)) return false;
      }
    }
    return true;
  }

  private computeCandidates(sim: Simulation): void {
    this.candidates = [];
    if (this.hq < 0) return;
    const b = sim.buildings;
    const def = BUILDINGS[b.type[this.hq]];
    const x0 = b.x[this.hq];
    const y0 = b.y[this.hq];
    const x1 = x0 + def.size[0] - 1;
    const y1 = y0 + def.size[1] - 1;
    this.hqX = (x0 + x1 + 1) / 2;
    this.hqZ = (y0 + y1 + 1) / 2;
    const w = sim.world;
    const scored: [number, number][] = [];
    for (let y = y0 - C.maxDistance; y <= y1 + C.maxDistance; y++) {
      for (let x = x0 - C.maxDistance; x <= x1 + C.maxDistance; x++) {
        if (!w.inBounds(x, y)) continue;
        const d = Math.max(x0 - x, x - x1, y0 - y, y - y1, 0);
        if (d < C.minDistance) continue;
        const r = Math.hypot(x + 0.5 - this.hqX, y + 0.5 - this.hqZ);
        if (r > C.maxDistance + 1.5) continue;
        const i = w.index(x, y);
        scored.push([i, r + hash3Float(x, y, w.seed + 17) * 4]);
      }
    }
    scored.sort((a, c) => a[1] - c[1]);
    this.candidates = scored.map((s) => s[0]);
  }

  /**
   * Dorffest: Lagerfeuer an der Feststelle, Lichterketten von dort zu den nächsten Häusern
   * (Glühbirnen leuchten nachts über die Fensterfarbe), die Bewohner tanzen im Kreis ums Feuer.
   */
  private celebrate(sim: Simulation, t: number, view: ViewRect): void {
    const size = sim.world.size;
    const fx = (this.festSpot % size) + 0.5;
    const fz = Math.floor(this.festSpot / size) + 0.5;
    if (fx < view.minX - 20 || fx > view.maxX + 20 || fz < view.minY - 20 || fz > view.maxY + 20)
      return;
    const flicker = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05;
    pos.set(fx, 0, fz);
    q.identity();
    scl.set(1.4, 1.4 * flicker, 1.4);
    this.fire.push(m.compose(pos, q, scl));
    // Lichterketten zu den nächsten Häusern, leicht durchhängend
    const near = this.garlands;
    q.identity();
    scl.set(1, 1, 1);
    for (const { tile, d } of near) {
      const hx = (tile % size) + 0.5;
      const hz = Math.floor(tile / size) + 0.5;
      const n = Math.max(4, Math.round(d * 2.2));
      for (let k = 1; k < n; k++) {
        const u = k / n;
        const sag = Math.sin(u * Math.PI) * Math.min(0.5, d * 0.08);
        pos.set(fx + (hx - fx) * u, 1.25 - sag - u * 0.35, fz + (hz - fz) * u);
        (k % 2 ? this.bulbs : this.bulbsWarm).push(m.compose(pos, q, scl));
      }
    }
    // Reigen: zwei Bewohner je Haus (höchstens 14), Hände hoch im Takt
    const dancers = Math.min(14, this.placed.length * 2);
    const radius = 0.9 + dancers * 0.06;
    for (let k = 0; k < dancers; k++) {
      const a = t * 0.5 + (k / dancers) * Math.PI * 2;
      const hop = Math.abs(Math.sin(t * 6 + k)) * 0.06;
      pos.set(fx + Math.cos(a) * radius, hop, fz + Math.sin(a) * radius);
      q.setFromAxisAngle(UP, -a);
      scl.set(1.5, 1.5, 1.5);
      this.people[k % SHIRTS.length].push(m.compose(pos, q, scl));
    }
  }

  /** Bewohner: zwei von drei spazieren ums Haus, jeder dritte geht zur Zentrale und zurück. */
  private walk(sim: Simulation, t: number, view: ViewRect): void {
    const size = sim.world.size;
    for (let k = 0; k < this.placed.length; k++) {
      const tile = this.placed[k];
      const hx = (tile % size) + 0.5;
      const hz = Math.floor(tile / size) + 0.5;
      if (hx < view.minX - 8 || hx > view.maxX + 8 || hz < view.minY - 8 || hz > view.maxY + 8)
        continue;
      const seed = hash3Float(tile, 5, 31);
      let x: number;
      let z: number;
      let yaw: number;
      if (k % 3 === 2) {
        // zur Zentrale und zurück, dazwischen ein Schwätzchen
        const p = (t / 50 + seed) % 1;
        const u = p < 0.4 ? p / 0.4 : p < 0.5 ? 1 : p < 0.9 ? 1 - (p - 0.5) / 0.4 : 0;
        const tx = this.hqX + (seed - 0.5) * 2;
        const tz = this.hqZ + 2.2;
        x = hx + (tx - hx) * u;
        z = hz + 0.5 + (tz - hz - 0.5) * u;
        yaw = Math.atan2(tx - hx, tz - hz) + (p >= 0.5 && p < 0.9 ? Math.PI : 0);
        if (p >= 0.9) continue; // zu Hause
      } else {
        // Runde ums Haus (Ellipse), ab und zu stehen bleiben
        const speed = 0.12 + seed * 0.08;
        const a = t * speed + seed * 6.28;
        x = hx + Math.cos(a) * 0.62;
        z = hz + Math.sin(a) * 0.55;
        yaw = Math.atan2(-Math.sin(a) * 0.62, Math.cos(a) * 0.55);
      }
      const bob = Math.abs(Math.sin(t * 9 + seed * 20)) * 0.02;
      pos.set(x, bob, z);
      q.setFromAxisAngle(UP, yaw);
      scl.set(1.5, 1.5, 1.5);
      this.people[k % SHIRTS.length].push(m.compose(pos, q, scl));
    }
  }
}
