"use client";

import { useState } from "react";
import { PAKETE, paketLaden } from "@/lib/kartenpaket";

export function Kartenpakete() {
  const [status, setStatus] = useState<string>("");
  const [laeuft, setLaeuft] = useState(false);

  async function laden(datei: string) {
    setLaeuft(true);
    try {
      const n = await paketLaden(datei);
      setStatus(`${n} Karten hinzugefügt.`);
    } catch {
      setStatus("Das hat leider nicht geklappt. Bitte prüfe deine Internetverbindung.");
    }
    setLaeuft(false);
  }

  return (
    <div style={{ marginTop: 16 }}>
      {PAKETE.map((p) => (
        <button key={p.datei} className="knopf haupt gross" disabled={laeuft} onClick={() => laden(p.datei)}>
          ✨ Fertige Karten hinzufügen: {p.titel} ({p.anzahl})
        </button>
      ))}
      {status && <p className="leise" style={{ marginTop: 12 }}>{status}</p>}
    </div>
  );
}
