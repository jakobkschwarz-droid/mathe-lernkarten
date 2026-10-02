"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { kennzahlen, knotenFinden, pfadZuUrl, themenbaum, type ThemenKnoten } from "@/lib/themen";
import { KartenEintrag } from "@/components/KartenEintrag";

function Abschnitt({ knoten, tiefe }: { knoten: ThemenKnoten; tiefe: number }) {
  const Ueberschrift = (tiefe === 0 ? "h2" : tiefe === 1 ? "h3" : "h4") as "h2" | "h3" | "h4";
  const k = kennzahlen(knoten.alleKarten);
  return (
    <section className={tiefe === 0 ? "themenabschnitt" : ""}>
      <Ueberschrift className="reihe zwischen" style={{ display: "flex" }}>
        <Link href={pfadZuUrl(knoten.pfad)} style={{ color: "inherit" }}>{knoten.name}</Link>
        <span className="leise klein" style={{ fontWeight: 400 }}>{k.anzahl} {k.anzahl === 1 ? "Karte" : "Karten"} · {k.sicherProzent} % sicher</span>
      </Ueberschrift>
      {knoten.eigeneKarten.length > 0 && (
        <div className="kartenliste">
          {knoten.eigeneKarten.map((karte) => <KartenEintrag key={karte.id} karte={karte} />)}
        </div>
      )}
      {knoten.kinder.map((c) => <Abschnitt key={c.name} knoten={c} tiefe={tiefe + 1} />)}
    </section>
  );
}

export default function ThemenSeite() {
  return (
    <Suspense fallback={null}>
      <Thema />
    </Suspense>
  );
}

function Thema() {
  const params = useSearchParams();
  const pfad = (params.get("p") ?? "").split("/").filter(Boolean);
  const karten = useLiveQuery(() => db.karten.where("status").equals("aktiv").toArray(), []);
  if (!karten) return null;

  const baum = themenbaum(karten);
  const knoten = knotenFinden(baum, pfad);
  if (!knoten) {
    return (
      <div className="flaeche leerzustand">
        <h2>Dieses Thema gibt es nicht (mehr).</h2>
        <Link href="/" className="knopf">Zur Übersicht</Link>
      </div>
    );
  }
  const k = kennzahlen(knoten.alleKarten);
  const lernLink = `/lernen/?thema=${encodeURIComponent(pfad.join("/"))}`;

  return (
    <>
      <div className="themenkopf">
        <div className="pfad">
          <Link href="/">Meine Mathematik</Link>
          {pfad.slice(0, -1).map((teil, i) => (
            <span key={i} className="reihe" style={{ gap: 8 }}>
              <span className="trenner">›</span>
              <Link href={pfadZuUrl(pfad.slice(0, i + 1))}>{teil}</Link>
            </span>
          ))}
        </div>
        <div className="reihe zwischen" style={{ alignItems: "flex-end" }}>
          <div>
            <h1>{knoten.name}</h1>
            <p className="unterzeile" style={{ margin: 0 }}>
              {k.anzahl} {k.anzahl === 1 ? "Karte" : "Karten"} · {k.sicherProzent} % sicher
              {k.faellig > 0 && <> · {k.faellig} zu wiederholen</>}
              {k.neu > 0 && <> · {k.neu} neu</>}
            </p>
          </div>
          <div className="reihe">
            <Link href={`${lernLink}&modus=frei`} className="knopf">Alle Karten üben</Link>
            <Link href={lernLink} className="knopf haupt gross">Dieses Thema lernen</Link>
          </div>
        </div>
        <div style={{ marginTop: 18 }} className="balken"><div style={{ width: `${k.sicherProzent}%` }} /></div>
        {knoten.kinder.length > 1 && (
          <div className="unterthemen">
            {knoten.kinder.map((c) => <Link key={c.name} href={pfadZuUrl(c.pfad)}>{c.name}</Link>)}
          </div>
        )}
      </div>

      {knoten.eigeneKarten.length > 0 && (
        <div className="kartenliste" style={{ marginBottom: 24 }}>
          {knoten.eigeneKarten.map((karte) => <KartenEintrag key={karte.id} karte={karte} />)}
        </div>
      )}
      {knoten.kinder.map((c) => <Abschnitt key={c.name} knoten={c} tiefe={0} />)}
    </>
  );
}
