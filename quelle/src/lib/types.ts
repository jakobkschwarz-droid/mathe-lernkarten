// Gemeinsame Datentypen für Browser und Server.

export const KARTEN_ARTEN = [
  "konzept",
  "definition",
  "satz",
  "formel",
  "voraussetzungen",
  "verfahren",
  "verstaendnis",
  "fehler",
  "beispiel",
] as const;

export type KartenArt = (typeof KARTEN_ARTEN)[number];

/** Anzeigenamen für die Kartenarten (sichtbar in der Oberfläche). */
export const ART_NAMEN: Record<KartenArt, string> = {
  konzept: "Grundidee",
  definition: "Definition",
  satz: "Satz",
  formel: "Formel",
  voraussetzungen: "Voraussetzungen",
  verfahren: "Vorgehensweise",
  verstaendnis: "Verständnis",
  fehler: "Typischer Fehler",
  beispiel: "Beispiel",
};

export type MaterialArt = "pdf" | "text" | "docx" | "pptx" | "bild";

export interface Material {
  id: string;
  name: string;
  groesse: number;
  mime: string;
  art: MaterialArt;
  hash: string;
  hinzugefuegt: number;
  datei: Blob;
  status: "neu" | "analysiert" | "fehler";
  fehler?: string;
  analysiertAm?: number;
  /** Ergebnis der Inhaltsanalyse (wird zwischengespeichert, damit bei einem
   *  Abbruch nicht erneut analysiert werden muss). */
  wissen?: Wissen;
}

/** Eine einzelne Wissenseinheit, die die KI im Material gefunden hat. */
export interface Wissenseinheit {
  art: KartenArt;
  pfad: string[];
  titel: string;
  inhalt: string;
  voraussetzungen: string;
  bedeutung: string;
  anwendung: string;
  wichtigkeit: number;
  fundstelle: string;
  /** wird im Browser ergänzt */
  quelle?: string;
}

export interface Wissen {
  sprache: string;
  zusammenfassung: string;
  einheiten: Wissenseinheit[];
}

export interface Lernstand {
  /** Anzahl aller Wiederholungen */
  wiederholungen: number;
  richtig: number;
  falsch: number;
  /** richtige Antworten in Folge */
  serie: number;
  leichtigkeit: number;
  intervallTage: number;
  zuletzt: number | null;
}

export interface Karte {
  id: string;
  art: KartenArt;
  pfad: string[];
  /** = pfad[0], für schnelles Filtern */
  bereich: string;
  frage: string;
  antwort: string;
  hinweis: string;
  quellen: string[];
  status: "aktiv" | "pruefen";
  pruefGrund?: string;
  erstellt: number;
  geaendert: number;
  faellig: number;
  lernstand: Lernstand;
  widerspruchIds?: string[];
}

export interface Widerspruch {
  id: string;
  pfad: string[];
  beschreibung: string;
  aussagen: { dokument: string; aussage: string }[];
  erstellt: number;
  erledigt: boolean;
}

export interface VerlaufEintrag {
  id?: number;
  kartenId: string;
  zeit: number;
  gewusst: boolean;
}

/** Kompakte Darstellung bestehender Karten für die KI. */
export interface KarteKompakt {
  id: string;
  art: KartenArt;
  pfad: string[];
  frage: string;
  antwort: string;
  quellen?: string[];
}

export interface KartenVorschlag {
  vorschlagId: string;
  art: KartenArt;
  pfad: string[];
  frage: string;
  antwort: string;
  hinweis: string;
  quellen: string[];
  lernzweck: string;
}

export interface KartenVerbesserung {
  kartenId: string;
  frage: string;
  antwort: string;
  hinweis: string;
  grund: string;
}

export interface WiderspruchVorschlag {
  pfad: string[];
  beschreibung: string;
  aussagen: { dokument: string; aussage: string }[];
  betroffeneKartenIds: string[];
}

export interface KartenErgebnis {
  neueKarten: KartenVorschlag[];
  verbesserungen: KartenVerbesserung[];
  widersprueche: WiderspruchVorschlag[];
}

export interface PruefUrteil {
  id: string;
  urteil: "speichern" | "korrigieren" | "pruefen" | "verwerfen";
  grund: string;
  frage: string;
  antwort: string;
  hinweis: string;
  pfad: string[];
}
