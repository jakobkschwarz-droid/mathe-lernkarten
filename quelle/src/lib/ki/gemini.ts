"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { NutzerFehler } from "./nutzerfehler";

// Anbindung an Google Gemini (kostenlose Stufe möglich). Gleiche Aufgabe,
// gleiche Anweisungen, gleiches Antwortformat wie bei Claude.

const BASIS = "https://generativelanguage.googleapis.com/v1beta/models";
// "-latest"-Namen zeigen immer auf die aktuelle Version des jeweiligen Modells.
const MODELL = { hoch: "gemini-pro-latest", schnell: "gemini-flash-latest" } as const;

interface Anfrage {
  system: string;
  inhalt: Anthropic.ContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens?: number;
}

type Teil = { text: string } | { inlineData: { mimeType: string; data: string } };

function teile(inhalt: Anthropic.ContentBlockParam[]): Teil[] {
  return inhalt.map((b): Teil => {
    if (b.type === "text") return { text: b.text };
    if ((b.type === "document" || b.type === "image") && b.source.type === "base64") {
      return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
    }
    throw new NutzerFehler("Dieses Dateiformat kann mit Gemini nicht ausgewertet werden.");
  });
}

async function aufrufen(modell: string, apiKey: string, a: Anfrage): Promise<Response> {
  return fetch(`${BASIS}/${modell}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: a.system }] },
      contents: [{ role: "user", parts: teile(a.inhalt) }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: a.schema,
        maxOutputTokens: Math.min(a.maxTokens ?? 64000, 65000),
        temperature: 0.3,
      },
    }),
  });
}

export async function frageGemini<T>(apiKey: string, qualitaet: "hoch" | "schnell", a: Anfrage): Promise<T> {
  let res: Response;
  try {
    res = await aufrufen(MODELL[qualitaet], apiKey, a);
    // Das große Modell ist in der kostenlosen Stufe oft gesperrt oder ausgelastet.
    if (qualitaet === "hoch" && [403, 404, 429].includes(res.status)) {
      res = await aufrufen(MODELL.schnell, apiKey, a);
    }
  } catch {
    throw new NutzerFehler("Keine Verbindung zur KI. Bitte prüfe deine Internetverbindung.");
  }

  if (!res.ok) {
    let meldung = "";
    try {
      meldung = String((await res.json())?.error?.message ?? "");
    } catch {}
    if (res.status === 400 && /api key/i.test(meldung)) {
      throw new NutzerFehler("Der Zugangsschlüssel wurde nicht akzeptiert. Bitte prüfe ihn unter „Einstellungen“.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new NutzerFehler("Der Zugangsschlüssel wurde nicht akzeptiert oder hat keine Berechtigung. Bitte prüfe ihn unter „Einstellungen“.");
    }
    if (res.status === 429) {
      throw new NutzerFehler("Das kostenlose Tageslimit oder die Auslastung der KI ist erreicht. Warte etwas oder versuche es morgen noch einmal.");
    }
    if (res.status === 413 || (res.status === 400 && /size|large|token|pages/i.test(meldung))) {
      throw new NutzerFehler("Die Datei ist zu groß, um sie auf einmal auszuwerten. Teile sie bitte in kleinere Dateien auf.");
    }
    if (res.status >= 500) throw new NutzerFehler("Die KI ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.");
    console.error("Gemini:", res.status, meldung);
    throw new NutzerFehler("Die Datei konnte nicht ausgewertet werden. Bitte versuche es noch einmal.");
  }

  const daten = await res.json();
  const kandidat = daten?.candidates?.[0];
  if (!kandidat) {
    throw new NutzerFehler("Die KI konnte diesen Inhalt leider nicht bearbeiten.");
  }
  if (kandidat.finishReason === "MAX_TOKENS") {
    throw new NutzerFehler("Das Material ist für einen Durchgang zu umfangreich. Teile es bitte in kleinere Dateien auf.");
  }
  const text = (kandidat.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new NutzerFehler("Die Antwort der KI war unvollständig. Bitte versuche es noch einmal.");
  }
}
