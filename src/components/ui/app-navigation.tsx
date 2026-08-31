"use client";

import Link from "next/link";

export function AppNavigation() {
  return (
    <header className="site-nav">
      <Link className="brand" href="/" aria-label="Kaushal AI home">
        <span className="brand-mark" aria-hidden="true">
          <span />
        </span>
        <span className="brand-copy">
          <strong>Kaushal AI</strong>
        </span>
      </Link>
      <div className="nav-actions">
        <Link className="nav-cta" href="/learner">
          Start assessment <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
