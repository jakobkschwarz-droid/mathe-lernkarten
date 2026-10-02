# Mathe lernen – Karteikarten aus deinem Lernmaterial

Web-App für Mathematik: Du lädst Skripte, Zusammenfassungen, Mitschriften oder Fotos von Notizen hoch, und die App erstellt daraus eine **bewusst kleine, durchdachte Sammlung** von Karteikarten – sortiert nach Themen, mit sauber gesetzten Formeln, Lernmodus, Wiederholungssystem und PDF-Export. Installierbar auf Handy und iPad.

## Benutzen

1. Link öffnen. Auf dem Handy/iPad: Teilen → „Zum Home-Bildschirm“ (Android: Menü → „App installieren“).
2. Unter **Einstellungen** den eigenen Anthropic-Zugangsschlüssel eintragen (console.anthropic.com). Er bleibt auf dem Gerät und geht nur an die KI.
3. Unter **Material** Dateien hochladen und „📚 Karteikarten erstellen“ tippen.

Alle Karten und der Lernfortschritt liegen im Browser des jeweiligen Geräts (Sicherung: Einstellungen → „Sicherung speichern“).

## Für Entwickler

Reine Web-Seite ohne eigenen Server (Next.js, statischer Export). Die KI wird direkt aus dem Browser angesprochen.

- `npm install`, dann `npm run build` (Ergebnis im Ordner `out/`).
- Liegt die Seite in einem Unterordner (GitHub Pages): `NEXT_PUBLIC_BASE_PATH=/mathe-lernkarten npm run build`.
- Aufbau: `src/lib/pipeline.ts` (Ablauf Erstellen/Aktualisieren), `src/lib/ki/prompts.ts` (alle Anweisungen an die KI), `src/lib/srs.ts` (Wiederholungssystem), `src/lib/pdfexport.ts` (PDF-Druckansicht).
