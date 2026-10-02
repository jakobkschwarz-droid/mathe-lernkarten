// Lokale Sicherheitsprüfung gegen doppelte Karten (zusätzlich zur Prüfung
// durch die KI): vergleicht normalisierte Fragen über Buchstaben-Trigramme.

function normalisieren(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\[a-z]+/g, " ")
    .replace(/[^a-zäöüß0-9]+/g, " ")
    .replace(/\b(die|der|das|ein|eine|einer|eines|wie|was|lautet|ist|sind|man|bei|von|und|zu|im|in)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigramme(s: string): Set<string> {
  const t = new Set<string>();
  const w = ` ${s} `;
  for (let i = 0; i < w.length - 2; i++) t.add(w.slice(i, i + 3));
  return t;
}

export function aehnlichkeit(a: string, b: string): number {
  const na = normalisieren(a);
  const nb = normalisieren(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = trigramme(na);
  const tb = trigramme(nb);
  let gemeinsam = 0;
  for (const x of ta) if (tb.has(x)) gemeinsam++;
  return (2 * gemeinsam) / (ta.size + tb.size);
}

/** true, wenn Frage UND Antwort einer vorhandenen Karte sehr ähnlich sind. */
export function istDublette(
  neu: { frage: string; antwort: string },
  vorhandene: { frage: string; antwort: string }[]
): boolean {
  return vorhandene.some(
    (v) =>
      aehnlichkeit(neu.frage, v.frage) > 0.9 ||
      (aehnlichkeit(neu.frage, v.frage) > 0.75 && aehnlichkeit(neu.antwort, v.antwort) > 0.75)
  );
}
