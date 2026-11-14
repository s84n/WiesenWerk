import type { BuildCategory } from './buildings';
import type { ItemKey } from './items';

/**
 * Alle sichtbaren Texte an einem Ort, damit später weitere Sprachen möglich sind.
 */
export const TEXTS = {
  gameTitle: 'Wiesenwerk',
  version: (version: string, date: string) => `Version ${version} · ${date}`,

  items: {
    wood: 'Holz',
    stone: 'Stein',
    copperOre: 'Kupfererz',
    copperIngot: 'Kupferbarren',
    stoneBrick: 'Steinziegel',
    charcoal: 'Holzkohle',
    plank: 'Bretter',
    copperWire: 'Kupferdraht',
    copperSheet: 'Kupferblech',
    frame: 'Baurahmen',
    coil: 'Spule',
    circuit: 'Leiterplatte',
    motor: 'Motor',
    controlUnit: 'Steuereinheit',
  } satisfies Record<ItemKey, string>,

  buildings: {
    hq: { name: 'Zentrale', description: 'Herz deiner Fabrik. Gelieferte Items landen im Vorrat.' },
    lumberjack: {
      name: 'Holzfäller',
      description: 'Fällt Bäume in der Umgebung. Bäume wachsen nach.',
    },
    miner: {
      name: 'Bergwerk',
      description: 'Baut ein Vorkommen ab. Muss auf einem Vorkommen stehen.',
    },
    furnace: {
      name: 'Schmelzofen',
      description: 'Schmilzt Erz zu Barren, brennt Ziegel und Holzkohle.',
    },
    workshop: { name: 'Werkstatt', description: 'Sägt Bretter, zieht Draht und walzt Blech.' },
  } as Record<string, { name: string; description: string }>,

  categories: {
    extraction: 'Abbau',
    production: 'Produktion',
    logistics: 'Logistik',
    energy: 'Energie',
    decoration: 'Dekoration',
  } satisfies Record<BuildCategory, string>,

  build: {
    size: (w: number, h: number) => `${w} × ${h} Felder`,
    free: 'kostenlos',
    hotkey: (n: number) => `Taste ${n}`,
    modeBuild: (name: string) => `${name} bauen · R drehen · Rechtsklick oder Esc beendet`,
    modeDemolish: 'Abrissmodus · Klick oder Rahmen ziehen · Rechtsklick oder Esc beendet',
    demolishButton: 'Abreißen (X)',
  },

  messages: {
    outOfBounds: 'Hier ist die Welt zu Ende.',
    blocked: 'Hier ist kein Platz.',
    needsDeposit: 'Ein Bergwerk muss auf einem Vorkommen stehen.',
    unique: 'Davon kann es nur eine geben.',
    missing: (list: string) => `Es fehlt noch: ${list}`,
    built: (name: string) => `${name} gebaut`,
    refunded: (list: string) => `Erstattet: ${list}`,
  },

  hud: {
    pause: 'Pause',
    pauseTooltip: 'Pause (Leertaste)',
    speedTooltip: (n: number) => `${n}-fache Geschwindigkeit`,
  },

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
    confirmReplace: 'Eine neue Welt ersetzt deine aktuelle Fabrik. Wirklich neu erzeugen?',
  },
  error: {
    title: 'Hoppla, da ist etwas schiefgelaufen',
    body: 'Das Spiel wurde angehalten, damit nichts kaputtgeht. Lade die Seite neu, um weiterzuspielen.',
    details: 'Technische Details',
    reload: 'Seite neu laden',
  },
  hint: 'Klick auf Bäume und Vorkommen sammelt Rohstoffe · WASD: bewegen · Mausrad: zoomen · Q/E: drehen · Leertaste: Pause',
} as const;
