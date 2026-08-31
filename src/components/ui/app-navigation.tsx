"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const officialStorageKey = "kaushal-active-official";

export function AppNavigation() {
  const pathname = usePathname();
  const [officialName, setOfficialName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const syncOfficial = async () => {
      if (pathname !== "/learner") {
        setOfficialName(null);
        return;
      }
      try {
        const savedOfficial = window.localStorage.getItem(officialStorageKey);
        if (savedOfficial) {
          if (!cancelled) setOfficialName(JSON.parse(savedOfficial).name ?? null);
          return;
        }
        const assessmentId = window.localStorage.getItem("kaushal-active-assessment");
        if (!assessmentId) {
          if (!cancelled) setOfficialName(null);
          return;
        }
        const response = await fetch(`/api/learner/session?assessmentId=${encodeURIComponent(assessmentId)}`);
        if (!response.ok) throw new Error("Unable to restore assessment");
        const session = await response.json();
        if (!cancelled && session.official?.name) {
          setOfficialName(session.official.name);
          window.localStorage.setItem(officialStorageKey, JSON.stringify({ name: session.official.name }));
        }
      } catch {
        if (!cancelled) setOfficialName(null);
      }
    };
    void syncOfficial();
    window.addEventListener("kaushal-assessment-started", syncOfficial);
    return () => {
      cancelled = true;
      window.removeEventListener("kaushal-assessment-started", syncOfficial);
    };
  }, [pathname]);

  function logout() {
    window.localStorage.removeItem("kaushal-active-assessment");
    window.localStorage.removeItem(officialStorageKey);
    window.location.reload();
  }

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
        {officialName ? <><div className="nav-profile"><span className="nav-profile-status" aria-hidden="true" /><span><small>Signed in as</small><strong>{officialName}</strong></span></div><Button className="nav-logout" size="sm" variant="secondary" onClick={logout}>Log out</Button></> : <Button asChild className="nav-cta" size="sm" variant="primary"><Link href="/learner">Start assessment <span aria-hidden="true">→</span></Link></Button>}
      </div>
    </header>
  );
}
