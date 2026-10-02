"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { kennzahlen, pfadZuUrl } from "@/lib/themen";
import { bereichsauswertung, heuteGelernt } from "@/lib/statistik";
import { ErstellenKnopf, Fortschritt } from "@/components/Erstellen";
import { usePipeline } from "@/lib/pipeline";

export default function Uebersicht() {
  const pipeline = usePipeline();
  const daten = useLiveQuery(async () => {
    const [karten, verlauf, materialien, widersprueche] = await Promise.all([
      db.karten.toArray(),
      db.verlauf.where("zeit").above(Date.now() - 2 * 24 * 3600 * 1000).toArray(),
      db.materialien.toArray(),
      db.widersprueche.toArray(),
    ]);
    return { karten, verlauf, materialien, widersprueche };
  }, []);

  if (!daten) return null;
  const aktiv = daten.karten.filter((k) => k.status === "aktiv");
  const zuPruefen = daten.karten.length - aktiv.length;
  const offeneWidersprueche = daten.widersprueche.filter((w) => !w.erledigt).length;
  const neueMaterialien = daten.materialien.filter((m) => m.status !== "analysiert").length;

  if (aktiv.length === 0) {
    return (
      <div className="schmal">
        {(pipeline.laeuft || pipeline.ergebnis || pipeline.fehler) && <Fortschritt />}
        <div className="flaeche leerzustand">
          <div className="symbol">📚</div>
          <h2>Willkommen!</h2>
          <p className="unterzeile" style={{ marginBottom: 24 }}>
            Lade dein erstes Lernmaterial hoch – ein Skript, eine Zusammenfassung oder Fotos deiner Mitschrift. Daraus entstehen
            Karteikarten mit Definitionen, Sätzen, Formeln, Vorgehensweisen und typischen Fehlern.
          </p>
          {neueMaterialien > 0 ? (
            <ErstellenKnopf />
          ) : (
            <Link href="/material" className="knopf haupt gross">📄 Lernmaterial hochladen</Link>
          )}
          {zuPruefen > 0 && (
            <p style={{ marginTop: 20 }}>
              <Link href="/pruefen">{zuPruefen} Karten warten auf deine Prüfung</Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  const gesamt = kennzahlen(aktiv);
  const { bereiche, staerkstes, nochZuLernen } = bereichsauswertung(aktiv);
  const heute = heuteGelernt(daten.verlauf);

  return (
    <>
      <div className="reihe zwischen" style={{ alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1>Meine Mathematik</h1>
          <p className="unterzeile" style={{ margin: 0 }}>
            {gesamt.anzahl} Karteikarten in {bereiche.length} {bereiche.length === 1 ? "Bereich" : "Bereichen"}
          </p>
        </div>
        <Link href="/lernen" className="knopf haupt gross">
          {gesamt.faellig + gesamt.neu > 0 ? "Jetzt lernen" : "Freies Üben"}
        </Link>
      </div>

      {(pipeline.laeuft || pipeline.ergebnis || pipeline.fehler) && <Fortschritt />}

      {neueMaterialien > 0 && !pipeline.laeuft && (
        <div className="hinweisbox blau">
          <span>
            {neueMaterialien === 1 ? "1 neues Dokument ist" : `${neueMaterialien} neue Dokumente sind`} noch nicht in deinen Karten enthalten.
          </span>
          <ErstellenKnopf gross={false} />
        </div>
      )}
      {zuPruefen > 0 && (
        <div className="hinweisbox gelb">
          <span>{zuPruefen === 1 ? "1 Karte wartet" : `${zuPruefen} Karten warten`} auf deine Prüfung, bevor sie gelernt wird.</span>
          <Link href="/pruefen" className="knopf klein">Ansehen</Link>
        </div>
      )}
      {offeneWidersprueche > 0 && (
        <div className="hinweisbox gelb">
          <span>⚠️ Möglicher Widerspruch in den Lernmaterialien{offeneWidersprueche > 1 ? ` (${offeneWidersprueche})` : ""}</span>
          <Link href="/pruefen" className="knopf klein">Ansehen</Link>
        </div>
      )}

      <section className="flaeche kennzahlen" style={{ marginTop: 8 }}>
        <div className="kennzahl"><div className="wert">{heute}</div><div className="name">Heute gelernt</div></div>
        <div className="kennzahl"><div className="wert">{gesamt.sicherProzent} %</div><div className="name">Sicher</div></div>
        <div className="kennzahl"><div className="wert">{gesamt.faellig}</div><div className="name">Zu wiederholen</div></div>
        <div className="kennzahl"><div className="wert">{gesamt.neu}</div><div className="name">Noch nie gelernt</div></div>
        <div className="kennzahl"><div className="wert text">{staerkstes ?? "–"}</div><div className="name">Stärkstes Thema</div></div>
        <div className="kennzahl"><div className="wert text">{nochZuLernen ?? "–"}</div><div className="name">Noch zu lernen</div></div>
      </section>

      <h2>Themen</h2>
      <div className="raster raster-3">
        {bereiche.map(({ knoten, k }) => (
          <Link key={knoten.name} href={pfadZuUrl(knoten.pfad)} className="flaeche bereich-kachel">
            <h3>{knoten.name}</h3>
            <div className="zahlen">
              {k.anzahl} {k.anzahl === 1 ? "Karte" : "Karten"} · {k.sicherProzent} % sicher
              {k.faellig > 0 && <> · <span style={{ color: "var(--akzent)" }}>{k.faellig} fällig</span></>}
            </div>
            <div className="balken"><div style={{ width: `${k.sicherProzent}%` }} /></div>
            <div className="themenliste">{knoten.kinder.map((c) => c.name).join(" · ")}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
