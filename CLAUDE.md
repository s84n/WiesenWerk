# CLAUDE.md – Arbeitsregeln und Projektwissen für Wiesenwerk

Die vollständige Vorgabe steht in `docs/projektskript.md`. Dieses Dokument fasst Regeln,
Architektur, Entscheidungen und den Stand zusammen.

## Arbeitsregeln (aus Projektskript, Abschnitt 16)

1. **Phase für Phase.** Nur an der aktuellen Phase arbeiten (siehe „Stand der Phasen“). Nichts aus späteren Phasen vorbauen, außer die Architektur verlangt es.
2. **Immer lauffähig.** `main` muss jederzeit bauen, alle Tests bestehen und auf GitHub Pages laufen.
3. **Simulation und Darstellung trennen.** Kein Import von `three` oder Browser-Schnittstellen in `src/sim` und `src/data` (per ESLint erzwungen). Zustandsänderungen nur über Befehle (ab Phase 2).
4. **Datengetrieben.** Items, Rezepte, Gebäude, Forschung entstehen durch Einträge in `src/data`. Keine Balancing-Zahlen verstreut im Code.
5. **Performance ist Pflicht.** Instancing, typisierte Arrays, keine Speicherzuweisungen in Bild- und Tick-Schleifen. Größere Änderungen mit dem Stresstest prüfen (ab Phase 3) und Messwerte nennen.
6. **Tests für die Spiellogik** (Vitest in `tests/`). Darstellung und Oberfläche werden von Hand geprüft.
7. **Kleine, verständliche Commits** mit deutscher Beschreibung.
8. **Verständlich berichten.** Der Auftraggeber programmiert nicht selbst: am Ende jedes Schritts in einfachem Deutsch erklären, was neu ist, wie man es ausprobiert und was als Nächstes kommt.
9. **Rückfragen nur bei echten Richtungsentscheidungen** (Spielgefühl, Abweichungen vom Projektskript). Technische Details selbst entscheiden und hier festhalten.
10. **Keine neuen Abhängigkeiten ohne Begründung**, keine externen Dienste, Tracker oder fremden Schriftarten.
11. **Spielstände nie brechen.** Formatänderung → Formatnummer erhöhen + Migration + Test.
12. **Dokumentation aktuell halten.** Diese Datei pflegen; Abweichungen auch in `docs/projektskript.md` eintragen.
13. **Fehler abfangen.** Fehler in der Spielschleife zeigen `showErrorScreen` (ab Phase 4 mit Export-Knopf).

## Befehle

