import katex from "katex";

const FORMEL = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/** Prüft, ob alle Formeln in einem Text fehlerfrei dargestellt werden können.
 *  Gibt bei einem Problem die betroffene Formel zurück, sonst null. */
export function fehlerhafteFormel(text: string): string | null {
  for (const m of text.matchAll(FORMEL)) {
    const tex = (m[1] ?? m[2] ?? "").trim();
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: !!m[1], strict: "ignore" });
    } catch {
      return tex;
    }
  }
  return null;
}

/** Vereinheitlicht Formel-Begrenzer: \( … \) → $ … $ und \[ … \] → $$ … $$. */
export function formelnVereinheitlichen(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => `$$${f}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => `$${f}$`);
}
