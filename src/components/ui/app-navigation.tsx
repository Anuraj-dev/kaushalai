"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const officialStorageKey = "kaushal-active-official";

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [officialName, setOfficialName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const syncOfficial = async () => {
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
        } else if (!cancelled) {
          setOfficialName(null);
        }
      } catch {
        if (!cancelled) setOfficialName(null);
      }
    };
    void syncOfficial();
    const handleStorage = () => void syncOfficial();
    window.addEventListener("kaushal-assessment-started", syncOfficial);
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("kaushal-assessment-started", syncOfficial);
      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname]);

  function logout() {
    window.localStorage.removeItem("kaushal-active-assessment");
    window.localStorage.removeItem(officialStorageKey);
    window.dispatchEvent(new Event("kaushal-assessment-started"));
    setOfficialName(null);
    // Avoid staying on protected workspace after logout
    if (pathname?.startsWith("/learner")) {
      router.push("/learner/login");
    } else {
      router.refresh();
    }
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
        {officialName ? <>
          <Link href="/learner" className="nav-profile" aria-label={`Go to workspace, signed in as ${officialName}`}>
            <span className="nav-profile-status" aria-hidden="true" />
            <span><small>Signed in as</small><strong>{officialName}</strong></span>
          </Link>
          <Button asChild size="sm" variant="secondary"><Link href="/learner">Go to workspace</Link></Button>
          <Button className="nav-logout" size="sm" variant="secondary" onClick={logout}>Log out</Button>
        </> : <Button asChild className="nav-cta" size="sm" variant="primary"><Link href="/learner/login">Start assessment <span aria-hidden="true">→</span></Link></Button>}
      </div>
    </header>
  );
}
