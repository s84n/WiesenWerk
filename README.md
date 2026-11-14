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
`https://<dein-github-name>.github.io/wiesenwerk/`.

Einmalige Einrichtung:

1. Auf github.com ein neues, leeres Repository mit dem Namen `wiesenwerk` anlegen (ohne README,
   ohne .gitignore, ohne Lizenz).
2. Im Projektordner:
   ```bash
   git remote add origin https://github.com/<dein-github-name>/wiesenwerk.git
   git push -u origin main
   ```
3. Im Repository auf GitHub: **Settings → Pages → Build and deployment → Source:
   „GitHub Actions“** auswählen.
4. Unter **Actions** den Lauf „Veröffentlichen auf GitHub Pages“ abwarten (grüner Haken). Falls
   er vor Schritt 3 schon gelaufen und fehlgeschlagen ist: Lauf öffnen und „Re-run all jobs“.
