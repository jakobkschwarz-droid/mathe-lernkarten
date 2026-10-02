// Textauszug aus Word- (.docx) und PowerPoint-Dateien (.pptx).
// Formeln aus dem Word-Formeleditor (OMML) werden dabei in LaTeX übersetzt,
// damit sie für die KI lesbar bleiben.

import JSZip from "jszip";

type El = {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  childNodes: ArrayLike<El>;
  textContent: string | null;
  getAttribute?: (n: string) => string | null;
};

const ELEMENT = 1;

function kinder(n: El): El[] {
  const r: El[] = [];
  for (let i = 0; i < n.childNodes.length; i++) {
    const c = n.childNodes[i];
    if (c.nodeType === ELEMENT) r.push(c);
  }
  return r;
}

function name(n: El): string {
  return n.nodeName; // inkl. Präfix, z. B. "m:f"
}

function kind(n: El, nm: string): El | undefined {
  return kinder(n).find((c) => name(c) === nm);
}

function attr(n: El | undefined, nm: string): string | null {
  if (!n || !n.getAttribute) return null;
  return n.getAttribute(nm);
}

function prop(n: El, pr: string, child: string): string | null {
  const p = kind(n, pr);
  const c = p ? kind(p, child) : undefined;
  return attr(c, "m:val");
}

const ZEICHEN: Record<string, string> = {
  "·": "\\cdot ", "⋅": "\\cdot ", "×": "\\times ", "÷": "\\div ", "±": "\\pm ", "∓": "\\mp ",
  "≤": "\\leq ", "≥": "\\geq ", "≠": "\\neq ", "≈": "\\approx ", "≡": "\\equiv ", "∼": "\\sim ",
  "∞": "\\infty ", "→": "\\to ", "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "←": "\\leftarrow ",
  "↦": "\\mapsto ", "∈": "\\in ", "∉": "\\notin ", "⊂": "\\subset ", "⊆": "\\subseteq ", "∪": "\\cup ",
  "∩": "\\cap ", "∅": "\\emptyset ", "∀": "\\forall ", "∃": "\\exists ", "∂": "\\partial ", "∇": "\\nabla ",
  "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}", "ℂ": "\\mathbb{C}",
  "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\varepsilon ", "ϵ": "\\epsilon ",
  "ζ": "\\zeta ", "η": "\\eta ", "θ": "\\theta ", "λ": "\\lambda ", "μ": "\\mu ", "ν": "\\nu ", "ξ": "\\xi ",
  "π": "\\pi ", "ρ": "\\rho ", "σ": "\\sigma ", "τ": "\\tau ", "φ": "\\varphi ", "ϕ": "\\phi ", "χ": "\\chi ",
  "ψ": "\\psi ", "ω": "\\omega ", "Γ": "\\Gamma ", "Δ": "\\Delta ", "Θ": "\\Theta ", "Λ": "\\Lambda ",
  "Π": "\\Pi ", "Σ": "\\Sigma ", "Φ": "\\Phi ", "Ψ": "\\Psi ", "Ω": "\\Omega ", "′": "'", "″": "''",
  "−": "-", "…": "\\ldots ", "⋯": "\\cdots ", "∘": "\\circ ", "⊥": "\\perp ", "∥": "\\parallel ",
  "¬": "\\neg ", "∧": "\\land ", "∨": "\\lor ", "∠": "\\angle ", "°": "^{\\circ}",
};

function zeichen(t: string): string {
  return Array.from(t).map((c) => ZEICHEN[c] ?? c).join("");
}

const FUNKTIONEN = new Set(["sin", "cos", "tan", "cot", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "ln", "log", "exp", "lim", "max", "min", "sup", "inf", "det", "dim", "ker", "deg", "gcd"]);

function e(n: El | undefined): string {
  return n ? omml(n) : "";
}

