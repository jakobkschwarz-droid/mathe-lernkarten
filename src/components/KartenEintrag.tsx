"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { istFaellig, istNeu, istSicher } from "@/lib/srs";
import { ART_NAMEN, type Karte } from "@/lib/types";
import { Mathe } from "./Mathe";
import { KartenEditor } from "./KartenEditor";

export function Lernstatus({ karte }: { karte: Karte }) {
  if (karte.status === "pruefen") return <span className="etikett gelb">Zu prüfen</span>;
  if (istNeu(karte)) return <span className="etikett grau">Neu</span>;
  if (istFaellig(karte)) return <span className="etikett">Fällig</span>;
  if (istSicher(karte)) return <span className="etikett gruen">Sicher</span>;
  return <span className="etikett grau">In Arbeit</span>;
}

export function KartenEintrag({ karte }: { karte: Karte }) {
  const [offen, setOffen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(false);

  async function loeschen() {
    if (confirm("Diese Karte wirklich löschen?")) await db.karten.delete(karte.id);
  }

  const quote = karte.lernstand.richtig + karte.lernstand.falsch;

  return (
    <div className={`flaeche karteneintrag ${offen ? "offen" : ""}`}>
      <div className="vorne" onClick={() => setOffen(!offen)}>
        <span className="pfeil">›</span>
        <div className="frage"><Mathe text={karte.frage} /></div>
        <div className="reihe" style={{ gap: 6, flexShrink: 0 }}>
          {karte.widerspruchIds?.length ? <span title="Möglicher Widerspruch in den Lernmaterialien">⚠️</span> : null}
          <span className="etikett grau">{ART_NAMEN[karte.art]}</span>
          <Lernstatus karte={karte} />
        </div>
      </div>
      {offen && (
        <div className="hinten">
          <div className="antwort"><Mathe text={karte.antwort} /></div>
          {karte.hinweis && <div className="erklaerung"><Mathe text={karte.hinweis} /></div>}
          <div className="reihe zwischen" style={{ marginTop: 12 }}>
            <div className="quellen">
              {karte.quellen.length > 0 && <>Aus: {karte.quellen.join(", ")}</>}
              {quote > 0 && <> · {karte.lernstand.richtig} von {quote} Mal gewusst</>}
            </div>
            <div className="reihe" style={{ gap: 4 }}>
              <button className="knopf still klein" onClick={() => setBearbeiten(true)}>Bearbeiten</button>
              <button className="knopf still klein gefahr" onClick={loeschen}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {bearbeiten && <KartenEditor karte={karte} onSchliessen={() => setBearbeiten(false)} />}
    </div>
  );
}
