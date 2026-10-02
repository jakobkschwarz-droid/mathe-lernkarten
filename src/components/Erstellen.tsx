"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { kartenErstellen, pipelineZuruecksetzen, SCHRITTE, usePipeline } from "@/lib/pipeline";

/** Der Hauptknopf: „Karteikarten erstellen“ bzw. „Karteikarten aktualisieren“. */
export function ErstellenKnopf({ gross = true }: { gross?: boolean }) {
  const p = usePipeline();
  const daten = useLiveQuery(async () => ({
    offen: (await db.materialien.toArray()).filter((m) => m.status !== "analysiert").length,
    karten: await db.karten.count(),
  }), []);
  if (!daten) return null;
  const aktualisieren = daten.karten > 0;
  return (
    <button
      className={`knopf haupt ${gross ? "gross" : ""}`}
      disabled={p.laeuft || daten.offen === 0}
      onClick={() => kartenErstellen()}
      title={daten.offen === 0 ? "Lade zuerst neues Lernmaterial hoch." : undefined}
    >
      {p.laeuft ? (
        <>
          <span className="dreher" style={{ borderColor: "currentColor", borderTopColor: "transparent" }} /> Wird erstellt …
        </>
      ) : aktualisieren ? (
        "🔄 Karteikarten aktualisieren"
      ) : (
        "📚 Karteikarten erstellen"
      )}
    </button>
  );
}

function mehrzahl(n: number, eins: string, viele: string) {
  return `${n} ${n === 1 ? eins : viele}`;
}

/** Fortschrittsanzeige während und nach der Erstellung. */
export function Fortschritt() {
  const p = usePipeline();
  if (!p.laeuft && !p.ergebnis && !p.fehler) return null;
  const index = p.schritt ? SCHRITTE.findIndex((s) => s.id === p.schritt) : -1;

  if (p.fehler) {
    return (
      <div className="hinweisbox rot">
        <div>
          <strong>Das hat leider nicht geklappt.</strong>
          <div>{p.fehler}</div>
          <div className="klein leise">Bereits ausgewertete Dokumente bleiben gespeichert – beim nächsten Versuch geht es dort weiter.</div>
        </div>
        <div className="reihe">
          <button className="knopf" onClick={() => kartenErstellen()}>Erneut versuchen</button>
          <button className="knopf still" onClick={pipelineZuruecksetzen}>Schließen</button>
        </div>
      </div>
    );
  }

  const e = p.ergebnis;
  return (
    <div className="flaeche polster" style={{ marginBottom: 24 }}>
      <ol className="schritte">
        {SCHRITTE.map((s, i) => {
          const status = p.schritt === "fertig" || i < index ? "erledigt" : i === index ? "aktiv" : "";
          return (
            <li key={s.id} className={status}>
              <span className="punkt">{status === "erledigt" ? "✓" : ""}</span>
              <span>
                {s.text}
                {i === index && p.detail && <span className="detail">{p.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {e && (
        <div style={{ marginTop: 18 }}>
          {e.keinInhalt ? (
            <p>In den neuen Materialien wurden keine mathematischen Inhalte gefunden.</p>
          ) : (
            <>
              <p style={{ margin: "0 0 6px" }}>
                <strong>{mehrzahl(e.neu, "neue Karte", "neue Karten")}</strong>
                {e.verbessert > 0 && <> · {mehrzahl(e.verbessert, "Karte verbessert", "Karten verbessert")}</>}
                {e.aussortiert > 0 && (
                  <span className="leise"> · {mehrzahl(e.aussortiert, "Vorschlag", "Vorschläge")} aussortiert (doppelt oder nicht lernenswert)</span>
                )}
              </p>
              {e.zurPruefung > 0 && (
                <p style={{ margin: "0 0 6px" }}>
                  {mehrzahl(e.zurPruefung, "Karte wartet", "Karten warten")} auf deine Prüfung, weil die KI sich nicht ganz sicher war. <Link href="/pruefen">Jetzt ansehen</Link>
                </p>
              )}
              {e.widersprueche > 0 && (
                <p style={{ margin: "0 0 6px" }}>
                  ⚠️ {mehrzahl(e.widersprueche, "möglicher Widerspruch", "mögliche Widersprüche")} in den Lernmaterialien. <Link href="/pruefen">Ansehen</Link>
                </p>
              )}
            </>
          )}
          {e.fehlgeschlagen.map((f) => (
            <p key={f.name} style={{ margin: "0 0 6px", color: "var(--rot)" }}>
              „{f.name}“ konnte nicht ausgewertet werden: {f.fehler}
            </p>
          ))}
          <div className="reihe" style={{ marginTop: 14 }}>
            <Link href="/" className="knopf haupt">Zu meinen Lernkarten</Link>
            <button className="knopf still" onClick={pipelineZuruecksetzen}>Schließen</button>
          </div>
        </div>
      )}
    </div>
  );
}
