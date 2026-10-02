"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { usePipeline } from "@/lib/pipeline";

export function Navigation() {
  const pfad = usePathname();
  const pipeline = usePipeline();
  const zuPruefen = useLiveQuery(async () => {
    const karten = await db.karten.where("status").equals("pruefen").count();
    const w = (await db.widersprueche.toArray()).filter((x) => !x.erledigt).length;
    return karten + w;
  }, []);

  const links = [
    { href: "/", text: "Übersicht", icon: "🏠" },
    { href: "/lernen", text: "Lernen", icon: "🎓" },
    { href: "/material", text: "Material", icon: "📄" },
    { href: "/pruefen", text: "Zu prüfen", icon: "🔍", zahl: zuPruefen },
    { href: "/export", text: "Export", icon: "📤" },
    { href: "/einstellungen", text: "Einstellungen", icon: "⚙️" },
  ];
  const aktiv = (href: string) => (href === "/" ? pfad === "/" || pfad.startsWith("/thema") : pfad.startsWith(href));

  return (
    <header className="kopfleiste">
      <div className="kopfleiste-innen">
        <Link href="/" className="logo">
          <span className="logo-zeichen">∫</span>
          <span>Mathe lernen</span>
        </Link>
        <nav className="navigation">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={aktiv(l.href) ? "aktiv" : ""}>
              <span className="nav-symbol" aria-hidden>{l.icon}</span>
              <span className="nav-text">{l.text}</span>
              {l.zahl ? <span className="zaehler">{l.zahl}</span> : null}
            </Link>
          ))}
        </nav>
        {pipeline.laeuft && !pfad.startsWith("/material") && (
          <Link href="/material" className="hintergrund-hinweis">
            <span className="dreher" /> Karten werden erstellt
          </Link>
        )}
      </div>
    </header>
  );
}
