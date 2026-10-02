"use client";

export interface Einstellungen {
  schluessel: string;
  qualitaet: "hoch" | "schnell";
}

const KEY = "lernapp-einstellungen";

export function einstellungenLaden(): Einstellungen {
  try {
    const roh = localStorage.getItem(KEY);
    if (roh) return { schluessel: "", qualitaet: "hoch", ...JSON.parse(roh) };
  } catch {}
  return { schluessel: "", qualitaet: "hoch" };
}

export function einstellungenSpeichern(e: Einstellungen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(e));
  } catch {}
}

export function kopfzeilen(): Record<string, string> {
  const e = einstellungenLaden();
  const h: Record<string, string> = { "x-lernapp-qualitaet": e.qualitaet };
  if (e.schluessel) h["x-lernapp-schluessel"] = e.schluessel;
  return h;
}
