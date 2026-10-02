import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { BASIS } from "@/lib/basis";
import { DienstStarten } from "@/components/DienstStarten";

export const metadata: Metadata = {
  title: "Mathe lernen – Karteikarten",
  description: "Aus deinen Lernmaterialien entstehen durchdachte Mathe-Karteikarten.",
  manifest: `${BASIS}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Mathe", statusBarStyle: "default" },
  icons: { icon: `${BASIS}/icons/icon-192.png`, apple: `${BASIS}/icons/apple-touch-icon.png` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#15171c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <DienstStarten />
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}
