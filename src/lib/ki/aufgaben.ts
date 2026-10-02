"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { fehlerhafteFormel, formelnVereinheitlichen } from "../formelcheck";
import type { KarteKompakt, KartenErgebnis, Material, PruefUrteil, Wissen, Wissenseinheit } from "../types";
import { parallel, pdfAufteilen, textAufteilen } from "./aufteilen";
import { frageKI, NutzerFehler } from "./client";
import { docxText, pptxText } from "./office";
import {
  ANALYSE_SCHEMA,
  ANALYSE_SYSTEM,
  KARTEN_SCHEMA,
  KARTEN_SYSTEM,
  PRUEFUNG_SCHEMA,
  PRUEFUNG_SYSTEM,
  THEMEN_SCHEMA,
  THEMEN_SYSTEM,
} from "./prompts";

type Schema = Record<string, unknown>;

function zuBase64(daten: Uint8Array): string {
  let s = "";
  for (let i = 0; i < daten.length; i += 0x8000) s += String.fromCharCode(...daten.subarray(i, i + 0x8000));
  return btoa(s);
}

function textDekodieren(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  const kaputt = (utf8.match(/�/g) ?? []).length;
  return kaputt > 5 ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

const BILD_TYPEN = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Liest ein hochgeladenes Dokument und erfasst den mathematischen Lernstoff. */
export async function analysiereMaterial(m: Material): Promise<Wissen> {
  const buf = await m.datei.arrayBuffer();
  const abschnitte: { inhalt: Anthropic.ContentBlockParam[]; titel: string }[] = [];

  if (m.art === "pdf") {
    const teile = await pdfAufteilen(new Uint8Array(buf));
    for (const t of teile) {
      abschnitte.push({
        titel: teile.length > 1 ? `${m.name} (Seiten ${t.von}–${t.bis})` : m.name,
        inhalt: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: zuBase64(t.daten) } }],
      });
    }
  } else if (m.art === "bild") {
    if (!BILD_TYPEN.has(m.mime)) throw new NutzerFehler("Dieses Bildformat wird nicht unterstützt. Bitte verwende JPG oder PNG.");
    abschnitte.push({
      titel: m.name,
      inhalt: [{ type: "image", source: { type: "base64", media_type: m.mime as "image/png", data: zuBase64(new Uint8Array(buf)) } }],
    });
  } else {
    let text: string;
    try {
      text = m.art === "docx" ? await docxText(buf) : m.art === "pptx" ? await pptxText(buf) : textDekodieren(buf);
    } catch {
      throw new NutzerFehler("Die Datei konnte nicht gelesen werden. Ist sie beschädigt?");
    }
    if (!text.trim()) throw new NutzerFehler("In dieser Datei wurde kein Text gefunden.");
    const teile = textAufteilen(text);
    teile.forEach((t, i) =>
      abschnitte.push({
        titel: teile.length > 1 ? `${m.name} (Teil ${i + 1} von ${teile.length})` : m.name,
        inhalt: [{ type: "text", text: `<material>\n${t}\n</material>` }],
      })
    );
  }

  const ergebnisse = await parallel(abschnitte, 3, (a) =>
    frageKI<Wissen>({
      system: ANALYSE_SYSTEM,
      effort: "medium",
      schema: ANALYSE_SCHEMA as unknown as Schema,
      inhalt: [
        ...a.inhalt,
        { type: "text", text: `Lernmaterial: „${a.titel}“\n\nErfasse den mathematischen Lernstoff dieses Materials als Wissenseinheiten.` },
      ],
    })
  );
  return {
    sprache: ergebnisse[0]?.sprache ?? "Deutsch",
    zusammenfassung: ergebnisse.map((e) => e.zusammenfassung).filter(Boolean).join(" "),
    einheiten: ergebnisse.flatMap((e) => e.einheiten),
  };
}

/** Ordnet gefundene Themenpfade in die gemeinsame Themenstruktur ein. */
export async function themenZuordnen(ein: {
  gefunden: { pfad: string; beispiele: string[] }[];
  vorhanden: string[];
}): Promise<{ zuordnungen: { gefunden: string; endgueltig: string[] }[] }> {
  if (ein.gefunden.length === 0) return { zuordnungen: [] };
  const text = [
    "<vorhandene_themen>",
    ein.vorhanden.length ? ein.vorhanden.join("\n") : "(noch keine)",
    "</vorhandene_themen>",
    "",
    "<gefundene_pfade>",
    ...ein.gefunden.map((g) => `${g.pfad}\n   Inhalte: ${g.beispiele.slice(0, 6).join("; ")}`),
    "</gefundene_pfade>",
    "",
    "Ebenen sind mit „ › “ getrennt. Ordne jedem gefundenen Pfad seinen endgültigen Pfad zu.",
  ].join("\n");
  return frageKI({
    system: THEMEN_SYSTEM,
    effort: "low",
    maxTokens: 32000,
    schema: THEMEN_SCHEMA as unknown as Schema,
    inhalt: [{ type: "text", text }],
  });
}

