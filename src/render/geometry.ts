import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
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
