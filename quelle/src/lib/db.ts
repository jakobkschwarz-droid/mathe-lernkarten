"use client";

import Dexie, { type EntityTable } from "dexie";
import type { Karte, Material, VerlaufEintrag, Widerspruch } from "./types";

// Alle Daten liegen dauerhaft im Browser (IndexedDB) auf dem eigenen Gerät.
export class LernDatenbank extends Dexie {
  materialien!: EntityTable<Material, "id">;
  karten!: EntityTable<Karte, "id">;
  verlauf!: EntityTable<VerlaufEintrag, "id">;
  widersprueche!: EntityTable<Widerspruch, "id">;

  constructor() {
    super("mathe-lernkarten");
    this.version(1).stores({
      materialien: "id, hash, status, hinzugefuegt",
      karten: "id, status, bereich, faellig",
      verlauf: "++id, kartenId, zeit",
      widersprueche: "id, erledigt",
    });
  }
}

export const db = new LernDatenbank();

export function neueId(): string {
  return crypto.randomUUID();
}
