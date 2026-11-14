import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { PALETTE } from '../data/palette';
import { RENDER_CONFIG } from '../data/config';
import { Simulation } from '../sim/simulation';
import { colored, merge } from './geometry';

/** Klassischer Iso-Blickwinkel: 45° seitlich, ca. 35° von oben. */
const ISO_DIRECTION = new Vector3(
  1,
  Math.SQRT2 * Math.tan((35.264 * Math.PI) / 180),
  1,
).normalize();
const CAMERA_DISTANCE = 60;

/**
 * Die 3D-Darstellung. Liest den Simulationszustand, verändert ihn nie.
 */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  /** Ein gemeinsames Material mit Vertex-Farben für fast alle Objekte. */
  readonly material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

  private viewHeight = 18;
  private rotor!: Mesh;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.background = new Color(PALETTE.skyDay);
    this.scene.fog = new Fog(PALETTE.fogDay, CAMERA_DISTANCE + 10, CAMERA_DISTANCE + 60);

    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.camera.position.copy(ISO_DIRECTION).multiplyScalar(CAMERA_DISTANCE);
    this.camera.lookAt(0, 0, 0);

    this.setupLights();
    this.buildDemoScene();
    this.resize();
  }

  private setupLights(): void {
    const hemi = new HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.4);
    this.scene.add(hemi);

    const sun = new DirectionalLight(PALETTE.sun, 2.4);
    sun.position.set(-20, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 16;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  /** Kleine Platzhalter-Szene für Phase 0: Wiesenstück, Häuschen, Bäume, Windrad. */
  private buildDemoScene(): void {
    // Wiesenstück mit Erdkante
    const ground = merge([
      colored(new BoxGeometry(16, 0.6, 16).translate(0, -0.3, 0), PALETTE.soil),
      colored(new BoxGeometry(16, 0.12, 16).translate(0, 0.0, 0), PALETTE.meadow),
    ]);
    const groundMesh = new Mesh(ground, this.material);
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Häuschen als Platzhalter für die Zentrale
    const house = merge([
      colored(new BoxGeometry(3, 1.8, 3).translate(0, 0.96, 0), PALETTE.cream),
      colored(
        new ConeGeometry(2.4, 1.4, 4).rotateY(Math.PI / 4).translate(0, 2.56, 0),
        PALETTE.roof,
      ),
      colored(new BoxGeometry(0.5, 1.2, 0.5).translate(0.8, 2.8, 0.4), PALETTE.brick),
      colored(new BoxGeometry(0.7, 1.1, 0.08).translate(0, 0.6, 1.51), PALETTE.woodDark),
    ]);
    this.addStatic(house, -2, -1);

    // Ein paar Bäume
    const tree = (): ReturnType<typeof merge> =>
      merge([
        colored(new CylinderGeometry(0.15, 0.2, 0.8, 6).translate(0, 0.46, 0), PALETTE.woodDark),
        colored(new ConeGeometry(0.8, 1.4, 7).translate(0, 1.4, 0), PALETTE.leaf),
        colored(new ConeGeometry(0.6, 1.0, 7).translate(0, 2.1, 0), PALETTE.leafLight),
      ]);
    const treeGeo = tree();
    for (const [x, z] of [
      [4, -5],
      [5.5, -3.5],
      [-6, 4],
      [-5, 6],
      [6, 5],
      [-6.5, -5.5],
    ] as const) {
      this.addStatic(treeGeo, x, z);
    }

    // Windrad: Mast statisch, Rotor dreht sich passend zum Simulationstick
    const mast = merge([
      colored(new CylinderGeometry(0.18, 0.3, 4, 6).translate(0, 2.06, 0), PALETTE.cream),
      colored(new BoxGeometry(0.5, 0.4, 0.8).translate(0, 4.1, 0), PALETTE.brick),
    ]);
    this.addStatic(mast, 3, 2);

    const blades: ReturnType<typeof colored>[] = [];
    for (let i = 0; i < 4; i++) {
      blades.push(
        colored(
          new BoxGeometry(0.28, 1.8, 0.06).translate(0, 0.95, 0).rotateZ((i * Math.PI) / 2),
          PALETTE.wood,
        ),
      );
    }
    blades.push(
      colored(new CylinderGeometry(0.15, 0.15, 0.2, 8).rotateX(Math.PI / 2), PALETTE.copper),
    );
    const rotorGroup = new Group();
    rotorGroup.position.set(3, 4.1, 2.45);
    this.rotor = new Mesh(merge(blades), this.material);
    this.rotor.castShadow = true;
    rotorGroup.add(this.rotor);
    this.scene.add(rotorGroup);
  }

  private addStatic(geometry: ReturnType<typeof merge>, x: number, z: number): void {
    const mesh = new Mesh(geometry, this.material);
    mesh.position.set(x, 0, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.scene.add(mesh);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER_CONFIG.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const aspect = w / h;
    this.camera.left = (-this.viewHeight * aspect) / 2;
    this.camera.right = (this.viewHeight * aspect) / 2;
    this.camera.top = this.viewHeight / 2;
    this.camera.bottom = -this.viewHeight / 2;
    this.camera.updateProjectionMatrix();
  }

  /** Zeichnet ein Bild. `alpha` (0 bis 1) interpoliert zwischen zwei Ticks. */
  render(sim: Simulation, alpha: number): void {
    const rotorTurns = (sim.demoRotor + alpha * Simulation.DEMO_ROTOR_STEP) / 1000;
    this.rotor.rotation.z = -rotorTurns * Math.PI * 2;
    this.renderer.render(this.scene, this.camera);
  }
}
