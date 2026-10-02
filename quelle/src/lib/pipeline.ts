"use client";

// Ablauf "Karteikarten erstellen / aktualisieren":
// 1. Dokumente analysieren  2. Themen erkennen  3. Karten erstellen
// 4. Qualitätsprüfung & Duplikate entfernen  5. Speichern
// Der Zustand liegt außerhalb von React, damit der Vorgang weiterläuft,
// wenn man innerhalb der App die Seite wechselt.

import { useSyncExternalStore } from "react";
import { db, neueId } from "./db";
import { analysiereMaterial, kartenPruefen, kartenVorschlagen, themenZuordnen } from "./ki/aufgaben";
import { istDublette } from "./dubletten";
import { neuerLernstand } from "./srs";
import { pfadBereinigen, pfadText } from "./themen";
import type {
  Karte,
  KarteKompakt,
  KartenErgebnis,
  KartenVerbesserung,
  KartenVorschlag,
  Material,
  PruefUrteil,
  Widerspruch,
  Wissen,
  Wissenseinheit,
} from "./types";

export type Schritt = "analyse" | "themen" | "karten" | "duplikate" | "fertig";

export const SCHRITTE: { id: Schritt; text: string }[] = [
  { id: "analyse", text: "Dokument wird analysiert …" },
  { id: "themen", text: "Mathematische Themen werden erkannt …" },
  { id: "karten", text: "Karteikarten werden erstellt …" },
  { id: "duplikate", text: "Duplikate werden entfernt …" },
  { id: "fertig", text: "Deine Lernkarten sind fertig." },
];

export interface Zusammenfassung {
  neu: number;
  verbessert: number;
  zurPruefung: number;
  aussortiert: number;
  widersprueche: number;
  fehlgeschlagen: { name: string; fehler: string }[];
  keinInhalt: boolean;
}

export interface PipelineZustand {
  laeuft: boolean;
  schritt: Schritt | null;
  detail: string;
  fehler: string | null;
  ergebnis: Zusammenfassung | null;
}

let zustand: PipelineZustand = { laeuft: false, schritt: null, detail: "", fehler: null, ergebnis: null };
const hoerer = new Set<() => void>();

function setzen(z: Partial<PipelineZustand>) {
  zustand = { ...zustand, ...z };
  hoerer.forEach((h) => h());
}

export function usePipeline(): PipelineZustand {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    () => zustand,
    () => zustand
  );
}

export function pipelineZuruecksetzen() {
  if (!zustand.laeuft) setzen({ schritt: null, detail: "", fehler: null, ergebnis: null });
}

function kompakt(k: Karte): KarteKompakt {
  return { id: k.id, art: k.art, pfad: k.pfad, frage: k.frage, antwort: k.antwort, quellen: k.quellen };
}

/** Teilt Wissenseinheiten nach Bereichen in handliche Pakete auf. */
function paketeBilden(einheiten: Wissenseinheit[], max = 110): Wissenseinheit[][] {
  const nachBereich = new Map<string, Wissenseinheit[]>();
  for (const e of einheiten) {
    const b = e.pfad[0];
    nachBereich.set(b, [...(nachBereich.get(b) ?? []), e]);
  }
  const pakete: Wissenseinheit[][] = [];
  let aktuell: Wissenseinheit[] = [];
  for (const gruppe of nachBereich.values()) {
    // Ein großer Bereich wird nach Teilgebieten weiter aufgeteilt
    const teile: Wissenseinheit[][] = [];
    if (gruppe.length > max) {
      const nachTeil = new Map<string, Wissenseinheit[]>();
      for (const e of gruppe) {
        const t = e.pfad.slice(0, 2).join("›");
        nachTeil.set(t, [...(nachTeil.get(t) ?? []), e]);
      }
      let stueck: Wissenseinheit[] = [];
      for (const g of nachTeil.values()) {
        if (stueck.length + g.length > max && stueck.length) {
          teile.push(stueck);
          stueck = [];
        }
        stueck.push(...g);
        while (stueck.length > max) teile.push(stueck.splice(0, max));
      }
      if (stueck.length) teile.push(stueck);
    } else teile.push(gruppe);

    for (const t of teile) {
      if (aktuell.length + t.length > max && aktuell.length) {
        pakete.push(aktuell);
        aktuell = [];
      }
      aktuell.push(...t);
    }
  }
  if (aktuell.length) pakete.push(aktuell);
  return pakete;
}

