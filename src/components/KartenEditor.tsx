"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { pfadBereinigen, PFAD_TRENNER } from "@/lib/themen";
import { ART_NAMEN, KARTEN_ARTEN, type Karte, type KartenArt } from "@/lib/types";
import { Mathe } from "./Mathe";

export function KartenEditor({ karte, onSchliessen, nachSpeichern }: { karte: Karte; onSchliessen: () => void; nachSpeichern?: (k: Karte) => void }) {
  const [frage, setFrage] = useState(karte.frage);
  const [antwort, setAntwort] = useState(karte.antwort);
  const [hinweis, setHinweis] = useState(karte.hinweis);
  const [thema, setThema] = useState(karte.pfad.join(PFAD_TRENNER));
  const [art, setArt] = useState<KartenArt>(karte.art);

  async function speichern() {
    const pfad = pfadBereinigen(thema.split(/\s*[›>]\s*/));
    const neu: Karte = { ...karte, frage, antwort, hinweis, art, pfad, bereich: pfad[0], geaendert: Date.now() };
    await db.karten.put(neu);
    nachSpeichern?.(neu);
    onSchliessen();
  }

  return (
    <div className="dialog-hintergrund" onClick={onSchliessen}>
      <div className="dialog flaeche" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Karte bearbeiten</h2>
        <p className="leise klein" style={{ marginTop: -8 }}>
          Formeln schreibst du zwischen Dollarzeichen, z. B. <code>$\frac{"{a}{b}"}$</code> – die Vorschau zeigt, wie es aussieht.
        </p>
        <label className="feld">
          <span>Frage</span>
          <textarea value={frage} onChange={(e) => setFrage(e.target.value)} rows={2} />
        </label>
        <div className="vorschau"><Mathe text={frage || " "} /></div>
        <label className="feld">
          <span>Antwort</span>
          <textarea value={antwort} onChange={(e) => setAntwort(e.target.value)} rows={4} />
        </label>
        <div className="vorschau"><Mathe text={antwort || " "} /></div>
        <label className="feld">
          <span>Erklärung (optional)</span>
          <textarea value={hinweis} onChange={(e) => setHinweis(e.target.value)} rows={2} />
        </label>
        {hinweis && <div className="vorschau"><Mathe text={hinweis} /></div>}
        <div className="reihe" style={{ alignItems: "flex-start" }}>
          <label className="feld" style={{ flex: 2, minWidth: 240 }}>
            <span>Thema</span>
            <input type="text" value={thema} onChange={(e) => setThema(e.target.value)} />
          </label>
          <label className="feld" style={{ flex: 1, minWidth: 180 }}>
            <span>Art</span>
            <select value={art} onChange={(e) => setArt(e.target.value as KartenArt)}>
              {KARTEN_ARTEN.map((a) => <option key={a} value={a}>{ART_NAMEN[a]}</option>)}
            </select>
          </label>
        </div>
        <div className="reihe" style={{ justifyContent: "flex-end" }}>
          <button className="knopf still" onClick={onSchliessen}>Abbrechen</button>
          <button className="knopf haupt" onClick={speichern} disabled={!frage.trim() || !antwort.trim()}>Speichern</button>
        </div>
      </div>
    </div>
  );
}
