"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNavigation() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isLearner = pathname.startsWith("/learner");

  return <header className={`site-nav ${isAdmin ? "site-nav-admin" : ""}`}>
    <Link className="brand" href="/" aria-label="Kaushal AI home"><span className="brand-mark" aria-hidden="true"><span/></span><span className="brand-copy"><strong>Kaushal AI</strong><small>{isAdmin ? "Administrator workspace" : isLearner ? "Official workspace" : "Competency practice"}</small></span></Link>
    <nav className="main-nav" aria-label="Primary">
      {isAdmin ? <><Link href="/admin">Role matrices</Link><Link href="/admin/officials">Officials</Link><Link href="/admin/analytics">Analytics</Link></> : isLearner ? <><Link href="/learner">Assessment</Link><Link href="/">About Kaushal AI</Link></> : <><Link href="/learner">Official workspace</Link><Link href="/admin">Administrator workspace</Link></>}
    </nav>
    <div className="nav-actions">
      <span className="demo-badge"><span className="status-dot"/> {isAdmin ? "Admin demo" : "Demo mode"}</span>
      {isAdmin ? <Link className="nav-cta nav-cta-secondary" href="/">Exit admin</Link> : <Link className="nav-cta" href="/learner">{isLearner ? "Assessment home" : "Start assessment"} <span aria-hidden="true">→</span></Link>}
    </div>
  </header>;
}
