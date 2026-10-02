import type { Karte, VerlaufEintrag } from "./types";
import { kennzahlen, themenbaum } from "./themen";

export function heuteGelernt(verlauf: VerlaufEintrag[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Set(verlauf.filter((v) => v.zeit >= start.getTime()).map((v) => v.kartenId)).size;
}

export function bereichsauswertung(karten: Karte[]) {
  const baum = themenbaum(karten);
  const bereiche = baum.kinder.map((b) => ({ knoten: b, k: kennzahlen(b.alleKarten) }));
  const geuebt = bereiche.filter((b) => b.k.anzahl >= 2 && b.k.anzahl - b.k.neu > 0);
  const staerkstes = geuebt.length && geuebt.some((b) => b.k.sicher > 0)
    ? [...geuebt].sort((a, b) => b.k.sicherProzent - a.k.sicherProzent)[0].knoten.name
    : null;
  const kandidaten = bereiche.filter((b) => b.knoten.name !== staerkstes && b.k.anzahl > 0);
  const nochZuLernen = kandidaten.length
    ? [...kandidaten].sort((a, b) => a.k.sicherProzent - b.k.sicherProzent || b.k.neu - a.k.neu)[0].knoten.name
    : null;
  return { baum, bereiche, staerkstes, nochZuLernen };
}
