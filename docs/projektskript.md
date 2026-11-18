# Wiesenwerk: Projektskript für ein Cozy-Fabrikspiel in three.js

Nov 14, 2026 · @s84n

## 1. Überblick und Vision

Gebaut wird ein friedliches Fabrik- und Automatisierungsspiel für den Browser, im Geist von Satisfactory und Factorio, aber ohne Gegner, Zeitdruck oder Fehlschläge. Der Spieler baut Rohstoffe ab, verarbeitet sie in Maschinen, verbindet alles mit Förderbändern und einem Stromnetz und automatisiert seine Fabrik über einen Forschungsbaum immer weiter.

Dieses Dokument ist die vollständige Vorgabe für die Umsetzung mit Claude Code. Das Spiel heißt Wiesenwerk, das GitHub-Repository wiesenwerk. Der Name erscheint im Hauptmenü, im Browser-Tab und im Dateinamen exportierter Spielstände.

**Kernschleife:** Rohstoff abbauen → verarbeiten → zur Zentrale liefern → damit bauen und forschen → neue Gebäude und Upgrades freischalten → Fabrik vergrößern und verschönern.

**Leitprinzipien, nach Priorität geordnet:**

1. **Performance zuerst.** Jede Architekturentscheidung muss große Fabriken mit Tausenden Gebäuden und Zehntausenden Items auf Bändern möglich machen, auch wenn die erste Version kleiner bleibt.
2. **Cozy.** Keine Angriffe, kein Scheitern, keine Strafen. Abreißen erstattet die vollen Kosten. Engpässe verlangsamen die Fabrik, sie zerstören nichts.
3. **Schick mit wenig Hardware.** Low-Poly-Optik aus Code-Geometrie, stimmungsvolles Licht, viele kleine Animationen. Das Spiel soll auf einem Büro-Laptop mit integrierter Grafik flüssig laufen.
4. **Datengetrieben und erweiterbar.** Items, Rezepte, Gebäude und Forschung liegen als Daten vor. Neue Inhalte wie Öl oder Wasser kommen später ohne Umbau der Spiellogik dazu.
5. **Früh spielbar.** Jede Umsetzungsphase endet mit einem lauffähigen, online erreichbaren Stand.

## 2. Rahmenbedingungen

| Thema | Festlegung |
| --- | --- |
| Plattform | Desktop-Browser (aktuelle Versionen von Chrome, Edge, Firefox, Safari), nur Maus und Tastatur. Keine Touch-Unterstützung. |
| Hosting | GitHub Pages. Das Spiel ist eine rein statische Website ohne Server, Datenbank oder Accounts. |
| Sprache | TypeScript im Strict-Modus |
| Build-Tool | Vite |
| 3D | three.js (aktuelle stabile Version) mit dem WebGL-Renderer |
| Oberfläche | HTML und CSS als Ebene über dem 3D-Canvas, ohne UI-Framework |
| Tests | Vitest für die Spiellogik |
| Code-Qualität | ESLint und Prettier |
| Spielmodus | Einzelspieler. Multiplayer ist nicht geplant. |
| Speichern | Lokal im Browser plus Export und Import als Datei |
| Spielsprache | Deutsch. Alle sichtbaren Texte liegen in einer zentralen Textdatei, damit später weitere Sprachen möglich sind. |
| Assets | Keine externen 3D-Modelle oder Texturen. Alle Formen entstehen im Code. |

**Folgen von GitHub Pages, die Claude Code beachten muss:**

- Die Seite liegt unter einem Unterpfad (`https://<name>.github.io/wiesenwerk/`). Vite braucht dazu die passende `base`-Einstellung, und alle Pfade im Code müssen relativ sein.
- GitHub Pages erlaubt keine eigenen HTTP-Header. Damit steht `SharedArrayBuffer` nicht zur Verfügung. Web Worker sind erlaubt, der Datenaustausch läuft dann über `postMessage` mit übertragbaren Puffern.
- Es gibt keinen Server-Code. Alles, was das Spiel braucht, steckt im Build-Ordner.

**Zum Auftraggeber:** Der Auftraggeber hat kaum Programmiererfahrung. Claude Code trifft technische Entscheidungen selbstständig im Rahmen dieses Dokuments, erklärt sie kurz in einfachem Deutsch und beschreibt nach jeder Phase, wie der Stand getestet wird.

## 3. Spielwelt

Die Welt ist eine flache, prozedural erzeugte Karte mit fester Größe, auf der alles in einem quadratischen Raster platziert wird.

- **Größe:** 256 × 256 Felder in der ersten Version. Die Kartengröße ist ein Parameter. Intern ist die Karte in Chunks von 16 × 16 Feldern geteilt, sodass 512 × 512 oder mehr später ohne Umbau möglich sind.
- **Seed:** Jede Welt entsteht aus einer Zahl (Seed). Gleicher Seed ergibt die gleiche Karte. Der Spieler kann beim Start einen Seed eingeben oder würfeln lassen.
- **Erzeugung:** Noise-Funktionen (zum Beispiel Simplex-Noise) bestimmen Geländeart, Wälder und Vorkommen. Der Zufallsgenerator ist ein eigener, deterministischer Generator, nicht `Math.random`.
- **Eine Bauebene:** Es gibt keine Höhenstufen zum Bauen. Leichte optische Unebenheiten, Hügel am Kartenrand und Wasserflächen sorgen für Abwechslung, ohne die Logik zu verändern.
- **Kartenrand:** Die Karte endet weich in Wasser, Nebel oder nicht bebaubaren Hügeln. Es gibt keine harte Kante.

**Feldarten:**

| Feldart | Bebaubar | Bedeutung |
| --- | --- | --- |
| Wiese | Ja | Normaler Baugrund mit Gras, Blumen und kleinen Steinen als Dekoration |
| Wald | Erst nach dem Fällen | Bäume liefern Holz und wachsen nach einiger Zeit nach |
| Steinvorkommen | Nur Bergwerk | Liefert Stein |
| Kupfervorkommen | Nur Bergwerk | Liefert Kupfererz |
| Wasser | Nein | Seen und Ufer. Zunächst nur Kulisse, später Rohstoff für Pumpen |
| Fels und Hügel | Nein | Kulisse und natürliche Begrenzung |

**Vorkommen:** Stein- und Kupfervorkommen sind Flecken aus mehreren Feldern. Sie sind unerschöpflich, haben aber eine Reinheit (arm, normal, reich), die die Abbaugeschwindigkeit mit 0,5-fach, 1-fach oder 2-fach bestimmt. Das passt zum gemütlichen Spielgefühl, weil keine Fabrik je trockenläuft.

**Startgebiet:** Die Weltgenerierung garantiert rund um den Startpunkt eine freie Wiese, einen Wald, ein Steinvorkommen und ein Kupfervorkommen in kurzer Entfernung.

**Vorbereitet für später:** Der Generator kann weitere Vorkommen aufnehmen (Eisen, Kohle, Sand, Ölquellen), ohne dass sich alte Seeds für bestehende Rohstoffe ändern müssen. Dazu erhält jeder Rohstoff seine eigene Noise-Ebene.

## 4. Ressourcen, Items und Rezepte

Die erste Version kennt drei Rohstoffe (Holz, Stein, Kupfererz) und daraus elf verarbeitete Items in bis zu vier Stufen. Alle Zahlen sind Startwerte zum späteren Ausbalancieren und stehen ausschließlich in den Datendateien.

**Rohstoffe:**

| Rohstoff | Quelle | Verwendung |
| --- | --- | --- |
| Holz | Wald (von Hand oder per Holzfäller) | Brennstoff, Bretter, Holzkohle |
| Stein | Steinvorkommen | Steinziegel |
| Kupfererz | Kupfervorkommen | Kupferbarren |

**Rezepte der ersten Version:**

