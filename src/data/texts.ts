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
    chunks: 'Sichtbare Chunks',
    buildings: 'Gebäude',
    segments: 'Bandsegmente',
    items: 'Items auf Bändern',
    paused: 'Pausiert',
  },
  seed: {
    label: 'Seed',
    roll: 'Würfeln',
    rollTooltip: 'Zufälligen Seed würfeln und neue Welt erzeugen',
    generate: 'Erzeugen',
    generateTooltip: 'Welt aus diesem Seed erzeugen',
  },
  error: {
    title: 'Hoppla, da ist etwas schiefgelaufen',
    body: 'Das Spiel wurde angehalten, damit nichts kaputtgeht. Lade die Seite neu, um weiterzuspielen.',
    details: 'Technische Details',
    reload: 'Seite neu laden',
  },
  hint: 'WASD/Pfeile: bewegen · Mausrad: zoomen · Mittlere Maustaste: ziehen · Q/E: drehen · F3: Debug · Leertaste: Pause',
} as const;