export async function kartenErstellen(): Promise<void> {
  if (zustand.laeuft) return;
  setzen({ laeuft: true, schritt: "analyse", detail: "", fehler: null, ergebnis: null });

  try {
    const offen = (await db.materialien.toArray())
      .filter((m) => m.status !== "analysiert")
      .sort((a, b) => a.hinzugefuegt - b.hinzugefuegt);
    if (offen.length === 0) {
      setzen({ laeuft: false, schritt: null });
      return;
    }
    const fehlgeschlagen: Zusammenfassung["fehlgeschlagen"] = [];

    // ---------- 1. Analyse ----------
    const erfolgreich: { m: Material; wissen: Wissen }[] = [];
    let fertig = 0;
    const analysieren = async (m: Material) => {
      if (m.wissen) {
        erfolgreich.push({ m, wissen: m.wissen });
        return;
      }
      try {
        const wissen = await analysiereMaterial(m);
        await db.materialien.update(m.id, { wissen, fehler: undefined });
        erfolgreich.push({ m, wissen });
      } catch (e) {
        const fehler = e instanceof Error ? e.message : String(e);
        fehlgeschlagen.push({ name: m.name, fehler });
        await db.materialien.update(m.id, { status: "fehler", fehler });
      } finally {
        fertig++;
        setzen({ detail: offen.length > 1 ? `${fertig} von ${offen.length} Dokumenten ausgewertet` : "" });
      }
    };
    setzen({ detail: offen.length > 1 ? `0 von ${offen.length} Dokumenten ausgewertet` : `„${offen[0].name}“` });
    const warteschlange = [...offen];
    await Promise.all(
      Array.from({ length: Math.min(2, offen.length) }, async () => {
        while (warteschlange.length) await analysieren(warteschlange.shift()!);
      })
    );

    if (erfolgreich.length === 0) {
      throw new Error(fehlgeschlagen[0]?.fehler ?? "Die Dokumente konnten nicht ausgewertet werden.");
    }

    // Reihenfolge der Dokumente beibehalten (Grundlagen vor Fortsetzung)
    erfolgreich.sort((a, b) => a.m.hinzugefuegt - b.m.hinzugefuegt);
    let einheiten: Wissenseinheit[] = erfolgreich.flatMap(({ m, wissen }) =>
      wissen.einheiten.map((e) => ({ ...e, quelle: m.name, pfad: pfadBereinigen(e.pfad) }))
    );

    const materialIds = erfolgreich.map((x) => x.m.id);
    if (einheiten.length === 0) {
      await db.materialien.where("id").anyOf(materialIds).modify({ status: "analysiert", analysiertAm: Date.now() });
      setzen({
        laeuft: false,
        schritt: "fertig",
        detail: "",
        ergebnis: { neu: 0, verbessert: 0, zurPruefung: 0, aussortiert: 0, widersprueche: 0, fehlgeschlagen, keinInhalt: true },
      });
      return;
    }

    // ---------- 2. Themen erkennen ----------
    setzen({ schritt: "themen", detail: "" });
    const vorhandeneKarten = await db.karten.toArray();
    const vorhandenePfade = [...new Set(vorhandeneKarten.map((k) => pfadText(k.pfad)))];
    const gefunden = new Map<string, string[]>();
    for (const e of einheiten) {
      const p = pfadText(e.pfad);
      gefunden.set(p, [...(gefunden.get(p) ?? []), e.titel]);
    }
    const themen = await themenZuordnen({
      gefunden: [...gefunden.entries()].map(([pfad, beispiele]) => ({ pfad, beispiele })),
      vorhanden: vorhandenePfade,
    });
    const zuordnung = new Map(themen.zuordnungen.map((z) => [z.gefunden, pfadBereinigen(z.endgueltig)]));
    einheiten = einheiten.map((e) => ({ ...e, pfad: zuordnung.get(pfadText(e.pfad)) ?? e.pfad }));
    setzen({ detail: `${new Set(einheiten.map((e) => pfadText(e.pfad))).size} Themen erkannt` });

    // ---------- 3. Karten erstellen ----------
    setzen({ schritt: "karten", detail: "" });
    const pakete = paketeBilden(einheiten);
    const vorschlaege: KartenVorschlag[] = [];
    const verbesserungen: KartenVerbesserung[] = [];
    const widersprueche: KartenErgebnis["widersprueche"] = [];
    for (let i = 0; i < pakete.length; i++) {
      if (pakete.length > 1) setzen({ detail: `Teil ${i + 1} von ${pakete.length}` });
      const bereiche = new Set(pakete[i].map((e) => e.pfad[0]));
      // Bei sehr vielen Karten nur die thematisch passenden mitschicken
      const bestand = vorhandeneKarten.length > 600 ? vorhandeneKarten.filter((k) => bereiche.has(k.bereich)) : vorhandeneKarten;
      const bisherigeVorschlaege: KarteKompakt[] = vorschlaege.map((v) => ({
        id: v.vorschlagId,
        art: v.art,
        pfad: v.pfad,
        frage: v.frage,
        antwort: v.antwort,
        quellen: v.quellen,
      }));
      const r: KartenErgebnis = await kartenVorschlagen({
        einheiten: pakete[i],
        vorhandeneKarten: [...bestand.map(kompakt), ...bisherigeVorschlaege],
      });
      const echteIds = new Set(vorhandeneKarten.map((k) => k.id));
      vorschlaege.push(...r.neueKarten.map((v) => ({ ...v, vorschlagId: `p${i + 1}-${v.vorschlagId}` })));
      verbesserungen.push(...r.verbesserungen.filter((v) => echteIds.has(v.kartenId)));
      widersprueche.push(...r.widersprueche);
    }
    setzen({ detail: `${vorschlaege.length} Vorschläge` });

    // ---------- 4. Prüfung & Duplikate ----------
    setzen({ schritt: "duplikate", detail: "" });
    const nachId = new Map(vorhandeneKarten.map((k) => [k.id, k]));
    const kandidaten = [
      ...vorschlaege.map((v) => ({
        id: v.vorschlagId,
        art: v.art,
        pfad: v.pfad,
        frage: v.frage,
        antwort: v.antwort,
        hinweis: v.hinweis,
        begruendung: v.lernzweck,
      })),
      ...verbesserungen.map((v) => {
        const alt = nachId.get(v.kartenId)!;
        return {
          id: `verb:${v.kartenId}`,
          art: alt.art,
          pfad: alt.pfad,
          frage: v.frage,
          antwort: v.antwort,
          hinweis: v.hinweis,
          bisher: { frage: alt.frage, antwort: alt.antwort, hinweis: alt.hinweis },
          begruendung: v.grund,
        };
      }),
    ];
    // Prüfpakete thematisch zusammenhalten, damit ähnliche Karten gemeinsam geprüft werden
    kandidaten.sort((a, b) => pfadText(a.pfad).localeCompare(pfadText(b.pfad)));
    const urteile: PruefUrteil[] = [];
    const GROESSE = 40;
    for (let i = 0; i < kandidaten.length; i += GROESSE) {
      const teil = kandidaten.slice(i, i + GROESSE);
      if (kandidaten.length > GROESSE) {
        setzen({ detail: `${Math.min(i + GROESSE, kandidaten.length)} von ${kandidaten.length} Karten geprüft` });
      }
      const bereiche = new Set(teil.map((k) => k.pfad[0]));
      urteile.push(
        ...(await kartenPruefen({
          kandidaten: teil,
          vorhandene: vorhandeneKarten.filter((k) => bereiche.has(k.bereich)).map(kompakt),
        }))
      );
    }

    // ---------- 5. Speichern ----------
    const jetzt = Date.now();
    const vorschlagNachId = new Map(vorschlaege.map((v) => [v.vorschlagId, v]));
    const neueKarten: Karte[] = [];
    const aktualisiert: Karte[] = [];
    let aussortiert = 0;
    let zurPruefung = 0;
    const vergleich = vorhandeneKarten.map((k) => ({ frage: k.frage, antwort: k.antwort }));

    for (const u of urteile) {
      if (u.id.startsWith("verb:")) {
        const alt = nachId.get(u.id.slice(5));
        if (!alt) continue;
        if (u.urteil === "speichern" || u.urteil === "korrigieren") {
          aktualisiert.push({ ...alt, frage: u.frage, antwort: u.antwort, hinweis: u.hinweis, geaendert: jetzt });
        }
        continue;
      }
      const v = vorschlagNachId.get(u.id);
      if (!v) continue;
      if (u.urteil === "verwerfen") {
        aussortiert++;
        continue;
      }
      const kandidat = { frage: u.frage || v.frage, antwort: u.antwort || v.antwort };
      if (istDublette(kandidat, vergleich)) {
        aussortiert++;
        continue;
      }
      vergleich.push(kandidat);
      const pfad = pfadBereinigen(u.urteil === "korrigieren" && u.pfad.length ? u.pfad : v.pfad);
      const pruefen = u.urteil === "pruefen";
      if (pruefen) zurPruefung++;
      neueKarten.push({
        id: neueId(),
        art: v.art,
        pfad,
        bereich: pfad[0],
        frage: kandidat.frage,
        antwort: kandidat.antwort,
        hinweis: u.hinweis ?? v.hinweis,
        quellen: v.quellen.filter(Boolean),
        status: pruefen ? "pruefen" : "aktiv",
        pruefGrund: pruefen ? u.grund : undefined,
        erstellt: jetzt + neueKarten.length, // stabile Reihenfolge
        geaendert: jetzt,
        faellig: jetzt,
        lernstand: neuerLernstand(),
      });
    }

    const neueWidersprueche: Widerspruch[] = widersprueche.map((w) => ({
      id: neueId(),
      pfad: pfadBereinigen(w.pfad),
      beschreibung: w.beschreibung,
      aussagen: w.aussagen,
      erstellt: jetzt,
      erledigt: false,
    }));
    const kartenMitWiderspruch = new Map<string, string[]>();
    widersprueche.forEach((w, i) =>
      w.betroffeneKartenIds.forEach((id) => {
        if (nachId.has(id)) kartenMitWiderspruch.set(id, [...(kartenMitWiderspruch.get(id) ?? []), neueWidersprueche[i].id]);
      })
    );

    await db.transaction("rw", db.karten, db.materialien, db.widersprueche, async () => {
      await db.karten.bulkAdd(neueKarten);
      await db.karten.bulkPut(aktualisiert);
      for (const [id, wIds] of kartenMitWiderspruch) {
        const k = await db.karten.get(id);
        if (k) await db.karten.update(id, { widerspruchIds: [...(k.widerspruchIds ?? []), ...wIds] });
      }
      await db.widersprueche.bulkAdd(neueWidersprueche);
      await db.materialien
        .where("id")
        .anyOf(materialIds)
        .modify({ status: "analysiert", analysiertAm: jetzt, fehler: undefined });
    });

    setzen({
      laeuft: false,
      schritt: "fertig",
      detail: "",
      ergebnis: {
        neu: neueKarten.length - zurPruefung,
        verbessert: aktualisiert.length,
        zurPruefung,
        aussortiert,
        widersprueche: neueWidersprueche.length,
        fehlgeschlagen,
        keinInhalt: false,
      },
    });
  } catch (e) {
    setzen({ laeuft: false, fehler: e instanceof Error ? e.message : String(e) });
  }
}
