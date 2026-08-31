"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <Button asChild className="nav-cta" size="sm" variant="primary">
          <Link href="/learner">
            Start assessment <span aria-hidden="true">→</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
