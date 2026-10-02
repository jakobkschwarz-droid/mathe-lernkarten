import type { Karte } from "./types";
import { istFaellig, istNeu, istSicher } from "./srs";

export interface ThemenKnoten {
  name: string;
  pfad: string[];
  kinder: ThemenKnoten[];
  /** Karten, die genau diesem Knoten zugeordnet sind */
  eigeneKarten: Karte[];
  /** alle Karten in diesem Knoten inkl. Unterthemen */
  alleKarten: Karte[];
}

export const PFAD_TRENNER = " › ";

export function pfadText(pfad: string[]): string {
  return pfad.join(PFAD_TRENNER);
}

/** Baut aus den Themenpfaden der Karten einen Themenbaum. */
export function themenbaum(karten: Karte[]): ThemenKnoten {
  const wurzel: ThemenKnoten = { name: "Mathematik", pfad: [], kinder: [], eigeneKarten: [], alleKarten: [] };
  for (const k of karten) {
    let knoten = wurzel;
    knoten.alleKarten.push(k);
    for (let i = 0; i < k.pfad.length; i++) {
      const name = k.pfad[i];
      let kind = knoten.kinder.find((c) => c.name === name);
      if (!kind) {
        kind = { name, pfad: k.pfad.slice(0, i + 1), kinder: [], eigeneKarten: [], alleKarten: [] };
        knoten.kinder.push(kind);
      }
      kind.alleKarten.push(k);
      knoten = kind;
    }
    knoten.eigeneKarten.push(k);
  }
  sortieren(wurzel);
  return wurzel;
}

function sortieren(k: ThemenKnoten) {
  // Reihenfolge des ersten Auftretens beibehalten (entspricht meist der
  // Reihenfolge im Lernmaterial), Karten nach Erstellung.
  k.eigeneKarten.sort((a, b) => a.erstellt - b.erstellt);
  k.kinder.forEach(sortieren);
}

export function knotenFinden(wurzel: ThemenKnoten, pfad: string[]): ThemenKnoten | null {
  let k: ThemenKnoten | undefined = wurzel;
  for (const teil of pfad) {
    k = k.kinder.find((c) => c.name === teil);
    if (!k) return null;
  }
  return k;
}

export function imPfad(karte: Karte, pfad: string[]): boolean {
  return pfad.every((teil, i) => karte.pfad[i] === teil);
}

export interface Kennzahlen {
  anzahl: number;
  sicher: number;
  sicherProzent: number;
  faellig: number;
  neu: number;
}

export function kennzahlen(karten: Karte[]): Kennzahlen {
  const jetzt = Date.now();
  const anzahl = karten.length;
  const sicher = karten.filter(istSicher).length;
  return {
    anzahl,
    sicher,
    sicherProzent: anzahl ? Math.round((sicher / anzahl) * 100) : 0,
    faellig: karten.filter((k) => istFaellig(k, jetzt)).length,
    neu: karten.filter(istNeu).length,
  };
}

export function pfadZuUrl(pfad: string[]): string {
  return "/thema/?p=" + encodeURIComponent(pfad.join("/"));
}

/** Bereinigt Themennamen (keine Schrägstriche, keine Nummerierung, kein Leerraum). */
export function pfadBereinigen(pfad: string[]): string[] {
  const p = pfad
    .map((t) =>
      t
        .replace(/[\/\\]/g, "–")
        .replace(/^\s*(kapitel|abschnitt|teil)?\s*\d+(\.\d+)*[.):]?\s+/i, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((t) => t && t.toLowerCase() !== "mathematik");
  return p.length ? p.slice(0, 5) : ["Allgemeines"];
}
