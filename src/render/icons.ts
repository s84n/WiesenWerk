import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  OrthographicCamera,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type Material,
  type WebGLRenderer,
} from 'three';
import { PALETTE } from '../data/palette';
import { buildingGeometries } from './buildings-view';

const SIZE = 96;

/**
 * Rendert für jedes Gebäude einmalig ein kleines Bild für die Bauleiste (als Daten-URL).
 */
export function renderBuildingIcons(renderer: WebGLRenderer, material: Material): string[] {
  const scene = new Scene();
  scene.add(new HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.6));
  const sun = new DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(-3, 6, 4);
  scene.add(sun);

  const target = new WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  target.texture.colorSpace = SRGBColorSpace;
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const box = new Box3();
  const size = new Vector3();
  const center = new Vector3();
  const urls: string[] = [];

  for (const geometry of buildingGeometries()) {
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    box.setFromObject(mesh);
    box.getSize(size);
    box.getCenter(center);
    const r = Math.max(size.x, size.y, size.z) * 0.62;
    camera.left = camera.bottom = -r;
    camera.right = camera.top = r;
    camera.position.set(center.x + 10, center.y + 8.2, center.z + 10);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
    scene.remove(mesh);

    if (ctx) {
      const img = ctx.createImageData(SIZE, SIZE);
      // WebGL liefert die Zeilen von unten nach oben
      for (let row = 0; row < SIZE; row++) {
        img.data.set(
          pixels.subarray((SIZE - 1 - row) * SIZE * 4, (SIZE - row) * SIZE * 4),
          row * SIZE * 4,
        );
      }
      ctx.putImageData(img, 0, 0);
      urls.push(canvas.toDataURL());
    } else {
      urls.push('');
    }
  }
  renderer.setRenderTarget(null);
  target.dispose();
  return urls;
}
