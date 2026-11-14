import { OrthographicCamera, Vector3 } from 'three';
import { CAMERA_CONFIG } from '../data/config';

const C = CAMERA_CONFIG;
const ELEVATION = (C.elevationDeg * Math.PI) / 180;
const tmpOrigin = new Vector3();
const tmpDir = new Vector3();
const before = new Vector3();
const after = new Vector3();
const dragNow = new Vector3();

/**
 * Isometrische Kamera: Blickpunkt, Zoom und Drehung werden weich zum Ziel hin geglättet.
 * Koordinaten: Feld (x, y) liegt in der Welt bei x..x+1 und z = y..y+1.
 */
export class CameraRig {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, C.distance * 2 + 100);

  // aktueller Zustand
  x = 0;
  z = 0;
  viewHeight: number = C.viewHeightStart;
  angle = Math.PI / 4;
  // Zielzustand
  private tx = 0;
  private tz = 0;
  private tViewHeight: number = C.viewHeightStart;
  private tAngle = Math.PI / 4;

  private aspect = 1;
  private bounds = 256;
  private anchorX = 0;
  private anchorY = 0;
  private hasAnchor = false;
  private readonly dragAnchor = new Vector3();
  private dragging = false;

  setBounds(size: number): void {
    this.bounds = size;
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.apply();
  }

  /** Springt ohne Glättung an eine Position. */
  reset(x: number, z: number): void {
    this.x = this.tx = x;
    this.z = this.tz = z;
    this.viewHeight = this.tViewHeight = C.viewHeightStart;
    this.angle = this.tAngle = Math.PI / 4;
    this.apply();
  }

  /** Verschiebt das Ziel relativ zur Blickrichtung (Bildschirm-rechts / -oben, in Feldern). */
  panScreen(right: number, forward: number): void {
    const s = Math.sin(this.angle);
    const c = Math.cos(this.angle);
    this.tx += right * c - forward * s;
    this.tz += -right * s - forward * c;
  }

  rotate(direction: 1 | -1): void {
    this.tAngle += (direction * Math.PI) / 2;
  }

  /** Zoomt so, dass der Punkt unter der Maus (NDC-Koordinaten) an seiner Stelle bleibt. */
  zoomAt(factor: number, ndcX: number, ndcY: number): void {
    this.tViewHeight = clamp(this.tViewHeight * factor, C.viewHeightMin, C.viewHeightMax);
    this.anchorX = ndcX;
    this.anchorY = ndcY;
    this.hasAnchor = true;
  }

  dragStart(ndcX: number, ndcY: number): void {
    this.dragging = this.groundAt(ndcX, ndcY, this.dragAnchor);
  }

  /** Hält beim Ziehen den angefassten Bodenpunkt unter der Maus. */
  dragMove(ndcX: number, ndcY: number): void {
    if (!this.dragging || !this.groundAt(ndcX, ndcY, dragNow)) return;
    this.shiftBoth(this.dragAnchor.x - dragNow.x, this.dragAnchor.z - dragNow.z);
    this.apply();
  }

  dragEnd(): void {
    this.dragging = false;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-C.smoothing * dt);

    if (Math.abs(this.tViewHeight - this.viewHeight) > 1e-4) {
      const next = this.viewHeight + (this.tViewHeight - this.viewHeight) * k;
      if (this.hasAnchor && this.groundAt(this.anchorX, this.anchorY, before)) {
        this.viewHeight = next;
        this.apply();
        if (this.groundAt(this.anchorX, this.anchorY, after)) {
          this.shiftBoth(before.x - after.x, before.z - after.z);
        }
      } else {
        this.viewHeight = next;
      }
    } else {
      this.viewHeight = this.tViewHeight;
      this.hasAnchor = false;
    }

    this.x += (this.tx - this.x) * k;
    this.z += (this.tz - this.z) * k;
    this.angle += (this.tAngle - this.angle) * k;
    if (Math.abs(this.tAngle - this.angle) < 1e-4) this.angle = this.tAngle;
    this.apply();
  }

  /** Schnittpunkt des Sichtstrahls durch einen Bildschirmpunkt mit dem Boden (y = 0). */
  groundAt(ndcX: number, ndcY: number, out: Vector3): boolean {
    tmpOrigin.set(ndcX, ndcY, -1).unproject(this.camera);
    this.camera.getWorldDirection(tmpDir);
    if (Math.abs(tmpDir.y) < 1e-6) return false;
    const t = -tmpOrigin.y / tmpDir.y;
    out.copy(tmpOrigin).addScaledVector(tmpDir, t);
    return true;
  }

  private shiftBoth(dx: number, dz: number): void {
    this.x += dx;
    this.z += dz;
    this.tx += dx;
    this.tz += dz;
    this.clamp();
  }

  private clamp(): void {
    const b = this.bounds;
    this.x = clamp(this.x, 0, b);
    this.z = clamp(this.z, 0, b);
    this.tx = clamp(this.tx, 0, b);
    this.tz = clamp(this.tz, 0, b);
  }

  private apply(): void {
    this.clamp();
    const cam = this.camera;
    const h = this.viewHeight / 2;
    cam.left = -h * this.aspect;
    cam.right = h * this.aspect;
    cam.top = h;
    cam.bottom = -h;
    cam.updateProjectionMatrix();
    const horizontal = Math.cos(ELEVATION) * C.distance;
    cam.position.set(
      this.x + Math.sin(this.angle) * horizontal,
      Math.sin(ELEVATION) * C.distance,
      this.z + Math.cos(this.angle) * horizontal,
    );
    cam.lookAt(this.x, 0, this.z);
    cam.updateMatrixWorld();
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
