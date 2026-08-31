"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <Button asChild className="nav-cta" size="sm" variant="primary">
          <Link href="/learner">
            Start assessment <span aria-hidden="true">→</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
