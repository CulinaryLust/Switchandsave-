import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Switchandsave: jedes Jahr automatisch günstiger Strom und Gas",
  description: "Kostenloser Wechselservice für Strom und Gas. Wir vergleichen jedes Jahr und wechseln für Sie.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="logo">
              Switch<span>and</span>save
            </Link>
            <nav className="nav">
              <Link href="/#so-funktionierts">So funktioniert&apos;s</Link>
              <Link href="/#transparenz">Transparenz</Link>
              <Link href="/vergleich">Jetzt vergleichen</Link>
            </nav>
          </div>
        </header>
        <main>
          <div className="container">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="container">
            <Link href="/rechtliches#impressum">Impressum</Link>
            <Link href="/rechtliches#datenschutz">Datenschutz</Link>
            <Link href="/rechtliches#agb">AGB</Link>
            <Link href="/rechtliches#bildnachweise">Bildnachweise</Link>
            <p>MVP mit Demo-Tarifdaten. Keine echten Vertragsabschlüsse.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
