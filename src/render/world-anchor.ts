/**
 * Hilfen, damit Schmuck-Teilchen (Schmetterlinge, Regen, Glühwürmchen) fest in der Welt stehen,
 * obwohl es nur einen kleinen festen Vorrat davon gibt: Jedes Teilchen hat eine feste
 * Weltposition in einem Kachelmuster der Größe `period`; gezeigt wird die Kopie, die dem
 * Blickpunkt am nächsten liegt. Beim Verschieben der Kamera bleiben die Teilchen also stehen
 * und tauchen erst am fernen Rand (außerhalb des Bildes) auf der anderen Seite wieder auf.
 */

/** Kachelgröße: nächste Zweierpotenz ≥ `size` (ändert sich nur in großen Zoomschritten). */
export function anchorPeriod(size: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, size)));
}

/** Weltkoordinate des Teilchens mit fester Lage `u` (0..1) nahe `center`. */
export function anchored(u: number, center: number, period: number): number {
  const start = center - period / 2;
  let r = (u * period - start) % period;
  if (r < 0) r += period;
  return start + r;
}