function einheitText(e: Wissenseinheit, i: number): string {
  const zeilen = [
    `[W${i + 1}] (${e.art}, Wichtigkeit ${e.wichtigkeit}) ${e.pfad.join(" › ")} — ${e.titel}`,
    `Quelle: ${e.quelle ?? "?"}${e.fundstelle ? `, ${e.fundstelle}` : ""}`,
    `Inhalt: ${e.inhalt}`,
  ];
  if (e.voraussetzungen) zeilen.push(`Voraussetzungen: ${e.voraussetzungen}`);
  if (e.bedeutung) zeilen.push(`Bedeutung der Symbole: ${e.bedeutung}`);
  if (e.anwendung) zeilen.push(`Anwendung/Hinweis: ${e.anwendung}`);
  return zeilen.join("\n");
}

function karteText(k: KarteKompakt): string {
  return `[${k.id}] (${k.art}) ${k.pfad.join(" › ")}${k.quellen?.length ? ` · Quellen: ${k.quellen.join(", ")}` : ""}\nF: ${k.frage}\nA: ${k.antwort}`;
}

/** Erstellt aus Wissenseinheiten neue Karten, Verbesserungen und Widersprüche. */
export async function kartenVorschlagen(ein: { einheiten: Wissenseinheit[]; vorhandeneKarten: KarteKompakt[] }): Promise<KartenErgebnis> {
  const text = [
    "<vorhandene_karten>",
    ein.vorhandeneKarten.length ? ein.vorhandeneKarten.map(karteText).join("\n\n") : "(noch keine Karten vorhanden)",
    "</vorhandene_karten>",
    "",
    "<wissenseinheiten_aus_neuem_material>",
    ein.einheiten.map(einheitText).join("\n\n"),
    "</wissenseinheiten_aus_neuem_material>",
    "",
    "Erstelle daraus einen didaktisch sinnvollen, möglichst knappen Satz neuer Karteikarten, schlage nötige Verbesserungen vorhandener Karten vor und melde Widersprüche.",
  ].join("\n");
  return frageKI<KartenErgebnis>({
    system: KARTEN_SYSTEM,
    effort: "high",
    schema: KARTEN_SCHEMA as unknown as Schema,
    inhalt: [{ type: "text", text }],
  });
}

export interface Kandidat {
  id: string;
  art: string;
  pfad: string[];
  frage: string;
  antwort: string;
  hinweis: string;
  bisher?: { frage: string; antwort: string; hinweis: string };
  begruendung?: string;
}

function kandidatText(k: Kandidat): string {
  const z = [`[${k.id}] (${k.art}) ${k.pfad.join(" › ")}`];
  if (k.bisher) z.push(`VERBESSERUNG einer vorhandenen Karte. Bisher:\nF: ${k.bisher.frage}\nA: ${k.bisher.antwort}\nNeu:`);
  z.push(`F: ${k.frage}`, `A: ${k.antwort}`);
  if (k.hinweis) z.push(`Hinweis: ${k.hinweis}`);
  if (k.begruendung) z.push(`Begründung: ${k.begruendung}`);
  return z.join("\n");
}

/** Qualitätskontrolle: prüft jede Karte, bevor sie gespeichert wird. */
export async function kartenPruefen(ein: { kandidaten: Kandidat[]; vorhandene: KarteKompakt[] }): Promise<PruefUrteil[]> {
  const text = [
    "<vorhandene_karten>",
    ein.vorhandene.length ? ein.vorhandene.map((k) => `[${k.id}] ${k.pfad.join(" › ")}\nF: ${k.frage}\nA: ${k.antwort}`).join("\n\n") : "(keine)",
    "</vorhandene_karten>",
    "",
    "<zu_pruefende_karten>",
    ein.kandidaten.map(kandidatText).join("\n\n"),
    "</zu_pruefende_karten>",
    "",
    `Prüfe alle ${ein.kandidaten.length} Karten.`,
  ].join("\n");
  const r = await frageKI<{ urteile: PruefUrteil[] }>({
    system: PRUEFUNG_SYSTEM,
    effort: "high",
    schema: PRUEFUNG_SCHEMA as unknown as Schema,
    inhalt: [{ type: "text", text }],
  });

  // Fehlende Urteile: lieber zur Prüfung vorlegen als ungeprüft speichern.
  const nachId = new Map(r.urteile.map((u) => [u.id, u]));
  const vollstaendig: PruefUrteil[] = ein.kandidaten.map(
    (k) =>
      nachId.get(k.id) ?? {
        id: k.id,
        urteil: "pruefen",
        grund: "Diese Karte konnte nicht automatisch geprüft werden.",
        frage: k.frage,
        antwort: k.antwort,
        hinweis: k.hinweis,
        pfad: k.pfad,
      }
  );
  // Zusätzlich: Lassen sich alle Formeln sauber darstellen?
  for (const u of vollstaendig) {
    u.frage = formelnVereinheitlichen(u.frage);
    u.antwort = formelnVereinheitlichen(u.antwort);
    u.hinweis = formelnVereinheitlichen(u.hinweis);
    if (u.urteil === "speichern" || u.urteil === "korrigieren") {
      const kaputt = fehlerhafteFormel(`${u.frage}\n${u.antwort}\n${u.hinweis}`);
      if (kaputt) {
        u.urteil = "pruefen";
        u.grund = `Eine Formel ist nicht korrekt geschrieben und konnte nicht dargestellt werden: ${kaputt}`;
      }
    }
  }
  return vollstaendig;
}
