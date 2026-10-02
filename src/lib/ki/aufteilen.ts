import { PDFDocument } from "pdf-lib";

const SEITEN_PRO_TEIL = 30;
const ZEICHEN_PRO_TEIL = 80_000;

export interface PdfTeil {
  daten: Uint8Array;
  von: number;
  bis: number;
}

/** Teilt große PDFs in Abschnitte, damit jeder Abschnitt gründlich
 *  ausgewertet werden kann. */
export async function pdfAufteilen(daten: Uint8Array): Promise<PdfTeil[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(daten, { ignoreEncryption: true });
  } catch {
    return [{ daten, von: 1, bis: 0 }];
  }
  const n = doc.getPageCount();
  if (n <= SEITEN_PRO_TEIL + 10) return [{ daten, von: 1, bis: n }];
  const teile: PdfTeil[] = [];
  for (let start = 0; start < n; start += SEITEN_PRO_TEIL) {
    const ende = Math.min(n, start + SEITEN_PRO_TEIL);
    const neu = await PDFDocument.create();
    const seiten = await neu.copyPages(doc, Array.from({ length: ende - start }, (_, i) => start + i));
    seiten.forEach((s) => neu.addPage(s));
    teile.push({ daten: await neu.save(), von: start + 1, bis: ende });
  }
  return teile;
}

/** Teilt lange Texte an Absatzgrenzen. */
export function textAufteilen(text: string): string[] {
  if (text.length <= ZEICHEN_PRO_TEIL) return [text];
  const teile: string[] = [];
  let rest = text;
  while (rest.length > ZEICHEN_PRO_TEIL) {
    let schnitt = rest.lastIndexOf("\n\n", ZEICHEN_PRO_TEIL);
    if (schnitt < ZEICHEN_PRO_TEIL / 2) schnitt = rest.lastIndexOf("\n", ZEICHEN_PRO_TEIL);
    if (schnitt < ZEICHEN_PRO_TEIL / 2) schnitt = ZEICHEN_PRO_TEIL;
    teile.push(rest.slice(0, schnitt));
    rest = rest.slice(schnitt);
  }
  if (rest.trim()) teile.push(rest);
  return teile;
}

/** Führt Aufgaben mit begrenzter Parallelität aus (Reihenfolge bleibt erhalten). */
export async function parallel<T, R>(items: T[], max: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const ergebnis: R[] = new Array(items.length);
  let naechster = 0;
  const arbeiter = Array.from({ length: Math.min(max, items.length) }, async () => {
    while (naechster < items.length) {
      const i = naechster++;
      ergebnis[i] = await fn(items[i], i);
    }
  });
  await Promise.all(arbeiter);
  return ergebnis;
}