| Maschine | Eingang | Ausgang | Dauer |
| --- | --- | --- | --- |
| Schmelzofen | 1 Kupfererz | 1 Kupferbarren | 2 s |
| Schmelzofen | 2 Stein | 1 Steinziegel | 4 s |
| Schmelzofen | 2 Holz | 1 Holzkohle | 4 s |
| Werkstatt | 1 Holz | 2 Bretter | 2 s |
| Werkstatt | 1 Kupferbarren | 2 Kupferdraht | 2 s |
| Werkstatt | 2 Kupferbarren | 1 Kupferblech | 4 s |
| Manufaktur | 2 Bretter + 2 Steinziegel | 1 Baurahmen | 4 s |
| Manufaktur | 4 Kupferdraht + 1 Bretter | 1 Spule | 4 s |
| Manufaktur | 1 Kupferblech + 2 Kupferdraht | 1 Leiterplatte | 4 s |
| Manufaktur | 1 Baurahmen + 1 Spule | 1 Motor | 8 s |
| Manufaktur | 1 Baurahmen + 1 Leiterplatte | 1 Steuereinheit | 8 s |

**Abgestimmte Verhältnisse:** Die Werte sind so gewählt, dass saubere Fabriken ohne Rechnerei aufgehen. Ein Tick dauert 0,05 Sekunden, alle Zeiten sind ganze Ticks.

- Ein Bergwerk auf normalem Vorkommen oder ein Holzfäller liefert 30 Items pro Minute und versorgt damit genau einen Schmelzofen oder eine Werkstatt.
- Ein Schmelzofen liefert 30 Kupferbarren oder 15 Steinziegel oder 15 Holzkohle pro Minute.
- Eine Werkstatt macht aus 30 Rohstoffen pro Minute 60 Bretter, 60 Kupferdraht oder 15 Kupferblech. 60 pro Minute füllen genau ein Band Mk1.
- Eine Manufaktur liefert 15 Baurahmen, 15 Spulen oder 15 Leiterplatten pro Minute. Eine Spulen-Manufaktur verbraucht genau den Draht einer Werkstatt.
- Motor und Steuereinheit entstehen mit 7,5 pro Minute. Eine Baurahmen-Manufaktur versorgt zwei davon.
- Ein Baum gibt 4 Holz und wächst nach 120 Sekunden nach. Ein Holzfäller braucht etwa 15 Bäume in Reichweite für volle Leistung.
- Abbau von Hand: 1 Item pro Klick, bei gedrückter Maustaste 2 pro Sekunde.
- Startpaket im Vorrat: 30 Holz, 30 Stein, 10 Kupfererz.

**Der zentrale Vorrat:** Es gibt keine Spielfigur und kein Inventar. Alles, was per Band in die Zentrale geliefert oder von Hand gesammelt wird, landet in einem globalen Vorrat. Aus diesem Vorrat werden Baukosten und Forschung bezahlt. Die Zentrale ist damit das Ziel jeder Produktionslinie.

**Abbau von Hand:** Zu Spielbeginn klickt der Spieler auf Bäume, Stein- und Kupfervorkommen und sammelt so kleine Mengen direkt in den Vorrat. Das reicht für die ersten Gebäude und wird schnell durch Automatisierung abgelöst. Zusätzlich enthält der Vorrat ein kleines Startpaket.

**Datenmodell:** Jedes Item hat eine numerische ID, einen Namen, eine Farbe, eine einfache 3D-Form für das Band, ein Icon und optional einen Brennwert. Jedes Rezept nennt Maschine, Eingänge, Ausgänge und Dauer. Die Spiellogik kennt keine einzelnen Items beim Namen.

**Spätere Erweiterungen (nicht Teil der ersten Version, aber im Datenmodell mitgedacht):**

- Weitere feste Rohstoffe: Eisen, Kohle, Sand
- Flüssigkeiten: Wasser und Öl mit Pumpen, Rohren und Tanks. Das Datenmodell unterscheidet deshalb von Anfang an zwischen festen Items und Flüssigkeiten, auch wenn Flüssigkeiten noch nicht umgesetzt sind.
- Rezepte mit mehreren Ausgängen (Nebenprodukte), etwa in einer Raffinerie

## 5. Gebäude

Die erste Version enthält 15 Gebäudetypen plus Dekoration. Jedes Gebäude belegt ein Rechteck im Raster, lässt sich in 90-Grad-Schritten drehen und hat feste Anschlusspunkte für Bänder an seinen Kanten.

| Gebäude | Größe | Strom | Funktion | Anschlüsse |
| --- | --- | --- | --- | --- |
| Zentrale | 3 × 3 | Keiner | Nimmt Items in den globalen Vorrat auf. Genau eine pro Welt, zu Beginn frei platzierbar. | 12 Eingänge (jedes Randfeld; ursprünglich 4, nach Phase 7 erweitert) |
| Holzfäller | 2 × 2 | Keiner (geändert, siehe unten) | Fällt Bäume im Umkreis von 4 Feldern, 30 Holz pro Minute. Bäume wachsen nach. | 1 Ausgang |
| Bergwerk | 2 × 2 | 5 kW | Steht auf einem Vorkommen, 30 Items pro Minute mal Reinheit | 1 Ausgang |
| Schmelzofen | 2 × 2 | 4 kW | Rezepte mit einem Eingang, Hitze | 1 Eingang, 1 Ausgang |
| Werkstatt | 2 × 2 | 4 kW | Rezepte mit einem Eingang, Mechanik | 1 Eingang, 1 Ausgang |
| Manufaktur | 3 × 3 | 15 kW | Rezepte mit zwei Eingängen | 2 Eingänge, 1 Ausgang |
| Lager | 2 × 2 | Keiner | Puffert bis zu 1.000 Items | 1 Eingang, 1 Ausgang |
| Förderband Mk1 bis Mk3 | 1 × 1 je Feld | Keiner | Transportiert 60, 120 oder 240 Items pro Minute | siehe Abschnitt 6 |
| Verteiler | 1 × 1 | Keiner | Teilt einen Strom gleichmäßig auf bis zu drei Ausgänge | 1 Eingang, 3 Ausgänge |
| Zusammenführer | 1 × 1 | Keiner | Vereint bis zu drei Ströme | 3 Eingänge, 1 Ausgang |
| Bandbrücke | 1 × 1 | Keiner | Lässt zwei Bänder sich kreuzen | 2 Eingänge, 2 Ausgänge |
| Biomassebrenner | 2 × 2 | Erzeugt 30 kW | Verbrennt Holz oder Holzkohle | 1 Eingang |
| Windrad | 2 × 2 | Erzeugt 10 kW | Braucht keinen Brennstoff, Leistung schwankt sanft | Keine |
| Strommast | 1 × 1 | Verteilt | Versorgt Gebäude im Umkreis, verbindet sich mit anderen Masten | Keine |
| Großer Strommast | 2 × 2 | Verteilt | Überbrückt weite Strecken zwischen Fabrikteilen | Keine |
| Dekoration | 1 × 1 | Keiner | Wege, Laternen, Blumenbeete, Zäune, Bänke. Rein optisch. | Keine |

**Verhalten von Maschinen:**

- Der Spieler wählt pro Maschine ein Rezept aus den freigeschalteten Rezepten.
- Jede Maschine hat einen kleinen Eingangs- und Ausgangspuffer (Startwert: Menge für zwei Durchläufe im Eingang, zwei im Ausgang). Ist der Ausgang voll, wartet sie.
- Zustände: arbeitet, wartet auf Eingang, Ausgang blockiert, kein Strom, kein Rezept. Der Zustand ist am Gebäude sichtbar (Animation läuft oder steht, kleines Symbol über dem Gebäude bei Problemen).
- Brenner können per Band oder mit einem Klick aus dem globalen Vorrat befüllt werden. So lässt sich der erste Strom ohne Automatisierung erzeugen.

**Bauen und Abreißen:**

- Baukosten werden aus dem globalen Vorrat bezahlt. Abreißen erstattet 100 Prozent, auch den Inhalt der Puffer.
- Vor dem Platzieren zeigt eine halbtransparente Vorschau das Gebäude, grün bei gültiger, rot bei ungültiger Position. Anschlusspunkte sind als Pfeile sichtbar.
- Baukosten, Größe, Stromwerte und Anschlüsse stehen als Daten in der Gebäudedefinition.

**Baukosten:** Gebäude der Startphase kosten nur Rohstoffe, die sich von Hand sammeln lassen. Spätere Gebäude kosten die Bauteile ihrer Forschungsstufe.

