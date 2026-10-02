"use client";

export type Anbieter = "claude" | "gemini";

export interface Einstellungen {
  anbieter: Anbieter;
  /** Zugangsschlüssel für Claude */
  schluessel: string;
  /** Zugangsschlüssel für Google Gemini */
  geminiSchluessel: string;
  qualitaet: "hoch" | "schnell";
}

const KEY = "lernapp-einstellungen";
const STANDARD: Einstellungen = { anbieter: "claude", schluessel: "", geminiSchluessel: "", qualitaet: "hoch" };

export function einstellungenLaden(): Einstellungen {
  try {
    const roh = localStorage.getItem(KEY);
    if (roh) return { ...STANDARD, ...JSON.parse(roh) };
  } catch {}
  return { ...STANDARD };
}

export function einstellungenSpeichern(e: Einstellungen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(e));
  } catch {}
}
