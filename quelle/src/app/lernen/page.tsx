"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import { bewerten, lernrunde, uebungsrunde } from "@/lib/srs";
import { imPfad, themenbaum } from "@/lib/themen";
import { ART_NAMEN, type Karte } from "@/lib/types";
import { Mathe } from "@/components/Mathe";

export default function LernSeite() {
  return (
    <Suspense fallback={null}>
      <Lernen />
    </Suspense>
  );
}

interface Runde {
  karten: Karte[];
  index: number;
  gewusst: number;
  nichtGewusst: number;
  wiederholt: Record<string, number>;
}

function Lernen() {
  const params = useSearchParams();
  const router = useRouter();
  const thema = params.get("thema");
  const frei = params.get("modus") === "frei";
  const pfad = useMemo(() => (thema ? thema.split("/").filter(Boolean) : []), [thema]);

  const [alleBereiche, setAlleBereiche] = useState<string[][]>([]);
  const [runde, setRunde] = useState<Runde | null>(null);
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [naechsteFaellig, setNaechsteFaellig] = useState<number | null>(null);

  const starten = useCallback(
    async (freiesUeben: boolean) => {
      const alle = await db.karten.where("status").equals("aktiv").toArray();
      const baum = themenbaum(alle);
      setAlleBereiche(baum.kinder.flatMap((b) => [b.pfad, ...b.kinder.map((c) => c.pfad)]));
      const auswahl = alle.filter((k) => imPfad(k, pfad));
      const karten = freiesUeben ? uebungsrunde(auswahl) : lernrunde(auswahl);
      const spaeter = auswahl.filter((k) => k.lernstand.wiederholungen > 0).map((k) => k.faellig);
      setNaechsteFaellig(spaeter.length ? Math.min(...spaeter) : null);
      setRunde({ karten, index: 0, gewusst: 0, nichtGewusst: 0, wiederholt: {} });
      setAufgedeckt(false);
    },
    [pfad]
  );

  useEffect(() => {
    starten(frei);
  }, [starten, frei]);

  const karte = runde && runde.index < runde.karten.length ? runde.karten[runde.index] : null;

  const antworten = useCallback(
    async (gewusst: boolean) => {
      if (!runde || !karte) return;
      const aktuell = (await db.karten.get(karte.id)) ?? karte;
      const { lernstand, faellig } = bewerten(aktuell, gewusst);
      await db.karten.update(karte.id, { lernstand, faellig });
      await db.verlauf.add({ kartenId: karte.id, zeit: Date.now(), gewusst });

      const karten = [...runde.karten];
      karten[runde.index] = { ...aktuell, lernstand, faellig };
      const wiederholt = { ...runde.wiederholt };
      // Nicht gewusste Karten kommen in dieser Runde noch einmal dran (höchstens zweimal)
      if (!gewusst && (wiederholt[karte.id] ?? 0) < 2) {
        wiederholt[karte.id] = (wiederholt[karte.id] ?? 0) + 1;
        const pos = Math.min(karten.length, runde.index + 4);
        karten.splice(pos, 0, { ...aktuell, lernstand, faellig });
      }
      setRunde({
        karten,
        index: runde.index + 1,
        gewusst: runde.gewusst + (gewusst ? 1 : 0),
        nichtGewusst: runde.nichtGewusst + (gewusst ? 0 : 1),
        wiederholt,
      });
      setAufgedeckt(false);
    },
    [runde, karte]
  );

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (!karte || (e.target as HTMLElement)?.tagName === "SELECT") return;
      if (!aufgedeckt && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setAufgedeckt(true);
      } else if (aufgedeckt && (e.key === "1" || e.key === "ArrowLeft")) antworten(false);
      else if (aufgedeckt && (e.key === "2" || e.key === "ArrowRight")) antworten(true);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [karte, aufgedeckt, antworten]);

  if (!runde) return null;

  const themenwahl = (
    <select
      value={pfad.join("/")}
      onChange={(e) => router.push(e.target.value ? `/lernen?thema=${encodeURIComponent(e.target.value)}` : "/lernen")}
      style={{ width: "auto", maxWidth: 340 }}
      aria-label="Thema wählen"
    >
      <option value="">Alle Themen</option>
      {alleBereiche.map((p) => (
        <option key={p.join("/")} value={p.join("/")}>
          {p.length > 1 ? `   ${p[p.length - 1]}` : p[0]}
        </option>
      ))}
      {pfad.length > 0 && !alleBereiche.some((p) => p.join("/") === pfad.join("/")) && (
        <option value={pfad.join("/")}>{pfad[pfad.length - 1]}</option>
      )}
    </select>
  );

  // ----- Runde beendet oder nichts zu tun -----
  if (!karte) {
    const leer = runde.karten.length === 0;
    return (
      <div className="schmal">
        <div className="lernkopf"><h1 style={{ margin: 0 }}>Lernen</h1>{themenwahl}</div>
        <div className="flaeche leerzustand">
          {leer ? (
            <>
              <h2>Gerade ist nichts fällig</h2>
              <p className="unterzeile">
                Du hast alle Karten {pfad.length ? "dieses Themas " : ""}wiederholt.
                {naechsteFaellig && ` Die nächste Wiederholung steht ${wann(naechsteFaellig)} an.`}
              </p>
            </>
          ) : (
            <>
              <h2>Runde geschafft</h2>
              <p className="unterzeile">
                {runde.gewusst} gewusst · {runde.nichtGewusst} nicht gewusst. Nicht gewusste Karten kommen bald wieder dran.
              </p>
            </>
          )}
          <div className="reihe" style={{ justifyContent: "center" }}>
            {!leer && <button className="knopf haupt" onClick={() => starten(false)}>Weiterlernen</button>}
            <button className="knopf" onClick={() => starten(true)}>Freies Üben</button>
            <Link href="/" className="knopf still">Zur Übersicht</Link>
          </div>
        </div>
      </div>
    );
  }

  const fortschritt = Math.round((runde.index / runde.karten.length) * 100);

  return (
    <div className="schmal">
      <div className="lernkopf">
        <div className="reihe">
          <h1 style={{ margin: 0, fontSize: 26 }}>{frei ? "Freies Üben" : "Lernen"}</h1>
          <span className="leise">Karte {runde.index + 1} von {runde.karten.length}</span>
        </div>
        {themenwahl}
      </div>
      <div className="balken" style={{ marginBottom: 18 }}><div style={{ width: `${fortschritt}%`, background: "var(--akzent)" }} /></div>

      <article className="flaeche lernkarte">
        <div className="reihe zwischen">
          <div className="pfad">
            {karte.pfad.map((t, i) => (
              <span key={i} className="reihe" style={{ gap: 8 }}>
                {i > 0 && <span className="trenner">›</span>}
                {t}
              </span>
            ))}
          </div>
          <span className="etikett">{ART_NAMEN[karte.art]}</span>
        </div>
        <div className="frage"><Mathe text={karte.frage} /></div>

        {aufgedeckt ? (
          <>
            <div className="trennlinie" />
            <div className="antwort"><Mathe text={karte.antwort} /></div>
            {karte.hinweis && <div className="erklaerung"><Mathe text={karte.hinweis} /></div>}
            {karte.widerspruchIds?.length ? (
              <div className="hinweisbox gelb" style={{ marginTop: 16, marginBottom: 0 }}>
                <span>⚠️ Möglicher Widerspruch in den Lernmaterialien</span>
                <Link href="/pruefen" className="knopf klein">Ansehen</Link>
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ flex: 1 }} />
        )}
      </article>

      {aufgedeckt ? (
        <>
          <div className="lernknoepfe">
            <button className="knopf gross nicht-gewusst" onClick={() => antworten(false)}>Nicht gewusst</button>
            <button className="knopf gross gewusst" onClick={() => antworten(true)}>Gewusst</button>
          </div>
          <div className="tastenhinweis">Tastatur: <span className="taste">1</span> nicht gewusst · <span className="taste">2</span> gewusst</div>
        </>
      ) : (
        <>
          <div className="lernknoepfe">
            <button className="knopf haupt gross" onClick={() => setAufgedeckt(true)} style={{ minWidth: 260 }}>Antwort anzeigen</button>
          </div>
          <div className="tastenhinweis">Tastatur: <span className="taste">Leertaste</span></div>
        </>
      )}
    </div>
  );
}

function wann(zeit: number): string {
  const tage = Math.round((zeit - Date.now()) / (24 * 3600 * 1000));
  if (tage <= 0) return "in Kürze";
  if (tage === 1) return "morgen";
  return `in ${tage} Tagen`;
}
