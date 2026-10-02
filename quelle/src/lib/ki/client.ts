"use client";

import Anthropic from "@anthropic-ai/sdk";
import { einstellungenLaden, type Anbieter } from "../einstellungen";

// Die KI wird direkt aus dem Browser mit dem eigenen Zugangsschlüssel
// angesprochen. Es gibt keinen eigenen Server, der Material oder Schlüssel sieht.

export type Qualitaet = "hoch" | "schnell";

export const MODELLE: Record<Qualitaet, string> = {
  hoch: "claude-opus-5-5",
  schnell: "claude-sonnet-5-5",
};

import { NutzerFehler } from "./nutzerfehler";
import { frageGemini } from "./gemini";

export { NutzerFehler };

export function zugang(): { anbieter: Anbieter; apiKey: string; qualitaet: Qualitaet } {
  const e = einstellungenLaden();
  const apiKey = (e.anbieter === "gemini" ? e.geminiSchluessel : e.schluessel).trim();
  if (!apiKey) {
    throw new NutzerFehler("Es ist noch kein Zugangsschlüssel für die KI hinterlegt. Trage ihn unter „Einstellungen“ ein.");
  }
  return { anbieter: e.anbieter, apiKey, qualitaet: e.qualitaet };
}

interface Anfrage {
  system: string;
  inhalt: Anthropic.ContentBlockParam[];
  schema: Record<string, unknown>;
  effort: "low" | "medium" | "high" | "xhigh";
  maxTokens?: number;
}

/** Stellt der KI eine Aufgabe und erhält eine strukturierte Antwort zurück. */
export async function frageKI<T>(a: Anfrage): Promise<T> {
  const { anbieter, apiKey, qualitaet } = zugang();
  if (anbieter === "gemini") return frageGemini<T>(apiKey, qualitaet, a);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 3, timeout: 20 * 60 * 1000 });
  let nachricht: Anthropic.Beta.BetaMessage;
  try {
    const params = {
      model: MODELLE[qualitaet],
      max_tokens: a.maxTokens ?? 64000,
      system: a.system,
      thinking: { type: "adaptive" },
      output_config: { effort: a.effort, format: { type: "json_schema", schema: a.schema } },
      messages: [{ role: "user", content: a.inhalt }],
      // Lehnt ein Modell eine Anfrage ab, springt automatisch ein Ersatzmodell ein.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    };
    nachricht = await client.beta.messages
      .stream(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming)
      .finalMessage();
  } catch (e) {
    throw verstaendlicherFehler(e);
  }

  if (nachricht.stop_reason === "refusal") throw new NutzerFehler("Die KI konnte diesen Inhalt leider nicht bearbeiten.");
  if (nachricht.stop_reason === "max_tokens") {
    throw new NutzerFehler("Das Material ist für einen Durchgang zu umfangreich. Teile es bitte in kleinere Dateien auf.");
  }
  const bloecke = nachricht.content as Array<{ type: string; text?: string }>;
  const letzterWechsel = bloecke.map((b) => b.type).lastIndexOf("fallback");
  const text = bloecke
    .slice(letzterWechsel + 1)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new NutzerFehler("Die Antwort der KI war unvollständig. Bitte versuche es noch einmal.");
  }
}

function verstaendlicherFehler(e: unknown): Error {
  if (e instanceof NutzerFehler) return e;
  if (e instanceof Anthropic.AuthenticationError) {
    return new NutzerFehler("Der Zugangsschlüssel wurde nicht akzeptiert. Bitte prüfe ihn unter „Einstellungen“.");
  }
  if (e instanceof Anthropic.PermissionDeniedError) return new NutzerFehler("Dein Zugang hat für diese Funktion keine Berechtigung.");
  if (e instanceof Anthropic.RateLimitError) return new NutzerFehler("Die KI ist gerade stark ausgelastet. Bitte versuche es in einer Minute erneut.");
  if (e instanceof Anthropic.BadRequestError) {
    const msg = String(e.message ?? "");
    if (/credit|balance|billing/i.test(msg)) {
      return new NutzerFehler("Dein Guthaben bei Anthropic ist aufgebraucht. Bitte lade es in deinem Anthropic-Konto auf.");
    }
    if (/too large|too long|exceed|pages/i.test(msg)) {
      return new NutzerFehler("Die Datei ist zu groß, um sie auf einmal auszuwerten. Teile sie bitte in kleinere Dateien auf.");
    }
    console.error("KI-Anfrage abgelehnt:", msg);
    return new NutzerFehler("Die Datei konnte nicht ausgewertet werden. Ist sie vielleicht beschädigt oder passwortgeschützt?");
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new NutzerFehler("Keine Verbindung zur KI. Bitte prüfe deine Internetverbindung.");
  }
  if (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500) {
    return new NutzerFehler("Die KI ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.");
  }
  console.error(e);
  return new NutzerFehler("Unerwarteter Fehler bei der Auswertung. Bitte versuche es noch einmal.");
}
