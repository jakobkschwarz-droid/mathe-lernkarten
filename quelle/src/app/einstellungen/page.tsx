"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { einstellungenLaden, einstellungenSpeichern, type Einstellungen } from "@/lib/einstellungen";
import type { Karte, Widerspruch } from "@/lib/types";
import { neuerLernstand } from "@/lib/srs";

export default function EinstellungenSeite() {
  const [e, setE] = useState<Einstellungen>({ anbieter: "claude", schluessel: "", geminiSchluessel: "", qualitaet: "hoch" });
  const [gespeichert, setGespeichert] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const datei = useRef<HTMLInputElement>(null);

  useEffect(() => setE(einstellungenLaden()), []);

  function speichern() {
    einstellungenSpeichern(e);
    setGespeichert(true);
    setTimeout(() => setGespeichert(false), 2000);
  }

  async function sichern() {
    const daten = {
      version: 1,
      karten: await db.karten.toArray(),
      verlauf: await db.verlauf.toArray(),
      widersprueche: await db.widersprueche.toArray(),
    };
    const blob = new Blob([JSON.stringify(daten)], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Lernkarten-Sicherung-${new Date().toISOString().slice(0, 10)}.lernkarten`;
    a.click();
  }

  async function wiederherstellen(f: File) {
    try {
      const d = JSON.parse(await f.text()) as { karten: Karte[]; verlauf: never[]; widersprueche: Widerspruch[] };
      if (!Array.isArray(d.karten)) throw new Error();
      if (!confirm(`${d.karten.length} Karten laden? Bereits vorhandene Karten behalten ihren Lernfortschritt.`)) return;
      const jetzt = Date.now();
      const vorhanden = new Map((await db.karten.bulkGet(d.karten.map((k) => k.id))).map((k) => [k?.id, k]));
      await db.karten.bulkPut(
        d.karten.map((k): Karte => {
          const alt = vorhanden.get(k.id);
          return {
            ...k,
            pfad: k.pfad ?? [],
            bereich: k.bereich ?? k.pfad?.[0] ?? "Sonstiges",
            hinweis: k.hinweis ?? "",
            quellen: k.quellen ?? [],
            status: k.status ?? "aktiv",
            erstellt: k.erstellt ?? jetzt,
            geaendert: k.geaendert ?? jetzt,
            faellig: alt?.faellig ?? k.faellig ?? jetzt,
            lernstand: alt?.lernstand ?? k.lernstand ?? neuerLernstand(),
          };
        }),
      );
      await db.widersprueche.bulkPut(d.widersprueche ?? []);
      setMeldung("Die Karten wurden geladen.");
    } catch {
      setMeldung("Diese Datei ist keine gültige Karten- oder Sicherungsdatei.");
    }
  }

  async function alleLoeschen() {
    if (!confirm("Wirklich ALLE Karten, Materialien und deinen Lernfortschritt löschen? Das kann nicht rückgängig gemacht werden.")) return;
    await Promise.all([db.karten.clear(), db.materialien.clear(), db.verlauf.clear(), db.widersprueche.clear()]);
    setMeldung("Alles wurde gelöscht.");
  }

  return (
    <div className="schmal">
      <h1>Einstellungen</h1>
      <p className="unterzeile">Hier verbindest du die App mit der KI und sicherst deine Lernkarten.</p>

      <div className="flaeche polster">
        <h3 style={{ marginTop: 0 }}>Zugang zur KI</h3>
        <label className="feld">
          <span>Welche KI soll die Karten erstellen?</span>
          <select value={e.anbieter} onChange={(x) => setE({ ...e, anbieter: x.target.value as Einstellungen["anbieter"] })}>
            <option value="claude">Claude (beste Genauigkeit bei Formeln, kostet nach Verbrauch)</option>
            <option value="gemini">Google Gemini (kostenlose Stufe möglich, mit Tageslimit)</option>
          </select>
        </label>
        {e.anbieter === "claude" ? (
          <label className="feld">
            <span>Persönlicher Zugangsschlüssel für Claude</span>
            <input type="password" value={e.schluessel} onChange={(x) => setE({ ...e, schluessel: x.target.value })} placeholder="sk-ant-…" autoComplete="off" />
            <span className="leise klein" style={{ fontWeight: 400, marginTop: 6 }}>
              Du bekommst ihn in deinem Konto auf console.anthropic.com (mit etwas Guthaben). Er bleibt nur auf diesem Gerät und wird ausschließlich zur KI geschickt, nie an andere. Auf jedem Gerät, das du nutzt, trägst du ihn einmal ein.
            </span>
          </label>
        ) : (
          <label className="feld">
            <span>Persönlicher Zugangsschlüssel für Gemini</span>
            <input type="password" value={e.geminiSchluessel} onChange={(x) => setE({ ...e, geminiSchluessel: x.target.value })} placeholder="AI… oder AQ.…" autoComplete="off" />
            <span className="leise klein" style={{ fontWeight: 400, marginTop: 6 }}>
              Du bekommst ihn kostenlos auf aistudio.google.com („Get API key“). Er bleibt nur auf diesem Gerät. Bei Gemini solltest du die erstellten Karten besonders aufmerksam ansehen, vor allem bei Formeln.
            </span>
          </label>
        )}
        <label className="feld">
          <span>Genauigkeit</span>
          <select value={e.qualitaet} onChange={(x) => setE({ ...e, qualitaet: x.target.value as Einstellungen["qualitaet"] })}>
            <option value="hoch">Höchste Genauigkeit (empfohlen)</option>
            <option value="schnell">Schneller und günstiger</option>
          </select>
        </label>
        <button className="knopf haupt" onClick={speichern}>{gespeichert ? "Gespeichert ✓" : "Speichern"}</button>
      </div>

      <div className="flaeche polster" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Meine Daten</h3>
        <p className="leise">Alle Karten und dein Lernfortschritt liegen dauerhaft in diesem Browser. Mit einer Sicherung kannst du sie auf ein anderes Gerät mitnehmen.</p>
        <div className="reihe">
          <button className="knopf" onClick={sichern}>Sicherung speichern</button>
          <button className="knopf" onClick={() => datei.current?.click()}>Karten laden (Sicherung oder Kartenpaket)</button>
          <button className="knopf gefahr" onClick={alleLoeschen}>Alles löschen</button>
          <input ref={datei} type="file" accept=".lernkarten,.json,application/json" style={{ display: "none" }} onChange={(x) => { const f = x.target.files?.[0]; if (f) wiederherstellen(f); x.target.value = ""; }} />
        </div>
        {meldung && <div className="hinweisbox blau" style={{ marginTop: 16, marginBottom: 0 }}>{meldung}</div>}
      </div>
    </div>
  );
}
