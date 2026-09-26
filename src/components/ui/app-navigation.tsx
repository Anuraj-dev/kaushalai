"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const officialStorageKey = "kaushal-active-official";
const adminSessionKey = "kaushal-admin-session";

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [officialName, setOfficialName] = useState<string | null>(null);
  const [officialRole, setOfficialRole] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Close the compact mobile menu on navigation and on any click outside it.
  useEffect(() => {
    menuRef.current?.removeAttribute("open");
  }, [pathname]);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.removeAttribute("open");
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncOfficial = async () => {
      try {
        const savedOfficial = window.localStorage.getItem(officialStorageKey);
        if (savedOfficial) {
          const parsed = JSON.parse(savedOfficial) as { name?: string; role?: string };
          if (parsed.name && parsed.role) {
            if (!cancelled) {
              setOfficialName(parsed.name);
              setOfficialRole(parsed.role);
            }
            return;
          }
        }
        const assessmentId = window.localStorage.getItem("kaushal-active-assessment");
        if (!assessmentId) {
          if (!cancelled) {
            setOfficialName(null);
            setOfficialRole(null);
          }
          return;
        }
        const response = await fetch(`/api/learner/session?assessmentId=${encodeURIComponent(assessmentId)}`);
        if (!response.ok) throw new Error("Unable to restore assessment");
        const session = await response.json();
        if (!cancelled && session.official?.name) {
          setOfficialName(session.official.name);
          setOfficialRole(session.official.jobRoleName ?? "Official");
          window.localStorage.setItem(officialStorageKey, JSON.stringify({ name: session.official.name, role: session.official.jobRoleName ?? "Official" }));
        } else if (!cancelled) {
          setOfficialName(null);
          setOfficialRole(null);
        }
      } catch {
        if (!cancelled) {
          setOfficialName(null);
          setOfficialRole(null);
        }
      }
    };
    void syncOfficial();
    const handleStorage = () => void syncOfficial();
    window.addEventListener("kaushal-assessment-started", syncOfficial);
    window.addEventListener("kaushal-admin-signed-in", syncOfficial);
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("kaushal-assessment-started", syncOfficial);
      window.removeEventListener("kaushal-admin-signed-in", syncOfficial);
      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname]);

  useEffect(() => {
    const syncAdmin = () => {
      try {
        const savedAdmin = window.localStorage.getItem(adminSessionKey);
        if (!savedAdmin) {
          setAdminName(null);
          return;
        }
        const parsed = JSON.parse(savedAdmin) as { name?: string };
        if (parsed?.name) setAdminName(parsed.name);
        else setAdminName("Administrator");
      } catch {
        setAdminName(null);
      }
    };
    syncAdmin();
    const handleAdmin = () => syncAdmin();
    window.addEventListener("kaushal-admin-signed-in", handleAdmin);
    window.addEventListener("kaushal-assessment-started", handleAdmin);
    window.addEventListener("storage", handleAdmin);
    return () => {
      window.removeEventListener("kaushal-admin-signed-in", handleAdmin);
      window.removeEventListener("kaushal-assessment-started", handleAdmin);
      window.removeEventListener("storage", handleAdmin);
    };
  }, [pathname]);

  function logout() {
    window.localStorage.removeItem("kaushal-active-assessment");
    window.localStorage.removeItem(officialStorageKey);
    window.localStorage.removeItem(adminSessionKey);
    window.dispatchEvent(new Event("kaushal-assessment-started"));
    window.dispatchEvent(new Event("kaushal-admin-signed-in"));
    setOfficialName(null);
    setOfficialRole(null);
    setAdminName(null);
    // Avoid staying on protected workspace after logout
    if (pathname?.startsWith("/admin")) {
      router.push("/admin/login");
    } else if (pathname?.startsWith("/learner")) {
      router.push("/learner/login");
    } else {
      router.refresh();
    }
  }

  // Show the identity for the area being viewed: both sessions can exist in one browser.
  const inAdmin = pathname?.startsWith("/admin") ?? false;
  const inLearner = pathname?.startsWith("/learner") ?? false;
  const identity =
    adminName && !inLearner
      ? { name: adminName, role: "Administrator", links: [{ href: "/admin", label: "Administrator workspace" }] }
      : officialName && !inAdmin
        ? {
            name: officialName,
            role: officialRole ?? "Official",
            links: [
              { href: "/learner/plan", label: "Learning plan" },
              { href: "/learner/profile", label: "Assessment result" },
            ],
          }
        : null;
  const initials = identity
    ? identity.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join("")
    : "";

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
        {identity ? (
          <>
            <Link href={identity.links[0]!.href} className="nav-profile" aria-label={`Go to workspace, signed in as ${identity.name}, ${identity.role}`}>
              <span className="nav-profile-status" aria-hidden="true" />
              <span>
                <strong>{identity.name}</strong>
                <small>{identity.role}</small>
              </span>
            </Link>
            <Button className="nav-logout" size="sm" variant="secondary" onClick={logout}>
              Log out
            </Button>
            <details className="nav-menu" ref={menuRef}>
              <summary className="nav-menu-trigger" aria-label={`Account menu for ${identity.name}`}>
                <span className="nav-menu-initials" aria-hidden="true">{initials}</span>
              </summary>
              <div className="nav-menu-panel">
                <div className="nav-menu-identity">
                  <strong>{identity.name}</strong>
                  <small>{identity.role}</small>
                </div>
                {identity.links.map((link) => (
                  <Link key={link.href} href={link.href} className="nav-menu-link" aria-current={pathname === link.href ? "page" : undefined}>
                    {link.label}
                  </Link>
                ))}
                <Button className="nav-menu-logout" size="sm" variant="secondary" onClick={logout}>
                  Log out
                </Button>
              </div>
            </details>
          </>
        ) : inAdmin ? null : (
          <Button asChild className="nav-cta" size="sm" variant="primary">
            <Link href="/learner/login">
              Start assessment <span aria-hidden="true">→</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
