import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Kaushal AI", description: "Evidence-based competency assessment" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="app-frame"><aside className="side-rail"><Link className="brand" href="/"><span className="brand-mark">K</span><span>Kaushal AI<small>Competency practice</small></span></Link><nav aria-label="Primary"><Link href="/learner">Official workspace</Link><Link href="/admin">Administrator workspace</Link></nav><div className="rail-note"><span className="status-dot"/> Demo environment<br/><small>Seeded public-sector data</small></div></aside><div className="content-frame">{children}</div></div></body></html>;
}
