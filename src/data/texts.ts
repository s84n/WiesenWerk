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
    ironOre: 'Eisenerz',
    coal: 'Kohle',
    sand: 'Sand',
    ironIngot: 'Eisenbarren',
    glass: 'Glas',
    steel: 'Stahl',
    gear: 'Zahnrad',
    ironPlate: 'Eisenplatte',
    lens: 'Linse',
    clockwork: 'Uhrwerk',
    steelFrame: 'Stahlträger',
    instrument: 'Messinstrument',
  } satisfies Record<ItemKey, string>,

  buildings: {
    hq: {
      name: 'Zentrale',
      description:
        'Herz deiner Fabrik. Gelieferte Items landen im Vorrat. Bänder können von jeder Seite hinein.',
    },
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
        'Versorgt alle Gebäude auf 13 × 13 Feldern rundherum und verbindet sich mit Masten in bis zu 14 Feldern Entfernung.',
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
      description:
        'Puffert bis zu 1.000 Items aller Art und gibt sie in derselben Reihenfolge wieder ab. 1 Eingang, 1 Ausgang.',
    },
    storageSplit: {
      name: 'Verteillager',
      description:
        'Puffert bis zu 1.500 Items und gibt sie abwechselnd an zwei Ausgänge ab. 1 Eingang, 2 Ausgänge. Ausgemustert: nicht mehr baubar, vorhandene arbeiten weiter.',
    },
    storageMerge: {
      name: 'Sammellager',
      description:
        'Sammelt zwei Bänder in einem Lager (bis zu 1.500 Items). 2 Eingänge, 1 Ausgang. Ausgemustert: nicht mehr baubar, vorhandene arbeiten weiter.',
    },
    storageLarge: {
      name: 'Großlager',
      description: 'Puffert bis zu 5.000 Items. 2 Eingänge, 2 Ausgänge.',
    },
    depot: {
      name: 'Depot',
      description:
        'Alles, was hier ankommt, landet sofort im Vorrat – wie bei der Zentrale. Bänder können von jeder Seite hinein (8 Eingänge). Bau es direkt neben deine Produktion.',
    },
    depotLarge: {
      name: 'Großdepot',
      description: 'Wie das Depot, aber größer: 12 Eingänge ringsum.',
    },
    tunnelIn: {
      name: 'Tunnel-Eingang',
      description:
        'Das Band taucht hier ab und kommt am Tunnel-Ausgang wieder hoch – bis zu 6 Felder geradeaus. Darüber kannst du frei bauen.',
    },
    tunnelOut: {
      name: 'Tunnel-Ausgang',
      description:
        'Hier kommt die Ware aus dem Tunnel wieder hoch. In gleicher Richtung wie der Eingang bauen, höchstens 6 Felder dahinter.',
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
        'Überbrückt weite Strecken: verbindet sich mit Masten in bis zu 32 Feldern Entfernung und versorgt 3 Felder rundherum.',
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
    foundry: {
      name: 'Gießerei',
      description: 'Schmilzt aus Eisenbarren und Kohle robusten Stahl. 2 Eingänge, 1 Ausgang.',
    },
    waterWheel: {
      name: 'Wasserrad',
      description:
        'Erzeugt Tag und Nacht gleichmäßig 25 kW. Die Vorderseite mit dem Rad muss an Wasser grenzen (R dreht).',
    },
    solarPanel: {
      name: 'Solarfeld',
      description:
        'Erzeugt bei Sonne bis zu 20 kW, nachts nichts. Zusammen mit einem Akku-Haus reicht der Strom auch für die Nacht.',
    },
    battery: {
      name: 'Akku-Haus',
      description:
        'Speichert bis zu 20 MJ überschüssigen Strom aus Wind, Wasser und Sonne und gibt ihn bei Bedarf wieder ab (bis 60 kW).',
    },
    dispenser: {
      name: 'Ausgabestelle',
      description:
        'Gegenstück zum Depot: Legt ein gewähltes Item aus dem Vorrat aufs Band (60 pro Minute). So kommt z. B. Holz aus dem Vorrat zur Werkstatt.',
    },
    clockTower: {
      name: 'Uhrturm',
      description:
        'Das Wahrzeichen deines Dorfes. Er wächst in sechs Abschnitten – jeder wünscht sich Waren und bringt eine Belohnung. Ganz ohne Eile.',
    },
    fountain: {
      name: 'Brunnen',
      description: 'Ein plätschernder Dorfbrunnen. Belohnung für die Mauern des Uhrturms.',
    },
    bandstand: {
      name: 'Musikpavillon',
      description: 'Ein Pavillon mit Kupferdach. Belohnung für die Turmspitze des Uhrturms.',
    },
    vegetableBed: {
      name: 'Gemüsebeet',
      description:
        'Kohl und Kürbisse wachsen hier langsam heran, ein Gärtner kümmert sich darum. Macht die Umgebung gemütlich: Maschinen in der Nähe arbeiten etwas schneller.',
    },
    flowerMeadow: {
      name: 'Blumenwiese',
      description:
        'Eine bunte Wiese, die mit der Zeit immer dichter blüht. Macht die Umgebung gemütlich: Maschinen in der Nähe arbeiten etwas schneller.',
    },
    beehive: {
      name: 'Bienenstock',
      description:
        'Die Bienen fliegen zu den Gärten in der Nähe (11 × 11 Felder) – dort wächst alles anderthalbmal so schnell.',
    },
    orchard: {
      name: 'Obstgarten',
      description:
        'Apfelbäume blühen erst rosa, dann hängen rote Äpfel daran. Macht eine große Umgebung besonders gemütlich.',
    },
    greenhouse: {
      name: 'Gewächshaus',
      description:
        'Unter Glas wächst alles schneller, und nachts leuchtet es warm. Macht eine große Umgebung gemütlich.',
    },
  } as Record<string, { name: string; description: string }>,

  landmark: {
    intro:
      'Bring die gewünschten Waren per Band (von jeder Seite) oder aus dem Vorrat. Was der Turm nicht braucht, landet im Vorrat.',
    stages: {
      foundation: 'Fundament',
      walls: 'Mauern',
      chamber: 'Turmstube',
      clockwork: 'Uhrwerk',
      belfry: 'Glockenstube',
      spire: 'Turmspitze',
    } as Record<string, string>,
    stageOf: (n: number, total: number, name: string) => `Abschnitt ${n} von ${total}: ${name}`,
    needs: 'Gewünscht',
    stock: (n: string) => `Vorrat ${n}`,
    contribute: 'Aus dem Vorrat beisteuern',
    contributeHint: 'Gibt alles, was dieser Abschnitt noch braucht und im Vorrat liegt.',
    reward: 'Belohnung',
    rewardCrafter: (pct: number) => `Alle Maschinen arbeiten ${pct} % schneller`,
    rewardExtractor: (pct: number) => `Bergwerke und Holzfäller arbeiten ${pct} % schneller`,
    rewardBuilding: (name: string) => `Neu zum Bauen: ${name}`,
    rewardClock: 'Die Uhr geht – nach deiner echten Uhrzeit',
    rewardBell: 'Die Glocke schlägt zu jeder vollen Stunde',
    bonusSoFar: (crafter: number, extractor: number) =>
      `Bisher: Maschinen +${crafter} %, Abbau +${extractor} %`,
    finished:
      'Der Uhrturm ist fertig! Danke für all die Mühe – das ganze Dorf ist stolz. Die Glocke schlägt zu jeder vollen Stunde.',
    stageDone: (name: string) => `Uhrturm: „${name}“ ist fertig!`,
    allDone: 'Der Uhrturm ist vollendet!',
  },

  research: {
    title: 'Forschung',
    tooltip: 'Forschung (T)',
    hint: 'Forschung wird sofort aus dem Vorrat bezahlt und gilt direkt. Ein grüner Punkt am Reiter heißt: Hier geht gerade etwas.',
    research: 'Erforschen',
    done: 'Erforscht',
    locked: 'Erst die Voraussetzungen erforschen',
    missing: 'Noch nicht genug im Vorrat',
    unlocks: 'Schaltet frei:',
    areas: {
      production: 'Fertigung',
      logistics: 'Logistik',
      energy: 'Energie',
      industry: 'Eisen & Glas',
      beauty: 'Verschönerung',
    } as Record<string, string>,
    upgradesTab: 'Verbesserungen',
    requiresOther: 'Benötigt:',
    tabReady: 'Hier kannst du gerade etwas erforschen',
    costs: 'Kosten',
    upgradesTitle: 'Verbesserungen (wiederholbar)',
    upgradesLocked: 'Nach der Forschung „Antriebe“ verfügbar.',
    level: (n: number) => `Stufe ${n}`,
    maxLevel: 'Höchste Stufe erreicht',
    buy: 'Verbessern',
    recipe: (name: string) => `Rezept ${name}`,
    extractorUpgrade: 'Bergwerk und Holzfäller Stufe 2',
    crafterUpgrade: 'Maschinen Stufe 2',
    level3: 'Stufe 3 für Abbau und Maschinen',
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
      warehousing: 'Lagerwirtschaft',
      ironworking: 'Eisenverhüttung',
      glassmaking: 'Glasbläserei',
      waterPower: 'Wasserkraft',
      steelmaking: 'Stahlwerk',
      solarPower: 'Sonnenkraft',
      batteries: 'Stromspeicher',
      precision: 'Feinmechanik',
      optics: 'Optik',
      highPerformance: 'Hochleistung',
      gardening: 'Gartenbau',
      greenhouse: 'Gewächshäuser',
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

  settings: {
    quality: 'Grafik',
    qualities: { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', ultra: 'Ultra' } as Record<
      string,
      string
    >,
    qualityHints: {
      low: 'Für schwache Rechner: keine echten Schatten, weniger Kleinkram, geringere Auflösung.',
      medium: 'Schatten, Blumen und Gras, Bäume wiegen sich im Wind.',
      high: 'Schärfere Schatten, volle Auflösung, Wolkenschatten und Glühwürmchen.',
      ultra:
        'Alles aus „Hoch“ plus leichter Regen, weiche Schatten und sanftes Leuchten. Braucht eine kräftige Grafikkarte.',
    } as Record<string, string>,
    autoChosen:
      'Die Stufe wurde beim ersten Start automatisch passend zu deinem Rechner gewählt. Kantenglättung ändert sich erst nach dem Neuladen der Seite.',
    dayNight: 'Tag-Nacht-Wechsel (ein Tag dauert 20 Minuten)',
    muted: 'Ton aus',
    soundVolume: 'Klänge',
    musicVolume: 'Musik',
    noMusic:
      'Noch keine Musik hinterlegt. Musikdateien kommen nach public/audio/musik/ und in die Liste in src/data/music.ts.',
  },

  itemTip: {
    stock: (n: string) => `Vorrat: ${n}`,
    flowLabel: 'Vorrat:',
    perMinute: 'pro Minute',
    dispensers: (n: number) =>
      n === 1
        ? '1 Ausgabestelle nimmt es aus dem Vorrat'
        : `${n} Ausgabestellen nehmen es aus dem Vorrat`,
    howTo: 'So bekommst du es',
    usedFor: 'Wird gebraucht für',
    fuel: 'Brennstoff für Brenner',
    landmark: (stage: string) => `Uhrturm: ${stage}`,
    crafterUpgrade: 'Aufwertung von Maschinen und Abbau',
    seconds: (s: number) => `${s.toLocaleString('de-DE')} s`,
    needsResearch: (names: string) => `Erst erforschen: ${names}`,
  },

  inventory: {
    title: 'Vorrat',
    tooltip: 'Vorrat: alle Items (Klick auf die Mengen oben öffnet ihn auch)',
    hint: 'Oben stehen nur Items, die du schon hast. Hier siehst du alle – und woher sie kommen.',
    raw: {
      wood: 'Von Bäumen: von Hand oder mit dem Holzfäller',
      stone: 'Von Steinvorkommen: von Hand oder mit dem Bergwerk',
      copperOre: 'Von Kupfervorkommen: von Hand oder mit dem Bergwerk',
      ironOre: 'Von Eisenvorkommen (rötlich-grau): von Hand oder mit dem Bergwerk',
      coal: 'Von Kohlevorkommen (schwarz): von Hand oder mit dem Bergwerk. Guter Brennstoff!',
      sand: 'Von Sandvorkommen (hellgelb): von Hand oder mit dem Bergwerk',
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
    show: 'Aufgaben',
    allDone:
      'Alle Kapitel geschafft – der Uhrturm steht und die Wiese gehört dir. Bau weiter, wie es dir gefällt!',
    chapterOf: (n: number, total: number) => `Kapitel ${n} von ${total}`,
    reward: 'Geschenk:',
    chapterDone: (name: string, reward: string) =>
      `Kapitel „${name}“ geschafft! Geschenk: ${reward}`,
    chapters: {
      start: 'Erste Schritte',
      smelting: 'Schmelzen und Sägen',
      together: 'Zusammen geht’s',
      assembly: 'Die Manufaktur',
      ironGlass: 'Eisen und Glas',
      precision: 'Feinmechanik',
      completion: 'Vollendung',
    } as Record<string, string>,
    completed: (name: string) => `Erledigt: ${name}`,
    count: (done: number, total: number) => `${done} / ${total}`,
    items: {
      harvestWood: 'Sammle 10 Holz: klicke auf Bäume',
      buildHq: 'Baue die Zentrale',
      lumberjackWorking:
        'Lass einen Holzfäller am Waldrand arbeiten: seine Leute fällen die Bäume für dich',
      buildPower: 'Baue einen Biomassebrenner und einen Strommast',
      minerWorking: 'Bringe ein Bergwerk mit Strom zum Laufen',
      beltToHq: 'Liefere per Förderband etwas an die Zentrale',
      firstResearch: 'Erforsche etwas (Taste T)',
      furnaceWorking: 'Lass einen Schmelzofen Kupfererz zu Barren schmelzen',
      workshopWorking: 'Lass eine Werkstatt arbeiten, z. B. Bretter aus Holz sägen',
      produceIngots: 'Stelle 100 Kupferbarren her',
      buildTower:
        'Baue den Uhrturm (Bauleiste → Dekoration) – das Wahrzeichen, das mit deiner Fabrik wächst',
      researchLogistics: 'Erforsche „Logistik I“ für den Zusammenführer',
      buildMerger: 'Baue einen Zusammenführer: bis zu 3 Bänder werden zu einem',
      ingotRate:
        'Schaffe 80 Kupferbarren pro Minute: 3 Öfen füllen gemeinsam ein Band (Statistik: Taste I)',
      towerFoundation: 'Vollende das Fundament des Uhrturms',
      researchAssembler: 'Erforsche die Manufaktur',
      produceFrames: 'Stelle 20 Baurahmen her',
      produceCoils: 'Stelle 30 Spulen her (eine Spulen-Manufaktur braucht 2 Drahtwerkstätten)',
      towerWalls: 'Mauere den Uhrturm hoch (Abschnitt 2)',
      researchBelts2: 'Erforsche „Logistik II“ für schnellere Bänder',
      researchIron: 'Erforsche die Eisenverhüttung',
      researchDrives: 'Erforsche „Antriebe“ für Motoren',
      produceIron: 'Stelle 100 Eisenbarren her',
      produceGlass: 'Stelle 50 Glas her',
      towerChamber: 'Setze dem Uhrturm die Turmstube auf (Abschnitt 3)',
      firstLevel2:
        'Werte ein Gebäude auf Stufe 2 auf (Infofenster) – doppeltes Tempo, passend zu Mk2-Bändern',
      researchPrecision: 'Erforsche die Feinmechanik',
      produceClockwork: 'Stelle 30 Uhrwerke her',
      towerClockwork: 'Bring die Uhr am Turm zum Laufen (Abschnitt 4)',
      researchSteel: 'Erforsche das Stahlwerk',
      produceSteelFrames: 'Stelle 20 Stahlträger her',
      researchOptics: 'Erforsche die Optik',
      towerBelfry: 'Häng die Glocke in den Turm (Abschnitt 5)',
      researchHighPerformance: 'Erforsche „Hochleistung“',
      firstLevel3: 'Werte ein Gebäude auf Stufe 3 auf – passend zu Mk3-Bändern',
      towerDone: 'Vollende den Uhrturm mit der Turmspitze',
    } as Record<string, string>,
  },

  categories: {
    extraction: 'Abbau',
    production: 'Produktion',
    logistics: 'Logistik',
    energy: 'Energie',
    garden: 'Gärten',
    decoration: 'Dekoration',
  } satisfies Record<BuildCategory, string>,

  build: {
    quickTab: 'Schnellwahl 1–9',
    quickTabTooltip: 'Die Gebäude auf den Zahlentasten 1 bis 9',
    size: (w: number, h: number) => `${w} × ${h} Felder`,
    free: 'kostenlos',
    hotkey: (n: number) => `Taste ${n}`,
    modeBuild: (name: string) => `${name} bauen · R drehen · Rechtsklick oder Esc beendet`,
    modeBelt:
      'Förderband: mit gedrückter Maustaste ziehen · R dreht bzw. wechselt die Ecke · Rechtsklick oder Esc beendet',
    perTile: 'je Feld',
    modePole:
      'Strommast bauen · Fläche = versorgte Felder · Kreis = Reichweite, Linien = neue Verbindungen · Rechtsklick oder Esc beendet',
    modeLine: (name: string) =>
      `${name}: mit gedrückter Maustaste ziehen · R wechselt die Ecke · Rechtsklick oder Esc beendet`,
    modeDemolish: 'Abrissmodus · Klick oder Rahmen ziehen · Rechtsklick oder Esc beendet',
    demolishButton: 'Abreißen (X)',
    blueprintButton: 'Blaupause (C)',
    modeCopy: 'Blaupause: Rahmen über einen Fabrikteil ziehen · Rechtsklick oder Esc beendet',
    modePaste: (n: number, cost: string) =>
      `Blaupause mit ${n} Gebäuden einfügen · Kosten: ${cost} · R dreht · Rechtsklick oder Esc beendet`,
    copied: (n: number) => `Blaupause mit ${n} Gebäuden kopiert`,
    copyEmpty: 'In diesem Rahmen steht nichts zum Kopieren.',
    noBlueprint: 'Noch keine Blaupause: Taste C und einen Rahmen ziehen.',
    pasted: (ok: number, total: number) =>
      ok === total
        ? `${ok} Gebäude gebaut`
        : `${ok} von ${total} Gebäuden gebaut (Rest blockiert oder zu teuer)`,
  },

  messages: {
    outOfBounds: 'Hier ist die Welt zu Ende.',
    blocked: 'Hier ist kein Platz.',
    needsDeposit: 'Ein Bergwerk muss auf einem Vorkommen stehen.',
    unique: 'Davon kann es nur eine geben.',
    locked: 'Das musst du erst erforschen (Taste T).',
    needsWater: 'Das Wasserrad muss mit der Radseite an Wasser stehen (R dreht).',
    undone: (n: number) =>
      n === 1 ? 'Rückgängig gemacht' : `Rückgängig gemacht (${n} Änderungen)`,
    nothingToUndo: 'Nichts mehr rückgängig zu machen',
    missing: (list: string) => `Es fehlt noch: ${list}`,
    built: (name: string) => `${name} gebaut`,
    refunded: (list: string) => `Erstattet: ${list}`,
  },

  info: {
    close: 'Schließen (Esc)',
    garden: 'Wachstum',
    gardenStages: [
      'Frisch gesät',
      'Erste Triebe',
      'Wächst kräftig',
      'Blüht',
      'Reif – bald wird geerntet',
    ],
    gardenRemaining: (left: string) => `nächste Ernte in ${left} s`,
    gardenBees: 'Bienen in der Nähe: wächst anderthalbmal so schnell',
    gardenNoBees: 'Tipp: Ein Bienenstock in der Nähe lässt den Garten schneller wachsen.',
    harvests: (n: number) => `Schon ${n.toLocaleString('de-DE')}-mal geerntet`,
    cozy: 'Gemütlichkeit',
    cozyBonus: (pct: string) => `+${pct} % Tempo durch Gärten und Deko in der Nähe`,
    cozyNone: 'Gärten und Deko in der Nähe machen diese Maschine bis zu 10 % schneller.',
    cozySource: (pct: string) =>
      `Macht Maschinen in der Nähe ${pct} % schneller (zusammen höchstens 10 %).`,
    beehive: (gardens: number) =>
      gardens === 1 ? 'Bestäubt 1 Garten in der Nähe.' : `Bestäubt ${gardens} Gärten in der Nähe.`,
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
    cycle: 'Nächstes Teil',
    cycleTooltip:
      'Zeit bis das aktuelle Teil fertig ist und ausgegeben wird (bei 1-facher Geschwindigkeit)',
    cycleRemaining: (left: string, per: string) => `noch ${left} s · ${per} s je Teil`,
    cycleStopped: 'angehalten',
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
    waterNow: (kw: string) => `Leistung: ${kw} kW, Tag und Nacht gleich`,
    solarNow: (kw: string, sun: number) => `Leistung gerade: ${kw} kW · Sonne ${sun} %`,
    solarStates: ['Kein Bedarf', 'Erzeugt Strom', 'Nachts kein Strom', '', '', 'Nicht am Netz'],
    batteryStates: ['Wartet', 'Lädt oder gibt Strom ab', '', '', '', 'Nicht am Netz'],
    batteryCharge: (mj: string, cap: string, pct: number) =>
      `Ladung: ${mj} von ${cap} MJ (${pct} %)`,
    batteryFlow: (kw: string, charging: boolean) =>
      charging ? `Lädt gerade mit ${kw} kW` : `Gibt gerade ${kw} kW ab`,
    batteryIdle: 'Gerade weder Laden noch Abgeben.',
    batteryHint:
      'Lädt nur mit Überschuss von Wind, Wasser und Sonne – Brennstoff wird dafür nicht verbrannt.',
    splitter: 'Verteilt ankommende Items reihum auf die freien Ausgänge.',
    merger: 'Nimmt reihum von den Eingängen und gibt alles auf ein Band.',
    bridge: 'Zwei Bänder kreuzen sich hier: Nord–Süd unten, West–Ost oben.',
    holding: 'Gerade darin',
    empty: 'leer',
    storageFill: (n: number, cap: number) =>
      `${n.toLocaleString('de-DE')} von ${cap.toLocaleString('de-DE')} Plätzen belegt`,
    decor: 'Rein zur Verschönerung.',
    depot: 'Träger bringen alles, was hier ankommt, gleich in den Vorrat.',
    dispenserChoose: 'Was soll ausgegeben werden?',
    dispenserHint: 'Klick auf ein Item. Ausgegeben wird nur, was im Vorrat liegt.',
    dispenserStates: [
      'Bereit',
      'Gibt aus',
      'Vorrat leer – nichts mehr da',
      'Band voll – Ausgang blockiert',
      'Kein Item gewählt',
      '',
    ],
    dispenserRate: (perMin: number, name: string) => `${perMin} ${name} pro Minute`,
    inStock: (n: string) => `Vorrat: ${n}`,
    tunnelLinked: (n: number) => `Verbunden: der Ausgang liegt ${n} Felder weiter.`,
    tunnelUnlinked:
      'Noch nicht verbunden: Bau einen Tunnel-Ausgang in gleicher Richtung, höchstens 6 Felder geradeaus.',
    tunnelExitLinked: 'Verbunden mit einem Tunnel-Eingang.',
    tunnelExitUnlinked:
      'Kein Tunnel-Eingang in Reichweite (bis zu 6 Felder davor, gleiche Richtung).',
    tier: (n: number) => `Stufe ${n}`,
    upgrade: (n: number) => `Auf Stufe ${n} aufwerten`,
    levelHint: (speed: number, power: number) =>
      `Danach ${speed}-faches Tempo und ${power}-facher Strom (Holzfäller brauchen keinen). Drei Maschinen einer Stufe füllen ein Band derselben Stufe.`,
    levelMax: 'Höchste Stufe erreicht.',
    level3Locked: 'Mit der Forschung „Hochleistung“ geht es weiter auf Stufe 3.',
    blockedNoBelt:
      'Am Ausgang (oranger Pfeil) liegt kein Band. Zieh ein Band von dort zur Zentrale.',
    blockedWrongWay:
      'Das Band am Ausgang läuft auf das Gebäude zu. Dreh es um (neu darüberziehen).',
    blockedFull: 'Das Band am Ausgang ist voll. Führt es zur Zentrale oder zu einer Maschine?',
    upgradeLocked: 'Mit der Forschung „Tiefbau“ lässt sich das Gebäude auf Stufe 2 aufwerten.',
    crafterUpgradeLocked:
      'Mit der Forschung „Feinmechanik“ lässt sich die Maschine auf Stufe 2 aufwerten.',
  },

  menu: {
    continue: 'Weiterspielen',
    newGame: 'Neues Spiel',
    save: 'Speichern',
    load: 'Laden',
    export: 'Exportieren',
    import: 'Importieren',
    keys: 'Tastenbelegung',
    settings: 'Einstellungen',
    back: 'Zurück',
    start: 'Los geht’s',
    seed: 'Seed',
    mapSize: 'Kartengröße',
    mapSizes: { normal: 'Normal', large: 'Groß', huge: 'Riesig' } as Record<string, string>,
    mapSizeTip: (n: number) => `${n} × ${n} Felder`,
    mapSizeHint:
      'Größere Karten bieten mehr Platz zum Bauen. „Riesig“ braucht etwas mehr Rechenleistung.',
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
    ['C', 'Blaupause: Bereich markieren und kopieren'],
    ['Strg + V', 'Letzte Blaupause wieder einfügen'],
    ['M', 'Minikarte ein/aus'],
    ['F', 'Pipette: Gebäude unter der Maus samt Rezept übernehmen'],
    ['Strg + Z', 'Letzten Bau- oder Abrissschritt rückgängig machen'],
    ['1 – 9', 'Schnellwahl Gebäude'],
    ['V', 'Strom-Ansicht'],
    ['B', 'Engpass-Ansicht: wo die Fabrik stockt'],
    ['P', 'Fotomodus (H blendet die Leiste aus)'],
    ['T', 'Forschung'],
    ['I', 'Statistik'],
    ['Leertaste', 'Pause'],
    ['Strg + S', 'Speichern'],
    ['F3', 'Debug-Anzeige'],
  ] as const,

  photo: {
    title: 'Fotomodus',
    tooltip: 'Fotomodus (P): Oberfläche aus, Tageszeit wählen, Bild speichern',
    time: 'Uhrzeit',
    clock: (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    live: 'Spielzeit',
    liveLabel: 'wie im Spiel',
    liveTooltip: 'Tageszeit wieder wie im Spiel weiterlaufen lassen',
    save: 'Foto speichern',
    saveTooltip: 'Speichert das Bild (ohne Leiste) als PNG-Datei',
    done: 'Fertig (Esc)',
    hint: 'Mausrad: näher heran · Q / E: fein drehen · WASD: bewegen · Leertaste: Pause · H: Leiste aus/ein',
    fileName: (d: Date) => {
      const p = (n: number): string => String(n).padStart(2, '0');
      return `wiesenwerk-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
    },
  },

  bottlenecks: {
    title: 'Engpässe',
    close: 'Engpass-Ansicht schließen (B)',
    tooltip: 'Engpass-Ansicht (B): Wo stockt die Fabrik?',
    legend: {
      working: 'Arbeitet',
      waiting: 'Wartet',
      blocked: 'Blockiert',
      noPower: 'Kein Strom',
      noRecipe: 'Kein Rezept',
    },
    allGood: 'Alles läuft rund – keine Maschine wartet gerade.',
    more: (n: number) => `… und ${n} weitere`,
    jump: 'Klick springt zur Maschine (mehrmals klicken: zur nächsten)',
    reasons: {
      missing: (item: string) => `wartet auf ${item}`,
      missingAny: 'wartet auf Nachschub',
      noBelt: 'hat kein Band am Ausgang',
      wrongWay: 'Band am Ausgang läuft falsch herum',
      beltFull: 'Band am Ausgang ist voll',
      noPower: 'hat keinen Strom',
      noRecipe: 'hat kein Rezept',
    },
    hints: {
      missing: 'Mehr davon herstellen oder ein weiteres Band zuführen.',
      extractor: 'Keine Bäume gewachsen bzw. kein Vorkommen in Reichweite.',
      fuel: 'Brennstoff per Band zuführen oder „Selbst nachfüllen“ einschalten.',
      stock: 'Das Item ist im Vorrat ausgegangen.',
      noBelt: 'Zieh ein Band vom orangen Ausgangspfeil weg.',
      wrongWay: 'Band neu darüberziehen, damit es vom Gebäude wegläuft.',
      beltFull:
        'Mehr Abnehmer anschließen oder ein schnelleres Band legen (3 Maschinen füllen ein Band ihrer Stufe).',
      noPower: 'Strommast in die Nähe bauen oder mehr Strom erzeugen (Taste V).',
      noRecipe: 'Gebäude anklicken und ein Rezept wählen.',
    },
  },

  minimap: {
    tooltip: 'Minikarte (M) · Klick springt hin',
  },

  village: {
    hint: 'Je größer deine Fabrik, desto mehr Menschen ziehen ins Dorf rund um die Zentrale.',
  },

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
