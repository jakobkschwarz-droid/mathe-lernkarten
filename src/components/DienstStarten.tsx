"use client";

import { useEffect } from "react";

export function DienstStarten() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`).catch(() => {});
    }
    // Browser soll die Daten nicht von selbst aufräumen
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  return null;
}
