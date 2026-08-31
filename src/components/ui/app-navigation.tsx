"use client";

import Link from "next/link";

export function AppNavigation() {
  return (
    <header className="site-nav">
      <Link className="brand" href="/" aria-label="Kaushal AI home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kaushal-logo.svg" alt="" aria-hidden="true" width={28} height={30} className="brand-mark-img" />
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