| Gebäude | Kosten |
| --- | --- |
| Zentrale | kostenlos |
| Holzfäller | 10 Holz, 5 Stein |
| Bergwerk | 10 Holz, 10 Stein |
| Biomassebrenner | 15 Stein, 5 Kupfererz |
| Strommast | 3 Holz, 1 Kupfererz |
| Förderband Mk1 | 1 Holz je Feld |
| Schmelzofen | 20 Stein |
| Werkstatt | 15 Holz, 5 Kupferbarren |
| Verteiler | 4 Holz, 2 Stein (ab Spielbeginn, geändert nach Phase 6) |
| Zusammenführer | 5 Bretter, 5 Kupferdraht |
| Lager | 30 Bretter, 10 Steinziegel |
| Manufaktur | 30 Bretter, 30 Steinziegel, 20 Kupferblech |
| Windrad | 10 Baurahmen, 10 Spulen |
| Bandbrücke | 5 Baurahmen |
| Förderband Mk2 | 1 Kupferblech je Feld |
| Förderband Mk3 | 1 Leiterplatte je Feld |
| Großer Strommast | 5 Baurahmen, 10 Spulen |
| Aufwertung Holzfäller oder Bergwerk auf Stufe 2 | 5 Motoren |
| Dekoration | 1 bis 5 Bretter oder Steinziegel |

**Strombilanz:** Ein Biomassebrenner (30 kW) verbraucht bei voller Last 15 Holz pro Minute. Ein Holzfäller versorgt also zwei Brenner. Eine einfache Linie aus Bergwerk, Schmelzofen und Werkstatt braucht 13 kW, ein Brenner trägt zwei solche Linien. Holzkohle liefert aus derselben Holzmenge 50 Prozent mehr Energie.

**Änderung nach Phase 6 (Wunsch des Auftraggebers):** Der Holzfäller braucht keinen Strom (Muskelkraft). Sonst bräuchte man Strom, um Holz zu bekommen, das man erst für Strom verbrennt. So ist die Reihenfolge schlüssig: Holzfäller → Holz → Brenner → Strom für Bergwerk und Maschinen. Stufe 2 verdoppelt beim Holzfäller nur das Tempo.

**Weitere Änderung nach Phase 6:** Brenner holen sich Brennstoff selbst aus dem Vorrat, wenn Strom gebraucht wird, und immer nur 2 Stück (im Infofenster abschaltbar, bei neuen Brennern an). Der Verteiler ist ab Spielbeginn baubar (4 Holz, 2 Stein). Holzfäller und Bergwerk lagern bis zu 50 Items selbst (statt eines Puffers für zwei Durchläufe), damit sie nicht sofort stehen bleiben, wenn das Band fehlt oder stockt. Grund: Lieferte der erste Holzfäller alles an den Brenner, kam kein Holz mehr in den Vorrat, und ohne Vorrat ließ sich der Verteiler nicht erforschen. Jetzt reicht ein Band vom Holzfäller zur Zentrale, oder ein Verteiler teilt das Holz zwischen Brenner und Zentrale.

## 6. Logistik: Förderbänder

Bänder funktionieren wie in Satisfactory: Sie docken direkt an die Ein- und Ausgänge der Gebäude an, es gibt keine Greifarme. Jedes Band hat eine einzige Spur.

**Regeln:**

- Ein Band liegt auf Rasterfeldern und hat pro Feld eine Richtung. Kurven entstehen automatisch.
- Der Spieler zieht ein Band mit gedrückter Maustaste von einem Ausgang zu einem Eingang oder frei über die Wiese. Der Weg wird als Vorschau angezeigt, bevor er gebaut wird.
- Ein Band, das an einem Gebäudeeingang endet, liefert dort ab. Ein Band, das an einem Ausgang beginnt, nimmt dort auf. Passt die Richtung nicht, zeigt die Vorschau das an.
- Items sind auf dem Band einzeln sichtbar und stauen sich, wenn das Ziel voll ist.
- Drei Bandstufen mit 60, 120 und 240 Items pro Minute, unterscheidbar an Farbe und Tempo. Ein vorhandenes Band lässt sich durch Überbauen aufwerten.
- Verteiler geben reihum auf ihre freien Ausgänge ab. Zusammenführer nehmen reihum von ihren Eingängen.
- Die Bandbrücke lässt zwei Bänder im rechten Winkel kreuzen, ohne dass sich die Items mischen.

**Bandwerte:** Items liegen mit mindestens einem halben Feld Abstand. Die Bänder laufen mit 0,5, 1 und 2 Feldern pro Sekunde, das ergibt 60, 120 und 240 Items pro Minute.

**Simulation der Bänder (entscheidend für die Performance):**

- Zusammenhängende Bandfelder werden zu einem Segment zusammengefasst. Ein Segment reicht von einer Quelle (Gebäudeausgang, Verteiler, Zusammenführer) bis zu einem Ziel.
- Ein Segment speichert seine Items nicht als einzelne Objekte mit Position, sondern als Liste der Abstände zwischen aufeinanderfolgenden Items. Pro Tick wird im Normalfall nur der Abstand des vordersten Items zum Bandende verringert. Ein gestautes Segment kostet fast keine Rechenzeit.
- Die Daten liegen in typisierten Arrays (zum Beispiel `Uint16Array` für Abstände, `Uint16Array` für Item-IDs), nicht in JavaScript-Objekten.
- Wird ein Bandfeld gebaut oder abgerissen, werden nur die betroffenen Segmente neu gebildet, nicht das ganze Netz.
- Die sichtbare Position eines Items wird erst beim Zeichnen aus den Abständen berechnet, und nur für Segmente im Bildausschnitt.

**Nicht in der ersten Version:** Züge, Drohnen, Rohre, unterirdische Bänder, Filter und Prioritäten an Verteilern. Die Segmentlogik soll diese Erweiterungen aber nicht verbauen.

## 7. Energie: Stromnetz

Maschinen brauchen Strom, der von Generatoren erzeugt und über Strommasten mit sichtbaren Leitungen verteilt wird.

**Regeln:**

- Ein Strommast versorgt alle Gebäude in seinem Umkreis (Startwert: 5 × 5 Felder um den Mast). Der Umkreis wird beim Platzieren und bei eingeschalteter Strom-Ansicht angezeigt.
- Masten verbinden sich beim Platzieren automatisch mit anderen Masten in Reichweite (Startwert: 8 Felder, großer Mast 20 Felder). Die Verbindung erscheint als durchhängendes Kabel.
- Generatoren speisen in das Netz ein, sobald sie im Umkreis eines Mastes stehen.
- Alle verbundenen Masten bilden ein Netz. Mehrere getrennte Netze sind möglich.
- Pro Netz werden Erzeugung und Verbrauch summiert. Reicht der Strom, laufen alle Maschinen mit 100 Prozent.
- Reicht der Strom nicht, laufen alle Maschinen des Netzes gleichmäßig langsamer (Erzeugung geteilt durch Verbrauch). Es gibt keinen Stromausfall und keine Sicherung, die auszulösen wäre.
- Der Biomassebrenner verbraucht nur so viel Brennstoff, wie das Netz gerade abruft. Ein Holz reicht bei voller Last 4 Sekunden, eine Holzkohle 12 Sekunden.
- Maschinen, die warten oder blockiert sind, ziehen nur 10 Prozent ihres Verbrauchs.

**Simulation:**

- Netze werden als Gruppen verwaltet. Die Zugehörigkeit wird nur neu berechnet, wenn ein Mast, Generator oder Verbraucher gebaut oder abgerissen wird.
- Pro Tick wird je Netz nur eine Summe und ein Faktor berechnet. Jede Maschine liest den Faktor ihres Netzes.

**Anzeige:** Eine Kopfzeile zeigt Erzeugung, Verbrauch und Auslastung des größten Netzes. Ein Klick auf einen Mast zeigt die Werte seines Netzes mit einem kleinen Verlaufsdiagramm. Die Strom-Ansicht färbt versorgte und unversorgte Gebäude ein.

**Später möglich:** Solaranlage (nur tagsüber), Wasserrad am Ufer, Kohlekraftwerk, Batteriespeicher.

## 8. Forschung und Fortschritt

Fortschritt entsteht über einen Forschungsbaum, dessen Knoten mit Items aus dem globalen Vorrat bezahlt werden. Ein Endziel gibt es nicht. Nach dem letzten Knoten bleiben endlos wiederholbare Upgrades.

**Ablauf:** Der Spieler öffnet den Forschungsbaum, wählt einen verfügbaren Knoten und bezahlt ihn sofort aus dem Vorrat. Die Freischaltung gilt direkt. Es gibt keine Wartezeit und kein Laborgebäude.

