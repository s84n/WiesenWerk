import { CAMERA_CONFIG } from '../data/config';
import type { CameraRig } from '../render/camera-rig';

export interface HotkeyHandlers {
  toggleDebug(): void;
  togglePause(): void;
  togglePowerView(): void;
}

const PAN_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
const PAN_CODES = Object.keys(PAN_KEYS);

/**
 * Übersetzt Maus und Tastatur in Kamerabewegungen und Tastenkürzel.
 */
export class InputController {
  private readonly pressed = new Set<string>();
  private middleDown = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly rig: CameraRig,
    private readonly hotkeys: HotkeyHandlers,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.pressed.delete(e.code));
    window.addEventListener('blur', () => this.pressed.clear());
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Pro Bild aufrufen: Tastatur-Verschiebung. */
  update(dt: number): void {
    let right = 0;
    let forward = 0;
    // Feste Schleife über bekannte Tasten: keine Speicherzuweisung pro Bild
    for (let i = 0; i < PAN_CODES.length; i++) {
      const code = PAN_CODES[i];
      if (!this.pressed.has(code)) continue;
      right += PAN_KEYS[code][0];
      forward += PAN_KEYS[code][1];
    }
    if (right === 0 && forward === 0) return;
    const len = Math.hypot(right, forward);
    const speed = this.rig.viewHeight * CAMERA_CONFIG.keyPanSpeed * dt;
    this.rig.panScreen((right / len) * speed, (forward / len) * speed);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return;
    if (e.code in PAN_KEYS) e.preventDefault();
    this.pressed.add(e.code);
    if (e.repeat) return;
    switch (e.code) {
      case 'F3':
        e.preventDefault();
        this.hotkeys.toggleDebug();
        break;
      case 'Space':
        e.preventDefault();
        this.hotkeys.togglePause();
        break;
      case 'KeyV':
        this.hotkeys.togglePowerView();
        break;
      case 'KeyQ':
        this.rig.rotate(-1);
        break;
      case 'KeyE':
        this.rig.rotate(1);
        break;
    }
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const [x, y] = this.ndc(e);
    this.rig.zoomAt(Math.exp(delta * CAMERA_CONFIG.wheelZoomSpeed), x, y);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) return;
    e.preventDefault(); // verhindert das Auto-Scrollen des Browsers
    this.middleDown = true;
    const [x, y] = this.ndc(e);
    this.rig.dragStart(x, y);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.middleDown) return;
    const [x, y] = this.ndc(e);
    this.rig.dragMove(x, y);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 1) return;
    this.middleDown = false;
    this.rig.dragEnd();
  };

  private ndc(e: MouseEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  }
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
