/**
 * Alle sichtbaren Texte an einem Ort, damit später weitere Sprachen möglich sind.
 */
export const TEXTS = {
  gameTitle: 'Wiesenwerk',
  version: (version: string, date: string) => `Version ${version} · ${date}`,
  debug: {
    title: 'Debug (F3)',
    fps: 'Bilder/s',
    tickTime: 'Tick-Zeit',
    tick: 'Tick',
    drawCalls: 'Zeichenaufrufe',
    triangles: 'Dreiecke',
    buildings: 'Gebäude',
    segments: 'Bandsegmente',
    items: 'Items auf Bändern',
    paused: 'Pausiert',
  },
  error: {
    title: 'Hoppla, da ist etwas schiefgelaufen',
    body: 'Das Spiel wurde angehalten, damit nichts kaputtgeht. Lade die Seite neu, um weiterzuspielen.',
    details: 'Technische Details',
    reload: 'Seite neu laden',
  },
  hint: 'Phase 0 · F3 zeigt die Debug-Anzeige · Leertaste pausiert',
} as const;