**Von Beginn an verfügbar:** Zentrale, Holzfäller, Bergwerk, Schmelzofen, Werkstatt, Förderband Mk1, Biomassebrenner, Strommast und die Rezepte für Kupferbarren, Steinziegel, Bretter und Kupferdraht.

**Forschungsbaum der ersten Version:**

| Knoten | Schaltet frei | Voraussetzung | Kosten (Startwerte) |
| --- | --- | --- | --- |
| Logistik I | Zusammenführer (Verteiler gibt es ab Spielbeginn) | Start | 50 Bretter, 30 Kupferdraht |
| Lagerhaltung | Lager | Start | 80 Bretter, 40 Steinziegel |
| Köhlerei | Rezept Holzkohle | Start | 60 Steinziegel |
| Verschönerung I | Wege, Laternen, Blumenbeete | Start | 40 Steinziegel, 40 Bretter |
| Blechbearbeitung | Rezept Kupferblech | Logistik I | 100 Kupferbarren |
| Manufaktur | Manufaktur, Rezepte Baurahmen und Spule | Blechbearbeitung | 100 Bretter, 100 Steinziegel, 50 Kupferblech |
| Windkraft | Windrad | Manufaktur | 30 Baurahmen, 30 Spulen |
| Logistik II | Förderband Mk2, Bandbrücke | Manufaktur | 60 Baurahmen, 100 Kupferblech |
| Elektronik | Rezept Leiterplatte | Manufaktur | 60 Spulen, 100 Kupferdraht |
| Antriebe | Rezepte Motor und Steuereinheit | Elektronik | 50 Leiterplatten, 50 Baurahmen |
| Fernleitung | Großer Strommast | Windkraft, Antriebe | 40 Spulen, 20 Motoren |
| Logistik III | Förderband Mk3 | Logistik II, Antriebe | 60 Motoren, 40 Steuereinheiten |
| Tiefbau | Bergwerk und Holzfäller Stufe 2 (doppeltes Tempo, beim Bergwerk doppelter Strom) | Antriebe | 80 Motoren |
| Verschönerung II | Zäune, Bänke, Zierbäume, farbige Wege | Verschönerung I, Manufaktur | 100 Steinziegel, 20 Baurahmen |

**Wiederholbare Upgrades (nach Antriebe verfügbar, Grundkosten 50 Motoren und 50 Steuereinheiten, je Stufe 50 Prozent mehr):**

- Maschinentempo: plus 5 Prozent je Stufe für Schmelzofen, Werkstatt und Manufaktur
- Abbautempo: plus 5 Prozent je Stufe für Holzfäller und Bergwerk
- Effizienz: minus 3 Prozent Stromverbrauch je Stufe, höchstens 10 Stufen

**Erste Schritte:** Eine kleine Aufgabenliste am Bildschirmrand führt durch den Einstieg (Holz sammeln, Zentrale bauen, Brenner und Mast bauen, erstes Bergwerk anschließen, erstes Band zur Zentrale, erste Forschung). Sie ersetzt ein Tutorial und lässt sich ausblenden.

**Statistik als Langzeitmotivation:** Ein Fenster zeigt Produktion und Verbrauch je Item pro Minute sowie Gesamtzahlen (gebaute Gebäude, gelieferte Items, Spielzeit).

## 9. Steuerung, Kamera und Oberfläche

Gespielt wird nur mit Maus und Tastatur aus einer isometrischen Sicht von schräg oben, ohne Spielfigur.

**Kamera:** Orthografische Kamera im klassischen Iso-Winkel. Sie lässt sich verschieben, stufenlos zoomen und in 90-Grad-Schritten um die Karte drehen. Bewegungen sind weich geglättet. Die Kamera bleibt innerhalb der Kartengrenzen.

**Tastatur und Maus:**

| Eingabe | Aktion |
| --- | --- |
| W A S D oder Pfeiltasten | Kamera verschieben |
| Mittlere Maustaste ziehen | Kamera verschieben |
| Mausrad | Zoomen auf die Mausposition |
| Q und E | Kamera um 90 Grad drehen |
| Linksklick | Platzieren, auswählen, von Hand abbauen |
| Linksklick ziehen | Bänder und Wege in einer Linie bauen |
| Rechtsklick oder Esc | Bauen abbrechen, Fenster schließen |
| R | Gebäude vor dem Platzieren drehen |
| X | Abrissmodus (Klick oder Rahmen ziehen) |
| Tasten 1 bis 9 | Schnellleiste |
| Pipette (Taste F) | Gebäude unter der Maus samt Rezept als Bauauswahl übernehmen |
| T | Forschungsbaum |
| I | Statistikfenster (ergänzt in Phase 6) |
| V | Strom-Ansicht ein und aus |
| Leertaste | Pause |
| Strg + S | Speichern |
| Strg + Z | Letzten Bau- oder Abrissschritt rückgängig machen |

**Elemente der Oberfläche:**

- **Kopfzeile:** wichtigste Vorratsmengen, Stromstatus, Spielgeschwindigkeit (Pause, 1-fach, 2-fach, 3-fach), Menüknopf
- **Bauleiste unten:** Kategorien Abbau, Produktion, Logistik, Energie, Dekoration. Jeder Eintrag zeigt Icon, Name und Baukosten. Nicht bezahlbare Gebäude sind ausgegraut.
- **Infofenster:** Ein Klick auf ein Gebäude zeigt Zustand, Rezeptauswahl, Pufferinhalte, Auslastung in Prozent und Stromverbrauch.
- **Vorratsfenster:** alle Items im globalen Vorrat
- **Forschungsbaum:** Knoten mit Verbindungen, Kosten und Zustand (gesperrt, verfügbar, erforscht)
- **Statistikfenster:** Produktion und Verbrauch pro Minute
- **Menü:** Neues Spiel mit Seed, Speichern, Laden, Export, Import, Einstellungen (Grafikqualität, Lautstärke, Tastenbelegung anzeigen)
- **Tooltips** an allen Knöpfen und Items

**Gestaltung der Oberfläche:** Ruhig, warm, abgerundete Flächen, gut lesbare Schrift, dezente Übergangsanimationen. Die Oberfläche wird nur aktualisiert, wenn sich angezeigte Werte ändern, und höchstens einige Male pro Sekunde.

## 10. Grafikstil und Atmosphäre

Der Stil ist warmes, liebevoll detailliertes Low-Poly mit flachen Farbflächen. Alle Formen entstehen im Code, und die Technik dahinter ist auf wenige Zeichenaufrufe ausgelegt.

**Farbstimmung:** Sonnig und warm. Das Grundlicht ist ein goldenes Nachmittagslicht mit leicht gelblicher Sonne und weichen, bläulich-violetten Schatten. Wiesen sind satt gelbgrün, Holz honigfarben, Ziegel terrakotta, Wasser türkis. Auch die Nacht bleibt freundlich: tiefes Blau mit warm leuchtenden Fenstern und Laternen. Kalte, graue oder schmutzige Töne werden vermieden.

**Formen und Farben:**

- Jedes Gebäude wird aus einfachen Grundkörpern (Quader, Zylinder, Kegel, Prismen) zusammengesetzt und einmalig zu einer einzigen Geometrie verschmolzen.
- Farben stecken als Vertex-Farben in der Geometrie. Es gibt keine Texturen. Dadurch teilen sich fast alle Objekte ein einziges Material.
- Eine feste, kleine Farbpalette (etwa 24 Farben) hält das Bild stimmig: warme Holz- und Ziegeltöne, gedämpftes Grün, Kupfer als Akzent, kräftige Farben nur für Items und Hinweise.
- Jedes Gebäude hat eine klar erkennbare Silhouette und zwei bis drei liebevolle Details, zum Beispiel einen Schornstein, ein Vordach, Fenster, ein Zahnrad oder Holzstapel.
- Flat Shading (harte Kanten) für den Low-Poly-Charakter.

**Bewegung (alles ohne Rechenlast in der Spiellogik):**

