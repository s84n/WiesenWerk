# Wiesenwerk

Ein gemütliches Fabrik- und Automatisierungsspiel für den Browser, gebaut mit three.js und
TypeScript. Keine Gegner, kein Zeitdruck – nur Wiese, Bänder und Maschinen.

Die vollständige Spielbeschreibung steht in [`docs/projektskript.md`](docs/projektskript.md).

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install      # einmalig: Abhängigkeiten installieren
npm run dev      # Entwicklungsserver starten, dann http://localhost:5173 öffnen
```

Weitere Befehle: `npm test` (Tests), `npm run lint` (Codeprüfung), `npm run build` (Build nach
`dist/`), `npm run preview` (Build lokal ansehen).

## Veröffentlichung auf GitHub Pages

Jeder Push auf den Zweig `main` baut das Spiel automatisch, prüft es und veröffentlicht es unter
`https://s84n.github.io/WiesenWerk/`.

Einmalige Einrichtung:

1. Auf github.com ein neues, leeres, **öffentliches** Repository mit dem Namen `WiesenWerk` anlegen
   (ohne README, ohne .gitignore, ohne Lizenz).
2. Im Projektordner:
   ```bash
   git remote add origin git@github.com:s84n/WiesenWerk.git
   git push -u origin main
   ```
3. Im Repository auf GitHub: **Settings → Pages → Build and deployment → Source:
   „GitHub Actions“** auswählen.
4. Unter **Actions** den Lauf „Veröffentlichen auf GitHub Pages“ abwarten (grüner Haken). Falls
   er vor Schritt 3 schon gelaufen und fehlgeschlagen ist: Lauf öffnen und „Re-run all jobs“.

## Eigene Musik

1. MP3- oder OGG-Dateien in den Ordner `public/audio/musik/` legen (Ordner ggf. anlegen).
2. Die Dateinamen in `src/data/music.ts` in die Liste `MUSIC_TRACKS` eintragen, z. B.
   `export const MUSIC_TRACKS = ['morgenwiese.mp3', 'abendrot.ogg'];`
3. Neu bauen bzw. `npm run dev` neu starten. Die Stücke laufen in zufälliger Reihenfolge mit
   weichem Überblenden; die Lautstärke regelst du im Menü unter **Einstellungen**.
