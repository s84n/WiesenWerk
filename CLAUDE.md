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
- **Instanzen pro Chunk** (`src/render/chunked-instances.ts`): Jede Objektart (Kiefer, Laubbaum, Felsbrocken, Blume, Gras) ist ein `InstancedMesh`. Instanzdaten liegen nach Chunks sortiert; `ChunkVisibility` (`visibility.ts`) prüft die Chunks gegen den Bildausschnitt und nur bei Änderung werden die sichtbaren Instanzen in den Puffer kopiert. Dieses Muster soll in Phase 2 auch für Gebäude genutzt werden (dann mit Einfügen/Entfernen).
- **Detailstufen:** ab `detailMaxViewHeight` keine Blumen/Gras, ab `lodViewHeight` vereinfachte Bäume (teilen sich die Instanzdaten) und keine Schatten (`src/data/config.ts`).
- **Kamera** (`src/render/camera-rig.ts`): Ziel- und Ist-Zustand, exponentiell geglättet. Zoom hält den Bodenpunkt unter der Maus fest, Ziehen mit der mittleren Maustaste hält den angefassten Punkt unter der Maus. Grenzen = Karte.
- **Sichtbare Texte** nur in `src/data/texts.ts`, **Farben** nur in `src/data/palette.ts`.

## Getroffene technische Entscheidungen

- **`base: './'`** in `vite.config.ts` statt `/wiesenwerk/`: rein relative Pfade, funktioniert unabhängig vom Repository-Namen.
- **Version und Build-Datum** setzt Vite über `__APP_VERSION__` / `__BUILD_DATE__` ein (Quelle: `package.json`).
- **Zusätzliche Entwicklungs-Abhängigkeiten** neben den im Skript genannten: `typescript-eslint` und `@eslint/js` (ESLint versteht sonst kein TypeScript), `eslint-config-prettier` (verhindert Konflikte zwischen ESLint und Prettier), `globals` (Liste der Browser-Globals für ESLint), `@types/three` (Typen für three.js). Keine davon landet im Spiel-Build.
- **Architekturgrenze per ESLint:** In `src/sim` und `src/data` sind Importe von `three`, `render`, `ui`, `input`, `core`, `dev` sowie Browser-Globals wie `window`/`document`/`performance` verboten.
- **Zufallsgenerator und Noise** liegen in `src/sim` (nicht `src/core`, wie ursprünglich skizziert), weil die Weltgenerierung zur Simulation gehört und `sim` nicht auf `core` zugreifen darf. Projektskript ist angepasst.
- **Geländeblöcke 32 × 32 statt 16 × 16:** Logische Chunks bleiben 16 × 16 (Instanzen, Culling), gezeichnet wird das Gelände aber in größeren Blöcken, damit weit herausgezoomt die Zeichenaufrufe unter 150 bleiben.
- **Seed** steht in der Adresse (`?seed=123`), damit Neuladen dieselbe Welt zeigt. Das Seed-Feld oben links ist vorläufig und wandert in Phase 4 ins Hauptmenü.
- **Entwicklerhilfe:** `?zoom=110` startet mit anderer Zoomstufe (für Bildschirmfotos/Messungen).
- **Bildschirmfotos zum Prüfen:** `npx vite preview --port 4789` und dann Headless-Chromium aus `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome` mit `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --screenshot=... --virtual-time-budget=8000`.
- **Deploy-Workflow** baut mit Node 22, führt Typprüfung, Lint und Tests aus; schlägt etwas fehl, wird nicht veröffentlicht.

## Bekannte Schwächen

- Schatten-Qualität ist fest eingestellt (Qualitätsstufen kommen in Phase 7); der Schattenbereich ist auf 70 Felder begrenzt.
- Das Gelände hat leichte Unebenheiten (±0,04) auch auf baubaren Feldern; Gebäude in Phase 2 sitzen auf Feldhöhe und können minimal einsinken/schweben.
- Kleine Teiche (1–2 Felder) sehen eher wie Sandmulden aus.
- Messwerte Phase 1 (Seed 4711, 1280 × 800): nah 22 Zeichenaufrufe / ca. 320 000 Dreiecke, ganz herausgezoomt 53 Zeichenaufrufe / ca. 430 000 Dreiecke. Welterzeugung ca. 30 ms.

## Stand der Phasen

| Phase                         | Stand                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| 0. Fundament                  | Umgesetzt und lokal geprüft. GitHub Pages wird auf Wunsch des Auftraggebers erst später eingerichtet. |
| 1. Welt und Kamera            | Umgesetzt und lokal geprüft. Wartet auf Abnahme durch den Auftraggeber (Erkunden im Browser).         |
| 2. Bauen und Vorrat           | offen                                                                                                 |
| 3. Produktion und Bänder      | offen                                                                                                 |
| 4. Speichern                  | offen                                                                                                 |
| 5. Strom                      | offen                                                                                                 |
| 6. Forschung und Ausbau       | offen                                                                                                 |
| 7. Atmosphäre und Feinschliff | offen                                                                                                 |