- Arbeitende Maschinen bewegen ein Teil: Sägeblatt, Zahnrad, Kolben, Windradflügel. Die Bewegung läuft im Vertex-Shader oder über wenige Instanz-Matrizen, nicht über einzelne Objekte.
- Bäume und Gras wiegen sich leicht im Wind (Vertex-Shader).
- Rauch aus Schornsteinen und Funken am Schmelzofen als kleines, gepooltes Partikelsystem.
- Wasser mit sanfter Wellenbewegung und leichtem Glanz.
- Bandoberflächen laufen sichtbar in Transportrichtung.
- Neu gebaute Gebäude erscheinen mit einer kurzen Aufploppen-Animation.

**Licht und Stimmung:**

- Ein gerichtetes Sonnenlicht plus Himmelslicht (Hemisphere Light). Keine weiteren echten Lichtquellen.
- Langsamer Tag-Nacht-Wechsel (Startwert: 20 Minuten pro Tag). Nachts wird es blau und ruhig, aber nie so dunkel, dass man nicht bauen kann. Der Wechsel hat keine Auswirkung auf die Spiellogik und lässt sich abschalten.
- Fenster, Laternen und Öfen leuchten nachts über selbstleuchtende Farben (Emissive), nicht über echte Lichter.
- Weiche Schatten aus einer einzigen Shadow Map, die dem Bildausschnitt folgt. In der niedrigen Qualitätsstufe ersetzen einfache dunkle Flecken unter den Gebäuden die Schatten.
- Leichter Dunst in der Ferne, der den Kartenrand weich verdeckt.

**Qualitätsstufen:** Niedrig, Mittel, Hoch. Sie steuern Schatten, Partikelmenge, Dekorationsdichte, Auflösungsskalierung und Kantenglättung. Beim ersten Start wählt das Spiel die Stufe anhand einer kurzen Messung der Bildrate.

**Ton:** Leise Umgebungsgeräusche (Wind, Vögel, Wasser), dezente Maschinengeräusche abhängig vom Bildausschnitt und sanfte Klänge beim Bauen und Forschen. Die Klänge werden mit der Web Audio API erzeugt oder als wenige, lizenzfreie (CC0) Dateien eingebunden. Die Musik stellt der Auftraggeber selbst bereit. Claude Code baut dafür einen einfachen Musikspieler: Dateien (MP3 oder OGG) liegen in public/audio/musik, eine Liste in den Datendateien nennt die Stücke, sie laufen in zufälliger Reihenfolge mit weichem Überblenden und werden erst bei Bedarf nachgeladen. Solange keine Dateien vorhanden sind, läuft das Spiel ohne Musik und ohne Fehlermeldung. Lautstärke ist getrennt regelbar, Ton startet erst nach der ersten Nutzereingabe.

## 11. Technische Architektur

Die wichtigste Regel: Spiellogik (Simulation) und Darstellung sind strikt getrennt. Die Simulation kennt weder three.js noch den Browser und läuft in festen Zeitschritten. Die Darstellung liest den Zustand nur und verändert ihn nie.

**Schichten:**

| Schicht | Aufgabe | Darf zugreifen auf |
| --- | --- | --- |
| `data` | Definitionen von Items, Rezepten, Gebäuden, Forschung, Texten | nichts |
| `sim` | Welt, Raster, Gebäude, Bänder, Strom, Forschung, Vorrat | `data` |
| `render` | three.js-Szene, Kamera, Instanzen, Effekte | `data`, liest `sim` |
| `ui` | HTML-Oberfläche | `data`, liest `sim`, sendet Befehle |
| `input` | Maus und Tastatur, übersetzt Eingaben in Befehle | `render` (für Mausposition im Raster), sendet Befehle |
| `core` | Spielschleife, Befehlswarteschlange, Ereignisse, Zufallsgenerator, Speichern | alle |

**Befehle:** Jede Änderung am Spielzustand läuft über einen Befehl (zum Beispiel `gebäudeBauen`, `abreißen`, `rezeptSetzen`, `forschen`). Oberfläche und Eingabe ändern den Zustand nie direkt. Das ermöglicht Rückgängig, saubere Tests und einen späteren Umzug der Simulation in einen Web Worker.

**Spielschleife:**

- Die Simulation läuft mit festen 20 Ticks pro Sekunde, unabhängig von der Bildrate. Spielgeschwindigkeit 2-fach und 3-fach bedeutet mehr Ticks pro Sekunde.
- Die Darstellung läuft mit der Bildrate des Monitors und interpoliert Bewegungen (Items auf Bändern) zwischen zwei Ticks, damit alles flüssig aussieht.
- Fällt die Bildrate stark ab, werden höchstens fünf Ticks pro Bild nachgeholt. Danach läuft das Spiel lieber langsamer, als einzufrieren.
- Ist der Browser-Tab im Hintergrund, pausiert das Spiel.

**Datenhaltung in der Simulation:**

- Das Raster ist ein flaches typisiertes Array pro Eigenschaft (Feldart, Vorkommen, belegende Gebäude-ID), adressiert über `index = y * breite + x`.
- Gebäude liegen als Struktur aus Arrays vor: je Eigenschaft ein typisiertes Array, die Gebäude-ID ist der Index. Freie IDs werden wiederverwendet. Keine Klasseninstanz pro Gebäude.
- Pro Gebäudeart gibt es ein System, das alle Gebäude dieser Art in einer Schleife verarbeitet (Abbau, Maschinen, Brenner, Zentrale).
- Bänder und Stromnetze haben eigene Strukturen (Abschnitte 6 und 7).
- Die Simulation ist deterministisch: gleicher Seed und gleiche Befehle ergeben den gleichen Zustand. Gerechnet wird in ganzen Ticks und ganzen Zahlen, wo immer möglich.

**Reihenfolge eines Ticks:** Befehle anwenden → Stromnetze berechnen → Abbau → Maschinen → Bänder und Verteiler → Zentrale und Vorrat → Statistik → Ereignisse an Darstellung und Oberfläche melden.

**Schlafende Gebäude:** Eine Maschine, die blockiert ist oder auf Eingang wartet, wird aus der aktiven Liste genommen und erst wieder geweckt, wenn ein Item ankommt oder Platz im Ausgang frei wird. Große, eingeschwungene Fabriken kosten dadurch wenig Rechenzeit.

**Web Worker:** Die erste Version läuft im Hauptthread. Weil die Simulation keine Browser- oder three.js-Abhängigkeit hat und nur über Befehle und lesbaren Zustand kommuniziert, kann sie später in einen Worker umziehen. Wegen GitHub Pages geschieht das dann ohne `SharedArrayBuffer`.

**Verbindung zur Darstellung:** Die Simulation meldet Änderungen als Ereignisse (Gebäude gebaut, abgerissen, Zustand gewechselt). Die Darstellung aktualisiert daraufhin nur die betroffenen Instanzen und baut nie die ganze Szene neu auf.

## 12. Performance-Strategie

Ziel sind stabile 60 Bilder pro Sekunde auf einem Laptop mit integrierter Grafik bei einer Fabrik mit 2.000 Gebäuden und 20.000 Items auf Bändern. Die Architektur soll das Zehnfache nicht ausschließen.

**Messbare Budgets:**

| Messgröße | Zielwert |
| --- | --- |
| Bildrate bei der Referenzfabrik | 60 Bilder pro Sekunde |
| Rechenzeit eines Simulations-Ticks | unter 4 ms |
| Zeichenaufrufe (Draw Calls) pro Bild | unter 150 |
| Speicherzuweisungen pro Bild im Normalbetrieb | keine |
| Ladezeit bis zum Hauptmenü | unter 3 Sekunden |
| Größe des Builds (gepackt) | unter 1 MB ohne Tondateien |
| Speicherstand der Referenzfabrik | unter 2 MB |

**Darstellung:**

