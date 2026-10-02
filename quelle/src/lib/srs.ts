import type { Karte, Lernstand } from "./types";

// Einfaches Wiederholungssystem nach dem Vorbild von SM-2, reduziert auf
// die beiden Antworten "Gewusst" und "Nicht gewusst".

const TAG = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export function neuerLernstand(): Lernstand {
  return {
    wiederholungen: 0,
    richtig: 0,
    falsch: 0,
    serie: 0,
    leichtigkeit: 2.5,
    intervallTage: 0,
    zuletzt: null,
  };
}

export function bewerten(
  karte: Karte,
  gewusst: boolean,
  jetzt = Date.now()
): { lernstand: Lernstand; faellig: number } {
  const alt = karte.lernstand;
  const ls: Lernstand = { ...alt, wiederholungen: alt.wiederholungen + 1, zuletzt: jetzt };

  if (gewusst) {
    ls.richtig += 1;
    ls.serie += 1;
    // Wer eine Karte zwischendurch (vor Fälligkeit) noch einmal übt, soll das
    // Intervall nicht künstlich aufblähen.
    const vorzeitig = alt.zuletzt !== null && karte.faellig - jetzt > TAG / 2;
    if (vorzeitig) {
      ls.serie = alt.serie;
      return { lernstand: ls, faellig: karte.faellig };
    }
    if (ls.serie === 1) ls.intervallTage = 1;
    else if (ls.serie === 2) ls.intervallTage = 3;
    else ls.intervallTage = Math.round(Math.max(alt.intervallTage, 1) * ls.leichtigkeit);
    ls.leichtigkeit = Math.min(3.0, ls.leichtigkeit + 0.05);
    ls.intervallTage = Math.min(ls.intervallTage, 365);
    // Ein wenig Streuung, damit nicht alle Karten am selben Tag fällig werden.
    const streuung = ls.intervallTage >= 4 ? (Math.random() - 0.5) * 0.2 * ls.intervallTage : 0;
    return { lernstand: ls, faellig: jetzt + (ls.intervallTage + streuung) * TAG };
  }

  ls.falsch += 1;
  ls.serie = 0;
  ls.leichtigkeit = Math.max(1.3, ls.leichtigkeit - 0.2);
  ls.intervallTage = 0;
  return { lernstand: ls, faellig: jetzt + 10 * MINUTE };
}

/** Eine Karte gilt als "sicher", wenn sie mindestens zweimal hintereinander
 *  (mit zeitlichem Abstand) gewusst wurde. */
export function istSicher(k: Karte): boolean {
  return k.lernstand.serie >= 2;
}

export function istNeu(k: Karte): boolean {
  return k.lernstand.wiederholungen === 0;
}

export function istFaellig(k: Karte, jetzt = Date.now()): boolean {
  return !istNeu(k) && k.faellig <= jetzt;
}

export function erfolgsquote(k: Karte): number | null {
  const n = k.lernstand.richtig + k.lernstand.falsch;
  return n === 0 ? null : k.lernstand.richtig / n;
}

function mischen<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Stellt eine Lernrunde zusammen: zuerst fällige Wiederholungen (am stärksten
 *  überfällige zuerst), dann eine begrenzte Zahl neuer Karten. */
export function lernrunde(karten: Karte[], maxNeu = 15, maxGesamt = 40): Karte[] {
  const jetzt = Date.now();
  const faellig = karten
    .filter((k) => istFaellig(k, jetzt))
    .sort((a, b) => a.faellig - b.faellig)
    .slice(0, maxGesamt);
  // Neue Karten in Themenreihenfolge, damit Zusammenhänge erhalten bleiben,
  // aber innerhalb eines Themas gemischt.
  const neu = karten.filter(istNeu);
  const nachThema = new Map<string, Karte[]>();
  for (const k of neu) {
    const key = k.pfad.join("›");
    nachThema.set(key, [...(nachThema.get(key) ?? []), k]);
  }
  const neuGeordnet = [...nachThema.values()].flatMap((g) => mischen(g)).slice(0, maxNeu);
  // Wiederholungen und neue Karten verzahnen
  const runde: Karte[] = [];
  const f = mischen(faellig.slice(0, Math.max(0, maxGesamt - neuGeordnet.length)));
  let i = 0;
  let j = 0;
  while (i < f.length || j < neuGeordnet.length) {
    if (i < f.length) runde.push(f[i++]);
    if (i < f.length) runde.push(f[i++]);
    if (j < neuGeordnet.length) runde.push(neuGeordnet[j++]);
  }
  return runde;
}

/** Freies Üben: alle Karten, die schwächsten zuerst (mit etwas Zufall). */
export function uebungsrunde(karten: Karte[], max = 30): Karte[] {
  return mischen(karten)
    .map((k) => ({ k, w: (erfolgsquote(k) ?? 0.4) + k.lernstand.serie * 0.15 + Math.random() * 0.25 }))
    .sort((a, b) => a.w - b.w)
    .slice(0, max)
    .map((x) => x.k);
}
