"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, neueId } from "@/lib/db";
import { bildVorbereiten, dateiHash, ERLAUBTE_ENDUNGEN, groesseText, materialArt } from "@/lib/dateien";
import { usePipeline } from "@/lib/pipeline";
import { ErstellenKnopf, Fortschritt } from "@/components/Erstellen";
import type { Material } from "@/lib/types";

const SYMBOL: Record<Material["art"], string> = { pdf: "📕", text: "📝", docx: "📘", pptx: "📙", bild: "🖼️" };
const MAX_GROESSE = 30 * 1024 * 1024;

export default function MaterialSeite() {
  const materialien = useLiveQuery(() => db.materialien.orderBy("hinzugefuegt").reverse().toArray(), []);
  const pipeline = usePipeline();
  const [ziehen, setZiehen] = useState(false);
  const [meldungen, setMeldungen] = useState<string[]>([]);
  const eingabe = useRef<HTMLInputElement>(null);

  async function hinzufuegen(dateien: FileList | File[]) {
    const neu: string[] = [];
    for (const datei of Array.from(dateien)) {
      const art = materialArt(datei);
      if (!art) {
        neu.push(`„${datei.name}“: Dieses Dateiformat wird nicht unterstützt.`);
        continue;
      }
      try {
        const inhalt = art === "bild" ? await bildVorbereiten(datei) : datei;
        if (inhalt.size > MAX_GROESSE) {
          neu.push(`„${datei.name}“ ist zu groß (höchstens 30 MB). Teile die Datei bitte auf.`);
          continue;
        }
        const hash = await dateiHash(inhalt);
        if (await db.materialien.where("hash").equals(hash).first()) {
          neu.push(`„${datei.name}“ ist bereits vorhanden.`);
          continue;
        }
        await db.materialien.add({
          id: neueId(),
          name: datei.name,
          groesse: inhalt.size,
          mime: inhalt.type || datei.type,
          art,
          hash,
          hinzugefuegt: Date.now(),
          datei: inhalt,
          status: "neu",
        });
      } catch (e) {
        neu.push(`„${datei.name}“: ${e instanceof Error ? e.message : "konnte nicht gelesen werden."}`);
      }
    }
    setMeldungen(neu);
  }

  async function entfernen(m: Material) {
    const text =
      m.status === "analysiert"
        ? `„${m.name}“ entfernen? Die daraus erstellten Karteikarten bleiben erhalten.`
        : `„${m.name}“ entfernen?`;
    if (confirm(text)) await db.materialien.delete(m.id);
  }

  const offen = materialien?.filter((m) => m.status !== "analysiert").length ?? 0;

  return (
    <div className="schmal">
      <h1>Lernmaterial</h1>
      <p className="unterzeile">
        Lade Skripte, Zusammenfassungen, Mitschriften oder Fotos deiner Notizen hoch. Daraus entstehen durchdachte Karteikarten – nicht
        möglichst viele, sondern die, die du wirklich brauchst.
      </p>

      <div
        className={`ablage ${ziehen ? "aktiv" : ""}`}
        onClick={() => eingabe.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setZiehen(true);
        }}
        onDragLeave={() => setZiehen(false)}
        onDrop={(e) => {
          e.preventDefault();
          setZiehen(false);
          hinzufuegen(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && eingabe.current?.click()}
      >
        <div className="titel">📄 Lernmaterial hochladen</div>
        <div className="text">Dateien hierher ziehen oder klicken, um sie auszuwählen</div>
        <div className="formate">PDF · Word · PowerPoint · Text · Fotos von Notizen (JPG, PNG)</div>
        <input
          ref={eingabe}
          type="file"
          multiple
          accept={ERLAUBTE_ENDUNGEN}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) hinzufuegen(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {meldungen.length > 0 && (
        <div className="hinweisbox gelb" style={{ marginTop: 16 }}>
          <div>{meldungen.map((m) => <div key={m}>{m}</div>)}</div>
          <button className="knopf still klein" onClick={() => setMeldungen([])}>OK</button>
        </div>
      )}

      <div className="reihe zwischen" style={{ margin: "32px 0 18px" }}>
        <div className="leise">
          {offen > 0 ? `${offen} ${offen === 1 ? "neues Dokument wartet" : "neue Dokumente warten"} auf die Auswertung.` : materialien?.length ? "Alle Materialien sind ausgewertet." : ""}
        </div>
        <ErstellenKnopf />
      </div>

      <Fortschritt />

      {materialien && materialien.length > 0 && (
        <>
          <h2>Meine Materialien</h2>
          <ul className="dateiliste flaeche">
            {materialien.map((m) => (
              <li key={m.id}>
                <span className="symbol">{SYMBOL[m.art]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="name">{m.name}</div>
                  <div className="info">
                    {groesseText(m.groesse)} · hinzugefügt am {new Date(m.hinzugefuegt).toLocaleDateString("de-DE")}
                    {m.wissen && ` · ${m.wissen.einheiten.length} Lerninhalte erkannt`}
                  </div>
                  {m.status === "fehler" && m.fehler && <div className="fehlertext">{m.fehler}</div>}
                </div>
                {m.status === "analysiert" && <span className="etikett gruen">Ausgewertet</span>}
                {m.status === "neu" && <span className="etikett">Neu</span>}
                {m.status === "fehler" && <span className="etikett rot">Fehler</span>}
                <button className="knopf still klein" onClick={() => entfernen(m)} disabled={pipeline.laeuft} aria-label="Entfernen" title="Entfernen">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
