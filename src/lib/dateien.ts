"use client";

import type { MaterialArt } from "./types";

export const ERLAUBTE_ENDUNGEN = ".pdf,.txt,.md,.tex,.docx,.pptx,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif";

export function materialArt(datei: File): MaterialArt | null {
  const n = datei.name.toLowerCase();
  if (n.endsWith(".pdf") || datei.type === "application/pdf") return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".pptx")) return "pptx";
  if (/\.(txt|md|markdown|tex)$/.test(n) || datei.type.startsWith("text/")) return "text";
  if (/\.(png|jpe?g|webp|gif|heic|heif)$/.test(n) || datei.type.startsWith("image/")) return "bild";
  return null;
}

export async function dateiHash(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verkleinert Fotos auf eine sinnvolle Größe und wandelt sie in JPEG um
 *  (spart Übertragungszeit, Handschrift bleibt gut lesbar). */
export async function bildVorbereiten(datei: File): Promise<Blob> {
  const max = 2000;
  let bild: ImageBitmap;
  try {
    bild = await createImageBitmap(datei);
  } catch {
    throw new Error("Dieses Bild kann dein Browser nicht öffnen. Bitte speichere es als JPG oder PNG.");
  }
  const faktor = Math.min(1, max / Math.max(bild.width, bild.height));
  if (faktor === 1 && datei.size < 3_500_000 && /image\/(jpeg|png|webp|gif)/.test(datei.type)) {
    bild.close();
    return datei;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bild.width * faktor);
  canvas.height = Math.round(bild.height * faktor);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
  bild.close();
  return await new Promise<Blob>((ok, fehler) =>
    canvas.toBlob((b) => (b ? ok(b) : fehler(new Error("Bild konnte nicht umgewandelt werden"))), "image/jpeg", 0.88)
  );
}

export function groesseText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
