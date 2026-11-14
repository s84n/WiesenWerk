import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PCFShadowMap,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { BUILDINGS } from '../data/buildings';
import { CAMERA_CONFIG, RENDER_CONFIG } from '../data/config';
import { PALETTE } from '../data/palette';
import { footprintH, footprintW } from '../sim/buildings';
import type { SimEvent } from '../sim/events';
import type { Simulation } from '../sim/simulation';
import { BeltView } from './belt-view';
import { BuildPreview } from './build-preview';
import { BuildingsView, buildingGeometries } from './buildings-view';
import { CameraRig } from './camera-rig';
import { renderIcons } from './icons';
import { itemGeometries } from './item-models';
import { StatusIcons } from './status-icons';
import { Nature } from './nature';
import { Terrain } from './terrain';
import { computeCornerHeights } from './terrain-heights';
import { ChunkVisibility } from './visibility';

const SUN_DIRECTION = new Vector3(-0.55, 1, 0.3).normalize();
const corner = new Vector3();
const SUN_DISTANCE = 120;

/**
 * Die 3D-Darstellung. Liest den Simulationszustand, verändert ihn nie.
 */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  readonly preview = new BuildPreview();
  /** Ein gemeinsames Material mit Vertex-Farben für fast alle Objekte. */
  readonly material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

  private readonly sun: DirectionalLight;
  private readonly fog: Fog;
  private readonly water: Mesh;
  private readonly seabed: Mesh;

  private sim: Simulation | null = null;
  private terrain: Terrain | null = null;
  private nature: Nature | null = null;
  private buildings: BuildingsView | null = null;
  private belts: BeltView | null = null;
  private readonly status = new StatusIcons();
  private itemIconUrls: string[] | null = null;
  private visibility: ChunkVisibility | null = null;
  private appliedVersion = -1;
  private icons: string[] | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene.background = new Color(PALETTE.fog);
    this.fog = new Fog(PALETTE.fog, 1, 1000);
    this.scene.fog = this.fog;

    this.scene.add(new HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.5));
    this.sun = new DirectionalLight(PALETTE.sun, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(RENDER_CONFIG.shadowMapSize, RENDER_CONFIG.shadowMapSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = SUN_DISTANCE * 2;
    this.scene.add(this.sun, this.sun.target);

    // Wasser: halbtransparente Oberfläche über einem dunkleren Meeresgrund
    const big = new PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2);
    this.water = new Mesh(
      big,
      new MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.72 }),
    );
    this.water.position.y = RENDER_CONFIG.waterLevel;
    this.water.renderOrder = 1;
    this.seabed = new Mesh(big, new MeshLambertMaterial({ color: PALETTE.waterDeep }));
    this.seabed.position.y = -1.6;
    this.scene.add(this.water, this.seabed, this.preview.group, this.status.mesh);

    this.resize();
  }

  /** Bilder der Gebäude für die Bauleiste (werden beim ersten Aufruf erzeugt). */
  buildingIcons(): string[] {
    this.icons ??= renderIcons(this.renderer, this.material, buildingGeometries());
    return this.icons;
  }

  /** Bilder der Items für Vorrat, Kosten und Infofenster. */
  itemIcons(): string[] {
    this.itemIconUrls ??= renderIcons(this.renderer, this.material, itemGeometries(), 48);
    return this.itemIconUrls;
  }

  /** Baut die Darstellung für eine neue Simulation auf (ersetzt die alte vollständig). */
  setSimulation(sim: Simulation): void {
    this.disposeWorld();
    const world = sim.world;
    this.sim = sim;
    const heights = computeCornerHeights(world);
    this.terrain = new Terrain(world, heights, this.material);
    this.nature = new Nature(world, heights, this.material);
    this.buildings = new BuildingsView(world, this.material);
    this.belts = new BeltView(world, this.material);
    this.visibility = new ChunkVisibility(world);
    this.appliedVersion = -1;
    this.scene.add(this.terrain.group, this.nature.group, this.buildings.group, this.belts.group);
    // Vorhandene Gebäude übernehmen (Stresstest, später geladene Spielstände)
    const b = sim.buildings;
    for (let id = 0; id < b.highWater; id++) if (b.alive[id]) this.onAdded(sim, id);
    for (let i = 0; i < world.tiles.length; i++) {
      if (world.tiles[i] === 1 && !sim.trees.hasTree(i)) this.nature.refreshTile(sim, i);
    }

    const center = world.size / 2;
    this.water.position.x = this.seabed.position.x = center;
    this.water.position.z = this.seabed.position.z = center;
    this.rig.setBounds(world.size);
    this.rig.reset(world.startX + 0.5, world.startY + 0.5);
  }

  /** Übernimmt Änderungen aus der Simulation (nur die betroffenen Instanzen). */
  handleEvents(events: readonly SimEvent[]): void {
    const sim = this.sim;
    if (!sim || !this.nature || !this.buildings) return;
    for (const e of events) {
      switch (e.type) {
        case 'treeChanged':
          this.nature.refreshTile(sim, e.tile);
          break;
        case 'buildingAdded':
          this.onAdded(sim, e.id);
          break;
        case 'buildingRotated':
          this.belts?.refreshAround(
            sim,
            sim.world.index(sim.buildings.x[e.id], sim.buildings.y[e.id]),
          );
          break;
        case 'buildingRemoved':
          if (BUILDINGS[e.buildingType].behavior.kind === 'belt') {
            this.belts?.refreshAround(sim, sim.world.index(e.x, e.y));
          } else {
            this.buildings.removed(e.id, e.buildingType);
            this.belts?.refreshPerimeter(sim, e.buildingType, e.x, e.y, e.rot);
          }
          this.refreshFootprint(sim, e.buildingType, e.x, e.y, e.rot);
          break;
      }
    }
  }

  private onAdded(sim: Simulation, id: number): void {
    const b = sim.buildings;
    if (sim.isBelt(id)) {
      this.belts?.refreshAround(sim, sim.world.index(b.x[id], b.y[id]));
    } else {
      this.buildings?.added(sim, id);
      this.belts?.refreshPerimeter(sim, b.type[id], b.x[id], b.y[id], b.rot[id]);
    }
    this.refreshFootprint(sim, b.type[id], b.x[id], b.y[id], b.rot[id]);
  }

  private refreshFootprint(sim: Simulation, type: number, x: number, y: number, rot: number): void {
    const def = BUILDINGS[type];
    const w = footprintW(def, rot);
    const h = footprintH(def, rot);
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) this.nature?.refreshTile(sim, sim.world.index(tx, ty));
    }
  }

  get visibleChunks(): number {
    return this.visibility?.count ?? 0;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER_CONFIG.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.rig.setAspect(w / h);
  }

  /** Bewegt die Kamera um `dt` Sekunden weiter (vor der Eingabeauswertung aufrufen). */
  updateCamera(dt: number): void {
    this.rig.update(dt);
  }

  /** Zeichnet ein Bild. `alpha` (0..1) = Anteil bis zum nächsten Tick, für flüssige Bewegung. */
  render(alpha: number, now: number): void {
    const rig = this.rig;

    // Sonne und Schattenbereich folgen dem Bildausschnitt
    this.sun.target.position.set(rig.x, 0, rig.z);
    this.sun.position
      .copy(SUN_DIRECTION)
      .multiplyScalar(SUN_DISTANCE)
      .add(this.sun.target.position);
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const extent = Math.min(
      RENDER_CONFIG.shadowMaxExtent,
      rig.viewHeight * Math.max(aspect, 1.8) * 0.6,
    );
    const sc = this.sun.shadow.camera;
    if (sc.right !== extent) {
      sc.left = sc.bottom = -extent;
      sc.right = sc.top = extent;
      sc.updateProjectionMatrix();
    }

    // Leichter Dunst, der mit dem Zoom mitwächst
    this.fog.near = CAMERA_CONFIG.distance + rig.viewHeight * 0.4;
    this.fog.far = CAMERA_CONFIG.distance + rig.viewHeight * 2.6;

    if (this.visibility && this.nature && this.buildings) {
      this.visibility.update(rig.camera);
      const changed = this.visibility.version !== this.appliedVersion;
      this.appliedVersion = this.visibility.version;
      this.nature.applyVisible(this.visibility.visible, this.visibility.count, changed);
      this.buildings.apply(this.visibility.visible, this.visibility.count, changed);
      if (this.belts && this.sim) {
        this.belts.apply(this.visibility.visible, this.visibility.count, changed);
        this.updateItems(this.sim, alpha);
        this.status.update(this.sim, now);
      }
      this.nature.setDetailVisible(rig.viewHeight < RENDER_CONFIG.detailMaxViewHeight);
      const far = rig.viewHeight > RENDER_CONFIG.lodViewHeight;
      this.nature.setLowDetail(far);
      this.sun.castShadow = !far;
    }

    this.renderer.render(this.scene, rig.camera);
  }

  /** Items auf Bändern im sichtbaren Ausschnitt (weit herausgezoomt ausgeblendet). */
  private updateItems(sim: Simulation, alpha: number): void {
    const rig = this.rig;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let k = 0; k < 4; k++) {
      if (!rig.groundAt(k & 1 ? 1 : -1, k & 2 ? 1 : -1, corner)) continue;
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.z);
      maxY = Math.max(maxY, corner.z);
    }
    const show = rig.viewHeight <= RENDER_CONFIG.lodViewHeight;
    this.belts?.updateItems(sim, alpha, minX - 2, minY - 2, maxX + 2, maxY + 2, show);
  }

  private disposeWorld(): void {
    for (const part of [this.terrain, this.nature, this.buildings, this.belts]) {
      if (!part) continue;
      this.scene.remove(part.group);
      part.dispose();
    }
    this.terrain = null;
    this.nature = null;
    this.buildings = null;
    this.belts = null;
    this.visibility = null;
    this.sim = null;
  }
}
