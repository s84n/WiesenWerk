import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CAMERA_CONFIG, RENDER_CONFIG } from '../data/config';
import { PALETTE } from '../data/palette';
import type { World } from '../sim/world';
import { CameraRig } from './camera-rig';
import { Nature } from './nature';
import { Terrain } from './terrain';
import { computeCornerHeights } from './terrain-heights';
import { ChunkVisibility } from './visibility';

const SUN_DIRECTION = new Vector3(-0.55, 1, 0.3).normalize();
const SUN_DISTANCE = 120;

/**
 * Die 3D-Darstellung. Liest den Simulationszustand, verändert ihn nie.
 */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  /** Ein gemeinsames Material mit Vertex-Farben für fast alle Objekte. */
  readonly material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

  private readonly sun: DirectionalLight;
  private readonly fog: Fog;
  private readonly water: Mesh;
  private readonly seabed: Mesh;

  private terrain: Terrain | null = null;
  private nature: Nature | null = null;
  private visibility: ChunkVisibility | null = null;
  private appliedVersion = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

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
    this.scene.add(this.water, this.seabed);

    this.resize();
  }

  /** Baut die Darstellung für eine neue Welt auf (ersetzt die alte vollständig). */
  setWorld(world: World): void {
    this.disposeWorld();
    const heights = computeCornerHeights(world);
    this.terrain = new Terrain(world, heights, this.material);
    this.nature = new Nature(world, heights, this.material);
    this.visibility = new ChunkVisibility(world);
    this.appliedVersion = -1;
    this.scene.add(this.terrain.group, this.nature.group);

    const center = world.size / 2;
    this.water.position.x = this.seabed.position.x = center;
    this.water.position.z = this.seabed.position.z = center;
    this.rig.setBounds(world.size);
    this.rig.reset(world.startX + 0.5, world.startY + 0.5);
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

  /** Zeichnet ein Bild. `dt` = vergangene Zeit in Sekunden. */
  render(dt: number): void {
    const rig = this.rig;
    rig.update(dt);

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

    if (this.visibility && this.nature) {
      this.visibility.update(rig.camera);
      if (this.visibility.version !== this.appliedVersion) {
        this.nature.applyVisible(this.visibility.visible, this.visibility.count);
        this.appliedVersion = this.visibility.version;
      }
      this.nature.setDetailVisible(rig.viewHeight < RENDER_CONFIG.detailMaxViewHeight);
      const far = rig.viewHeight > RENDER_CONFIG.lodViewHeight;
      this.nature.setLowDetail(far);
      this.sun.castShadow = !far;
    }

    this.renderer.render(this.scene, rig.camera);
  }

  private disposeWorld(): void {
    if (this.terrain) {
      this.scene.remove(this.terrain.group);
      this.terrain.dispose();
    }
    if (this.nature) {
      this.scene.remove(this.nature.group);
      this.nature.dispose();
    }
    this.terrain = null;
    this.nature = null;
    this.visibility = null;
  }
}
