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
      description:
        'Seine Leute fällen Bäume in der Umgebung – mit Muskelkraft, ganz ohne Strom. Bäume wachsen nach.',
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
    burner: {
      name: 'Biomassebrenner',
      description:
        'Verbrennt Holz oder Holzkohle und erzeugt 30 kW Strom für Gebäude im Netz. Holt sich Brennstoff selbst aus dem Vorrat.',
    },
    pole: {
      name: 'Strommast',
      description:
        'Versorgt Gebäude im Umkreis und verbindet sich mit Masten in bis zu 8 Feldern Entfernung.',
    },
    beltMk1: {
      name: 'Förderband',
      description: 'Transportiert 60 Items pro Minute. Mit gedrückter Maustaste ziehen.',
    },
    assembler: {
      name: 'Manufaktur',
      description: 'Baut aus zwei verschiedenen Zutaten Bauteile wie Baurahmen und Spulen.',
    },
    storage: {
      name: 'Lager',
      description: 'Puffert bis zu 1.000 Items und gibt sie in derselben Reihenfolge wieder ab.',
    },
    splitter: {
      name: 'Verteiler',
      description:
        'Teilt ein Band auf bis zu drei Bänder auf. Ist ein Ausgang voll (z. B. ein Brenner), geht alles an die anderen – praktisch als Überlauf zur Zentrale.',
    },
    merger: {
      name: 'Zusammenführer',
      description: 'Führt bis zu drei Bänder abwechselnd auf ein Band zusammen.',
    },
    bridge: {
      name: 'Bandbrücke',
      description: 'Lässt zwei Bänder sich kreuzen, ohne dass sich die Items mischen.',
    },
    beltMk2: {
      name: 'Förderband Mk2',
      description:
        'Transportiert 120 Items pro Minute. Über ein vorhandenes Band ziehen, um es aufzuwerten.',
    },
    beltMk3: {
      name: 'Förderband Mk3',
      description:
        'Transportiert 240 Items pro Minute. Über ein vorhandenes Band ziehen, um es aufzuwerten.',
    },
    windTurbine: {
      name: 'Windrad',
      description: 'Erzeugt im Mittel 10 kW ohne Brennstoff. Die Leistung schwankt mit dem Wind.',
    },
    bigPole: {
      name: 'Großer Strommast',
      description:
        'Überbrückt weite Strecken: verbindet sich mit Masten in bis zu 20 Feldern Entfernung.',
    },
    path: { name: 'Weg', description: 'Ein heller Steinweg. Mit gedrückter Maustaste ziehen.' },
    lantern: { name: 'Laterne', description: 'Eine kleine Laterne für gemütliche Ecken.' },
    flowerbed: { name: 'Blumenbeet', description: 'Ein gemauertes Beet voller Blumen.' },
    fence: { name: 'Zaun', description: 'Ein Holzzaun. Mit gedrückter Maustaste ziehen.' },
    bench: { name: 'Bank', description: 'Eine Holzbank zum Ausruhen.' },
    ornamentalTree: { name: 'Zierbaum', description: 'Ein runder Baum in einem Steinkübel.' },
    pathColored: {
      name: 'Ziegelweg',
      description: 'Ein rötlicher Ziegelweg. Mit gedrückter Maustaste ziehen.',
    },
  } as Record<string, { name: string; description: string }>,

  research: {
    title: 'Forschung',
    tooltip: 'Forschung (T)',
    hint: 'Forschung wird sofort aus dem Vorrat bezahlt und gilt direkt.',
    research: 'Erforschen',
    done: 'Erforscht',
    locked: 'Erst die Voraussetzungen erforschen',
    missing: 'Noch nicht genug im Vorrat',
    unlocks: 'Schaltet frei:',
    upgradesTitle: 'Verbesserungen (wiederholbar)',
    upgradesLocked: 'Nach der Forschung „Antriebe“ verfügbar.',
    level: (n: number) => `Stufe ${n}`,
    maxLevel: 'Höchste Stufe erreicht',
    buy: 'Verbessern',
    recipe: (name: string) => `Rezept ${name}`,
    extractorUpgrade: 'Bergwerk und Holzfäller Stufe 2',
    researched: (name: string) => `Erforscht: ${name}`,
    upgraded: (name: string, level: number) => `${name}: jetzt Stufe ${level}`,
    nodes: {
      logistics1: 'Logistik I',
      storage: 'Lagerhaltung',
      charcoal: 'Köhlerei',
      beauty1: 'Verschönerung I',
      sheetMetal: 'Blechbearbeitung',
      assembler: 'Manufaktur',
      wind: 'Windkraft',
      logistics2: 'Logistik II',
      electronics: 'Elektronik',
      drives: 'Antriebe',
      longDistance: 'Fernleitung',
      logistics3: 'Logistik III',
      deepMining: 'Tiefbau',
      beauty2: 'Verschönerung II',
    } as Record<string, string>,
    upgrades: {
      machineSpeed: {
        name: 'Maschinentempo',
        effect: (pct: number) =>
          `Schmelzofen, Werkstatt und Manufaktur arbeiten ${pct} % schneller.`,
      },
      extractionSpeed: {
        name: 'Abbautempo',
        effect: (pct: number) => `Holzfäller und Bergwerk arbeiten ${pct} % schneller.`,
      },
      efficiency: {
        name: 'Effizienz',
        effect: (pct: number) => `Alle Maschinen brauchen ${pct} % weniger Strom.`,
      },
    } as Record<string, { name: string; effect: (pct: number) => string }>,
  },

  stats: {
    title: 'Statistik',
    tooltip: 'Statistik (I)',
    item: 'Item',
    produced: 'Produktion',
    consumed: 'Verbrauch',
    delivered: 'an Zentrale',
    perMinute: 'pro Minute, gemittelt über die letzte Minute',
    totals: 'Gesamt',
    playTime: 'Spielzeit',
    built: 'Gebaute Gebäude',
    standing: 'Stehende Gebäude',
    deliveredTotal: 'An die Zentrale geliefert',
    researched: 'Erforscht',
    empty: 'Noch keine Produktion. Baue ein Bergwerk oder einen Holzfäller!',
  },

  inventory: {
    title: 'Vorrat',
    tooltip: 'Vorrat: alle Items (Klick auf die Mengen oben öffnet ihn auch)',
    hint: 'Oben stehen nur Items, die du schon hast. Hier siehst du alle – und woher sie kommen.',
    raw: {
      wood: 'Von Bäumen: von Hand oder mit dem Holzfäller',
      stone: 'Von Steinvorkommen: von Hand oder mit dem Bergwerk',
      copperOre: 'Von Kupfervorkommen: von Hand oder mit dem Bergwerk',
    } as Record<string, string>,
    made: (building: string, inputs: string) => `${building} aus ${inputs}`,
    locked: '(erst erforschen)',
  },

  sound: {
    on: 'Ton aus',
    off: 'Ton an',
  },

  goals: {
    title: 'Erste Schritte',
    hide: 'Ausblenden',
    show: 'Erste Schritte',
    allDone: 'Geschafft! Jetzt gehört die Wiese dir.',
    completed: (name: string) => `Erledigt: ${name}`,
    items: {
      harvestWood: 'Sammle 10 Holz: klicke auf Bäume',
      buildHq: 'Baue die Zentrale',
      lumberjackWorking:
        'Lass einen Holzfäller am Waldrand arbeiten: seine Leute fällen die Bäume für dich',
      buildPower: 'Baue einen Biomassebrenner und einen Strommast',
      minerWorking: 'Bringe ein Bergwerk mit Strom zum Laufen',
      beltToHq: 'Liefere per Förderband etwas an die Zentrale',
      firstResearch: 'Erforsche etwas (Taste T)',
    } as Record<string, string>,
  },

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
    modeBelt:
      'Förderband: mit gedrückter Maustaste ziehen · R dreht bzw. wechselt die Ecke · Rechtsklick oder Esc beendet',
    perTile: 'je Feld',
    modePole: 'Strommast bauen · zeigt die versorgten Felder · Rechtsklick oder Esc beendet',
    modeLine: (name: string) =>
      `${name}: mit gedrückter Maustaste ziehen · R wechselt die Ecke · Rechtsklick oder Esc beendet`,
    modeDemolish: 'Abrissmodus · Klick oder Rahmen ziehen · Rechtsklick oder Esc beendet',
    demolishButton: 'Abreißen (X)',
  },

  messages: {
    outOfBounds: 'Hier ist die Welt zu Ende.',
    blocked: 'Hier ist kein Platz.',
    needsDeposit: 'Ein Bergwerk muss auf einem Vorkommen stehen.',
    unique: 'Davon kann es nur eine geben.',
    locked: 'Das musst du erst erforschen (Taste T).',
    missing: (list: string) => `Es fehlt noch: ${list}`,
    built: (name: string) => `${name} gebaut`,
    refunded: (list: string) => `Erstattet: ${list}`,
  },

  info: {
    close: 'Schließen (Esc)',
    states: [
      'Bereit',
      'Arbeitet',
      'Wartet auf Nachschub',
      'Ausgang blockiert',
      'Kein Rezept gewählt',
      'Kein Strom',
    ],
    burnerStates: [
      'Kein Bedarf',
      'Erzeugt Strom',
      'Kein Brennstoff',
      'Ausgang blockiert',
      '',
      'Nicht am Netz',
    ],
    recipe: 'Rezept',
    recipeHint: 'Kommt das erste passende Item an, wird das Rezept automatisch gewählt.',
    input: 'Eingang',
    output: 'Ausgang',
    utilization: 'Auslastung',
    extracts: 'Abbau',
    perMinute: (n: number) => `${n.toLocaleString('de-DE')}/min`,
    seconds: (n: number) => `${n.toLocaleString('de-DE')} s`,
    purity: ['', 'armes Vorkommen', 'normales Vorkommen', 'reiches Vorkommen'],
    trees: (ready: number, total: number) => `Bäume in Reichweite: ${ready} von ${total} gewachsen`,
    noDeposit: 'Kein Vorkommen unter dem Bergwerk',
    hq: 'Alle angelieferten Items landen im Vorrat.',
    power: 'Strom',
    powerUse: (kw: number) => `${kw.toLocaleString('de-DE')} kW bei der Arbeit`,
    powerSpeed: (pct: number) => `Tempo durch Strom: ${pct} %`,
    noGrid: 'Kein Strom: baue einen Strommast in der Nähe und einen Biomassebrenner.',
    fuel: 'Brennstoff',
    burning: 'Brennt noch',
    burnerOutput: (kw: string) => `Leistung gerade: ${kw} kW`,
    refill: (item: string) => `${item} aus dem Vorrat nachfüllen`,
    autoRefill: 'Selbst aus dem Vorrat nachfüllen',
    autoRefillHint:
      'Wird Strom gebraucht, schickt die Zentrale immer 2 Holz (oder Holzkohle) nach – der Rest bleibt im Vorrat. Ein Band zum Brenner brauchst du dann nicht. Tipp: Mit einem Verteiler (Taste 9) geht Holz vom Band in den Brenner und der Rest zur Zentrale.',
    gridTitle: 'Stromnetz',
    gridLine: (prod: string, demand: string, cap: string) =>
      `Verbrauch ${demand} kW · Erzeugung ${prod} kW von ${cap} kW möglich`,
    gridBuildings: (n: number, gen: number) => `${n} Verbraucher · ${gen} Erzeuger`,
    gridSpeed: (pct: number) => `Maschinen laufen mit ${pct} % Tempo`,
    noPoleGrid: 'Dieser Mast ist mit keinem Netz verbunden.',
    chartLegend: 'Grün: Erzeugung · Orange: Verbrauch (letzte 60 s)',
    delivered: (n: number) => `Bisher angeliefert: ${n.toLocaleString('de-DE')} Items`,
    belt: (perMinute: number) => `Transportiert bis zu ${perMinute} Items pro Minute.`,
    beltItems: (n: number, tiles: number) =>
      `Auf diesem Abschnitt: ${n} Items auf ${tiles} Feldern`,
    windStates: ['Kein Bedarf', 'Erzeugt Strom', '', '', '', 'Nicht am Netz'],
    windNow: (kw: string, wind: number) => `Leistung gerade: ${kw} kW · Wind ${wind} %`,
    splitter: 'Verteilt ankommende Items reihum auf die freien Ausgänge.',
    merger: 'Nimmt reihum von den Eingängen und gibt alles auf ein Band.',
    bridge: 'Zwei Bänder kreuzen sich hier: Nord–Süd unten, West–Ost oben.',
    holding: 'Gerade darin',
    empty: 'leer',
    storageFill: (n: number, cap: number) =>
      `${n.toLocaleString('de-DE')} von ${cap.toLocaleString('de-DE')} Plätzen belegt`,
    decor: 'Rein zur Verschönerung.',
    tier: (n: number) => `Stufe ${n}`,
    upgrade: 'Auf Stufe 2 aufwerten',
    upgradeHint: 'Doppeltes Tempo (Bergwerk: doppelter Stromverbrauch).',
    blockedNoBelt:
      'Am Ausgang (oranger Pfeil) liegt kein Band. Zieh ein Band von dort zur Zentrale.',
    blockedWrongWay:
      'Das Band am Ausgang läuft auf das Gebäude zu. Dreh es um (neu darüberziehen).',
    blockedFull: 'Das Band am Ausgang ist voll. Führt es zur Zentrale oder zu einer Maschine?',
    upgradeLocked: 'Mit der Forschung „Tiefbau“ lässt sich das Gebäude auf Stufe 2 aufwerten.',
  },

  menu: {
    continue: 'Weiterspielen',
    newGame: 'Neues Spiel',
    save: 'Speichern',
    load: 'Laden',
    export: 'Exportieren',
    import: 'Importieren',
    keys: 'Tastenbelegung',
    back: 'Zurück',
    start: 'Los geht’s',
    seed: 'Seed',
    seedHint: 'Gleicher Seed, gleiche Welt. Leer lassen oder würfeln für eine zufällige Welt.',
    roll: 'Würfeln',
    saveName: 'Name des Spielstands',
    saveAs: 'Als neuen Spielstand speichern',
    overwrite: 'Überschreiben',
    delete: 'Löschen',
    confirmDelete: (name: string) => `„${name}“ wirklich löschen?`,
    noSaves: 'Noch keine Spielstände vorhanden.',
    autosave: 'Automatisch gespeichert',
    slotLine: (date: string, play: string, seed: number) =>
      `${date} · Spielzeit ${play} · Seed ${seed}`,
    storageHint:
      'Spielstände liegen nur in diesem Browser. Beim Löschen der Browserdaten gehen sie verloren – exportiere wichtige Fabriken als Datei.',
    dropHint: 'Du kannst eine .fabrik-Datei auch einfach ins Fenster ziehen.',
    notSaveable: 'Diese Welt (Stresstest) kann nicht gespeichert werden.',
    defaultName: (seed: number) => `Fabrik ${seed}`,
    menuTooltip: 'Menü (Esc)',
  },

  save: {
    saved: (name: string) => `Gespeichert: ${name}`,
    autosaved: 'Automatisch gespeichert',
    loaded: (name: string) => `Geladen: ${name}`,
    exported: 'Datei wird heruntergeladen',
    failed: (reason: string) => `Speichern nicht möglich: ${reason}`,
    errors: {
      notJson: 'Diese Datei ist kein Wiesenwerk-Spielstand oder sie ist beschädigt.',
      notWiesenwerk: 'Diese Datei ist kein Wiesenwerk-Spielstand.',
      tooNew:
        'Dieser Spielstand stammt aus einer neueren Version von Wiesenwerk. Bitte lade die Seite neu.',
      damaged: 'Dieser Spielstand ist beschädigt und kann nicht geladen werden.',
      storage:
        'Der Browser erlaubt hier keine Spielstände (z. B. im privaten Fenster). Exportieren geht trotzdem.',
    },
  },

  keys: [
    ['W A S D / Pfeiltasten', 'Kamera verschieben'],
    ['Mittlere Maustaste ziehen', 'Kamera verschieben'],
    ['Mausrad', 'Zoomen'],
    ['Q / E', 'Kamera drehen'],
    ['Linksklick', 'Bauen, auswählen, von Hand abbauen'],
    ['Linksklick ziehen', 'Förderband, Wege und Zäune bauen, Abriss-Rahmen'],
    ['Rechtsklick / Esc', 'Abbrechen, Fenster schließen, Menü'],
    ['R', 'Gebäude drehen'],
    ['X', 'Abrissmodus'],
    ['1 – 9', 'Schnellwahl Gebäude'],
    ['V', 'Strom-Ansicht'],
    ['T', 'Forschung'],
    ['I', 'Statistik'],
    ['Leertaste', 'Pause'],
    ['Strg + S', 'Speichern'],
    ['F3', 'Debug-Anzeige'],
  ] as const,

  hud: {
    pause: 'Pause',
    pauseTooltip: 'Pause (Leertaste)',
    speedTooltip: (n: number) => `${n}-fache Geschwindigkeit`,
    power: (use: number, cap: number) =>
      `${use.toLocaleString('de-DE')} / ${cap.toLocaleString('de-DE')} kW`,
    powerTooltip:
      'Strom im größten Netz: Verbrauch / mögliche Erzeugung. Taste V zeigt die Strom-Ansicht.',
    noPower: 'kein Strom',
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
  error: {
    title: 'Hoppla, da ist etwas schiefgelaufen',
    body: 'Das Spiel wurde angehalten, damit nichts kaputtgeht. Lade die Seite neu, um weiterzuspielen.',
    details: 'Technische Details',
    reload: 'Seite neu laden',
    export: 'Spielstand exportieren',
    exportFailed: 'Export leider nicht möglich',
  },
  hint: 'Klick auf Bäume und Vorkommen sammelt Rohstoffe · Klick auf Gebäude zeigt Infos · WASD: bewegen · Mausrad: zoomen · Q/E: drehen · Leertaste: Pause',
} as const;