| Befehl              | Zweck                                      |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Entwicklungsserver (http://localhost:5173) |
| `npm run build`     | Typprüfung + Build nach `dist/`            |
| `npm run preview`   | Build lokal ansehen                        |
| `npm test`          | Tests                                      |
| `npm run lint`      | ESLint + Prettier-Prüfung                  |
| `npm run format`    | Code automatisch formatieren               |
| `npm run typecheck` | Nur Typprüfung                             |

Vor jedem Commit: `npm run typecheck && npm run lint && npm test`.

## Architektur

| Ordner       | Aufgabe                                                  | Darf zugreifen auf                  |
| ------------ | -------------------------------------------------------- | ----------------------------------- |
| `src/data`   | Definitionen, Texte (`texts.ts`), Konfiguration, Palette | nichts                              |
| `src/sim`    | Spielzustand und Tick-Systeme                            | `data`                              |
| `src/render` | three.js-Szene, Kamera, Geometrie                        | `data`, liest `sim`                 |
| `src/ui`     | HTML-Oberfläche, CSS                                     | `data`, liest `sim`, sendet Befehle |
| `src/input`  | Maus/Tastatur → Befehle                                  | `render`, sendet Befehle            |
| `src/core`   | Spielschleife, später Befehle, Ereignisse, Speichern     | alle                                |
| `src/dev`    | Debug-Anzeige (F3), später Stresstest                    | alle                                |

- **Spielschleife** (`src/core/loop.ts`): fester Zeitschritt, 20 Ticks/s × Spielgeschwindigkeit, höchstens 5 Ticks pro Bild, Rückstand darüber wird verworfen. `alpha` dient der Interpolation zwischen Ticks. Im Hintergrund-Tab pausiert das Spiel (`document.hidden`).
- **Darstellung** (`src/render/scene.ts`): orthografische Kamera im Iso-Winkel, ein gemeinsames `MeshLambertMaterial` mit Vertex-Farben und Flat Shading. Formen werden mit `colored()` eingefärbt und mit `merge()` verschmolzen (`src/render/geometry.ts`).
- **Welt** (`src/sim/world.ts`, `src/sim/worldgen.ts`): flache typisierte Arrays (`tiles`, `resource`, `purity`, `relief`), Index `y * size + x`. Generator mit eigener Noise-Ebene je Schicht (`deriveSeed(seed, 'relief' | 'lakes' | 'forest' | 'deposit:<id>' ...)`). Neue Vorkommen in `DEPOSITS` (`src/data/world.ts`) immer hinten anhängen, sonst ändern sich alte Seeds. Startpunkt = Kartenmitte; Startgebiet wird garantiert (freie Wiese, Wald, Stein, Kupfer).
- **Gelände** (`src/render/terrain.ts`): verschmolzene Geometrie je Block von 32 × 32 Feldern. Höhen sind rein optisch (`terrain-heights.ts`): baubare Felder bleiben fast flach, Felsen wölben sich, Ufer fallen unter die Wasserlinie ab.
- **Instanzen pro Chunk** (`src/render/chunked-instances.ts`): Jede Objektart (Kiefer, Laubbaum, Felsbrocken, Blume, Gras) ist ein `InstancedMesh`. Instanzdaten liegen nach Chunks sortiert; `ChunkVisibility` (`visibility.ts`) prüft die Chunks gegen den Bildausschnitt und nur bei Änderung werden die sichtbaren Instanzen in den Puffer kopiert. Einzelne Instanzen lassen sich per Schlüssel (Feldindex) aus- und einblenden (gefällte Bäume ↔ Stümpfe). Für Gebäude gibt es die veränderliche Variante `DynamicChunkedInstances` (`dynamic-instances.ts`).
- **Detailstufen:** ab `detailMaxViewHeight` keine Blumen/Gras, ab `lodViewHeight` vereinfachte Bäume (teilen sich die Instanzdaten) und keine Schatten (`src/data/config.ts`).
- **Kamera** (`src/render/camera-rig.ts`): Ziel- und Ist-Zustand, exponentiell geglättet. Zoom hält den Bodenpunkt unter der Maus fest, Ziehen mit der mittleren Maustaste hält den angefassten Punkt unter der Maus. Grenzen = Karte.
- **Befehle und Ereignisse:** UI/Eingabe rufen `sim.enqueue(command)` auf (`src/sim/commands.ts`). Die Simulation wendet Befehle vor jedem Tick **und** einmal pro Bild an (`flushCommands`), damit Bauen auch in der Pause sofort wirkt. Änderungen meldet sie als `SimEvent` (`src/sim/events.ts`); `main.ts` reicht sie pro Bild an Darstellung und Oberfläche weiter und leert die Liste.
- **Gebäude** (`src/sim/buildings.ts`): Struktur aus Arrays (`type`, `x`, `y`, `rot`, `alive`), freie IDs werden wiederverwendet. Belegung im Raster: `world.building` (ID + 1). Drehung im Uhrzeigersinn: `rotateOffset`, `rotateDir`; Richtungen 0 = N (−y), 1 = O, 2 = S (+y), 3 = W. In der Darstellung: Drehung um −rot·90° um die Hochachse (`buildingMatrix`).
- **Platzierung** (`src/sim/placement.ts`, `checkPlacement`): reine Abfrage, auch für die Vorschau. Normale Gebäude nur auf Wiese oder gefälltem Wald, Bergwerk braucht ≥ 1 Feld auf einem Vorkommen (andere Gebäude dürfen nicht auf Vorkommen), Bänder dürfen auf Wiese und Vorkommen (`placement: 'groundOrDeposit'`).
- **Gebäudeverhalten** (`behavior` in `src/data/buildings.ts`): `hq`, `miner`, `lumberjack`, `crafter` (mit Maschinenart), `belt`. Die Simulation verzweigt nur nach diesen Arten, nie nach einzelnen Gebäuden.
- **Bänder** (`src/sim/belts.ts`): Bandfelder sind Gebäude (1 × 1, `rot` = Laufrichtung). Zusammenhängende Felder bilden ein `Segment` mit Ringpuffer aus Abständen (`gaps`, Einheit 1/120 Feld, Mindestabstand 60) und Item-IDs. Pro Tick schrumpft nur der erste schrumpfbare Abstand (`active`); gestaute Segmente kosten fast nichts. Vorgänger eines Feldes: bevorzugt das Band dahinter, sonst eines von der Seite (ergibt Kurven); Seitenzuführung in ein schon belegtes Band gibt es nicht (dafür kommen in Phase 6 Zusammenführer). Bei Bauänderungen werden nur die Segmente am Feld und seinen Nachbarn aufgelöst und neu gebildet; Items behalten dabei ihre Position. Ziele (Gebäudeeingang/Folgesegment) werden über `topologyVersion` zwischengespeichert. Geschlossene Ringe sind erlaubt (`cyclic`).
- **Maschinen** (`src/sim/machines.ts`): typisierte Arrays je Gebäude-ID (Rezept, Fortschritt, Zustand, Puffer, Auslastung). Listen `crafters` und `extractors` laufen pro Tick einmal durch. Ein Durchlauf dauert exakt `RECIPE_TICKS` Ticks (Fortschritt 1 … Dauer + 1). Ausgang: höchstens 1 Item pro Tick auf das Band vor dem Ausgangsanschluss (nur an den Anfang eines Segments). Bergwerk: Rohstoff mit den meisten Feldern darunter, beste Reinheit davon bestimmt das Tempo. Holzfäller: Waldfelder im Quadrat Grundfläche ± Radius, nimmt reihum Holz.
- **Rezept automatisch:** Hat eine Maschine noch kein Rezept und kommt ein Item an, das zu genau einem freigeschalteten Rezept passt, wird dieses gewählt (Ergänzung zum Projektskript, macht den Einstieg gemütlicher). Rezeptwechsel und Abriss erstatten den Pufferinhalt.
- **Tick-Reihenfolge:** Befehle → (Strom ab Phase 5) → Maschinen (Abbau, dann Verarbeitung, jeweils mit Ausgabe aufs Band) → Bänder (Bewegung, Abgabe an Eingänge/Zentrale) → Bäume.
- **Bäume** (`src/sim/trees.ts`): Holz pro Feld; gefällte Bäume kommen in eine Warteschlange und wachsen nach `TREES.regrowSeconds` nach. Wird gefällter Wald bebaut, wird das Feld zu Wiese (wichtig für Phase 4: diese Abweichung muss gespeichert werden).
- **Werkzeuge** (`src/input/tools.ts`): Auswahl/Abbau von Hand, Bauen (Vorschau, R drehen), Abriss (X, Rahmen ziehen). Beim Abbau wird der Sichtstrahl in mehreren Höhen abgetastet, damit Klicks auf Baumkronen den richtigen Baum treffen.
- **Werkzeug Band:** Ziehen ergibt einen L-förmigen Weg (Achse nach der ersten Bewegung, R wechselt die Ecke). Das letzte Feld zeigt automatisch in einen angrenzenden passenden Eingang (`belts.inputDirFor`). Vorhandene Bänder im Weg werden gedreht statt neu gebaut.
- **Darstellung Bänder** (`render/belt-view.ts`): gerade Stücke und Kurven als `DynamicChunkedInstances`; Form aus `belts.entryDir`. Items: ein `InstancedMesh` je Item-Art, jedes Bild nur für Segmente im Bildausschnitt aus den Abständen berechnet, mit `alpha` zwischen den Ticks weitergeschoben; weit herausgezoomt ausgeblendet. Problemsymbole: `render/status-icons.ts` (4×/s, erst nach `problemDelayTicks`).
- **Oberfläche:** Kopfzeile (`ui/hud.ts`), Bauleiste mit 3D-gerenderten Gebäudebildern (`ui/build-bar.ts`, `render/icons.ts`), Infofenster mit Rezeptwahl (`ui/info-panel.ts`), Meldungen und „+1“-Zahlen (`ui/toasts.ts`). Item-Bilder werden aus den Item-Modellen gerendert (`setItemIcons`). Alles aktualisiert nur bei Änderungen, höchstens 4×/s.
- **Speichern** (`src/sim/serialize.ts`): `serialize`/`migrate`/`deserialize`, ohne Browser. Gespeichert werden Abweichungen vom Gelände (`world.changedTiles`), Bäume (Holz ≠ voll, Nachwachs-Warteschlange in Reihenfolge), alle Gebäude **mit ihren IDs** und der Freiliste, Maschinenzustand (11 Werte je Maschine, Reihenfolge der Listen `crafters`/`extractors`, Baumlisten der Holzfäller), Bandsegmente **mit ihren IDs** (Anfangsfeld, `active`, Items + Abstände) und freie Segment-IDs. Damit läuft ein geladener Stand exakt identisch weiter (Test in `tests/save.test.ts`). Formatnummer `SAVE_VERSION`; jede Formatänderung braucht einen Eintrag in `MIGRATIONS` plus Test. Fehler beim Laden sind `SaveError` mit Code → Text in `TEXTS.save.errors`.
- **Speicherorte** (`src/core/storage.ts`, `saves.ts`, `save-files.ts`): IndexedDB mit Tabellen `meta` (Liste) und `data` (Spielstände); Speicherplatz `autosave` plus benannte Plätze. Export: JSON → gzip (`CompressionStream`) → `.fabrik`. Import: gzip oder reines JSON, per Menü oder Hineinziehen ins Fenster.
- **Automatisch speichern:** alle 2 Minuten (Echtzeit, nur im laufenden Spiel) in IndexedDB. Beim Unsichtbarwerden/Schließen des Tabs **nur** eine synchrone Notfall-Kopie in `localStorage` (`wiesenwerk-notfall`), die beim nächsten Start in den Autosave-Platz übernommen wird (`recoverEmergency`). Grund: Ein IndexedDB-Vorgang in einer Seite, die der Browser für „Zurück“ einfriert, blockierte die Datenbank für die nächste Seite. Beim `pagehide` wird die Verbindung geschlossen (`closeDb`), das Öffnen hat eine Zeitgrenze von 4 s.
- **Hauptmenü** (`src/ui/main-menu.ts`): beim Start ohne `?seed`/`?stress` über einer Hintergrundwelt; im Spiel per Esc (wenn nichts anderes abzubrechen ist) oder ☰-Knopf in der Kopfzeile. Pausiert das Spiel, solange es offen ist. „Weiterspielen“ ohne laufendes Spiel lädt den neuesten Spielstand. Vor Laden/Neuem Spiel wird automatisch gespeichert. Strg + S speichert in den aktuellen Platz (sonst neuer Platz).
- **Sichtbare Texte** nur in `src/data/texts.ts`, **Farben** nur in `src/data/palette.ts`.

## Getroffene technische Entscheidungen

- **`base: './'`** in `vite.config.ts` statt `/wiesenwerk/`: rein relative Pfade, funktioniert unabhängig vom Repository-Namen.
- **Version und Build-Datum** setzt Vite über `__APP_VERSION__` / `__BUILD_DATE__` ein (Quelle: `package.json`).
- **Zusätzliche Entwicklungs-Abhängigkeiten** neben den im Skript genannten: `typescript-eslint` und `@eslint/js` (ESLint versteht sonst kein TypeScript), `eslint-config-prettier` (verhindert Konflikte zwischen ESLint und Prettier), `globals` (Liste der Browser-Globals für ESLint), `@types/three` (Typen für three.js). Keine davon landet im Spiel-Build.
- **Architekturgrenze per ESLint:** In `src/sim` und `src/data` sind Importe von `three`, `render`, `ui`, `input`, `core`, `dev` sowie Browser-Globals wie `window`/`document`/`performance` verboten.
- **Zufallsgenerator und Noise** liegen in `src/sim` (nicht `src/core`, wie ursprünglich skizziert), weil die Weltgenerierung zur Simulation gehört und `sim` nicht auf `core` zugreifen darf. Projektskript ist angepasst.
- **Geländeblöcke 32 × 32 statt 16 × 16:** Logische Chunks bleiben 16 × 16 (Instanzen, Culling), gezeichnet wird das Gelände aber in größeren Blöcken, damit weit herausgezoomt die Zeichenaufrufe unter 150 bleiben.
- **Seed:** Neues Spiel mit Seed im Hauptmenü. `?seed=123` in der Adresse startet (Entwicklerhilfe) sofort ein neues Spiel ohne Menü.
- **Entwicklerhilfe:** `?zoom=110` startet mit anderer Zoomstufe (für Bildschirmfotos/Messungen). `?stress=1` lädt die Referenzfabrik, `?stress=10` die zehnfache Variante (sehr große Karte, im Browser schwer).
- **Stresstest** (`src/dev/stress.ts`): Produktionsmodule (Bergwerk → Band → Schmelzofen → Band → Werkstatt → Band) plus volle Bandringe. Maßstab 1 = 2.001 Maschinen, ~17.600 Bandfelder, 20.000–30.000 Items. `tests/benchmark.test.ts` misst den Tick und schlägt ab 8 ms fehl.
- **Schlafende Maschinen** (Projektskript Abschnitt 11) sind vorerst nicht als eigene aktive Liste umgesetzt: Jede Maschine prüft pro Tick nur ein paar Zahlen, die Messung liegt bei 0,1 ms für die Referenzfabrik und 0,7 ms für die zehnfache. Wird es nötig, lässt sich das Wecken ohne Datenumbau nachrüsten.
- **Bildschirmfotos zum Prüfen:** `npx vite preview --port 4789` und dann Headless-Chromium aus `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome` mit `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --screenshot=... --virtual-time-budget=8000`.
- **Entwicklerzugang:** Im Entwicklungsmodus (`npm run dev`) liegt `window.__wiesenwerk` (`sim`, `view`, `tools`, `loop`) bereit – für automatische Browser-Tests. Im Build ist er nicht enthalten.
- **Browser fernsteuern zum Prüfen:** Headless-Chromium mit `--remote-debugging-port` starten und per DevTools-Protokoll über das in Node eingebaute `WebSocket` steuern (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`, `Page.captureScreenshot`, `Runtime.evaluate`). Feldpositionen auf den Bildschirm umrechnen mit `new Vector3(x + 0.5, h, y + 0.5).project(view.rig.camera)`. Skripte gehören in den Scratchpad, nicht ins Repository.
- **Deploy-Workflow** baut mit Node 22, führt Typprüfung, Lint und Tests aus; schlägt etwas fehl, wird nicht veröffentlicht.

## Bekannte Schwächen

- Schatten-Qualität ist fest eingestellt (Qualitätsstufen kommen in Phase 7); der Schattenbereich ist auf 70 Felder begrenzt.
- Das Gelände hat leichte Unebenheiten (±0,04) auch auf baubaren Feldern; Gebäude sitzen auf Höhe 0 und können minimal einsinken/schweben (durch den Sockel kaum sichtbar).
- Bandoberflächen laufen noch nicht sichtbar mit (nur die Items bewegen sich; Phase 7).
- Kurven werden als zwei gerade Hälften dargestellt; Items knicken in der Feldmitte ab.
- Strom ist bis Phase 5 unbegrenzt; der Zustand „Kein Strom“ ist vorbereitet, wird aber noch nicht gesetzt.
- Spielstände der Stresstest-Welt lassen sich nicht speichern (Welt stammt nicht aus einem Seed).
- Speichern läuft synchron (Referenzfabrik: ~545 KB JSON); bei sehr großen Fabriken kann das einen kurzen Ruckler geben. Falls nötig, später in Stücken serialisieren.
- Einstellungen (Grafik, Lautstärke) fehlen im Menü noch; sie kommen mit Phase 7.
- Gebäude sind noch Platzhalter ohne Animation und ohne Aufploppen (Phase 7).
- Kleine Teiche (1–2 Felder) sehen eher wie Sandmulden aus.
- Messwerte Phase 1 (Seed 4711, 1280 × 800): nah 22 Zeichenaufrufe / ca. 320 000 Dreiecke, ganz herausgezoomt 53 Zeichenaufrufe / ca. 430 000 Dreiecke. Welterzeugung ca. 30 ms.
- Messwerte Phase 3 (Referenzfabrik, 1280 × 800): Tick 0,11 ms (Node) bzw. 0,05 ms (Browser); Zeichenaufrufe 26 (nah), 35 (Ringe), 71 (ganz heraus); Dreiecke 250 000–470 000. Zehnfach: Tick 0,74 ms.

## Stand der Phasen

| Phase                         | Stand                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 0. Fundament                  | Umgesetzt und lokal geprüft. GitHub Pages wird auf Wunsch des Auftraggebers erst später eingerichtet.                       |
| 1. Welt und Kamera            | Abgenommen (Auftraggeber: „Sieht gut aus“).                                                                                 |
| 2. Bauen und Vorrat           | Abgenommen (Auftraggeber: „mache mit der nächsten Phase weiter“).                                                           |
| 3. Produktion und Bänder      | Abgenommen (Auftraggeber: „Fahre fort“).                                                                                    |
| 4. Speichern                  | Umgesetzt; Abnahme automatisch (`tests/save.test.ts`) und im Browser (Neuladen, Export/Import) geprüft. Wartet auf Abnahme. |
| 5. Strom                      | offen                                                                                                                       |
| 6. Forschung und Ausbau       | offen                                                                                                                       |
| 7. Atmosphäre und Feinschliff | offen                                                                                                                       |
