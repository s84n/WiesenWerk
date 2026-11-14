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
- **Sichtbare Texte** nur in `src/data/texts.ts`.

## Getroffene technische Entscheidungen

- **`base: './'`** in `vite.config.ts` statt `/wiesenwerk/`: rein relative Pfade, funktioniert unabhängig vom Repository-Namen.
- **Version und Build-Datum** setzt Vite über `__APP_VERSION__` / `__BUILD_DATE__` ein (Quelle: `package.json`).
- **Zusätzliche Entwicklungs-Abhängigkeiten** neben den im Skript genannten: `typescript-eslint` und `@eslint/js` (ESLint versteht sonst kein TypeScript), `eslint-config-prettier` (verhindert Konflikte zwischen ESLint und Prettier), `globals` (Liste der Browser-Globals für ESLint), `@types/three` (Typen für three.js). Keine davon landet im Spiel-Build.
- **Architekturgrenze per ESLint:** In `src/sim` und `src/data` sind Importe von `three`, `render`, `ui`, `input`, `core`, `dev` sowie Browser-Globals wie `window`/`document`/`performance` verboten.
- **Zufallsgenerator und Noise** kommen in Phase 1 nach `src/sim` (nicht `src/core`, wie im Skript skizziert), weil die Weltgenerierung zur Simulation gehört und `sim` nicht auf `core` zugreifen darf.
- **Deploy-Workflow** baut mit Node 22, führt Typprüfung, Lint und Tests aus; schlägt etwas fehl, wird nicht veröffentlicht.

## Bekannte Schwächen

- Die Phase-0-Szene ist ein Platzhalter (Häuschen, Bäume, Windrad) und wird in Phase 1 durch die echte Welt ersetzt.
- Schatten laufen immer (Qualitätsstufen kommen in Phase 7).

## Stand der Phasen

| Phase                         | Stand                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| 0. Fundament                  | Umgesetzt und lokal geprüft. Abnahme offen: Seite muss über GitHub Pages erreichbar sein. |
| 1. Welt und Kamera            | offen                                                                                     |
| 2. Bauen und Vorrat           | offen                                                                                     |
| 3. Produktion und Bänder      | offen                                                                                     |
| 4. Speichern                  | offen                                                                                     |
| 5. Strom                      | offen                                                                                     |
| 6. Forschung und Ausbau       | offen                                                                                     |
| 7. Atmosphäre und Feinschliff | offen                                                                                     |
