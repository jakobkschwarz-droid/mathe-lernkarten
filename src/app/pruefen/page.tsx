"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { pfadText } from "@/lib/themen";
import { ART_NAMEN, type Karte, type Widerspruch } from "@/lib/types";
import { Mathe } from "@/components/Mathe";
import { KartenEditor } from "@/components/KartenEditor";

function PruefKarte({ karte }: { karte: Karte }) {
  const [bearbeiten, setBearbeiten] = useState(false);
  return (
    <div className="flaeche polster">
      <div className="reihe zwischen" style={{ marginBottom: 8 }}>
        <span className="pfad">{pfadText(karte.pfad)}</span>
        <span className="etikett grau">{ART_NAMEN[karte.art]}</span>
      </div>
      <div style={{ fontWeight: 650, fontSize: 18.5 }}><Mathe text={karte.frage} /></div>
      <div style={{ marginTop: 12 }}><Mathe text={karte.antwort} /></div>
      {karte.hinweis && <div className="erklaerung"><Mathe text={karte.hinweis} /></div>}
      {karte.pruefGrund && (
        <div className="hinweisbox gelb" style={{ marginTop: 16, marginBottom: 0 }}>
          <span><strong>Warum prüfen?</strong> {karte.pruefGrund}</span>
        </div>
      )}
      {karte.quellen.length > 0 && <div className="quellen">Aus: {karte.quellen.join(", ")}</div>}
      <div className="reihe" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button className="knopf still gefahr" onClick={() => db.karten.delete(karte.id)}>Verwerfen</button>
        <button className="knopf" onClick={() => setBearbeiten(true)}>Bearbeiten</button>
        <button className="knopf haupt" onClick={() => db.karten.update(karte.id, { status: "aktiv", pruefGrund: undefined })}>
          Übernehmen
        </button>
      </div>
      {bearbeiten && <KartenEditor karte={karte} onSchliessen={() => setBearbeiten(false)} />}
    </div>
  );
}

function WiderspruchKarte({ w }: { w: Widerspruch }) {
  async function erledigen() {
    await db.transaction("rw", db.widersprueche, db.karten, async () => {
      await db.widersprueche.update(w.id, { erledigt: true });
      const betroffen = (await db.karten.toArray()).filter((k) => k.widerspruchIds?.includes(w.id));
      for (const k of betroffen) {
        await db.karten.update(k.id, { widerspruchIds: k.widerspruchIds!.filter((x) => x !== w.id) });
      }
    });
  }
  return (
    <div className="flaeche polster">
      <div className="reihe zwischen" style={{ marginBottom: 8 }}>
        <strong>⚠️ Möglicher Widerspruch in den Lernmaterialien</strong>
        <span className="pfad">{pfadText(w.pfad)}</span>
      </div>
      <Mathe text={w.beschreibung} />
      <div className="raster" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>
        {w.aussagen.map((a, i) => (
          <div key={i} style={{ background: "var(--flaeche-2)", border: "1px solid var(--linie)", borderRadius: 12, padding: "12px 16px" }}>
            <div className="leise klein" style={{ marginBottom: 6 }}>📄 {a.dokument}</div>
            <Mathe text={a.aussage} />
          </div>
        ))}
      </div>
      <p className="leise klein" style={{ marginBottom: 0 }}>
        Die App entscheidet hier bewusst nicht selbst. Kläre am besten mit deinem Skript oder deiner Lehrkraft, welche Aussage gilt, und passe betroffene Karten bei Bedarf an.
      </p>
      <div className="reihe" style={{ marginTop: 14, justifyContent: "flex-end" }}>
        <button className="knopf" onClick={erledigen}>Als geklärt markieren</button>
      </div>
    </div>
  );
}

export default function PruefSeite() {
  const daten = useLiveQuery(async () => ({
    karten: await db.karten.where("status").equals("pruefen").toArray(),
    widersprueche: (await db.widersprueche.toArray()).filter((w) => !w.erledigt),
  }), []);
  if (!daten) return null;
  const leer = daten.karten.length === 0 && daten.widersprueche.length === 0;

  return (
    <div className="schmal">
      <h1>Zu prüfen</h1>
      <p className="unterzeile">
        Karten, bei denen sich die KI nicht ganz sicher war, werden nicht automatisch gespeichert. Sieh sie dir kurz an und entscheide selbst.
      </p>
      {leer && (
        <div className="flaeche leerzustand">
          <div className="symbol">✓</div>
          <h2>Alles geprüft</h2>
          <p className="unterzeile">Es gibt gerade nichts zu prüfen.</p>
          <Link href="/" className="knopf">Zur Übersicht</Link>
        </div>
      )}
      {daten.widersprueche.length > 0 && (
        <>
          <h2>Widersprüche</h2>
          <div className="raster">{daten.widersprueche.map((w) => <WiderspruchKarte key={w.id} w={w} />)}</div>
        </>
      )}
      {daten.karten.length > 0 && (
        <>
          <h2>Karten</h2>
          <div className="raster">{daten.karten.map((k) => <PruefKarte key={k.id} karte={k} />)}</div>
        </>
      )}
    </div>
  );
}
