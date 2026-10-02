import type { NextConfig } from "next";

// Reine Web-Seite ohne eigenen Server (läuft z. B. auf GitHub Pages).
// Liegt die Seite in einem Unterordner (…github.io/mathe-lernkarten), wird er
// beim Bauen über NEXT_PUBLIC_BASE_PATH angegeben.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
