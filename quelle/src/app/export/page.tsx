"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { istSicher } from "@/lib/srs";
import { pdfOeffnen } from "@/lib/pdfexport";
import { themenbaum, type ThemenKnoten } from "@/lib/themen";
import type { Karte } from "@/lib/types";

function inReihenfolge(k: ThemenKnoten): Karte[] {
  return [...k.eigeneKarten, ...k.kinder.flatMap(inReihenfolge)];
}

export default function ExportSeite() {
  const karten = useLiveQuery(() => db.karten.where("status").equals("aktiv").toArray(), []);
  const [auswahl, setAuswahl] = useState<Set<string> | null>(null);
  const [mitHinweisen, setMitHinweisen] = useState(true);
  const [nurUnsicher, setNurUnsicher] = useState(false);
  const [titel, setTitel] = useState("Meine Mathe-Karteikarten");
  const [meldung, setMeldung] = useState<string | null>(null);

  const baum = karten ? themenbaum(karten) : null;
  useEffect(() => {
    if (baum && auswahl === null) setAuswahl(new Set(baum.kinder.map((b) => b.name)));
  }, [baum, auswahl]);

  if (!karten || !baum || !auswahl) return null;

  const gewaehlt = baum.kinder
    .filter((b) => auswahl.has(b.name))
    .flatMap(inReihenfolge)
    .filter((k) => !nurUnsicher || !istSicher(k));

  function exportieren() {
    setMeldung(null);
    const ok = pdfOeffnen({
      titel: titel.trim() || "Mathe-Karteikarten",
      mitHinweisen,
      karten: gewaehlt.map((k) => ({ pfad: k.pfad, art: k.art, frage: k.frage, antwort: k.antwort, hinweis: k.hinweis })),
    });
    setMeldung(
      ok
        ? "Der Kartensatz hat sich in einem neuen Tab geöffnet. Tippe dort auf „Drucken / als PDF sichern“ und wähle „Als PDF sichern“ (am iPhone/iPad: Teilen → „In Dateien sichern“)."
        : "Bitte erlaube Pop-up-Fenster für diese Seite und versuche es noch einmal."
    );
  }

  const umschalten = (name: string) => {
    const neu = new Set(auswahl);
    if (neu.has(name)) neu.delete(name);
    else neu.add(name);
    setAuswahl(neu);
  };

  return (
    <div className="schmal">
      <h1>Als PDF exportieren</h1>
      <p className="unterzeile">
        Ein sauber gesetzter, druckfreundlicher Kartensatz – sortiert nach Thema und Unterthema, mit richtig dargestellten Formeln.
      </p>
      {karten.length === 0 ? (
        <div className="flaeche leerzustand"><h2>Noch keine Karten</h2><p className="unterzeile">Erstelle zuerst Karteikarten aus deinem Lernmaterial.</p></div>
      ) : (
        <div className="flaeche polster">
          <label className="feld">
            <span>Titel</span>
            <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} />
          </label>
          <h3 style={{ marginTop: 8 }}>Themen</h3>
          <ul className="checkliste">
            {baum.kinder.map((b) => (
              <li key={b.name}>
                <label>
                  <input type="checkbox" checked={auswahl.has(b.name)} onChange={() => umschalten(b.name)} />
                  <span style={{ flex: 1 }}>
                    <strong>{b.name}</strong>
                    <span className="leise klein"> · {b.kinder.map((c) => c.name).join(", ")}</span>
                  </span>
                  <span className="leise klein">{b.alleKarten.length} Karten</span>
                </label>
              </li>
            ))}
          </ul>
          <h3>Optionen</h3>
          <ul className="checkliste">
            <li><label><input type="checkbox" checked={mitHinweisen} onChange={(e) => setMitHinweisen(e.target.checked)} />Erklärungen unter den Antworten mit aufnehmen</label></li>
            <li><label><input type="checkbox" checked={nurUnsicher} onChange={(e) => setNurUnsicher(e.target.checked)} />Nur Karten, die ich noch nicht sicher kann</label></li>
          </ul>
          <div className="reihe zwischen" style={{ marginTop: 22 }}>
            <span className="leise">{gewaehlt.length} Karten ausgewählt</span>
            <button className="knopf haupt gross" disabled={gewaehlt.length === 0} onClick={exportieren}>
              📄 Als PDF speichern
            </button>
          </div>
          {meldung && <div className="hinweisbox blau" style={{ marginTop: 16, marginBottom: 0 }}>{meldung}</div>}
        </div>
      )}
    </div>
  );
}