- **Instancing für alles, was mehrfach vorkommt.** Pro Gebäudetyp, Item-Typ, Baumart und Dekorationsart genau ein `InstancedMesh`. Tausend Schmelzöfen sind ein Zeichenaufruf.
- **Gelände pro Chunk.** Jeder Chunk von 16 × 16 Feldern ist eine verschmolzene Geometrie, die nur bei Änderungen neu gebaut wird.
- **Culling pro Chunk.** Instanzen werden chunkweise verwaltet. Chunks außerhalb des Bildausschnitts werden weder aktualisiert noch gezeichnet.
- **Band-Items nur im Bild.** Die Positionen der Items werden ausschließlich für sichtbare Segmente in den Instanzpuffer geschrieben.
- **Detailstufen nach Zoom.** Weit herausgezoomt verschwinden Items auf Bändern, Partikel und Kleindekoration. Bänder zeigen dann nur ihre Lauffläche.
- **Ein gemeinsames Material** mit Vertex-Farben für fast alle Objekte, Animationen im Shader.
- **Schatten sparsam.** Eine Shadow Map, begrenzt auf den Bildausschnitt, Aktualisierung nur bei Kamerabewegung oder Änderungen. Items und Partikel werfen keine Schatten.
- **Auflösung begrenzen.** Das Pixelverhältnis ist auf höchstens 2 gedeckelt, in der niedrigen Stufe auf 1.
- **Kein Nachbearbeitungs-Stapel** in der ersten Version. Stimmung entsteht über Licht, Farben und Dunst.

**Simulation:**

- Typisierte Arrays statt Objekte, feste Schleifen statt Callbacks in den Tick-Systemen.
- Segmentierte Bänder mit Abstandslisten (Abschnitt 6) und schlafende Gebäude (Abschnitt 11).
- Stromnetze und Bandsegmente werden nur bei Bauänderungen neu berechnet.
- Objekt-Pools für Partikel und kurzlebige Hilfsobjekte. Keine neuen Vektoren oder Arrays innerhalb der Bild- und Tick-Schleifen.

**Werkzeuge, die von Anfang an eingebaut werden:**

- **Debug-Anzeige** (Taste F3): Bildrate, Tick-Zeit, Zeichenaufrufe, Dreiecke, Zahl der Gebäude, Segmente und Items.
- **Stresstest-Welt:** Ein Entwicklerbefehl erzeugt automatisch die Referenzfabrik (2.000 Gebäude, 20.000 Items) und eine zehnmal größere Variante. Jede Phase wird damit geprüft.
- **Automatischer Tick-Benchmark** als Test, der bei deutlicher Verschlechterung fehlschlägt.

## 13. Speichern und Laden

Spielstände liegen lokal im Browser in IndexedDB und lassen sich als Datei exportieren und wieder importieren.

- **Speicherort:** IndexedDB statt `localStorage`, weil `localStorage` auf wenige Megabyte begrenzt ist und große Fabriken nicht fasst. Nur Einstellungen (Grafik, Lautstärke) liegen in `localStorage`. Ausnahme (in der Umsetzung ergänzt): Beim Schließen des Tabs bricht der Browser das Schreiben in IndexedDB oft ab. Deshalb wird der Spielstand in diesem Moment kurz als Notfall-Kopie in `localStorage` abgelegt und beim nächsten Start in den Autosave-Platz übernommen.
- **Speicherplätze:** mehrere benannte Spielstände mit Datum, Spielzeit und Seed.
- **Automatisches Speichern:** alle 2 Minuten und beim Schließen des Tabs in einen eigenen Autosave-Platz. Das Speichern darf kein sichtbares Ruckeln auslösen.
- **Inhalt:** Formatversion, Seed, Kartengröße, Spielzeit, globaler Vorrat, Forschungsstand, alle Gebäude mit Position, Drehung, Rezept und Puffern, alle Bandsegmente mit Items, gefällte und nachwachsende Bäume, Kameraposition.
- **Nicht gespeichert:** das Gelände selbst. Es wird beim Laden aus dem Seed neu erzeugt. Gespeichert werden nur Abweichungen.
- **Format:** JSON mit kompakten Arrays, für den Export zusätzlich mit dem im Browser eingebauten `CompressionStream` gepackt.
- **Export:** lädt eine Datei herunter (Dateiname beginnt mit wiesenwerk, Endung `.fabrik`).
- **Import:** Datei auswählen oder ins Fenster ziehen. Die Datei wird geprüft. Eine beschädigte oder fremde Datei führt zu einer verständlichen Fehlermeldung, nicht zu einem Absturz.
- **Versionen:** Jeder Spielstand trägt eine Formatnummer. Für jede Formatänderung gibt es eine Migrationsfunktion, damit alte Spielstände nach Updates weiter funktionieren.
- **Hinweis für den Spieler:** Das Menü erklärt kurz, dass Spielstände im Browser liegen und beim Löschen der Browserdaten verloren gehen, und empfiehlt den Export als Sicherung.

## 14. Projektstruktur und Deployment

Das Projekt ist ein einzelnes Vite-Projekt in einem GitHub-Repository. Jeder Push auf den Hauptzweig baut das Spiel und veröffentlicht es automatisch auf GitHub Pages.

**Ordnerstruktur:**

```
/
├─ index.html
├─ vite.config.ts
├─ package.json
├─ CLAUDE.md                  Arbeitsregeln und Projektwissen für Claude Code
├─ README.md                  Kurzbeschreibung, Start und Veröffentlichung
├─ docs/
│  └─ projektskript.md        Dieses Dokument
├─ .github/workflows/
│  └─ deploy.yml              Build, Tests und Veröffentlichung auf GitHub Pages
├─ public/                    Statische Dateien (Favicon, später Tondateien)
├─ src/
│  ├─ main.ts                 Einstiegspunkt
│  ├─ core/                   Spielschleife, Befehle, Ereignisse, Speichern
│  ├─ data/                   Items, Rezepte, Gebäude, Forschung, Texte
│  ├─ sim/                    Welt, Raster, Gebäude, Bänder, Strom, Forschung, Zufall, Noise
│  ├─ render/                 Szene, Kamera, Gelände, Instanzen, Modelle, Effekte
│  ├─ ui/                     Kopfzeile, Bauleiste, Fenster, Menü
│  ├─ input/                  Maus, Tastatur, Bauwerkzeuge
│  └─ dev/                    Debug-Anzeige, Stresstest
└─ tests/                     Tests der Simulation
```

**Abhängigkeiten:** So wenige wie möglich. Zur Laufzeit nur `three`. Für die Entwicklung `typescript`, `vite`, `vitest`, `eslint`, `prettier`. Noise und Zufallsgenerator werden als kleine eigene Module geschrieben. Jede weitere Abhängigkeit braucht eine kurze Begründung.

**Deployment auf GitHub Pages:**

1. In `vite.config.ts` wird `base` auf den Repository-Namen gesetzt (`/wiesenwerk/`) oder auf `./` für rein relative Pfade.
2. Der Workflow `deploy.yml` läuft bei jedem Push auf `main`: Abhängigkeiten installieren, Typprüfung, Tests, `vite build`, dann den Ordner `dist` über die offiziellen GitHub-Pages-Actions veröffentlichen.
3. Im Repository wird unter Settings → Pages als Quelle „GitHub Actions“ eingestellt. Diesen Schritt macht der Auftraggeber einmalig von Hand. Claude Code liefert dafür eine Schritt-für-Schritt-Anleitung.
4. Schlägt ein Test oder die Typprüfung fehl, wird nicht veröffentlicht.

**Lokale Befehle:** `npm run dev` (Entwicklungsserver), `npm run build` (Build), `npm run preview` (Build lokal ansehen), `npm test` (Tests), `npm run lint` (Codeprüfung).

**Versionsanzeige:** Das Hauptmenü zeigt Versionsnummer und Build-Datum, damit erkennbar ist, welcher Stand online ist.

## 15. Umsetzungsphasen

Die erste Version entsteht in acht Phasen. Jede Phase endet mit einem lauffähigen Stand auf GitHub Pages und wird erst abgeschlossen, wenn ihr Abnahmekriterium erfüllt ist. Nach Phase 7 ist das Spiel ordentlich spielbar.

