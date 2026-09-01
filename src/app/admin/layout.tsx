"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSubnav } from "@/components/admin/admin-subnav";

const adminSessionKey = "kaushal-admin-session";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "authed" | "redirecting">("checking");

  const isLoginRoute = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginRoute) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- admin guard hydrates from localStorage
      setStatus("authed");
      return;
    }

    const checkSession = () => {
      try {
        const saved = window.localStorage.getItem(adminSessionKey);
        if (saved) {
          const parsed = JSON.parse(saved) as { name?: string; employeeCode?: string };
          if (parsed && typeof parsed === "object" && (parsed.name || parsed.employeeCode)) {
            setStatus("authed");
            return;
          }
          // Fallback: treat any non-empty saved string as authenticated
          if (saved.trim().length > 0) {
            setStatus("authed");
            return;
          }
        }
      } catch {
        // fall through to redirect
      }

      const stillMissing = !window.localStorage.getItem(adminSessionKey);
      if (stillMissing) {
        setStatus("redirecting");
        router.replace("/admin/login");
      } else {
        // Corrupted session -> clear and redirect
        window.localStorage.removeItem(adminSessionKey);
        window.dispatchEvent(new Event("kaushal-admin-signed-in"));
        setStatus("redirecting");
        router.replace("/admin/login");
      }
    };

    checkSession();

    const handle = () => checkSession();
    window.addEventListener("kaushal-admin-signed-in", handle);
    window.addEventListener("kaushal-assessment-started", handle);
    window.addEventListener("storage", handle);
    return () => {
      window.removeEventListener("kaushal-admin-signed-in", handle);
      window.removeEventListener("kaushal-assessment-started", handle);
      window.removeEventListener("storage", handle);
    };
  }, [router, isLoginRoute, pathname]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (status !== "authed") {
    return <AdminLoadingWorkspace />;
  }

  return (
    <div className="admin-shell">
      <AdminSubnav />
      <main id="main-content">{children}</main>
    </div>
  );
}

function AdminLoadingWorkspace() {
  return (
    <section className="loading-workspace" aria-busy="true" aria-live="polite">
      <div className="loading-header">
        <div>
          <span className="tag tag-lime">Administrator workspace</span>
          <h1>
            Preparing your
            <br />
            administrator workspace
          </h1>
          <p>Loading competency matrices and checking for a saved administrator session.</p>
        </div>
        <div className="loading-status">
          <span className="loading-mark" aria-hidden="true" />
          <span>Loading workspace data</span>
          <b>01</b>
        </div>
      </div>
      <div className="loading-progress" aria-hidden="true">
        <span />
      </div>
      <div className="loading-grid" aria-hidden="true">
        <div className="loading-panel loading-panel-main">
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="skeleton-list">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        </div>
        <div className="loading-panel loading-panel-side">
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-metric" />
          <div className="skeleton skeleton-metric short" />
          <div className="skeleton skeleton-copy short" />
        </div>
      </div>
    </section>
  );
}
