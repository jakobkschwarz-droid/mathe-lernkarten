import { db } from "./db";
import { BASIS } from "./basis";
import { neuerLernstand } from "./srs";
import type { Karte } from "./types";

/** Legt Karten an; bereits vorhandene behalten ihren Lernfortschritt. */
export async function kartenImportieren(karten: Karte[]): Promise<number> {
  const jetzt = Date.now();
  const vorhanden = new Map((await db.karten.bulkGet(karten.map((k) => k.id))).map((k) => [k?.id, k]));
  await db.karten.bulkPut(
    karten.map((k): Karte => {
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
  return karten.length;
}

export const PAKETE = [
  { datei: "abi-lernzettel", titel: "Abi-Lernzettel: Analysis, Vektoren, Stochastik", anzahl: 104 },
  { datei: "vektoren-zettel", titel: "Vektoren: Abstände, Spiegelungen, Geraden, Ebenen", anzahl: 25 },
];

export async function paketLaden(datei: string): Promise<number> {
  const res = await fetch(`${BASIS}/pakete/${datei}.json`);
  if (!res.ok) throw new Error("nicht gefunden");
  const d = (await res.json()) as { karten: Karte[] };
  return kartenImportieren(d.karten);
}