| Phase | Inhalt | Abnahmekriterium |
| --- | --- | --- |
| 0. Fundament | Vite-Projekt, TypeScript, Tests, Lint, Deploy-Workflow, `CLAUDE.md`, leere Szene mit Spielschleife und Debug-Anzeige | Die Seite ist über GitHub Pages erreichbar und zeigt eine 3D-Szene mit Bildratenanzeige. |
| 1. Welt und Kamera | Weltgenerator mit Seed, Gelände pro Chunk, Wälder, Vorkommen, Wasser, Iso-Kamera mit Verschieben, Zoom und Drehen | Eine Karte mit 256 × 256 Feldern lässt sich flüssig erkunden. Gleicher Seed ergibt die gleiche Karte. |
| 2. Bauen und Vorrat | Raster, Bauvorschau, Platzieren, Drehen, Abreißen, Zentrale, globaler Vorrat, Abbau von Hand, Bauleiste, Kopfzeile, Befehlssystem | Der Spieler sammelt Holz von Hand, baut die Zentrale und weitere Gebäude und reißt sie mit voller Erstattung ab. |
| 3. Produktion und Bänder | Holzfäller, Bergwerk, Schmelzofen, Werkstatt, Rezeptauswahl, Förderband Mk1 mit Segmentlogik, Infofenster. Strom ist in dieser Phase noch unbegrenzt. | Eine Linie vom Bergwerk über den Schmelzofen zur Zentrale läuft selbstständig und füllt den Vorrat. |
| 4. Speichern | IndexedDB, Speicherplätze, Autosave, Export, Import, Formatversion, Hauptmenü | Eine Fabrik übersteht Neuladen der Seite sowie Export und Import ohne Abweichung. |
| 5. Strom | Biomassebrenner, Strommast, Netze, Kabel, Verlangsamung bei Unterversorgung, Strom-Ansicht | Maschinen laufen nur mit Strom, und zu wenig Erzeugung verlangsamt sie sichtbar. |
| 6. Forschung und Ausbau | Forschungsbaum mit allen Knoten, Manufaktur, Verteiler, Zusammenführer, Bandbrücke, Lager, Band Mk2 und Mk3, Windrad, großer Mast, Stufe-2-Abbau, wiederholbare Upgrades, Statistikfenster, Aufgabenliste „Erste Schritte“ | Der gesamte Forschungsbaum ist von einem neuen Spiel aus ohne Entwicklerhilfen erreichbar. |
| 7. Atmosphäre und Feinschliff | Endgültige Gebäudemodelle, Maschinenanimationen, Partikel, Tag-Nacht-Wechsel, Wasser, Dekoration, Ton, Qualitätsstufen, Rückgängig, Pipette, Balancing, Performance-Abnahme | Die Referenzfabrik aus dem Stresstest hält alle Budgets aus Abschnitt 12 ein. |

**Hinweise zur Reihenfolge:**

- Bis Phase 6 dürfen Gebäude einfache, aber bereits unterscheidbare Platzhalterformen sein. Instancing und Chunk-Verwaltung gelten jedoch von Phase 1 an, weil sie sich nachträglich schwer einbauen lassen.
- Speichern kommt bewusst früh (Phase 4), damit das Format mit dem Spiel wächst und jede spätere Phase Migrationen übt.
- Der Stresstest wird in Phase 3 angelegt und ab dann in jeder Phase ausgeführt.
- Ergänzung bei der Umsetzung: Die Dekorationsgebäude (Wege, Laternen, Blumenbeete, Zäune, Bänke, Zierbäume, farbige Wege) entstehen schon in Phase 6 als einfache Platzhalter, damit die Forschungsknoten „Verschönerung I und II“ etwas freischalten. Phase 7 ersetzt sie durch die endgültigen Modelle.
- Nach Phase 7 auf Wunsch des Auftraggebers ergänzt, weil die Spielfläche schnell voll wurde: Depots (zahlen direkt in den Vorrat ein, damit nicht alles per Band zur Zentrale muss), Lager-Varianten mit unterschiedlichen Anschlüssen, Tunnelband (unterirdische Bänder standen ursprünglich unter „nicht in der ersten Version“), Bauen auf stehendem Wald mit automatischem Roden und wählbare Kartengrößen bis 512 × 512 (größere Karten standen unter „nach der ersten Version“). Neuer Forschungsknoten „Lagerwirtschaft“ (Voraussetzungen Lagerhaltung und Manufaktur, 40 Baurahmen und 150 Bretter). Später (Wunsch des Auftraggebers): Ausgabestelle, die ein gewähltes Item aus dem Vorrat zurück aufs Band legt (60/min), damit der Vorrat Produktionen versorgen kann. Zentrale und Depots nehmen an jedem Randfeld Bänder an (Zentrale und Großdepot 12, Depot 8 Eingänge). Verteil- und Sammellager danach ausgemustert (nicht mehr baubar, alte Exemplare laufen weiter), weil Depot und Ausgabestelle ihre Aufgaben besser erfüllen.
- Ausbaurunde Spielspaß (Auftraggeber, 2026-11-16): Als Langzeitziel ein Wahrzeichen, der **Uhrturm**. Er wächst in sechs Abschnitten (Fundament, Mauern, Turmstube, Uhrwerk, Glockenstube, Turmspitze), die sich Waren wünschen (per Band oder aus dem Vorrat) und kleine Belohnungen bringen (+5 % Tempo, Brunnen, Musikpavillon). Die Uhr zeigt die echte Uhrzeit des Computers, die Glocke schlägt zur vollen Stunde. Ohne Zeitdruck, nichts geht verloren.
- Schritt 2 der Ausbaurunde: fünf neue Endprodukte (Eisenplatte, Linse, Stahlträger, Uhrwerk, Messinstrument), Forschungen „Feinmechanik“ und „Optik“ sowie Stufe 2 auch für Schmelzofen, Werkstatt, Manufaktur und Gießerei (doppeltes Tempo und doppelter Strom).
- Durchsatz neu abgestimmt (Auftraggeber: Zusammenführen brachte nichts, weil eine Drahtwerkstatt allein das Band füllte): Grundmaschinen liefern einheitlich 30 Items/min (Draht und Bretter 4 s statt 2 s), Bänder tragen 90/180/360 Items/min (Mk1/Mk2/Mk3). Drei Maschinen einer Stufe füllen das Band derselben Stufe. Abbau und Fertigung haben drei Stufen je Gebäude (Tempo ×1/×2/×4, Strom ×1/×2/×3), Stufe 3 über die neue Forschung „Hochleistung“.
- Schritt 3 der Ausbaurunde: Die Aufgabenliste „Erste Schritte“ geht als Kette aus 7 Kapiteln durchs ganze Spiel, jedes mit kleinem Geschenk zum Abschluss. Gezeigt wird immer nur das aktuelle Kapitel.
- Schritt 4 der Ausbaurunde: Engpass-Ansicht (Taste B). Maschinen werden nach Zustand eingefärbt, ein Fenster fasst Probleme zusammen („2 × Werkstatt wartet auf Kupferbarren“) und springt per Klick zur Maschine.
- Schritt 5 der Ausbaurunde: Fotomodus (Taste P). Oberfläche aus, Tageszeit frei wählbar, feineres Drehen und näheres Zoomen, „Foto speichern“ als PNG-Datei.
- Ausbaurunde Gemütlichkeit (Auftraggeber, 2026-11-18: „alle Ideen gefallen mir gut“), Schritt 1: **Gärten**, die sichtbar wachsen (Gemüsebeet, Blumenwiese ab Start; Bienenstock und Obstgarten mit „Gartenbau“; Gewächshaus mit „Gewächshäuser“), mit Gärtnern und Bienen. Gärten und Dekoration machen ihre Umgebung **gemütlich**: Maschinen in der Nähe arbeiten bis zu 10 % schneller (nur Bonus, nie Strafe). Bienenstöcke lassen Gärten in der Nähe anderthalbmal so schnell wachsen. Neue Baukategorie „Gärten“. Weitere Schritte: Natur erobert alte Gebäude zurück und Hecken über Bändern, Garten-Waren (Äpfel, Gemüse, Honig, Blumen, Kuchen fürs Dorf), Jahreszeiten.
- Schritt 2 der Ausbaurunde Gemütlichkeit: Gebäude bewachsen mit der Zeit seit dem Bau (Gras, Blumen, Efeu am Sockel), auf den Wegen der Arbeiter entstehen Trampelpfade (rein optisch). Neu: **Hecke** (ab Start) und **Rosenbogen** („Gartenbau“) werden wie ein Band über vorhandene Bänder gezogen und machen Bandstraßen zu grünen Alleen, ohne den Warenfluss zu ändern. Spielstandformat 9 (Bau-Zeitpunkt und Hecken), alte Stände werden umgewandelt.
- Schritt 3 der Ausbaurunde Gemütlichkeit: Gärten ernten Gemüse, Blumen und Äpfel direkt in den Vorrat, Bienenstöcke machen Honig. Neue Gebäude Backstube (Apfelkuchen aus Äpfeln und Honig, Forschung „Backkunst“) und Komposter (Kompost verdoppelt die nächste Ernte). Gebackene Kuchen lassen das Dorf wachsen. Der Uhrturm bekommt einen 7. Abschnitt „Blumenschmuck“.
- Erweiterung nach Phase 7 (Auswahl des Auftraggebers aus Vorschlägen; stand ursprünglich unter „nach der ersten Version“): neue Rohstoffe Eisenerz, Kohle und Sand (späte Vorkommen, die erst nach dem Startgebiet und nur auf Wiese/Wald gesetzt werden, damit alte Welten ringsum gleich bleiben) mit Eisenbarren, Glas, Zahnrad und Stahl (neue Maschine Gießerei); neue Stromarten Wasserrad (am Ufer, gleichmäßig), Solarfeld (folgt der Tageszeit) und Akku-Haus (speichert Überschuss aus Wind, Wasser und Sonne); Blaupausen (Bereich kopieren, drehen, einfügen); Minikarte; ein rein optisches Dorf, das mit der Fabrik wächst. Neue Forschungsknoten: Eisenverhüttung, Glasbläserei, Wasserkraft, Stahlwerk, Sonnenkraft, Stromspeicher. Brenner springen jetzt erst ein, wenn Wind, Wasser, Sonne und Akkus nicht reichen.
- Phase 7 auf Wunsch des Auftraggebers erweitert: vierte Grafikstufe „Ultra“ mit Wolkenschatten, leichtem Regen (Wetter war ursprünglich erst nach der ersten Version geplant), Glühwürmchen, weichen Schatten und sanftem Leuchten. Für das Leuchten gibt es nur in dieser Stufe einen Nachbearbeitungsschritt (Bloom), abweichend von „kein Nachbearbeitungs-Stapel“ in Abschnitt 12. Die übrigen Stufen bleiben ohne.
- Auf Wunsch des Auftraggebers vorgezogen (nach Phase 6): dauerhaft sichtbare Pfeile an Bandanschlüssen, einfache Arbeitsanimationen (drehende Teile, Rauch, laufende Holzfäller), selbst erzeugte Klänge mit Ein/Aus-Knopf und ein Vorratsfenster. Phase 7 baut darauf auf.

