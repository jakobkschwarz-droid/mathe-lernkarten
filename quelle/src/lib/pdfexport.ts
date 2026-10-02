"use client";

// Karteikarten als druckfertiges Lernskript: Die Seite wird im Browser gesetzt,
// anschließend öffnet sich der Druckdialog („Als PDF sichern“ / „In Dateien sichern“).

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { formelnVereinheitlichen } from "./formelcheck";
import { ART_NAMEN, type KartenArt } from "./types";

export interface ExportKarte {
  pfad: string[];
  art: KartenArt;
  frage: string;
  antwort: string;
  hinweis: string;
}

export interface ExportOptionen {
  titel: string;
  mitHinweisen: boolean;
  karten: ExportKarte[];
}

import { BASIS } from "./basis";

const verarbeiter = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex, { strict: "ignore", throwOnError: false, output: "html" } as never)
  .use(rehypeStringify);

function mdZuHtml(md: string): string {
  return String(verarbeiter.processSync(formelnVereinheitlichen(md)));
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function gruppieren(karten: ExportKarte[]) {
  const bereiche = new Map<string, Map<string, ExportKarte[]>>();
  for (const k of karten) {
    const bereich = k.pfad[0] ?? "Allgemeines";
    const thema = k.pfad.slice(1).join(" › ") || bereich;
    if (!bereiche.has(bereich)) bereiche.set(bereich, new Map());
    const themen = bereiche.get(bereich)!;
    if (!themen.has(thema)) themen.set(thema, []);
    themen.get(thema)!.push(k);
  }
  return bereiche;
}

export function exportHtml(o: ExportOptionen): string {
  const bereiche = gruppieren(o.karten);
  const datum = new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  const katexCss = `${location.origin}${BASIS}/katex/katex.min.css`;
  let nr = 0;

  const inhalt = [...bereiche.entries()]
    .map(([bereich, themen], bi) => {
      const themenHtml = [...themen.entries()]
        .map(([thema, karten]) => {
          const kartenHtml = karten
            .map((k) => {
              nr++;
              return `
<article class="karte">
  <div class="kopf"><span class="nr">Karte ${nr}</span><span class="art">${esc(ART_NAMEN[k.art] ?? "")}</span></div>
  <div class="feld"><div class="label">Frage</div><div class="frage">${mdZuHtml(k.frage)}</div></div>
  <div class="feld"><div class="label">Antwort</div><div class="antwort">${mdZuHtml(k.antwort)}</div></div>
  ${o.mitHinweisen && k.hinweis ? `<div class="hinweis">${mdZuHtml(k.hinweis)}</div>` : ""}
</article>`;
            })
            .join("");
          return `<section class="thema"><h3>${esc(thema)}</h3>${kartenHtml}</section>`;
        })
        .join("");
      return `<section class="bereich${bi > 0 ? " neue-seite" : ""}"><h2>${esc(bereich)}</h2>${themenHtml}</section>`;
    })
    .join("");

  const verzeichnis = [...bereiche.entries()]
    .map(
      ([bereich, themen]) =>
        `<li><strong>${esc(bereich)}</strong><ul>${[...themen.entries()]
          .map(([t, k]) => `<li>${esc(t)} <span class="anz">${k.length} ${k.length === 1 ? "Karte" : "Karten"}</span></li>`)
          .join("")}</ul></li>`
    )
    .join("");

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(o.titel)}</title>
<link rel="stylesheet" href="${katexCss}">
<style>
  @page { size: A4; margin: 18mm 17mm 20mm 17mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: KaTeX_Main, "Latin Modern Roman", Georgia, serif; font-size: 11.5pt; line-height: 1.5; color: #1d2128; margin: 0; padding: 18px; }
  h1, h2, h3, .label, .kopf, .anz, .deckblatt .meta, .hilfe { font-family: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif; }
  .hilfe { background: #eef0fa; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 14px; }
  .hilfe button { font: inherit; font-weight: 600; margin-top: 8px; padding: 8px 16px; border-radius: 8px; border: 0; background: #4257b2; color: #fff; }
  @media print { .hilfe { display: none; } body { padding: 0; } }
  .deckblatt { min-height: 245mm; display: flex; flex-direction: column; justify-content: center; }
  .deckblatt .oben { font-size: 10pt; letter-spacing: .25em; text-transform: uppercase; color: #4257b2; font-weight: 700; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
  .deckblatt h1 { font-size: 30pt; margin: 6mm 0 4mm; font-weight: 700; letter-spacing: -.01em; }
  .deckblatt .meta { color: #5b6270; font-size: 11pt; }
  .deckblatt .linie { width: 30mm; height: 1.2mm; background: #4257b2; margin: 8mm 0; border-radius: 1mm; }
  .verzeichnis { page-break-after: always; }
  .verzeichnis h2 { font-size: 16pt; }
  .verzeichnis ul { list-style: none; padding-left: 0; }
  .verzeichnis > ul > li { margin-bottom: 4mm; }
  .verzeichnis ul ul { padding-left: 5mm; margin-top: 1mm; }
  .verzeichnis ul ul li { margin: .6mm 0; }
  .anz { color: #7a8190; font-size: 9pt; margin-left: 2mm; }
  .neue-seite { page-break-before: always; }
  h2 { font-size: 20pt; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 1.5pt solid #4257b2; color: #1d2128; }
  h3 { font-size: 13pt; color: #4257b2; margin: 8mm 0 3mm; page-break-after: avoid; }
  .karte { border: .8pt solid #d5d9e2; border-radius: 3mm; padding: 4mm 5mm; margin: 0 0 4mm; page-break-inside: avoid; break-inside: avoid; background: #fff; }
  .kopf { display: flex; justify-content: space-between; font-size: 8.5pt; color: #7a8190; margin-bottom: 2mm; text-transform: uppercase; letter-spacing: .08em; }
  .kopf .art { color: #4257b2; font-weight: 700; }
  .feld { display: grid; grid-template-columns: 20mm 1fr; gap: 3mm; margin: 1.5mm 0; }
  .label { font-size: 8.5pt; font-weight: 700; color: #5b6270; padding-top: .9mm; text-transform: uppercase; letter-spacing: .06em; }
  .frage { font-weight: 700; }
  .frage p, .antwort p, .hinweis p { margin: 0 0 1.5mm; }
  .frage p:last-child, .antwort p:last-child, .hinweis p:last-child { margin-bottom: 0; }
  .antwort ol, .antwort ul, .hinweis ul, .hinweis ol { margin: 0 0 1.5mm; padding-left: 5mm; }
  .hinweis { margin-top: 2.5mm; padding: 2mm 3mm; background: #f3f5fa; border-left: 2pt solid #9aa8dc; border-radius: 1mm; font-size: 10pt; color: #3a404c; }
  .katex { font-size: 1.12em; }
  .katex-display { margin: 2mm 0; overflow: hidden; }
</style></head>
<body>
  <div class="hilfe">Dein Kartensatz ist fertig gesetzt. Tippe auf „Drucken“ und wähle dann <strong>„Als PDF sichern“</strong> (am iPhone/iPad: Teilen-Symbol → „In Dateien sichern“).<br><button onclick="window.print()">Drucken / als PDF sichern</button></div>
  <section class="deckblatt">
    <div class="oben">Mathematik</div>
    <h1>${esc(o.titel)}</h1>
    <div class="linie"></div>
    <div class="meta">${o.karten.length} Karteikarten · ${bereiche.size} ${bereiche.size === 1 ? "Bereich" : "Bereiche"} · Stand ${datum}</div>
  </section>
  <section class="verzeichnis"><h2>Inhalt</h2><ul>${verzeichnis}</ul></section>
  ${inhalt}
</body></html>`;
}

/** Öffnet die fertig gesetzte Druckansicht in einem neuen Tab. */
export function pdfOeffnen(o: ExportOptionen): boolean {
  const blob = new Blob([exportHtml(o)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const fenster = window.open(url, "_blank");
  if (!fenster) return false;
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  return true;
}