/** Übersetzt einen OMML-Knoten nach LaTeX. */
export function omml(n: El): string {
  const nm = name(n);
  switch (nm) {
    case "m:r": {
      const t = kinder(n).filter((c) => name(c) === "m:t" || name(c) === "w:t").map((c) => c.textContent ?? "").join("");
      const z = zeichen(t);
      return FUNKTIONEN.has(t.trim()) ? `\\${t.trim()} ` : z;
    }
    case "m:f":
      return `\\frac{${e(kind(n, "m:num"))}}{${e(kind(n, "m:den"))}}`;
    case "m:sSup":
      return `{${e(kind(n, "m:e"))}}^{${e(kind(n, "m:sup"))}}`;
    case "m:sSub":
      return `{${e(kind(n, "m:e"))}}_{${e(kind(n, "m:sub"))}}`;
    case "m:sSubSup":
      return `{${e(kind(n, "m:e"))}}_{${e(kind(n, "m:sub"))}}^{${e(kind(n, "m:sup"))}}`;
    case "m:sPre":
      return `{}_{${e(kind(n, "m:sub"))}}^{${e(kind(n, "m:sup"))}}${e(kind(n, "m:e"))}`;
    case "m:rad": {
      const grad = e(kind(n, "m:deg")).trim();
      return grad ? `\\sqrt[${grad}]{${e(kind(n, "m:e"))}}` : `\\sqrt{${e(kind(n, "m:e"))}}`;
    }
    case "m:nary": {
      const chr = prop(n, "m:naryPr", "m:chr") ?? "∫";
      const op: Record<string, string> = { "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap" };
      const sub = e(kind(n, "m:sub"));
      const sup = e(kind(n, "m:sup"));
      return `${op[chr] ?? zeichen(chr)}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""} ${e(kind(n, "m:e"))}`;
    }
    case "m:d": {
      const beg = prop(n, "m:dPr", "m:begChr") ?? "(";
      const end = prop(n, "m:dPr", "m:endChr") ?? ")";
      const sep = prop(n, "m:dPr", "m:sepChr") ?? ",";
      const teile = kinder(n).filter((c) => name(c) === "m:e").map(omml);
      const links = beg === "" ? "." : beg === "{" ? "\\{" : beg === "|" ? "|" : beg === "‖" ? "\\|" : beg === "⟨" ? "\\langle" : beg === "⌊" ? "\\lfloor" : beg === "⌈" ? "\\lceil" : beg;
      const rechts = end === "" ? "." : end === "}" ? "\\}" : end === "|" ? "|" : end === "‖" ? "\\|" : end === "⟩" ? "\\rangle" : end === "⌋" ? "\\rfloor" : end === "⌉" ? "\\rceil" : end;
      return `\\left${links} ${teile.join(sep === "|" ? " \\mid " : `${sep} `)} \\right${rechts}`;
    }
    case "m:func":
      return `${e(kind(n, "m:fName"))} ${e(kind(n, "m:e"))}`;
    case "m:limLow": {
      const basis = e(kind(n, "m:e")).trim();
      const unten = e(kind(n, "m:lim"));
      return /^\\?lim\s*$/.test(basis) ? `\\lim_{${unten}}` : `\\underset{${unten}}{${basis}}`;
    }
    case "m:limUpp":
      return `\\overset{${e(kind(n, "m:lim"))}}{${e(kind(n, "m:e"))}}`;
    case "m:acc": {
      const chr = prop(n, "m:accPr", "m:chr") ?? "̂";
      const akz: Record<string, string> = { "̂": "\\hat", "̄": "\\bar", "⃗": "\\vec", "̇": "\\dot", "̈": "\\ddot", "̃": "\\tilde", "→": "\\vec" };
      return `${akz[chr] ?? "\\hat"}{${e(kind(n, "m:e"))}}`;
    }
    case "m:bar":
      return prop(n, "m:barPr", "m:pos") === "bot" ? `\\underline{${e(kind(n, "m:e"))}}` : `\\overline{${e(kind(n, "m:e"))}}`;
    case "m:groupChr":
      return prop(n, "m:groupChrPr", "m:pos") === "top" ? `\\overbrace{${e(kind(n, "m:e"))}}` : `\\underbrace{${e(kind(n, "m:e"))}}`;
    case "m:m": {
      const zeilen = kinder(n)
        .filter((c) => name(c) === "m:mr")
        .map((mr) => kinder(mr).filter((c) => name(c) === "m:e").map(omml).join(" & "));
      return `\\begin{matrix} ${zeilen.join(" \\\\ ")} \\end{matrix}`;
    }
    case "m:eqArr": {
      const zeilen = kinder(n).filter((c) => name(c) === "m:e").map(omml);
      return `\\begin{gathered} ${zeilen.join(" \\\\ ")} \\end{gathered}`;
    }
    case "m:t":
      return zeichen(n.textContent ?? "");
    default:
      if (/Pr$/.test(nm) || nm === "w:rPr") return "";
      return kinder(n).map(omml).join("");
  }
}

/** Geht ein Word-/PowerPoint-Dokument in Lesereihenfolge durch. */
function textAus(wurzel: El): string {
  const aus: string[] = [];
  const walk = (n: El) => {
    const nm = name(n);
    if (nm === "mc:Fallback") return; // Ersatzbilder für Formeln überspringen
    if (nm === "m:oMathPara") {
      const formeln = kinder(n).filter((c) => name(c) === "m:oMath").map(omml);
      aus.push(`\n$$${formeln.join(" \\\\ ")}$$\n`);
      return;
    }
    if (nm === "m:oMath") {
      aus.push(` $${omml(n).trim()}$ `);
      return;
    }
    if (nm === "w:t" || nm === "a:t") {
      aus.push(n.textContent ?? "");
      return;
    }
    if (nm === "w:tab") aus.push("\t");
    if (nm === "w:br" || nm === "a:br") aus.push("\n");
    if (nm === "w:p") {
      const stil = (() => {
        const pPr = kind(n, "w:pPr");
        return attr(pPr ? kind(pPr, "w:pStyle") : undefined, "w:val") ?? "";
      })();
      const ebene = /heading\s*(\d)|berschrift\s*(\d)|^(\d)$/i.exec(stil);
      const liste = (() => {
        const pPr = kind(n, "w:pPr");
        return !!(pPr && kind(pPr, "w:numPr"));
      })();
      if (ebene) aus.push("#".repeat(Number(ebene[1] ?? ebene[2] ?? ebene[3])) + " ");
      else if (liste) aus.push("- ");
    }
    if (nm === "w:tc") aus.push(" | ");
    kinder(n).forEach(walk);
    if (nm === "w:p" || nm === "a:p" || nm === "w:tr") aus.push("\n");
  };
  walk(wurzel);
  return aus.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function parse(xml: string): El {
  return new DOMParser().parseFromString(xml, "text/xml").documentElement as unknown as El;
}

export async function docxText(daten: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(daten);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("Keine gültige Word-Datei");
  return textAus(parse(await doc.async("string")));
}

export async function pptxText(daten: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(daten);
  const folien = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const teile: string[] = [];
  for (let i = 0; i < folien.length; i++) {
    const xml = await zip.file(folien[i])!.async("string");
    teile.push(`--- Folie ${i + 1} ---\n${textAus(parse(xml))}`);
  }
  return teile.join("\n\n");
}