**Nach der ersten Version (Reihenfolge offen):** Eisen, Kohle und Sand mit neuen Produktionsketten · Wasser und Öl mit Pumpen, Rohren, Tanks und Raffinerie · Blaupausen (Fabrikteile kopieren und einfügen) · größere Karten · Züge · Fotomodus · Wetter · weitere Sprachen · Simulation im Web Worker.

## 16. Arbeitsregeln für Claude Code

Diese Regeln gelten für die gesamte Umsetzung und werden in Phase 0 in die Datei `CLAUDE.md` übernommen.

1. **Phase für Phase.** Arbeite nur an der aktuellen Phase aus Abschnitt 15. Baue keine Funktionen späterer Phasen vor, außer die Architektur verlangt es ausdrücklich.
2. **Immer lauffähig.** Der Hauptzweig muss jederzeit bauen, alle Tests bestehen und auf GitHub Pages laufen.
3. **Simulation und Darstellung trennen.** Kein Import von `three` oder Browser-Schnittstellen in `sim` und `data`. Zustandsänderungen nur über Befehle.
4. **Datengetrieben.** Neue Items, Rezepte, Gebäude und Forschung entstehen durch Einträge in `data`, nicht durch Sonderfälle im Code. Zahlenwerte zum Balancing stehen nie verstreut im Code.
5. **Performance ist Pflicht.** Halte die Vorgaben aus Abschnitt 12 ein: Instancing, typisierte Arrays, keine Speicherzuweisungen in Bild- und Tick-Schleifen. Prüfe größere Änderungen mit dem Stresstest und nenne die Messwerte.
6. **Tests für die Spiellogik.** Bandsegmente, Verteiler, Maschinen, Stromnetze, Forschung, Speichern und Laden bekommen Tests. Darstellung und Oberfläche werden von Hand geprüft.
7. **Kleine, verständliche Commits** mit deutscher Beschreibung dessen, was sich für den Spieler oder die Technik ändert.
8. **Verständlich berichten.** Der Auftraggeber programmiert nicht selbst. Erkläre am Ende jedes Arbeitsschritts in einfachem Deutsch, was neu ist, wie es im Browser ausprobiert wird und was als Nächstes kommt. Keine Fachbegriffe ohne kurze Erklärung.
9. **Rückfragen nur bei echten Richtungsentscheidungen.** Technische Details entscheidest du selbst und hältst sie in `CLAUDE.md` fest. Bei Fragen zum Spielgefühl oder bei Abweichungen von diesem Dokument fragst du nach.
10. **Keine neuen Abhängigkeiten ohne Begründung** und keine externen Dienste, Tracker oder Schriftarten von fremden Servern.
11. **Spielstände nie brechen.** Jede Änderung am Speicherformat erhöht die Formatnummer und bringt eine Migration mit Test mit.
12. **Dokumentation aktuell halten.** `CLAUDE.md` enthält Architekturüberblick, getroffene Entscheidungen, bekannte Schwächen und den Stand der Phasen. Weicht die Umsetzung von diesem Projektskript ab, wird `docs/projektskript.md` angepasst.
13. **Fehler abfangen.** Ein Fehler in der Spielschleife zeigt eine verständliche Meldung mit der Möglichkeit, den Spielstand zu exportieren, statt eines eingefrorenen Bildes.

**Empfohlener erster Auftrag an Claude Code:** „Lies `docs/projektskript.md` vollständig. Fasse in eigenen Worten zusammen, was gebaut wird, und nenne Unklarheiten. Setze danach Phase 0 um und erkläre mir Schritt für Schritt, wie ich das Repository auf GitHub anlege und GitHub Pages einschalte.“

## 17. Getroffene Annahmen und offene Punkte

Die folgenden Punkte wurden im Gespräch nicht ausdrücklich festgelegt. Sie sind hier als Annahme entschieden und lassen sich vor dem Start noch ändern.

| Annahme | Entscheidung in diesem Dokument | Alternative |
| --- | --- | --- |
| Vorkommen | Unerschöpflich, mit Reinheitsstufen | Endliche Vorkommen, die zum Umziehen zwingen |
| Baukosten | Gebäude kosten Items aus einem globalen Vorrat, den die Zentrale füllt | Kostenloses Bauen (reiner Sandkasten) |
| Spielstart | Abbau von Hand per Klick plus kleines Startpaket | Nur Startpaket, kein Klicken |
| Forschung | Sofortige Bezahlung aus dem Vorrat, kein Laborgebäude | Labore, die Forschungspakete per Band verbrauchen |
| Stromleitungen | Masten verbinden sich automatisch, Kabel sind sichtbar | Kabel von Hand von Mast zu Mast ziehen |
| Strommangel | Alle Maschinen laufen gleichmäßig langsamer | Stromausfall mit Sicherung wie in Satisfactory |
| Kartengröße | 256 × 256 Felder, technisch erweiterbar | Größere Karte schon in der ersten Version |
| Tag-Nacht-Wechsel | Vorhanden, rein optisch, abschaltbar | Kein Wechsel, feste Tagesstimmung |
| Bäume | Wachsen nach | Wald ist endlich |
| Spielsprache | Deutsch | Englisch oder beides |

**Nachträglich festgelegt:**

- Name des Spiels: Wiesenwerk. Name des Repositories: wiesenwerk.
- Musik stellt der Nutzer selbst zur Verfügung (erledigt am 18.11.2026: fünf Stücke eingebaut)
- GitHub Pages wird erst eingerichtet, wenn das Projekt einen noch besseren Stand hat (**offener Punkt**, Wunsch des Auftraggebers; Workflow und Anleitung liegen bereit)
- Phase 7 abgenommen (14.11.2026). Balancing fühlt sich gut an; die hohen Stufen (Solar, Akku, Stahl) werden beim weiteren Spielen bewertet.
- Farbstimmung: sonnig-warm, festgelegt in Abschnitt 10. Claude Code schlägt in Phase 1 eine Palette vor.
- Alle Zahlenwerte (Rezepte, Kosten, Tempo, Strom) sind aufeinander abgestimmt gewählt (Abschnitte 4 bis 8) und werden in Phase 7 beim Spielen nur noch feinjustiert.
