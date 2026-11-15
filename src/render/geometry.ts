import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpColor = new Color();

/**
 * Färbt eine Grundform einheitlich ein (Vertex-Farben) und macht sie flach-schattierbar.
 */
export function colored(geometry: BufferGeometry, color: number): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  g.deleteAttribute('uv');
  tmpColor.setHex(color);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

/** Verschmilzt mehrere eingefärbte Teile zu einer einzigen Geometrie (ein Zeichenaufruf). */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('Geometrien konnten nicht verschmolzen werden.');
  merged.computeVertexNormals();
  return merged;
}

/**
 * Flacher Winkel „›“ als dezente Richtungsmarke, Spitze zeigt nach −z (Norden).
 * `width` = Spannweite, `depth` = Länge in Laufrichtung, `stroke` = Strichstärke, `height` = Dicke.
 */
export function chevron(
  width: number,
  depth: number,
  stroke: number,
  height: number,
  y: number,
  color: number,
): BufferGeometry {
  const half = width / 2;
  const length = Math.hypot(half, depth);
  const angle = Math.atan2(half, depth);
  const arm = (side: number): BufferGeometry =>
    new BoxGeometry(stroke, height, length + stroke * 0.5)
      .rotateY(side * angle)
      .translate((side * half) / 2, y + height / 2, 0);
  return colored(merge([arm(1), arm(-1)]), color);
}
